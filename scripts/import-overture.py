"""Importe les lieux de restauration de Toulouse Métropole depuis Overture Maps (open data, CDLA Permissive 2.0).

Usage : pip install duckdb && python scripts/import-overture.py [release]
Sortie : data/raw/overture.json (puis `npm run build:places`)
Lecture directe des fichiers Parquet sur S3 : aucun téléchargement complet, seule la boîte englobante est lue.
"""
import json
import os
import sys

import duckdb

RELEASE = sys.argv[1] if len(sys.argv) > 1 else "2026-10-21.0"
BBOX = (1.28, 43.48, 1.64, 43.73)  # xmin, ymin, xmax, ymax = Toulouse Métropole
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "overture.json")

con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
path = f"s3://overturemaps-us-west-2/release/{RELEASE}/theme=places/type=place/*"

cur = con.execute(
    f"""
SELECT id, names.primary AS name, taxonomy.primary AS cat, array_to_string(taxonomy.hierarchy, '>') AS hier,
       confidence, operating_status AS status,
       addresses[1].freeform AS street, addresses[1].locality AS city, addresses[1].postcode AS pc,
       websites[1] AS web, phones[1] AS tel,
       bbox.xmin AS lng, bbox.ymin AS lat
FROM read_parquet('{path}', hive_partitioning=1)
WHERE bbox.xmin BETWEEN {BBOX[0]} AND {BBOX[2]} AND bbox.ymin BETWEEN {BBOX[1]} AND {BBOX[3]}
  AND array_to_string(taxonomy.hierarchy, '>') LIKE 'food_and_drink%'
"""
)
cols = [c[0] for c in cur.description]
rows = [dict(zip(cols, r)) for r in cur.fetchall()]

out = []
for r in rows:
    if not r["name"] or r["status"] == "permanently_closed" or (r["confidence"] or 0) < 0.5:
        continue
    address = ", ".join(x for x in (r["street"], r["pc"], r["city"]) if x)
    out.append(
        {
            "id": r["id"],
            "n": r["name"],
            "cat": r["cat"],
            "la": round(r["lat"], 6),
            "ln": round(r["lng"], 6),
            "a": address,
            "w": r["web"] or "",
            "t": r["tel"] or "",
            "cf": round(r["confidence"] or 0, 2),
        }
    )

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(f"{len(out)} lieux écrits (sur {len(rows)} lignes, release {RELEASE})")

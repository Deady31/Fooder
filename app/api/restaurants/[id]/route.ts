import { NextRequest, NextResponse } from 'next/server';
import records from '../../../../data/toulouse-places.json';
import { cuisineLabel, OsmRecord } from '../../../../lib/osm';
import { isSharable } from '../../../../lib/restoShare';

export const dynamic = 'force-dynamic';

// Index construit une fois par instance : l'énorme JSON reste côté serveur, le client ne reçoit que {id, name, cuisine}.
const BY_ID = new Map((records as OsmRecord[]).map(r => [r.id, r]));

const MAX_ID_LENGTH = 80;
const MAX_PER_MINUTE = 60;
const MAX_TRACKED_IPS = 5000;

// Limiteur simple en mémoire (par instance), purgé pour ne pas grossir sans fin.
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  if (hits.size > MAX_TRACKED_IPS) {
    hits.forEach((v, k) => {
      if (now - v.t > 60_000) hits.delete(k);
    });
    if (hits.size > MAX_TRACKED_IPS) hits.clear();
  }
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n += 1;
  return h.n > MAX_PER_MINUTE;
}

/** Nom et cuisine d'une fiche (préremplissage « Propose la vraie photo »). L'id vient de l'URL : il est validé strictement. */
export function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (limited(ip)) return NextResponse.json({ success: false, error: 'Trop de requêtes' }, { status: 429 });

  const id = params.id;
  if (typeof id !== 'string' || id.length > MAX_ID_LENGTH || !isSharable(id)) {
    return NextResponse.json({ success: false, error: 'Identifiant invalide' }, { status: 400 });
  }
  const rec = BY_ID.get(id);
  if (!rec) return NextResponse.json({ success: false, error: 'Restaurant introuvable' }, { status: 404 });

  return NextResponse.json(
    { success: true, data: { id: rec.id, name: rec.n, cuisine: cuisineLabel(rec) } },
    { headers: { 'Cache-Control': 'public, s-maxage=3600' } }
  );
}

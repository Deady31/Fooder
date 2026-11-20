import { NextRequest, NextResponse } from 'next/server';
import records from '../../../../data/toulouse-places.json';
import { cuisineLabel, OsmRecord } from '../../../../lib/osm';
import { verifiedAddress } from '../../../../lib/addresses';
import { quartierAt } from '../../../../lib/quartiersGeo';

export const dynamic = 'force-dynamic';

const ALL = records as OsmRecord[];
const KINDS = new Set(['restaurant', 'fast_food', 'cafe', 'bar', 'pub', 'ice_cream']);

const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// Index pré-calculé une fois par instance
const INDEX = ALL.filter(r => KINDS.has(r.k)).map(r => ({ r, key: fold(r.n) }));

export function GET(req: NextRequest) {
  const q = fold(req.nextUrl.searchParams.get('q') ?? '').slice(0, 60);
  if (q.length < 2) return NextResponse.json({ success: true, data: [] });

  const seen = new Set<string>();
  const hits = INDEX.filter(x => x.key.includes(q))
    .sort((a, b) => Number(b.key.startsWith(q)) - Number(a.key.startsWith(q)) || a.key.length - b.key.length)
    .map(({ r }) => {
      const place = quartierAt(r.la, r.ln);
      return { id: r.id, name: r.n, cuisine: `${cuisineLabel(r)}${place ? ` · ${place}` : ''}`, address: verifiedAddress(r.id) ?? '', dedupe: `${fold(r.n)}|${place ?? r.id}` };
    })
    .filter(h => (seen.has(h.dedupe) ? false : (seen.add(h.dedupe), true)))
    .slice(0, 8)
    .map(({ dedupe: _d, ...h }) => h);

  return NextResponse.json({ success: true, data: hits }, { headers: { 'Cache-Control': 'public, s-maxage=600' } });
}

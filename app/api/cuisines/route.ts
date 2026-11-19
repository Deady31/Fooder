import { NextResponse } from 'next/server';
import records from '../../../data/toulouse-places.json';
import { cuisineLabel, isPresentable, OsmRecord } from '../../../lib/osm';

export const dynamic = 'force-static';

/** Catégories de cuisine réellement présentes dans les données, avec le nombre de fiches (pour la recherche des filtres). */
const COUNTS = (() => {
  const m = new Map<string, number>();
  for (const r of records as OsmRecord[]) {
    if (!isPresentable(r) || !['restaurant', 'fast_food'].includes(r.k)) continue;
    const l = cuisineLabel(r);
    m.set(l, (m.get(l) ?? 0) + 1);
  }
  return Array.from(m, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
})();

export function GET() {
  return NextResponse.json(
    { success: true, data: COUNTS },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } }
  );
}

import { NextRequest, NextResponse } from 'next/server';
import records from '../../../data/toulouse-places.json';
import { completeness, formatMeters, haversine, isPresentable, OsmRecord, osmToRestaurant } from '../../../lib/osm';

export const dynamic = 'force-dynamic';

const TOULOUSE = { lat: 43.6045, lng: 1.4442 };
const MAX_LIMIT = 50;
const MAX_RADIUS = 20000;
// Seules les fiches présentables (cuisine connue + horaires lisibles) sont proposées.
const ALL = (records as OsmRecord[]).filter(isPresentable);

// Limiteur simple en mémoire (par instance). En prod : Upstash/Redis ou Vercel Firewall.
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n += 1;
  return h.n > 60;
}

/** Coordonnées arrondies à 3 décimales (~100 m) : moins de données personnelles, meilleur cache. */
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

const num = (v: string | null, fallback: number, min: number, max: number): number => {
  if (v === null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (limited(ip)) {
    return NextResponse.json({ success: false, error: 'Trop de requêtes' }, { status: 429 });
  }

  const p = req.nextUrl.searchParams;
  const lat = round3(num(p.get('lat'), TOULOUSE.lat, -90, 90));
  const lng = round3(num(p.get('lng'), TOULOUSE.lng, -180, 180));
  const radius = num(p.get('radius'), 3000, 100, MAX_RADIUS);
  const limit = num(p.get('limit'), 20, 1, MAX_LIMIT);
  const offset = num(p.get('offset'), 0, 0, 100_000);
  const kinds = new Set((p.get('kinds') ?? 'restaurant,fast_food').split(',').map(s => s.trim()));

  const near = ALL.filter(r => kinds.has(r.k))
    .map(r => ({ r, d: haversine(lat, lng, r.la, r.ln) }))
    .filter(x => x.d <= radius)
    .sort((a, b) => a.d - b.d - (completeness(a.r) - completeness(b.r)) * 150);

  // Sans origine dans osmToRestaurant : la description ne dit pas « à X de toi » (le client recalcule
  // la distance depuis la vraie position, celle-ci n'est qu'indicative et part d'une origine arrondie).
  const page = near.slice(offset, offset + limit).map(x => ({
    ...osmToRestaurant(x.r),
    distance: formatMeters(x.d),
    distanceMeters: Math.round(x.d),
  }));

  return NextResponse.json(
    { success: true, data: page, meta: { total: near.length, offset, limit } },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  );
}

import { NextRequest, NextResponse } from 'next/server';
import records from '../../../data/toulouse-osm.json';
import { haversine, OsmRecord, osmToRestaurant } from '../../../lib/osm';

export const dynamic = 'force-dynamic';

const TOULOUSE = { lat: 43.6045, lng: 1.4442 };
const MAX_LIMIT = 50;
const MAX_RADIUS = 20000;
const ALL = records as OsmRecord[];

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
  const lat = num(p.get('lat'), TOULOUSE.lat, -90, 90);
  const lng = num(p.get('lng'), TOULOUSE.lng, -180, 180);
  const radius = num(p.get('radius'), 3000, 100, MAX_RADIUS);
  const limit = num(p.get('limit'), 20, 1, MAX_LIMIT);
  const offset = num(p.get('offset'), 0, 0, 100_000);
  const kinds = new Set((p.get('kinds') ?? 'restaurant,fast_food').split(',').map(s => s.trim()));

  const near = ALL.filter(r => kinds.has(r.k))
    .map(r => ({ r, d: haversine(lat, lng, r.la, r.ln) }))
    .filter(x => x.d <= radius)
    .sort((a, b) => a.d - b.d);

  const page = near.slice(offset, offset + limit).map(x => osmToRestaurant(x.r, { lat, lng }));

  return NextResponse.json(
    { success: true, data: page, meta: { total: near.length, offset, limit } },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  );
}

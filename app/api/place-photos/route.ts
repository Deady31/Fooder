import { NextRequest, NextResponse } from 'next/server';
import { fetchPlacePhoto } from '../../../lib/google/placePhotos';
import { createDailyCounter, parseDailyCap } from '../../../lib/google/dailyCap';
import { PLACE_ID_RE } from '../../../lib/google/placeIdCache';

export const dynamic = 'force-dynamic';

const KEY = process.env.GOOGLE_PLACES_API_KEY ?? '';
const VERIFY_NAME = process.env.GOOGLE_PHOTOS_VERIFY_NAME === '1';
// Plafond d'appels payants (média) par jour de Paris. Compteur en mémoire de l'instance : approximatif en serverless
// multi-instances ; le vrai plafond sûr est le quota journalier de la console Google.
const counter = createDailyCounter(parseDailyCap(process.env.GOOGLE_PHOTOS_DAILY_CAP));
// Zone d'activité : Toulouse et alentours seulement
const BOX = { minLat: 43.3, maxLat: 43.9, minLng: 1.0, maxLng: 1.9 };

const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n += 1;
  return h.n > 40;
}

const num = (v: string | null, min: number, max: number): number | null => {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ success: true, data: [], reason: 'disabled' }, { headers: NO_STORE });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (limited(ip)) return NextResponse.json({ success: false, error: 'Trop de requêtes' }, { status: 429 });

  const p = req.nextUrl.searchParams;
  const name = (p.get('name') ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80);
  const lat = num(p.get('lat'), BOX.minLat, BOX.maxLat);
  const lng = num(p.get('lng'), BOX.minLng, BOX.maxLng);
  if (!name || lat === null || lng === null) return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 });
  const rawPlaceId = p.get('placeId') ?? '';
  const placeId = PLACE_ID_RE.test(rawPlaceId) ? rawPlaceId : undefined;

  // Plafond déjà atteint : on n'appelle même pas Google.
  if (counter.isExhausted(new Date())) return NextResponse.json({ success: true, data: [], reason: 'budget' }, { headers: NO_STORE });

  const out = await fetchPlacePhoto({ name, lat, lng }, KEY, {
    placeId,
    verifyName: VERIFY_NAME,
    allowPaidCall: () => counter.tryConsume(new Date()),
  });

  if (out.status === 'ok') {
    // Cache navigateur privé et court (l'URL de Google est temporaire) ; jamais de stockage partagé.
    return NextResponse.json({ success: true, data: [out.photo], placeId: out.placeId }, { headers: { 'Cache-Control': 'private, max-age=300' } });
  }
  if (out.status === 'budget') return NextResponse.json({ success: true, data: [], reason: 'budget', placeId: out.placeId }, { headers: NO_STORE });
  return NextResponse.json({ success: true, data: [], reason: 'none', placeId: out.placeId }, { headers: NO_STORE });
}

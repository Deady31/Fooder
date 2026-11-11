import { NextRequest, NextResponse } from 'next/server';
import { fetchPlacePhotos, PlacePhoto } from '../../../lib/google/placePhotos';

export const dynamic = 'force-dynamic';

const KEY = process.env.GOOGLE_PLACES_API_KEY ?? '';
// Garde-fou de dépense : au-delà, on n'appelle plus Google jusqu'au lendemain (compteur par instance serveur).
const DAILY_CAP = Number(process.env.GOOGLE_PHOTOS_DAILY_CAP ?? 1500);
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

let day = '';
let spent = 0;
function overBudget(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    spent = 0;
  }
  return spent >= DAILY_CAP;
}

// Mémoire courte : évite de repayer Google pour le même resto pendant une session.
const memo = new Map<string, { at: number; photos: PlacePhoto[] }>();
const MEMO_MS = 30 * 60_000;
const MEMO_MAX = 500;

const num = (v: string | null, min: number, max: number): number | null => {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ success: true, data: [], reason: 'disabled' });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (limited(ip)) return NextResponse.json({ success: false, error: 'Trop de requêtes' }, { status: 429 });

  const p = req.nextUrl.searchParams;
  const name = (p.get('name') ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80);
  const lat = num(p.get('lat'), BOX.minLat, BOX.maxLat);
  const lng = num(p.get('lng'), BOX.minLng, BOX.maxLng);
  if (!name || lat === null || lng === null) return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 });

  const memoKey = `${name.toLowerCase()}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
  const cached = memo.get(memoKey);
  if (cached && Date.now() - cached.at < MEMO_MS) return NextResponse.json({ success: true, data: cached.photos });

  if (overBudget()) return NextResponse.json({ success: true, data: [], reason: 'budget' });
  spent += 1;

  const photos = await fetchPlacePhotos({ name, lat, lng }, KEY);
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value as string);
  memo.set(memoKey, { at: Date.now(), photos });
  return NextResponse.json({ success: true, data: photos }, { headers: { 'Cache-Control': 'private, max-age=900' } });
}

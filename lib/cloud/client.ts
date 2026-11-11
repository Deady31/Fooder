import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase côté navigateur. Retourne null tant que les variables d'environnement
 * ne sont pas renseignées : l'appli reste alors 100 % locale (mode prototype).
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

let client: SupabaseClient | null = null;

export const isCloudEnabled = (): boolean => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(URL_) && ANON.length > 20;

export function cloud(): SupabaseClient | null {
  if (typeof window === 'undefined' || !isCloudEnabled()) return null;
  if (!client) {
    client = createClient(URL_, ANON, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'fooder_auth' },
    });
  }
  return client;
}

export async function currentUserId(): Promise<string | null> {
  const sb = cloud();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

export const PHOTO_BUCKET = 'photos';

export function photoUrl(path: string): string {
  return `${URL_}/storage/v1/object/public/${PHOTO_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

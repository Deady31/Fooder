import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase côté navigateur. Retourne null tant que les variables d'environnement
 * ne sont pas renseignées : l'appli reste alors 100 % locale (mode prototype).
 *
 * La bibliothèque @supabase/supabase-js n'est PAS dans le bundle initial : elle est chargée à la demande
 * (loadCloud) dès que le cloud est activé. cloud() reste synchrone mais ne renvoie le client qu'une fois chargé.
 */
// Interrupteur de test : NEXT_PUBLIC_DISABLE_CLOUD=1 coupe tout le cloud, même si .env.local contient les clés
// (vider les variables en ligne de commande ne suffit pas : Next relit .env.local). À utiliser pour tester en local
// sans créer d'utilisateurs ni d'événements dans la vraie base.
const CLOUD_OFF = process.env.NEXT_PUBLIC_DISABLE_CLOUD === '1';
const URL_ = CLOUD_OFF ? '' : process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON = CLOUD_OFF ? '' : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

let client: SupabaseClient | null = null;
let loading: Promise<SupabaseClient | null> | null = null;

export const isCloudEnabled = (): boolean => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(URL_) && ANON.length > 20;

/** Charge (une seule fois) la bibliothèque Supabase et crée le client. Null si le cloud est coupé ou hors navigateur. */
export function loadCloud(): Promise<SupabaseClient | null> {
  if (typeof window === 'undefined' || !isCloudEnabled()) return Promise.resolve(null);
  if (client) return Promise.resolve(client);
  if (!loading) {
    loading = import('@supabase/supabase-js')
      .then(({ createClient }) => {
        client = createClient(URL_, ANON, {
          auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'fooder_auth' },
        });
        return client;
      })
      .catch(() => {
        loading = null; // nouvel essai possible (réseau coupé pendant le chargement)
        return null;
      });
  }
  return loading;
}

/** Client déjà chargé, sinon null. Préférer `await loadCloud()` dans le code asynchrone. */
export function cloud(): SupabaseClient | null {
  return client;
}

export async function currentUserId(): Promise<string | null> {
  const sb = await loadCloud();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

export const PHOTO_BUCKET = 'photos';

export function photoUrl(path: string): string {
  return `${URL_}/storage/v1/object/public/${PHOTO_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

import { track } from './analytics';
import { getMe } from './identity';
import { ShareOutcome, shareLink } from './share';

/** Clé du parrain reçu par lien (localStorage ET sessionStorage). Lue plus tard par l'onboarding. */
export const REF_KEY = 'fooder_ref';
const FALLBACK_ORIGIN = 'https://fooder-tawny.vercel.app';

export interface RefStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Un code d'ami valide : 12 caractères hexadécimaux minuscules. */
export function isValidRef(code: unknown): code is string {
  return typeof code === 'string' && /^[a-f0-9]{12}$/.test(code);
}

export function inviteUrl(origin: string, code?: string | null): string {
  const base = origin.replace(/\/+$/, '');
  return isValidRef(code) ? `${base}/?ref=${code}` : `${base}/`;
}

export function inviteText(): string {
  return 'Rejoins-moi sur Fooder : on swipe les restos de Toulouse et on compare nos goûts. Tu viens ?';
}

export function whatsappUrl(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
}

/** « a1b2c3d4e5f6 » devient « A1B2-C3D4-E5F6 » (affichage seulement). */
export function formatCode(code?: string | null): string {
  if (!isValidRef(code)) return '';
  return (code.toUpperCase().match(/.{4}/g) ?? []).join('-');
}

export function parseRefFromSearch(search: string): string | null {
  const v = new URLSearchParams(search).get('ref');
  return isValidRef(v) ? v : null;
}

function safeGet(store: RefStore, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

/** Ref enregistré (premier stockage qui en contient un valide). */
export function readRef(stores: RefStore[] = browserStores()): string | null {
  for (const s of stores) {
    const v = safeGet(s, REF_KEY);
    if (isValidRef(v)) return v;
  }
  return null;
}

/**
 * Mémorise le ?ref= reçu. N'écrase jamais un ref déjà enregistré ; ignore son propre code.
 * Retourne le ref nouvellement enregistré, sinon null.
 */
export function captureRef(search: string, stores: RefStore[] = browserStores(), ownCode?: string | null): string | null {
  const ref = parseRefFromSearch(search);
  if (!ref || ref === ownCode) return null;
  if (readRef(stores)) return null;
  for (const s of stores) {
    try {
      s.setItem(REF_KEY, ref);
    } catch {
      /* stockage indisponible */
    }
  }
  return ref;
}

function browserStores(): RefStore[] {
  const out: RefStore[] = [];
  try {
    if (typeof window !== 'undefined') out.push(window.localStorage, window.sessionStorage);
  } catch {
    /* stockage bloqué */
  }
  return out;
}

export function defaultOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : FALLBACK_ORIGIN;
}

/** Mon code d'ami (présent une fois connecté), sinon undefined. */
export function myInviteCode(): string | undefined {
  const code = getMe().code;
  return isValidRef(code) ? code : undefined;
}

export function myInviteUrl(): string {
  return inviteUrl(defaultOrigin(), myInviteCode());
}

/** Partage natif de l'invitation, copie du lien en repli. */
export async function shareInvite(code: string | undefined = myInviteCode(), origin: string = defaultOrigin()): Promise<ShareOutcome> {
  const outcome = await shareLink({ title: 'Fooder', text: inviteText(), url: inviteUrl(origin, code) });
  if (outcome === 'shared' || outcome === 'copied') track('share', { kind: 'app' });
  return outcome;
}

import { cloud } from './client';
import { SYNC_KEYS, SyncData, mergeAll } from './merge';
import { STORE_EVENT } from '../store';
import { buildMySnapshot } from '../social/friends';
import { getMe } from '../identity';
import { pickAlignedName } from './identityAlign';

/**
 * Synchronisation local ⇄ compte.
 * - À la connexion : on fusionne (rien n'est perdu), puis on pousse le résultat.
 * - Ensuite : l'appareil fait foi ; on pousse quand les données changent (toutes les 20 s au plus) et à la mise en arrière-plan.
 */

const PUSH_EVERY = 20_000;
let lastPushed = '';

export function readLocal(): SyncData {
  const out: SyncData = {};
  for (const k of SYNC_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (raw !== null) out[k] = JSON.parse(raw);
    } catch {
      /* valeur illisible : ignorée */
    }
  }
  return out;
}

function writeLocal(data: SyncData): void {
  for (const k of SYNC_KEYS) {
    if (data[k] === undefined) continue;
    try {
      localStorage.setItem(k, JSON.stringify(data[k]));
    } catch {
      /* stockage plein : on garde la version précédente */
    }
  }
  window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: 'sync' }));
}

/** Pseudo saisi à l'onboarding (null si pas encore fait ou illisible). */
function onboardedPseudo(): string | null {
  try {
    const p = JSON.parse(localStorage.getItem('fooder_profile') ?? 'null') as { pseudo?: unknown } | null;
    return p && typeof p.pseudo === 'string' && p.pseudo ? p.pseudo : null;
  } catch {
    return null;
  }
}

/** Aligne l'identité locale sur le compte (id = id du compte, pseudo et code d'ami du profil). */
async function alignIdentity(uid: string): Promise<void> {
  const sb = cloud();
  if (!sb) return;
  const { data } = await sb.from('profiles').select('name, friend_code').eq('id', uid).single();
  if (!data) return;
  const me = getMe();
  const name = pickAlignedName({ serverName: data.name, localName: me.name, onboardedPseudo: onboardedPseudo() });
  localStorage.setItem('fooder_me', JSON.stringify({ ...me, id: uid.replace(/-/g, ''), name, code: data.friend_code }));
  window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: 'fooder_me' }));
}

export async function pushNow(uid: string): Promise<boolean> {
  const sb = cloud();
  if (!sb) return false;
  const data = readLocal();
  const snap = buildMySnapshot();
  // La carte change d'horodatage à chaque calcul : on compare sans lui.
  const serialized = JSON.stringify([data, { ...snap, at: 0 }]);
  if (serialized === lastPushed) return true;
  const [state, profile] = await Promise.all([
    sb.from('user_state').upsert({ user_id: uid, data, updated_at: new Date().toISOString() }),
    sb
      .from('profiles')
      .update({ name: snap.name, avatar_id: snap.avatar.id, avatar_bg: snap.avatar.bg, card: snap, xp: snap.xp, updated_at: new Date().toISOString() })
      .eq('id', uid),
  ]);
  if (state.error || profile.error) return false;
  lastPushed = serialized;
  return true;
}

export async function pullAndMerge(uid: string): Promise<void> {
  const sb = cloud();
  if (!sb) return;
  await alignIdentity(uid);
  const { data, error } = await sb.from('user_state').select('data').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  const remote = (data?.data ?? {}) as SyncData;
  writeLocal(mergeAll(readLocal(), remote));
  lastPushed = '';
  await pushNow(uid);
}

/** Lance la synchronisation pour la session en cours. Retourne la fonction d'arrêt. */
export function startSync(uid: string, onError: (e: unknown) => void): () => void {
  let stopped = false;
  pullAndMerge(uid).catch(onError);
  const tick = () => {
    if (!stopped) pushNow(uid).catch(onError);
  };
  const timer = window.setInterval(tick, PUSH_EVERY);
  const onHide = () => document.visibilityState === 'hidden' && tick();
  document.addEventListener('visibilitychange', onHide);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onHide);
  };
}

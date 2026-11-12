import type { FeedPost } from '../feed';
import { GateResult, LOCAL_FALLBACK_MESSAGE, runWithSession } from './gate';
import { publishCloudPost } from './social';

/**
 * Publie en ligne un post que l'utilisateur vient de valider (action explicite). Le post est déjà enregistré localement :
 * un échec (session impossible, quota, réseau) ne perd rien et renvoie un message à afficher.
 */
export async function publishPostOnline(post: FeedPost): Promise<GateResult<boolean>> {
  const result = await runWithSession(uid => publishCloudPost(post, uid));
  if (result.ok && result.value === false) return { ok: false, message: LOCAL_FALLBACK_MESSAGE };
  return result;
}

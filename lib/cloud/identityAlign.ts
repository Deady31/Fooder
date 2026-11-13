/**
 * Choix du pseudo quand la session cloud apparaît (logique pure, testée dans tests/identityAlign.test.ts).
 *
 * Problème corrigé : l'onboarding écrit le pseudo choisi en local ; la session anonyme est créée ensuite et le trigger SQL
 * donne alors au profil un pseudo automatique (« foodie42 »). L'ancienne synchro écrasait le pseudo local par celui du serveur,
 * puis le poussait : le pseudo choisi était perdu. Règle : le serveur fait foi, SAUF s'il porte un pseudo automatique alors que
 * l'utilisateur en a choisi un (onboarding terminé).
 */

/** Pseudos générés automatiquement : trigger SQL « foodie » + 2 chiffres, et liste locale de lib/identity.ts. */
const AUTO_RE = /^(foodie|gourmand|croqueur|miam|papille|fourchette)\d{2}$/;

export const isAutoPseudo = (name: unknown): boolean => typeof name === 'string' && AUTO_RE.test(name);

export interface AlignInput {
  serverName: string | null | undefined;
  localName: string | null | undefined;
  /** Pseudo saisi à l'onboarding (fooder_profile.pseudo), null si l'onboarding n'est pas fait. */
  onboardedPseudo: string | null | undefined;
}

export function pickAlignedName({ serverName, localName, onboardedPseudo }: AlignInput): string {
  const local = typeof localName === 'string' ? localName.trim() : '';
  const server = typeof serverName === 'string' ? serverName.trim() : '';
  if (!server) return local;
  const userChoseOne = typeof onboardedPseudo === 'string' && onboardedPseudo.trim() !== '';
  if (isAutoPseudo(server) && userChoseOne && local && !isAutoPseudo(local)) return local;
  return server;
}

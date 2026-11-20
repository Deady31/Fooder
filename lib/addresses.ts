import verified from '../data/addresses-verified.json';

/**
 * Surcouche des adresses vérifiées, produite par scripts/verify-addresses.mjs (BAN, SIRENE, site du restaurant).
 * `data/toulouse-places.json` est généré et n'est jamais retouché à la main : l'adresse affichée vient d'ici.
 *  - av 'ok'     : adresse validée (position à 150 m ou moins de la fiche) ;
 *  - av 'approx' : adresse de repli (point le plus proche) : jamais affichée ;
 *  - av 'none'   : aucune adresse fiable.
 */
export type AddressStatus = 'ok' | 'approx' | 'none';

export interface VerifiedAddress {
  a: string | null;
  /** Quartier calculé à la construction des données (étape suivante) ; null tant qu'il n'est pas fiable. */
  q: string | null;
  av: AddressStatus;
  /** Source de l'adresse (osm+ban, overture+ban, sirene, site+ban) ou cause du refus. */
  src: string;
  /** Précision : numéro de rue, ou rue seule. */
  p?: 'numero' | 'rue' | null;
  /** Doublon d'une autre fiche (son identifiant) : non servi. */
  dup?: string;
}

const TABLE = verified as unknown as Record<string, VerifiedAddress>;

export const verifiedEntry = (id: string): VerifiedAddress | undefined => TABLE[id];

/** Adresse vérifiée à afficher, ou null. Jamais une adresse non vérifiée, jamais un repli du type « Quartier X ». */
export function verifiedAddress(id: string): string | null {
  const e = TABLE[id];
  return e && e.av === 'ok' && e.a && !e.dup ? e.a : null;
}

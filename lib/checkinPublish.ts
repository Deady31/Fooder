export interface CheckinPublishChoice {
  /** Case « Publier aussi sur le fil » (décochée par défaut). */
  publishOnline: boolean;
  /** Case de confirmation des droits sur la photo. */
  rightsConfirmed: boolean;
  hasPhoto: boolean;
  hasCaption: boolean;
}

/** Le check-in garde tout en local sauf choix explicite ; une photo exige en plus la confirmation des droits. */
export function shouldPublishOnline(c: CheckinPublishChoice): boolean {
  if (!c.publishOnline || (!c.hasPhoto && !c.hasCaption)) return false;
  return !c.hasPhoto || c.rightsConfirmed;
}

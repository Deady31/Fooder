export interface InviteInput {
  restId: string;
  /** Photos communautaires déjà connues pour ce resto. */
  communityPhotos: string[];
  /** Ids des restos pour lesquels l'utilisateur a déjà publié une photo. */
  myPostPhotoRestIds: string[];
  /** L'utilisateur vient de poster une photo dans le flux de visite. */
  postedInFlow?: boolean;
}

/** Invite à poster la vraie photo seulement s'il n'y en a aucune et que l'utilisateur n'a rien posté pour ce resto. */
export function shouldInviteRealPhoto(i: InviteInput): boolean {
  if (i.postedInFlow) return false;
  if (i.communityPhotos.length > 0) return false;
  return !i.myPostPhotoRestIds.includes(i.restId);
}

/** Fiche sans vraie photo de plat d'un foodie : on invite à poster (aucune récompense supplémentaire). */
export function needsRealDishPhoto(i: { communityPhotos: string[]; photoSource?: string }): boolean {
  return i.communityPhotos.length === 0 && i.photoSource !== 'community' && i.photoSource !== 'restaurant';
}

/** Consigne affichée au moment de poster. */
export const DISH_PHOTO_TIP = {
  title: 'Photographie ton plat (pas la devanture)',
  example: 'Ex. : la pizza dans l’assiette, vue de dessus, plutôt que la façade du resto.',
} as const;

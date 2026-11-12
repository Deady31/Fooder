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

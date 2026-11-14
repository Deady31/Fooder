import { Avatar } from '../profile/Avatar';
import type { CommentIdentity } from './commentAuthor';

/** Mascotte de l'auteur ; sans avatar enregistré (ancien commentaire) : initiale sur fond de marque. Décoratif : le nom est lu dans le texte. */
export function CommentAvatar({ identity, size = 28 }: { identity: CommentIdentity; size?: number }) {
  if (identity.avatar) return <Avatar avatar={identity.avatar} size={size} className='!border-2 !shadow-none' />;
  return (
    <span
      aria-hidden='true'
      className='shrink-0 flex items-center justify-center border-2 border-plum bg-bubblegum font-display text-plum leading-none'
      style={{ width: size, height: size, borderRadius: size * 0.3, fontSize: size * 0.5 }}
    >
      {identity.initial}
    </span>
  );
}

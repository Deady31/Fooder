import { AvatarChoice, avatarSrc, bgColor } from '../../lib/avatars';

interface AvatarProps {
  avatar: AvatarChoice;
  size?: number;
  className?: string;
}

/** Mascotte sur fond coloré, cadre prune. Taille en px, coins proportionnels. */
export function Avatar({ avatar, size = 64, className = '' }: AvatarProps) {
  return (
    <div
      className={`shrink-0 border-[3px] border-plum shadow-hard flex items-center justify-center overflow-hidden ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bgColor(avatar.bg) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={avatarSrc(avatar.id)} alt='' draggable={false} className='w-[88%] h-[88%] object-contain' />
    </div>
  );
}

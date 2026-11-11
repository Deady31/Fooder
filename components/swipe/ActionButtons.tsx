import { X, Heart } from 'lucide-react';

interface ActionButtonsProps {
  hidden: boolean;
  onNope: () => void;
  onLike: () => void;
}

export function ActionButtons({ hidden, onNope, onLike }: ActionButtonsProps) {
  return (
    <div
      className={`shrink-0 px-6 pb-3 pt-2 flex items-center justify-center gap-[clamp(24px,10vw,44px)] transition-opacity duration-300 ${hidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >
      <button onClick={onNope} aria-label='Passer' className='btn-round bg-white text-fooder-red'>
        <X className='w-10 h-10' strokeWidth={4} />
      </button>
      <button onClick={onLike} aria-label='Aimer' className='btn-round bg-bubblegum text-plum'>
        <Heart className='w-10 h-10 fill-white' strokeWidth={3.5} />
      </button>
    </div>
  );
}

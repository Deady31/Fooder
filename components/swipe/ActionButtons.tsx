import { X, Heart, Undo2 } from 'lucide-react';

interface ActionButtonsProps {
  hidden: boolean;
  onNope: () => void;
  onLike: () => void;
  /** Absent (deck de groupe) : pas de bouton Annuler */
  onUndo?: () => void;
  canUndo?: boolean;
}

export function ActionButtons({ hidden, onNope, onLike, onUndo, canUndo = false }: ActionButtonsProps) {
  return (
    <div
      className={`relative z-20 shrink-0 px-6 pb-3 pt-2 flex items-center justify-center gap-[clamp(18px,7vw,36px)] transition-opacity duration-300 ${hidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >
      {onUndo && (
      <button
        onClick={onUndo}
        disabled={!canUndo}
        aria-label='Annuler le dernier swipe'
        title='Annuler'
        className={`w-11 h-11 rounded-full bg-white border-[3px] border-plum text-plum flex items-center justify-center shadow-hard transition-all active:translate-y-0.5 active:shadow-none ${canUndo ? 'opacity-100' : 'opacity-35 pointer-events-none shadow-none'}`}
      >
        <Undo2 className='w-5 h-5' strokeWidth={3} />
      </button>
      )}
      <button onClick={onNope} aria-label='Passer' className='btn-round bg-white text-fooder-red'>
        <X className='w-10 h-10' strokeWidth={4} />
      </button>
      <button onClick={onLike} aria-label='Aimer' className='btn-round bg-bubblegum text-plum'>
        <Heart className='w-10 h-10 fill-white' strokeWidth={3.5} />
      </button>
      {onUndo && <span className='w-11 shrink-0' aria-hidden />}
    </div>
  );
}

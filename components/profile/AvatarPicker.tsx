'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, X, Check } from 'lucide-react';
import {
  AVATARS,
  AVATAR_BACKGROUNDS,
  AvatarChoice,
  avatarSrc,
  bgColor,
  isUnlocked,
  lockReason,
} from '../../lib/avatars';
import { Avatar } from './Avatar';

interface AvatarPickerProps {
  isOpen: boolean;
  current: AvatarChoice;
  level: number;
  onClose: () => void;
  onSave: (next: AvatarChoice) => void;
  onLockedTap: (reason: string) => void;
}

export function AvatarPicker({ isOpen, current, level, onClose, onSave, onLockedTap }: AvatarPickerProps) {
  const [draft, setDraft] = useState<AvatarChoice>(current);

  useEffect(() => {
    if (isOpen) setDraft(current);
  }, [isOpen, current]);

  const save = () => {
    onSave(draft);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='fixed inset-0 z-[150] flex items-end justify-center p-3 pb-4 bg-plum/60 backdrop-blur-sm'
          onClick={e => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className='w-full max-w-md max-h-[calc(100dvh-1.5rem)] bg-cream rounded-[32px] panel flex flex-col overflow-hidden'
          >
            <div className='p-[clamp(16px,5vw,24px)] space-y-4 scroll-y'>
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0 flex-1'>
                  <h2 className='text-[clamp(21px,6.6vw,28px)] leading-[1.05] text-plum'>Ta mascotte</h2>
                  <p className='text-plum-muted text-xs font-semibold mt-1'>Choisis ton perso et ta couleur</p>
                </div>
                <button
                  onClick={onClose}
                  aria-label='Fermer'
                  className='w-11 h-11 shrink-0 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 transition-transform'
                >
                  <X className='w-5 h-5' strokeWidth={3} />
                </button>
              </div>

              <div className='flex justify-center'>
                <motion.div key={draft.id + draft.bg} initial={{ scale: 0.85, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
                  <Avatar avatar={draft} size={104} />
                </motion.div>
              </div>

              <div role='radiogroup' aria-label='Couleur de fond' className='flex justify-center gap-2 flex-wrap'>
                {AVATAR_BACKGROUNDS.map(b => (
                  <button
                    key={b.id}
                    role='radio'
                    aria-checked={draft.bg === b.id}
                    aria-label={b.label}
                    onClick={() => setDraft({ ...draft, bg: b.id })}
                    className={`w-11 h-11 rounded-full border-[3px] border-plum transition-transform active:scale-90 flex items-center justify-center ${draft.bg === b.id ? 'scale-110 shadow-hard' : ''}`}
                    style={{ backgroundColor: b.color }}
                  >
                    {draft.bg === b.id && <Check className='w-4 h-4 text-plum' strokeWidth={4} />}
                  </button>
                ))}
              </div>

              <div className='grid grid-cols-4 gap-[clamp(6px,2vw,10px)]'>
                {AVATARS.map(a => {
                  const open = isUnlocked(a, level);
                  const reason = lockReason(a, level);
                  const selected = draft.id === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => (open ? setDraft({ ...draft, id: a.id }) : reason && onLockedTap(reason))}
                      aria-label={open ? a.label : `${a.label}, verrouillé : ${reason}`}
                      className={`relative aspect-square rounded-2xl border-[3px] border-plum flex items-center justify-center transition-all active:scale-95 ${selected ? 'shadow-hard -translate-y-0.5' : ''}`}
                      style={{ backgroundColor: selected ? bgColor(draft.bg) : '#fff' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatarSrc(a.id)} alt='' draggable={false} className={`w-[84%] h-[84%] object-contain ${open ? '' : 'opacity-40 grayscale'}`} />
                      {!open && (
                        <span className='absolute -bottom-1.5 left-1/2 -translate-x-1/2 chip !gap-0.5 !px-1 !py-0.5 !text-xs bg-white text-plum whitespace-nowrap'>
                          <Lock className='w-2.5 h-2.5' strokeWidth={3} />
                          {reason}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button onClick={save} className='duo-button w-full bg-bubblegum text-plum'>
                C&apos;est parti !
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

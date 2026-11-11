'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface FilterSheetProps {
  isOpen: boolean;
  budget: number;
  cuisine: string;
  cuisines: string[];
  onBudget: (v: number) => void;
  onCuisine: (v: string) => void;
  onApply: () => void;
  onClose: () => void;
}

export function FilterSheet({ isOpen, budget, cuisine, cuisines, onBudget, onCuisine, onApply, onClose }: FilterSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className='fixed inset-0 z-[60] flex items-end justify-center bg-plum/60 backdrop-blur-sm p-4'>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className='w-full max-w-md bg-cream rounded-[32px] p-7 space-y-7 panel'
          >
            <div className='flex justify-between items-center'>
              <h2 className='text-3xl text-plum'>Filtres</h2>
              <button
                onClick={onClose}
                aria-label='Fermer'
                className='w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 transition-transform'
              >
                <X className='w-5 h-5' strokeWidth={3} />
              </button>
            </div>

            <div className='space-y-4'>
              <div className='flex justify-between items-end'>
                <label className='text-sm font-bold text-plum/70'>Budget max</label>
                <span className='text-3xl font-display text-fooder-primary'>{budget}€</span>
              </div>
              <input
                type='range' min='10' max='150' step='5' value={budget}
                onChange={(e) => onBudget(parseInt(e.target.value))}
                className='w-full h-3 bg-white border-2 border-plum rounded-full appearance-none cursor-pointer accent-fooder-primary'
              />
            </div>

            <div className='space-y-3'>
              <label className='text-sm font-bold text-plum/70'>Envie de cuisine</label>
              <div className='flex flex-wrap gap-2.5'>
                {cuisines.map((c) => (
                  <button
                    key={c}
                    onClick={() => onCuisine(c)}
                    className={`chip text-xs px-4 py-2 transition-all active:translate-y-0.5 ${cuisine === c ? 'bg-fooder-primary text-white' : 'bg-white text-plum'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={onApply} className='w-full duo-button bg-fooder-secondary text-plum py-4 text-lg'>
              Appliquer
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

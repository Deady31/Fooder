'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Sticker } from './ui/Sticker';
import { StickerName } from '../lib/stickers';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivate: () => void;
}

const benefits: { sticker: StickerName; label: string; desc: string }[] = [
  { sticker: 'donut', label: 'Swipes illimités', desc: 'Plus jamais de limite quotidienne' },
  { sticker: 'steak', label: 'Restaurants exclusifs', desc: 'Accès aux spots cachés de la ville' },
  { sticker: 'cupcake', label: 'Filtres avancés', desc: 'Ambiance, terrasse, réservation...' },
];

export function PremiumModal({ isOpen, onClose, onActivate }: PremiumModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end justify-center p-4 pb-8 bg-plum/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.93 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.93 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="w-full max-w-md max-h-[calc(100dvh-2rem)] scroll-y bg-cream rounded-[32px] panel"
          >
            <div className="p-6 pb-7 space-y-5">
              <div className="flex justify-between items-start gap-3">
                <div className="space-y-1.5">
                  <h2 className="text-[clamp(24px,8vw,32px)] text-plum leading-none">Fooder Premium</h2>
                  <p className="text-slate-600 font-medium text-sm">
                    Va plus loin dans ta découverte.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fermer"
                  className="w-10 h-10 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 transition-transform flex-shrink-0"
                >
                  <X className="w-4 h-4" strokeWidth={3} />
                </button>
              </div>

              <div className="space-y-2.5">
                {benefits.map((b) => (
                  <div key={b.label} className="flex items-center gap-3 p-2.5 pr-4 bg-white rounded-2xl border-[3px] border-plum">
                    <Sticker name={b.sticker} size={48} rotate={-6} />
                    <div className="flex-1">
                      <p className="font-bold text-plum text-sm">{b.label}</p>
                      <p className="text-slate-500 text-xs font-medium">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <button
                  onClick={onActivate}
                  className="premium-button w-full py-4 rounded-full text-lg"
                >
                  Passer à Premium · 4,99€/mois
                </button>
                <p className="text-center text-slate-500 text-xs font-semibold">
                  Sans engagement · Annulation à tout moment
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

'use client';
import { X } from 'lucide-react';
import { Sticker } from './ui/Sticker';
import { Sheet } from './ui/Sheet';
import { StickerName } from '../lib/stickers';

const MOODS: { id: string; label: string; sticker: StickerName; tint: string }[] = [
  { id: 'surprise', label: 'Surprends-moi', sticker: 'donut', tint: 'bg-bubblegum' },
  { id: 'asie', label: 'Tour en Asie', sticker: 'ramen', tint: 'bg-fooder-secondary' },
  { id: 'terroir', label: 'Terroir & bistrots', sticker: 'steak', tint: 'bg-fooder-orange' },
  { id: 'street', label: 'Street & Fast', sticker: 'taco', tint: 'bg-fooder-mint' },
  { id: 'veggie', label: 'Vert & sain', sticker: 'salad', tint: 'bg-fooder-mint' },
  { id: 'gros', label: "J'ai VRAIMENT faim", sticker: 'burger', tint: 'bg-fooder-secondary' },
  { id: 'special', label: 'Soirée spéciale', sticker: 'cupcake', tint: 'bg-bubblegum' },
  { id: 'brunch', label: 'Slow morning', sticker: 'coffee', tint: 'bg-fooder-orange' },
];

interface MoodSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentMood: string;
  onSelect: (moodId: string, label: string) => void;
}

export function MoodSheet({ isOpen, onClose, currentMood, onSelect }: MoodSheetProps) {
  return (
    <Sheet open={isOpen} onClose={onClose} labelledBy='humeur-titre' className='bg-cream rounded-[32px] panel'>
      <div className="p-[clamp(16px,5vw,24px)] pt-2 space-y-[clamp(12px,3.5vw,20px)]">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id='humeur-titre' className="text-[clamp(21px,6.6vw,28px)] leading-[1.05] text-plum">T&apos;as envie de quoi ?</h2>
            <p className="text-plum-muted text-xs font-semibold mt-1">Change ton mood à tout moment</p>
          </div>
          <button
            type='button'
            onClick={onClose}
            aria-label="Fermer"
            className="w-11 h-11 shrink-0 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 transition-transform"
          >
            <X className="w-5 h-5" strokeWidth={3} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-[clamp(8px,2.5vw,12px)]">
          {MOODS.map((mood) => {
            const active = currentMood === mood.id;
            return (
              <button
                key={mood.id}
                type='button'
                aria-pressed={active}
                onClick={() => { onSelect(mood.id, mood.label); onClose(); }}
                className={`relative min-w-0 min-h-[56px] flex items-center gap-1.5 pl-1.5 pr-2 py-1.5 rounded-2xl border-[3px] border-plum text-left font-bold text-[clamp(11px,3.4vw,13px)] text-plum transition-all active:translate-y-1 ${
                  active ? `${mood.tint} shadow-none translate-y-1` : 'bg-white shadow-hard'
                }`}
              >
                <Sticker name={mood.sticker} size={40} rotate={-6} className="shrink-0" />
                <span className="leading-tight min-w-0 break-words [hyphens:auto]" lang="fr">{mood.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}

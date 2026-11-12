/** Briques visuelles du backoffice, dans le style « sticker » de Fooder (encre prune, bords épais, ombres pleines). */
import type { ReactNode } from 'react';

export type Tone = 'violet' | 'lemon' | 'mint' | 'bubblegum' | 'orange' | 'cream' | 'white';

export const TONE_BG: Record<Tone, string> = {
  violet: 'bg-fooder-primary text-white',
  lemon: 'bg-fooder-secondary text-plum',
  mint: 'bg-fooder-mint text-plum',
  bubblegum: 'bg-bubblegum text-plum',
  orange: 'bg-fooder-orange text-plum',
  cream: 'bg-cream text-plum',
  white: 'bg-white text-plum',
};

interface PanelProps {
  title?: string;
  kicker?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

export function Panel({ title, kicker, aside, children, className = '', id }: PanelProps) {
  return (
    <section id={id} aria-labelledby={id && title ? `${id}-title` : undefined} className={`bg-white border-[3px] border-plum rounded-3xl shadow-hard p-4 sm:p-5 min-w-0 ${className}`}>
      {(title || aside) && (
        <header className='flex flex-wrap items-end justify-between gap-2 mb-4'>
          <div className='min-w-0'>
            {kicker && <p className='text-[11px] font-bold uppercase tracking-[0.14em] text-plum/50'>{kicker}</p>}
            {title && (
              <h2 id={id ? `${id}-title` : undefined} className='font-display text-xl sm:text-2xl leading-tight text-plum'>
                {title}
              </h2>
            )}
          </div>
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

interface KpiProps {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  big?: boolean;
}

export function Kpi({ label, value, hint, tone = 'white', big = false }: KpiProps) {
  return (
    <div className={`border-[3px] border-plum rounded-2xl shadow-hard-sm px-3 py-3 min-w-0 ${TONE_BG[tone]}`}>
      <p className='text-[11px] font-bold uppercase tracking-[0.12em] opacity-75 truncate'>{label}</p>
      <p className={`font-display leading-none mt-1.5 tabular-nums truncate ${big ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl'}`}>{value}</p>
      {hint && <p className='text-[11px] font-semibold mt-1.5 opacity-75 truncate'>{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className='text-sm font-semibold text-plum/60 bg-cream border-2 border-dashed border-plum/30 rounded-2xl px-4 py-6 text-center'>{children}</p>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-2xl bg-plum/10 ${className}`} />;
}

interface ChipButtonProps {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  label?: string;
}

/** Bouton pastille : s'enfonce au clic, état actif en violet. */
export function ChipButton({ active = false, onClick, children, label }: ChipButtonProps) {
  return (
    <button
      type='button'
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full border-[3px] border-plum text-sm font-bold transition-[transform,box-shadow] duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-fooder-primary ${
        active ? 'bg-plum text-fooder-secondary shadow-none translate-y-[3px]' : 'bg-white text-plum shadow-[0_3px_0_#2B0F3A] hover:-translate-y-px active:translate-y-[3px] active:shadow-none'
      }`}
    >
      {children}
    </button>
  );
}

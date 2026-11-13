import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

/** En-tête d'écran : un seul <h1> par page, fond opaque (pas de flou, coûteux sur mobile). */
export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <header className='shrink-0 flex items-end justify-between gap-3 px-5 pt-6 pb-3 bg-cream border-b-[3px] border-plum z-20'>
      <div className='min-w-0'>
        <h1 className='text-[34px] leading-none text-plum truncate'>{title}</h1>
        {subtitle && <p className='text-xs font-semibold text-slate-muted mt-1.5'>{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

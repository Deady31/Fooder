import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface LegalPageProps {
  title: string;
  updated: string;
  children: React.ReactNode;
}

export function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <div className='h-full scroll-y bg-cream'>
      <div className='max-w-md mx-auto border-x-[3px] border-plum min-h-full bg-cream px-5 pt-[max(env(safe-area-inset-top),16px)] pb-10'>
        <Link href='/profile' className='inline-flex items-center gap-1 text-sm font-bold text-plum mb-4'>
          <ChevronLeft className='w-4 h-4' strokeWidth={3} /> Retour
        </Link>
        <h1 className='text-3xl leading-tight text-plum'>{title}</h1>
        <p className='text-xs font-bold text-plum/60 mt-1'>Dernière mise à jour : {updated}</p>
        <div className='mt-5 space-y-4 text-sm font-medium leading-relaxed text-plum [&_h2]:text-xl [&_h2]:mt-6 [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:underline'>
          {children}
        </div>
      </div>
    </div>
  );
}

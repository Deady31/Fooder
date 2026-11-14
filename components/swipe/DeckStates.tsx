'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sticker } from '../ui/Sticker';
import { radiusLabel, withinLabel, type Radius } from '../../lib/geo/radius';

export function DeckLoader() {
  return (
    <div className='flex flex-col items-center gap-5' role='status'>
      <div className='flex items-end gap-2'>
        <div className='bob' style={{ ['--r' as string]: '-8deg' }}><Sticker name='burger' size={72} rotate={-8} /></div>
        <div className='bob' style={{ ['--r' as string]: '4deg', animationDelay: '0.4s' }}><Sticker name='pizza' size={84} rotate={4} /></div>
        <div className='bob' style={{ ['--r' as string]: '10deg', animationDelay: '0.8s' }}><Sticker name='boba' size={72} rotate={10} /></div>
      </div>
      <p className='font-display text-xl text-plum'>On cherche des pépites…</p>
    </div>
  );
}

interface ActionsProps {
  /** Palier plus large qui apporte des résultats (undefined : aucun). */
  widenTo: Radius | undefined;
  onWiden: (r: Radius) => void;
  canUndo: boolean;
  onUndo: () => void;
}

function WidenButton({ widenTo, onWiden }: Pick<ActionsProps, 'widenTo' | 'onWiden'>) {
  if (widenTo === undefined) return null;
  return (
    <button type='button' onClick={() => onWiden(widenTo)} className='duo-button bg-bubblegum text-plum py-4 text-base'>
      {widenTo === null ? 'Élargir à toute la métropole' : `Élargir à ${radiusLabel(widenTo)}`}
    </button>
  );
}

function UndoButton({ canUndo, onUndo }: Pick<ActionsProps, 'canUndo' | 'onUndo'>) {
  if (!canUndo) return null;
  return (
    <button type='button' onClick={onUndo} className='duo-button bg-white text-plum py-3 text-sm'>
      Annuler mon dernier swipe
    </button>
  );
}

/** Fin de paquet : tout a été vu dans le rayon. */
export function DeckEnd({ radius, onMood, ...actions }: ActionsProps & { radius: Radius; onMood: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className='flex flex-col items-center text-center px-6 gap-5 w-full max-w-sm'>
      <div className='relative h-28 w-48' aria-hidden='true'>
        <div className='absolute left-0 top-2 bob' style={{ ['--r' as string]: '-12deg' }}><Sticker name='donut' size={80} rotate={-12} /></div>
        <div className='absolute right-0 top-0 bob' style={{ ['--r' as string]: '10deg', animationDelay: '0.5s' }}><Sticker name='icecream' size={88} rotate={10} /></div>
      </div>
      <div className='space-y-2 rounded-[22px] bg-cream border-[3px] border-plum px-4 py-3'>
        <h3 className='text-4xl text-plum'>Tu as tout vu !</h3>
        <p className='text-plum-muted font-medium text-sm leading-relaxed'>
          Tous les restos {withinLabel(radius)} sont passés entre tes doigts.
        </p>
      </div>
      <div className='flex flex-col w-full gap-3'>
        <WidenButton {...actions} />
        <Link href='/wishlist' className='duo-button bg-white text-plum py-4 text-base text-center'>Voir mes coups de cœur</Link>
        <button type='button' onClick={onMood} className='duo-button bg-white text-plum py-4 text-base'>Changer d&apos;envie</button>
        <UndoButton {...actions} />
      </div>
    </motion.div>
  );
}

export type BlockReason = 'radius' | 'closed' | 'diets' | 'openNow' | 'price';

const COPY: Record<BlockReason, { title: (r: Radius) => string; text: string }> = {
  radius: { title: r => `Rien ${withinLabel(r)}`, text: 'Aucun resto restant dans ce rayon avec tes filtres.' },
  diets: { title: () => 'Pas encore de résultat', text: 'Peu de restos renseignés pour ce régime (selon OpenStreetMap).' },
  closed: { title: () => 'Tout est fermé pour l’instant', text: 'Aucun resto de ta sélection n’est ouvert en ce moment.' },
  openNow: { title: () => 'Rien d’ouvert (confirmé)', text: 'Aucun resto restant n’a d’horaires confirmés ouverts en ce moment.' },
  price: { title: () => 'Rien pour ce budget ou cette cuisine', text: 'Aucun resto restant ne correspond au budget ou à la cuisine choisis.' },
};

const FIX_LABEL: Record<Exclude<BlockReason, 'radius'>, string> = {
  diets: 'Retirer le filtre régime',
  closed: 'Voir les fermés',
  openNow: 'Retirer « Ouvert (confirmé) »',
  price: 'Retirer budget et cuisine',
};

/** Plus aucune carte pour les filtres en cours : on dit lequel bloque et on propose la sortie précise. */
export function DeckNoMatch({ reason, radius, onFix, reopening, ...actions }: ActionsProps & { reason: BlockReason; radius: Radius; onFix: () => void; reopening?: string | null }) {
  const copy = COPY[reason];
  return (
    <div className='flex flex-col items-center text-center px-6 gap-4 w-full max-w-sm'>
      <div className='bob [@media(max-height:620px)]:hidden' style={{ ['--r' as string]: '-6deg' }} aria-hidden='true'><Sticker name='ramen' size={96} rotate={-6} /></div>
      <div className='space-y-2 rounded-[22px] bg-cream border-[3px] border-plum px-4 py-3'>
        <h3 className='text-3xl text-plum'>{copy.title(radius)}</h3>
        <p className='text-plum-muted font-medium text-sm leading-relaxed'>{copy.text}</p>
        {reason === 'closed' && reopening && <p className='text-plum font-bold text-sm leading-snug'>{reopening}</p>}
      </div>
      <div className='flex flex-col w-full gap-3'>
        {reason === 'radius' ? (
          <WidenButton {...actions} />
        ) : (
          <button type='button' onClick={onFix} className='duo-button bg-bubblegum text-plum py-4 text-base'>{FIX_LABEL[reason]}</button>
        )}
        <UndoButton {...actions} />
      </div>
    </div>
  );
}

export function DeckDesert() {
  return (
    <div className='text-center space-y-6 px-8'>
      <div className='flex justify-center' aria-hidden='true'><Sticker name='ramen' size={120} rotate={-6} className='bob' /></div>
      <div className='space-y-2'>
        <h3 className='text-3xl text-plum'>C&apos;est le désert…</h3>
        <p className='text-plum-muted font-medium'>Impossible de charger les restos. Vérifie ta connexion.</p>
      </div>
      <button type='button' onClick={() => window.location.reload()} className='duo-button bg-fooder-primary text-white px-12 py-4'>Réessayer</button>
    </div>
  );
}

'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { m } from 'framer-motion';
import type { Restaurant } from '../../data/mockRestaurants';
import { likesCount, subscribeLikes } from '../../lib/likes';
import { Sticker } from '../ui/Sticker';
import { stickerFor } from '../../lib/stickers';
import { SwipeTally, tallyTotal } from './swipeTally';
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

const RECAP_MAX = 4;

/**
 * Récap du paquet : combien de MIAM / BOF, et les restos retenus (les plus récents d'abord).
 * Chaque resto retenu ouvre sa fiche quand `onOpen` est fourni : la fin de paquet n'est pas un cul-de-sac.
 */
function DeckRecap({ tally, onOpen }: { tally: SwipeTally; onOpen?: (rest: Restaurant) => void }) {
  const recent = tally.liked.slice(-RECAP_MAX).reverse();
  const more = tally.liked.length - recent.length;
  return (
    <section aria-label='Récap de ton paquet' className='w-full rounded-[22px] bg-lemon border-[3px] border-plum shadow-hard px-4 py-3 text-left'>
      <div className='flex items-center justify-center gap-2 text-sm font-black text-plum'>
        <span className='chip bg-fooder-mint'>{tally.liked.length} MIAM</span>
        <span className='chip bg-white'>{tally.passed} BOF</span>
      </div>
      {recent.length > 0 && (
        <ul className='mt-3 space-y-1.5'>
          {recent.map(r => (
            <li key={r.id} className='flex items-center gap-2 min-w-0'>
              <Sticker name={stickerFor(r.cuisine, r.id, r.name)} size={28} />
              {onOpen ? (
                <button
                  type='button'
                  onClick={() => onOpen(r)}
                  aria-label={`Ouvrir la fiche de ${r.name}`}
                  className='min-h-[44px] flex-1 min-w-0 py-1 text-left text-sm font-bold text-plum leading-tight break-words underline decoration-plum/30 decoration-2 underline-offset-2 active:translate-y-px'
                >
                  {r.name}
                </button>
              ) : (
                <span className='flex-1 min-w-0 text-sm font-bold text-plum leading-tight break-words'>{r.name}</span>
              )}
            </li>
          ))}
          {more > 0 && <li className='text-xs font-bold text-plum-muted pl-9'>+ {more} autre{more > 1 ? 's' : ''}</li>}
        </ul>
      )}
      {onOpen && recent.length > 0 && (
        <p className='mt-2 text-center text-xs font-bold text-plum-muted'>Touche un resto pour ouvrir sa fiche.</p>
      )}
    </section>
  );
}

/** Fin de paquet : tout a été vu dans le rayon. */
export function DeckEnd({
  radius,
  onMood,
  tally,
  onOpen,
  ...actions
}: ActionsProps & { radius: Radius; onMood: () => void; tally?: SwipeTally; onOpen?: (rest: Restaurant) => void }) {
  // Compte des coups de cœur tenu à jour : une fiche ouverte depuis le récap peut en retirer un.
  const [likes, setLikes] = useState<number | null>(null);
  useEffect(() => {
    const sync = () => setLikes(likesCount());
    sync();
    return subscribeLikes(sync);
  }, []);
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      // `max-h-full` + défilement : sur un petit écran, la fin de paquet ne doit jamais être coupée
      // par la barre d'actions (le récap ajoute de la hauteur).
      className='flex flex-col items-center text-center px-6 gap-4 w-full max-w-sm max-h-full overflow-y-auto overscroll-contain py-1'
    >
      <div className='relative h-28 w-48 shrink-0 [@media(max-height:620px)]:hidden' aria-hidden='true'>
        <div className='absolute left-0 top-2 bob' style={{ ['--r' as string]: '-12deg' }}><Sticker name='donut' size={80} rotate={-12} /></div>
        <div className='absolute right-0 top-0 bob' style={{ ['--r' as string]: '10deg', animationDelay: '0.5s' }}><Sticker name='icecream' size={88} rotate={10} /></div>
      </div>
      <div className='space-y-2 rounded-[22px] bg-cream border-[3px] border-plum px-4 py-3'>
        <h3 className='text-[clamp(26px,9vw,36px)] leading-[1.05] text-plum'>Tu as tout swipé&nbsp;!</h3>
        <p className='text-plum-muted font-medium text-sm leading-relaxed'>
          Tous les restos {withinLabel(radius)} sont passés entre tes doigts.
        </p>
        {likes !== null && likes > 0 && (
          <p className='text-plum font-bold text-sm'>❤️ {likes} coup{likes > 1 ? 's' : ''} de cœur dans tes favoris</p>
        )}
      </div>
      {/* Les sorties d'abord : le récap est un bonus, il ne doit pas repousser les boutons hors de l'écran. */}
      <div className='flex flex-col w-full gap-3'>
        <WidenButton {...actions} />
        <Link href='/wishlist' className='duo-button bg-white text-plum py-4 text-base text-center'>Voir mes coups de cœur</Link>
      </div>
      {tally && tallyTotal(tally) > 0 && <DeckRecap tally={tally} onOpen={onOpen} />}
      <div className='flex flex-col w-full gap-3'>
        <button type='button' onClick={onMood} className='duo-button bg-white text-plum py-4 text-base'>Changer d&apos;envie</button>
        <UndoButton {...actions} />
      </div>
    </m.div>
  );
}

export type BlockReason = 'radius' | 'closed' | 'diets' | 'openNow' | 'price';

const COPY: Record<BlockReason, { title: (r: Radius) => string; text: string }> = {
  radius: { title: r => `Rien ${withinLabel(r)}`, text: 'Aucun resto restant dans ce rayon avec tes filtres.' },
  diets: { title: () => 'Pas encore de résultat', text: 'Peu de restos renseignés pour ce régime (selon OpenStreetMap).' },
  closed: { title: () => 'Tout est fermé pour l’instant', text: 'Aucun resto de ta sélection n’est ouvert en ce moment (seuls les restos ouverts sont proposés).' },
  openNow: { title: () => 'Rien d’ouvert pour l’instant', text: 'Aucun resto restant n’a d’horaires confirmés ouverts en ce moment.' },
  price: { title: () => 'Rien pour ce budget ou cette cuisine', text: 'Aucun resto restant ne correspond au budget ou à la cuisine choisis.' },
};

const FIX_LABEL: Record<Exclude<BlockReason, 'radius'>, string> = {
  diets: 'Retirer le filtre régime',
  closed: 'Voir aussi les fermés',
  openNow: 'Voir aussi les fermés',
  price: 'Retirer budget et cuisine',
};

/** Plus aucune carte pour les filtres en cours : on dit lequel bloque et on propose la sortie précise. */
export function DeckNoMatch({ reason, radius, onFix, reopening, ...actions }: ActionsProps & { reason: BlockReason; radius: Radius; onFix: () => void; reopening?: string | null }) {
  const copy = COPY[reason];
  return (
    <div className='flex flex-col items-center text-center px-6 gap-4 w-full max-w-sm max-h-full overflow-y-auto overscroll-contain py-1'>
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

/** Envie « Buffet à volonté » sans aucune carte : aucun buffet restant, ou tous déjà vus. */
export function DeckNoBuffet({ onMood }: { onMood: () => void }) {
  return (
    <div className='flex flex-col items-center text-center px-6 gap-4 w-full max-w-sm'>
      <div className='bob' style={{ ['--r' as string]: '-6deg' }} aria-hidden='true'><Sticker name='paella' size={96} rotate={-6} /></div>
      <div className='space-y-2 rounded-[22px] bg-cream border-[3px] border-plum px-4 py-3'>
        <h3 className='text-3xl text-plum'>Plus de buffet pour l’instant</h3>
        <p className='text-plum-muted font-medium text-sm leading-relaxed'>Tu as vu tous les buffets à volonté ouverts que l’on connaît. On en ajoute au fil des vérifications.</p>
      </div>
      <button type='button' onClick={onMood} className='duo-button bg-bubblegum text-plum py-4 text-base'>Changer d&apos;envie</button>
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

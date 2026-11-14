'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Navigation, Share2, Star, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { Restaurant } from '../../../data/mockRestaurants';
import { Sticker } from '../../../components/ui/Sticker';
import { FoodImage } from '../../../components/ui/FoodImage';
import { PageHeader } from '../../../components/nav/PageHeader';
import { InviteCard } from '../../../components/social/InviteCard';
import { DetailSheet } from '../../../components/swipe/DetailSheet';
import { CheckinSheet, CheckinMode } from '../../../components/checkin/CheckinSheet';
import { useSocial } from '../../../hooks/useSocial';
import { ActionToast, ActionToastState } from '../../../components/profile/ActionToast';
import {
    LIKE_SORTS, LikeSort, SavedRestaurant, addedLabel, readDislikes, readLikeSort, readLikes, removeDislike, removeLike, restoreDislike, restoreLike,
    sortLikes, subscribeLikes, writeLikeSort,
} from '../../../lib/likes';
import { LAST_POSITION_KEY, MANUAL_POSITION_KEY, initialPosition, parseStoredManual, parseStoredPosition } from '../../../lib/geo/position';
import { readJson } from '../../../lib/store';
import { VisitInput } from '../../../lib/visits';
import { isWeekendWindow, weekendPicks } from '../../../lib/rituals';

type ListId = 'likes' | 'dislikes';

/** Position déjà connue (GPS récent, dernière position ou adresse saisie), lue sans rien demander : null si seulement le centre par défaut. */
function readKnownPosition(): { lat: number; lng: number } | null {
    const start = initialPosition(
        parseStoredPosition(readJson<unknown>(LAST_POSITION_KEY, null), Date.now()),
        parseStoredManual(readJson<unknown>(MANUAL_POSITION_KEY, null))
    );
    return start.source === 'default' ? null : start.coords;
}

const LIST_TABS: { id: ListId; label: string }[] = [
    { id: 'likes', label: 'Coups de cœur' },
    { id: 'dislikes', label: 'Écartés' },
];

export default function WishlistPage() {
    const [likes, setLikes] = useState<SavedRestaurant[]>([]);
    const [dislikes, setDislikes] = useState<Restaurant[]>([]);
    const [sort, setSort] = useState<LikeSort>('recent');
    const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
    const [activeTab, setActiveTab] = useState<ListId>('likes');
    const [selectedRest, setSelectedRest] = useState<Restaurant | null>(null);
    const [checkin, setCheckin] = useState<{ target: VisitInput; mode: CheckinMode } | null>(null);
    const [weekend, setWeekend] = useState(false);
    const { visits, checkins } = useSocial();
    const visitedIds = new Set(visits.map(v => v.restId));

    useEffect(() => {
        const sync = () => {
            setLikes(readLikes());
            setDislikes(readDislikes());
        };
        sync();
        setSort(readLikeSort());
        setHere(readKnownPosition());
        setWeekend(isWeekendWindow());
        // Retrait, annulation ou like ailleurs : la liste et les compteurs suivent sans navigation.
        return subscribeLikes(sync);
    }, []);

    // Arrivée depuis la notification « Alors, ce resto ? »
    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get('checkin');
        if (!id) return;
        const c = checkins.find(x => x.restId === id);
        if (!c) return;
        window.history.replaceState(null, '', '/wishlist');
        setCheckin({ target: { restId: c.restId, name: c.name, cuisine: c.cuisine, lat: c.lat, lng: c.lng }, mode: 'ask' });
    }, [checkins]);

    const toVisit = (r: Restaurant): VisitInput => ({ restId: r.id, name: r.name, cuisine: r.cuisine, lat: r.lat, lng: r.lng });
    const picks = weekend ? weekendPicks(likes, visits) : [];

    const [toast, setToast] = useState<ActionToastState | null>(null);
    const toastSeq = useRef(0);
    const dismissToast = useCallback(() => setToast(null), []);
    const notify = (message: string, action?: { label: string; run: () => void }) => {
        toastSeq.current += 1;
        setToast({ id: toastSeq.current, message, actionLabel: action?.label, onAction: action?.run });
    };

    // Retrait annulable pendant 5 s : l'état précédent est gardé dans la fermeture du bouton « Annuler ».
    const removeFromList = (id: string, list: ListId) => {
        const out = list === 'likes' ? removeLike(id) : removeDislike(id);
        if (!out) return;
        const undo = () => (list === 'likes' ? restoreLike(out.rest, out.index) : restoreDislike(out.rest, out.index));
        notify(`${out.rest.name} retiré`, { label: 'Annuler', run: undo });
    };

    const openGoogleMaps = (rest: Restaurant) => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${rest.name} ${rest.address}`)}`, '_blank');
    };

    const handleShare = async (rest: Restaurant) => {
        const text = [rest.name, rest.cuisine, rest.price > 0 ? `${rest.price}€` : null].filter(Boolean).join(' · ') + `\n${rest.address}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: `Fooder — ${rest.name}`, text });
            } else {
                await navigator.clipboard.writeText(text);
                notify('Copié dans le presse-papiers');
            }
        } catch (err) {
            // Annuler la feuille de partage n'est pas une erreur.
            if (err instanceof DOMException && err.name === 'AbortError') return;
            notify('Partage impossible pour le moment');
        }
    };

    // « Les plus proches » demande une position connue ; sans elle, on retombe sur « Récents » (le choix reste mémorisé).
    const effectiveSort: LikeSort = sort === 'proche' && !here ? 'recent' : sort;
    const sortedLikes = useMemo(() => sortLikes(likes, effectiveSort, here), [likes, effectiveSort, here]);
    const activeList: SavedRestaurant[] = activeTab === 'likes' ? sortedLikes : dislikes;
    const chooseSort = (next: LikeSort) => {
        setSort(next);
        writeLikeSort(next);
    };
    const counts: Record<ListId, number> = { likes: likes.length, dislikes: dislikes.length };

    return (
        <div className='h-full flex flex-col'>
            <PageHeader
                title='Favoris'
                subtitle={likes.length > 0 ? `${likes.length} resto${likes.length > 1 ? 's' : ''} à tester` : 'Rien de sauvegardé pour l’instant'}
            />

            <div id='wishlist-panel' role='tabpanel' aria-labelledby={`wishlist-tab-${activeTab}`} className='flex-1 overflow-y-auto px-4 pt-4 pb-6'>
                <div role='tablist' aria-label='Mes listes' className='relative grid grid-cols-2 bg-white p-1.5 rounded-full border-[3px] border-plum mb-5'>
                    {LIST_TABS.map(tab => (
                        <button
                            key={tab.id}
                            role='tab'
                            id={`wishlist-tab-${tab.id}`}
                            aria-selected={activeTab === tab.id}
                            aria-controls='wishlist-panel'
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative z-10 min-h-[44px] py-2.5 rounded-full text-sm font-bold transition-colors ${activeTab === tab.id ? 'text-plum' : 'text-slate-muted'}`}
                        >
                            {activeTab === tab.id && (
                                <motion.span
                                    layoutId='wishlist-pill'
                                    className='absolute inset-0 rounded-full bg-bubblegum -z-10'
                                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                                />
                            )}
                            {tab.label} ({counts[tab.id]})
                        </button>
                    ))}
                </div>

                {activeTab === 'likes' && (
                    <div className='space-y-3 mb-4'>
                        <Link
                            href='/groupe?new=1'
                            className='flex items-center gap-3 bg-fooder-secondary rounded-3xl border-[3px] border-plum shadow-hard p-3.5 active:translate-y-0.5'
                        >
                            <span className='w-11 h-11 shrink-0 rounded-full bg-white border-[3px] border-plum flex items-center justify-center'>
                                <Users className='w-5 h-5 text-plum' strokeWidth={2.5} />
                            </span>
                            <span className='min-w-0'>
                                <span className='block font-display text-lg text-plum leading-tight'>On mange où ?</span>
                                <span className='block text-xs font-bold text-plum-muted'>Envoie tes favoris au groupe, chacun swipe</span>
                            </span>
                        </Link>
                        {picks.length > 0 && (
                            <div className='bg-bubblegum rounded-3xl border-[3px] border-plum shadow-hard p-3.5 space-y-2'>
                                <p className='font-display text-lg text-plum leading-tight'>Ton vendredi Fooder</p>
                                <p className='text-xs font-bold text-plum'>Tes coups de cœur à tester ce week-end, ouverts samedi soir en priorité.</p>
                                <ol className='space-y-1'>
                                    {picks.map((p, i) => (
                                        <li key={p.id}>
                                            <button onClick={() => setSelectedRest(p)} className='w-full flex items-center gap-2 min-h-[44px] bg-white rounded-xl border-2 border-plum px-2.5 py-1.5 text-left'>
                                                <span className='font-display text-plum'>{i + 1}</span>
                                                <span className='text-sm font-bold text-plum truncate'>{p.name}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'likes' && likes.length > 0 && <InviteCard variant='banner' className='mb-4' />}

                {activeTab === 'likes' && likes.length > 1 && (
                    <div className='mb-4'>
                        <div role='group' aria-label='Trier les favoris' aria-describedby={here ? undefined : 'wishlist-sort-hint'} className='flex flex-wrap gap-1.5'>
                            {LIKE_SORTS.map(opt => {
                                const unavailable = opt.id === 'proche' && !here;
                                const on = effectiveSort === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        type='button'
                                        disabled={unavailable}
                                        aria-pressed={on}
                                        onClick={() => chooseSort(opt.id)}
                                        className={`min-h-[44px] px-3.5 rounded-full border-[3px] border-plum text-xs font-bold transition-colors ${on ? 'bg-bubblegum text-plum' : 'bg-white text-plum'} ${unavailable ? 'opacity-40' : 'active:translate-y-0.5'}`}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                        {!here && (
                            <p id='wishlist-sort-hint' className='mt-1.5 px-1 text-[11px] font-semibold text-plum-muted'>
                                « Les plus proches » demande ta position : autorise la localisation depuis Découvrir.
                            </p>
                        )}
                    </div>
                )}

                <AnimatePresence mode='popLayout' initial={false}>
                    {activeList.map((rest, index) => (
                        <motion.div
                            layout
                            key={`${activeTab}-${rest.id}`}
                            initial={{ opacity: 0, y: 24, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: Math.min(index, 6) * 0.05, type: 'spring', stiffness: 300, damping: 26 } }}
                            exit={{ opacity: 0, x: -90, scale: 0.92, transition: { duration: 0.22 } }}
                            className='bg-white rounded-3xl p-3.5 panel flex gap-3.5 mb-4'
                        >
                            <button
                                onClick={() => setSelectedRest(rest)}
                                aria-label={`Voir ${rest.name}`}
                                className='w-[88px] h-[88px] rounded-2xl overflow-hidden flex-shrink-0 border-[3px] border-plum'
                            >
                                <FoodImage src={rest.image} alt={rest.name} cuisine={rest.cuisine} className='w-full h-full object-cover' />
                            </button>

                            <div className='flex-1 min-w-0 flex flex-col justify-between'>
                                <div>
                                    <div className='flex justify-between items-start gap-2'>
                                        <h3 className='text-xl text-plum leading-tight line-clamp-2'>{rest.name}</h3>
                                        <button
                                            onClick={() => removeFromList(rest.id, activeTab)}
                                            aria-label={`Retirer ${rest.name}`}
                                            className='text-slate-muted hover:text-danger transition-colors shrink-0 -mt-2 -mr-2 w-11 h-11 flex items-center justify-center'
                                        >
                                            <Trash2 className='w-4 h-4' aria-hidden='true' />
                                        </button>
                                    </div>
                                    <div className='flex items-center gap-1.5 text-xs font-bold mt-1 text-slate-muted'>
                                        {rest.rating > 0 && (
                                            <>
                                                <Star className='w-3 h-3 fill-fooder-orange text-fooder-orange' />
                                                <span>{rest.rating}</span>
                                                <span aria-hidden='true'>•</span>
                                            </>
                                        )}
                                        <span className='truncate'>{rest.cuisine}</span>
                                        {activeTab === 'likes' && addedLabel(rest.likedAt) && (
                                            <>
                                                <span aria-hidden='true'>•</span>
                                                <span className='shrink-0 font-semibold'>{addedLabel(rest.likedAt)}</span>
                                            </>
                                        )}
                                        {visitedIds.has(rest.id) && (
                                            <span className='chip !px-1.5 !py-0 !text-xs bg-fooder-mint text-plum shrink-0'>
                                                <Check className='w-2.5 h-2.5' strokeWidth={3.5} /> Testé
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className='flex gap-1.5 mt-2.5'>
                                    <button
                                        onClick={() => openGoogleMaps(rest)}
                                        className='chip flex-1 justify-center whitespace-nowrap !px-2 min-h-[44px] bg-fooder-secondary text-plum active:translate-y-0.5 transition-transform'
                                    >
                                        <Navigation className='w-3 h-3' /> Y aller
                                    </button>
                                    {activeTab === 'likes' && !visitedIds.has(rest.id) ? (
                                        <button
                                            onClick={() => setCheckin({ target: toVisit(rest), mode: 'confirm' })}
                                            className='chip justify-center !px-2.5 min-h-[44px] bg-fooder-mint text-plum active:translate-y-0.5 transition-transform whitespace-nowrap'
                                        >
                                            J&apos;y suis allé
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setSelectedRest(rest)}
                                            className='chip justify-center !px-2.5 min-h-[44px] bg-white text-plum active:translate-y-0.5 transition-transform'
                                        >
                                            Détail
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleShare(rest)}
                                        aria-label={`Partager ${rest.name}`}
                                        className='chip justify-center !px-2 min-h-[44px] min-w-[44px] bg-white text-plum active:translate-y-0.5 transition-transform'
                                    >
                                        <Share2 className='w-3.5 h-3.5' />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {activeList.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className='py-14 text-center space-y-4 flex flex-col items-center'
                    >
                        <Sticker name='ramen' size={132} rotate={-6} className='bob' />
                        <p className='font-display text-3xl text-plum'>Rien par ici...</p>
                        <p className='text-slate-muted font-medium text-sm'>
                            {activeTab === 'likes' ? 'Swipe à droite pour remplir ta liste.' : 'Les restos que tu écartes atterrissent ici.'}
                        </p>
                        <Link href='/swipe' className='inline-block duo-button bg-fooder-primary text-white px-8'>
                            Aller swiper
                        </Link>
                    </motion.div>
                )}
            </div>

            <DetailSheet rest={selectedRest} onClose={() => setSelectedRest(null)} />
            <ActionToast toast={toast} onDismiss={dismissToast} />
            <CheckinSheet target={checkin?.target ?? null} mode={checkin?.mode ?? 'confirm'} onClose={() => setCheckin(null)} />
        </div>
    );
}

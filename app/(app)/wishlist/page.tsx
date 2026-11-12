'use client';

import { useEffect, useState } from 'react';
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
import { VisitInput } from '../../../lib/visits';
import { isWeekendWindow, weekendPicks } from '../../../lib/rituals';

type ListId = 'likes' | 'dislikes';

const LIST_TABS: { id: ListId; label: string }[] = [
    { id: 'likes', label: 'Coups de cœur' },
    { id: 'dislikes', label: 'Écartés' },
];

function readList(key: string): Restaurant[] {
    try {
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
        return [];
    }
}

export default function WishlistPage() {
    const [likes, setLikes] = useState<Restaurant[]>([]);
    const [dislikes, setDislikes] = useState<Restaurant[]>([]);
    const [activeTab, setActiveTab] = useState<ListId>('likes');
    const [selectedRest, setSelectedRest] = useState<Restaurant | null>(null);
    const [checkin, setCheckin] = useState<{ target: VisitInput; mode: CheckinMode } | null>(null);
    const [weekend, setWeekend] = useState(false);
    const { visits, checkins } = useSocial();
    const visitedIds = new Set(visits.map(v => v.restId));

    useEffect(() => {
        const savedLikes = readList('fooder_likes');
        setLikes(savedLikes.length > 0 ? savedLikes : readList('fooder_wishlist'));
        setDislikes(readList('fooder_dislikes'));
        setWeekend(isWeekendWindow());
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

    const removeFromList = (id: string, list: ListId) => {
        if (list === 'likes') {
            const updated = likes.filter(r => r.id !== id);
            setLikes(updated);
            localStorage.setItem('fooder_likes', JSON.stringify(updated));
            localStorage.setItem('fooder_wishlist', JSON.stringify(updated));
            return;
        }
        const updated = dislikes.filter(r => r.id !== id);
        setDislikes(updated);
        localStorage.setItem('fooder_dislikes', JSON.stringify(updated));
    };

    const openGoogleMaps = (rest: Restaurant) => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${rest.name} ${rest.address}`)}`, '_blank');
    };

    const handleShare = async (rest: Restaurant) => {
        const text = [rest.name, rest.cuisine, rest.price > 0 ? `${rest.price}€` : null].filter(Boolean).join(' · ') + `\n${rest.address}`;
        if (navigator.share) {
            await navigator.share({ title: `Fooder — ${rest.name}`, text });
        } else {
            await navigator.clipboard.writeText(text);
        }
    };

    const activeList = activeTab === 'likes' ? likes : dislikes;
    const counts: Record<ListId, number> = { likes: likes.length, dislikes: dislikes.length };

    return (
        <div className='h-full flex flex-col'>
            <PageHeader
                title='Favoris'
                subtitle={likes.length > 0 ? `${likes.length} resto${likes.length > 1 ? 's' : ''} à tester` : 'Rien de sauvegardé pour l’instant'}
            />

            <div className='flex-1 overflow-y-auto px-4 pt-4 pb-6'>
                <div className='relative grid grid-cols-2 bg-white p-1.5 rounded-full border-[3px] border-plum mb-5'>
                    {LIST_TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative z-10 py-2.5 rounded-full text-sm font-bold transition-colors ${activeTab === tab.id ? 'text-plum' : 'text-slate-500'}`}
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
                                <span className='block text-xs font-bold text-plum/70'>Envoie tes favoris au groupe, chacun swipe</span>
                            </span>
                        </Link>
                        {picks.length > 0 && (
                            <div className='bg-bubblegum rounded-3xl border-[3px] border-plum shadow-hard p-3.5 space-y-2'>
                                <p className='font-display text-lg text-plum leading-tight'>Ton vendredi Fooder</p>
                                <p className='text-xs font-bold text-plum/80'>Tes coups de cœur à tester ce week-end, ouverts samedi soir en priorité.</p>
                                <ol className='space-y-1'>
                                    {picks.map((p, i) => (
                                        <li key={p.id}>
                                            <button onClick={() => setSelectedRest(p)} className='w-full flex items-center gap-2 bg-white rounded-xl border-2 border-plum px-2.5 py-1.5 text-left'>
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
                                            aria-label='Retirer'
                                            className='text-slate-400 hover:text-fooder-red transition-colors shrink-0 mt-0.5'
                                        >
                                            <Trash2 className='w-4 h-4' />
                                        </button>
                                    </div>
                                    <div className='flex items-center gap-1.5 text-xs font-bold mt-1 text-slate-600'>
                                        {rest.rating > 0 && (
                                            <>
                                                <Star className='w-3 h-3 fill-fooder-orange text-fooder-orange' />
                                                <span>{rest.rating}</span>
                                                <span className='text-slate-300'>•</span>
                                            </>
                                        )}
                                        <span className='truncate'>{rest.cuisine}</span>
                                        {visitedIds.has(rest.id) && (
                                            <span className='chip !px-1.5 !py-0 !text-[10px] bg-fooder-mint text-plum shrink-0'>
                                                <Check className='w-2.5 h-2.5' strokeWidth={3.5} /> Testé
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className='flex gap-1.5 mt-2.5'>
                                    <button
                                        onClick={() => openGoogleMaps(rest)}
                                        className='chip flex-1 justify-center whitespace-nowrap !px-2 bg-fooder-secondary text-plum active:translate-y-0.5 transition-transform'
                                    >
                                        <Navigation className='w-3 h-3' /> Y aller
                                    </button>
                                    {activeTab === 'likes' && !visitedIds.has(rest.id) ? (
                                        <button
                                            onClick={() => setCheckin({ target: toVisit(rest), mode: 'confirm' })}
                                            className='chip justify-center !px-2.5 bg-fooder-mint text-plum active:translate-y-0.5 transition-transform whitespace-nowrap'
                                        >
                                            J&apos;y suis allé
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setSelectedRest(rest)}
                                            className='chip justify-center !px-2.5 bg-white text-plum active:translate-y-0.5 transition-transform'
                                        >
                                            Détail
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleShare(rest)}
                                        aria-label='Partager'
                                        className='chip justify-center !px-2 bg-white text-plum active:translate-y-0.5 transition-transform'
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
                        <p className='text-slate-600 font-medium text-sm'>
                            {activeTab === 'likes' ? 'Swipe à droite pour remplir ta liste.' : 'Les restos que tu écartes atterrissent ici.'}
                        </p>
                        <Link href='/swipe' className='inline-block duo-button bg-fooder-primary text-white px-8'>
                            Aller swiper
                        </Link>
                    </motion.div>
                )}
            </div>

            <DetailSheet rest={selectedRest} onClose={() => setSelectedRest(null)} />
            <CheckinSheet target={checkin?.target ?? null} mode={checkin?.mode ?? 'confirm'} onClose={() => setCheckin(null)} />
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigation, Share2, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Restaurant } from '../../../data/mockRestaurants';
import { Sticker } from '../../../components/ui/Sticker';
import { FoodImage } from '../../../components/ui/FoodImage';
import { PageHeader } from '../../../components/nav/PageHeader';
import { DetailSheet } from '../../../components/swipe/DetailSheet';

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

    useEffect(() => {
        const savedLikes = readList('fooder_likes');
        setLikes(savedLikes.length > 0 ? savedLikes : readList('fooder_wishlist'));
        setDislikes(readList('fooder_dislikes'));
    }, []);

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
        const text = `${rest.name} · ${rest.cuisine} · ${rest.price}€\n${rest.address}`;
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
                                        <Star className='w-3 h-3 fill-fooder-orange text-fooder-orange' />
                                        <span>{rest.rating}</span>
                                        <span className='text-slate-300'>•</span>
                                        <span className='truncate'>{rest.cuisine}</span>
                                    </div>
                                </div>

                                <div className='flex gap-1.5 mt-2.5'>
                                    <button
                                        onClick={() => openGoogleMaps(rest)}
                                        className='chip flex-1 justify-center whitespace-nowrap !px-2 bg-fooder-secondary text-plum active:translate-y-0.5 transition-transform'
                                    >
                                        <Navigation className='w-3 h-3' /> Y aller
                                    </button>
                                    <button
                                        onClick={() => setSelectedRest(rest)}
                                        className='chip justify-center !px-2.5 bg-white text-plum active:translate-y-0.5 transition-transform'
                                    >
                                        Détail
                                    </button>
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
        </div>
    );
}

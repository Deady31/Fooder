'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { mockRestaurants, Restaurant } from '../../../data/mockRestaurants';
import { track } from '../../../lib/analytics';
import { communityPhotosFor } from '../../../lib/communityPhotos';
import { useFreemium } from '../../../hooks/useFreemium';
import { useGamification } from '../../../hooks/useGamification';
import { useDailyPicks } from '../../../hooks/useDailyPicks';
import { useMissions } from '../../../hooks/useMissions';
import { PremiumModal } from '../../../components/PremiumModal';
import { MoodSheet } from '../../../components/MoodSheet';
import { CasinoOverlay } from '../../../components/CasinoOverlay';
import { AchievementToast } from '../../../components/AchievementToast';
import { SwipeDeck, SwipeDeckHandle, SwipeDir } from '../../../components/swipe/SwipeDeck';
import { ActionButtons } from '../../../components/swipe/ActionButtons';
import { StickerBurst } from '../../../components/swipe/StickerBurst';
import { DetailSheet } from '../../../components/swipe/DetailSheet';
import { FilterSheet } from '../../../components/swipe/FilterSheet';
import { Sticker } from '../../../components/ui/Sticker';
import { Logo } from '../../../components/ui/Logo';
import { NotificationBell } from '../../../components/notifications/NotificationBell';
import { queueCheckin } from '../../../lib/visits';
import { fetchRestaurantPhotos } from '../../../lib/cloud/social';
import { fetchGooglePhotos } from '../../../lib/placePhotosClient';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    const rounded = Math.round(meters / 10) * 10;
    return `${rounded} m`;
}

const MOOD_FILTERS: Record<string, RegExp | null> = {
    surprise: null,
    asie: /asi|jap|sushi|ramen|thai|chin|vietn|n[ée]pal|indi/i,
    terroir: /fran[cç]|bistro|terroir|gastro|cassoulet/i,
    street: /burger|kebab|kabab|taco|street|fast|pizza|turc/i,
    veggie: /veg|végé|vert|sain|salad|bio/i,
    gros: /burger|pizza|kebab|kabab|grill|steak/i,
    special: /gastro|romant|[ée]toil/i,
    brunch: /brunch|caf[eé]|boulang|bagel|bakery/i,
};

function matchesMood(r: Restaurant, moodId: string): boolean {
    const re = MOOD_FILTERS[moodId];
    if (!re) return true;
    return re.test(`${r.cuisine} ${r.name} ${r.description}`);
}

export default function SwipePage() {
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedRest, setSelectedRest] = useState<Restaurant | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

    const { canSwipe, showPremiumModal, setShowPremiumModal, trySwipe, loaded, isPremium, activatePremium, deactivatePremium } = useFreemium();
    const [showPremiumInfo, setShowPremiumInfo] = useState(false);

    const [budget, setBudget] = useState<number>(50);
    const [cuisine, setCuisine] = useState<string>('All');

    const { newAchievement, clearNewAchievement, gainXP, unlock } = useGamification();
    const { picks: dailyPicks } = useDailyPicks(restaurants);
    const { progress: missionProgress } = useMissions();
    const [showMoodSheet, setShowMoodSheet] = useState(false);
    const [casinoRest, setCasinoRest] = useState<string | null>(null);
    const [moodLabel, setMoodLabel] = useState<string>('Surprends-moi');
    const [currentMoodId, setCurrentMoodId] = useState<string>('surprise');
    const [burst, setBurst] = useState({ id: 0, active: false });

    useEffect(() => {
        const prefs = JSON.parse(localStorage.getItem('fooder_preferences') || '{}');
        if (prefs.budget) setBudget(prefs.budget);
        if (prefs.cravingLabel) setMoodLabel(prefs.cravingLabel);
        if (prefs.craving) setCurrentMoodId(prefs.craving);
    }, []);

    const deckRef = useRef<SwipeDeckHandle>(null);
    const allRestaurantsRef = useRef<Restaurant[]>([]);

    const sortWithSponsored = (list: Restaurant[]): Restaurant[] => {
        const sponsored = list.filter(r => r.sponsored);
        const regular = list.filter(r => !r.sponsored);
        return [...sponsored, ...regular];
    };

    const poolForSavedMood = (list: Restaurant[]): Restaurant[] => {
        const prefs = JSON.parse(localStorage.getItem('fooder_preferences') || '{}');
        const matched = list.filter(r => matchesMood(r, prefs.craving || 'surprise'));
        return matched.length > 0 ? matched : list;
    };

    const pageRef = useRef<{ offset: number; total: number; loading: boolean; coords: { lat: number; lng: number } | null }>({
        offset: 0,
        total: Infinity,
        loading: false,
        coords: null,
    });

    const seenIds = (): Set<string> => {
        const ids = new Set<string>();
        for (const key of ['fooder_likes', 'fooder_dislikes']) {
            try {
                (JSON.parse(localStorage.getItem(key) || '[]') as { id: string }[]).forEach(r => ids.add(r.id));
            } catch {
                /* liste illisible : on ignore */
            }
        }
        return ids;
    };

    const fetchPage = async (): Promise<Restaurant[]> => {
        const pg = pageRef.current;
        const qs = new URLSearchParams({ limit: '50', radius: '3000', offset: String(pg.offset) });
        if (pg.coords) {
            qs.set('lat', String(pg.coords.lat));
            qs.set('lng', String(pg.coords.lng));
        }
        const res = await fetch(`/api/restaurants?${qs.toString()}`);
        const json = await res.json();
        if (!json.success) return [];
        pg.offset += (json.data as Restaurant[]).length;
        pg.total = json.meta.total;
        return json.data as Restaurant[];
    };

    /** Ajoute une page de restos au bas du deck quand il reste peu de cartes. */
    const loadMore = async (): Promise<void> => {
        const pg = pageRef.current;
        if (pg.loading || pg.offset >= pg.total) return;
        pg.loading = true;
        try {
            const have = new Set(allRestaurantsRef.current.map(r => r.id));
            const seen = seenIds();
            const fresh = (await fetchPage()).filter(r => !have.has(r.id) && !seen.has(r.id));
            if (fresh.length === 0) return;
            allRestaurantsRef.current = [...allRestaurantsRef.current, ...fresh];
            const add = fresh.filter(r => matchesMood(r, currentMoodId));
            if (add.length > 0) {
                setRestaurants(prev => [...[...add].reverse(), ...prev]);
                setCurrentIndex(i => i + add.length);
            }
        } catch {
            /* réseau coupé : on réessaiera au prochain swipe */
        } finally {
            pg.loading = false;
        }
    };

    useEffect(() => {
        const getCoords = () =>
            new Promise<{ lat: number; lng: number } | null>(resolve => {
                if (!navigator.geolocation) return resolve(null);
                navigator.geolocation.getCurrentPosition(
                    pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    () => resolve(null),
                    { timeout: 5000, maximumAge: 300000 }
                );
            });

        const loadAppData = async () => {
            setIsLoading(true);
            const coords = await getCoords();
            if (coords) setUserCoords(coords);

            pageRef.current.coords = coords;
            let fromApi: Restaurant[] = [];
            try {
                fromApi = await fetchPage();
            } catch {
                fromApi = [];
            }

            // Les fiches soignées (photos, menus) passent devant ; l'API complète avec tout Toulouse.
            const known = new Set(mockRestaurants.map(r => r.name.toLowerCase()));
            const seen = seenIds();
            const candidates = [...mockRestaurants, ...fromApi.filter(r => !known.has(r.name.toLowerCase()))];
            const unseen = candidates.filter(r => !seen.has(r.id));
            const merged = unseen.length > 0 ? unseen : candidates;
            const cloudPhotos = await fetchRestaurantPhotos(merged.map(r => r.id)).catch(() => new Map<string, string[]>());
            const withCommunity = merged.map(r => {
                const photos = [...communityPhotosFor(r.id), ...(cloudPhotos.get(r.id) ?? [])];
                return photos.length > 0 ? { ...r, image: photos[0], extraImages: photos.slice(1), photoSource: 'community' as const } : r;
            });
            const sorted = sortWithSponsored(withCommunity);
            allRestaurantsRef.current = sorted;
            const pool = poolForSavedMood(sorted);
            setRestaurants([...pool].reverse());
            setCurrentIndex(pool.length - 1);
            setIsLoading(false);
        };

        loadAppData();
    }, []);

    const applyFilters = () => {
        let filtered = [...restaurants].filter(r => r.price <= budget);
        if (cuisine !== 'All') {
            filtered = filtered.filter(r => r.cuisine === cuisine);
        }
        setRestaurants(filtered);
        setCurrentIndex(filtered.length - 1);
        setShowFilters(false);
    };

    const persistChoice = (key: 'fooder_likes' | 'fooder_dislikes', restaurant: Restaurant) => {
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        if (!list.find((r: Restaurant) => r.id === restaurant.id)) {
            localStorage.setItem(key, JSON.stringify([...list, restaurant]));
        }
    };

    const swiped = (direction: SwipeDir, restaurant: Restaurant, index: number) => {
        trySwipe();
        track('swipe', { direction });
        setCurrentIndex(index - 1);
        if (index - 1 < 6) void loadMore();

        gainXP(5);
        unlock('first_swipe');
        missionProgress('swipe_5');
        missionProgress('swipe_10');
        missionProgress('swipe_20');

        if (direction === 'right') {
            persistChoice('fooder_likes', restaurant);
            queueCheckin(restaurant);
            const wishlist = JSON.parse(localStorage.getItem('fooder_wishlist') || '[]');
            if (!wishlist.find((r: Restaurant) => r.id === restaurant.id)) {
                localStorage.setItem('fooder_wishlist', JSON.stringify([...wishlist, restaurant]));
            }
            if (typeof window !== 'undefined' && window.navigator.vibrate) {
                window.navigator.vibrate(50);
            }
            setBurst(b => ({ id: b.id + 1, active: true }));

            gainXP(15);
            unlock('first_like');
            missionProgress('like_3');
            if (restaurant.price < 15) missionProgress('like_cheap');
            if (restaurant.price > 50) missionProgress('like_premium');

            const likes: Restaurant[] = JSON.parse(localStorage.getItem('fooder_likes') || '[]');
            if (likes.length >= 10) unlock('likes_10');
            if (likes.length >= 50) unlock('likes_50');
            if (likes.filter((r: Restaurant) => r.price < 15).length >= 5) unlock('cheap_hunter');
            if (likes.filter((r: Restaurant) => r.price > 80).length >= 3) unlock('gasto_hunter');

            if (Math.random() < 0.1) {
                setCasinoRest(restaurant.name);
                unlock('casino_win');
            }
        } else {
            persistChoice('fooder_dislikes', restaurant);
            missionProgress('dislike_5');
        }

        const allLikes: Restaurant[] = JSON.parse(localStorage.getItem('fooder_likes') || '[]');
        const allDislikes: Restaurant[] = JSON.parse(localStorage.getItem('fooder_dislikes') || '[]');
        if (allLikes.length + allDislikes.length >= 100) unlock('swipes_100');
    };

    const openDetails = async (restaurant: Restaurant) => {
        setSelectedRest(restaurant);
        missionProgress('open_detail');
    };

    const handleMoodSelect = (moodId: string, label: string) => {
        setCurrentMoodId(moodId);
        setMoodLabel(label);
        const prefs = JSON.parse(localStorage.getItem('fooder_preferences') || '{}');
        localStorage.setItem('fooder_preferences', JSON.stringify({ ...prefs, craving: moodId, cravingLabel: label }));

        const all = allRestaurantsRef.current;
        const matched = all.filter(r => matchesMood(r, moodId));
        const pool = matched.length > 0 ? matched : all;
        setRestaurants([...pool].reverse());
        setCurrentIndex(pool.length - 1);
    };

    const cuisines = ['All', ...Array.from(new Set(restaurants.map(r => r.cuisine)))];
    const deckCards = restaurants.slice(0, currentIndex + 1);

    // Vraies photos Google pour la carte du dessus et les suivantes (jamais pour tout le catalogue : coût et règles de Google).
    const requestedPhotos = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (isLoading) return;
        const upcoming = restaurants.slice(Math.max(0, currentIndex - 3), currentIndex + 1);
        for (const r of upcoming) {
            if (r.photoSource === 'community' || r.photoSource === 'google' || requestedPhotos.current.has(r.id)) continue;
            requestedPhotos.current.add(r.id);
            fetchGooglePhotos(r).then(photos => {
                if (photos.length === 0) return;
                const apply = (x: Restaurant): Restaurant =>
                    x.id === r.id
                        ? { ...x, image: photos[0].url, extraImages: photos.slice(1).map(p => p.url), photoSource: 'google', photoCredit: photos[0].author }
                        : x;
                setRestaurants(prev => prev.map(apply));
                allRestaurantsRef.current = allRestaurantsRef.current.map(apply);
            });
        }
    }, [currentIndex, restaurants.length, isLoading]);
    const isDeckEmpty = currentIndex < 0 && restaurants.length > 0;

    return (
        <div className={`flex flex-col h-full overflow-hidden relative transition-colors duration-700 ${isPremium ? 'premium-bg doodle-bg' : ''}`}>

            {/* Top bar */}
            <header className={`shrink-0 flex items-center justify-between gap-2 px-4 pt-3 pb-2.5 backdrop-blur-md border-b-[3px] border-plum z-20 ${isPremium ? 'premium-navbar' : 'bg-cream/90'}`}>
                <button
                    onClick={() => setShowFilters(true)}
                    aria-label='Filtres'
                    className='w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all'
                >
                    <SlidersHorizontal className='w-5 h-5 text-plum' strokeWidth={2.5} />
                </button>

                <div className='flex flex-col items-center gap-1.5 min-w-0'>
                    <button
                        onClick={() => isPremium && setShowPremiumInfo(true)}
                        aria-label={isPremium ? 'fooder, compte Premium' : 'fooder'}
                        className='active:scale-95 transition-transform'
                    >
                        <Logo variant={isPremium ? 'gold' : 'pink'} className='w-[clamp(130px,40vw,176px)]' />
                    </button>
                    <button
                        onClick={() => setShowMoodSheet(true)}
                        className='chip bg-fooder-secondary text-plum active:translate-y-0.5 transition-transform'
                    >
                        <span className='truncate max-w-[110px]'>{moodLabel}</span>
                        <ChevronDown className='w-3 h-3' strokeWidth={3} />
                    </button>
                </div>

                <NotificationBell />
            </header>

            {/* Deck */}
            <main className='flex-1 relative flex items-center justify-center min-h-0 pt-3 pb-1'>
                {isLoading ? (
                    <div className='flex flex-col items-center gap-5'>
                        <div className='flex items-end gap-2'>
                            <div className='bob' style={{ ['--r' as string]: '-8deg' }}><Sticker name='burger' size={72} rotate={-8} /></div>
                            <div className='bob' style={{ ['--r' as string]: '4deg', animationDelay: '0.4s' }}><Sticker name='pizza' size={84} rotate={4} /></div>
                            <div className='bob' style={{ ['--r' as string]: '10deg', animationDelay: '0.8s' }}><Sticker name='boba' size={72} rotate={10} /></div>
                        </div>
                        <p className='font-display text-xl text-plum'>On cherche des pépites...</p>
                    </div>
                ) : isDeckEmpty ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className='flex flex-col items-center text-center px-8 gap-6'
                    >
                        <div className='relative h-32 w-48'>
                            <div className='absolute left-0 top-2 bob' style={{ ['--r' as string]: '-12deg' }}><Sticker name='donut' size={84} rotate={-12} /></div>
                            <div className='absolute right-0 top-0 bob' style={{ ['--r' as string]: '10deg', animationDelay: '0.5s' }}><Sticker name='icecream' size={92} rotate={10} /></div>
                        </div>
                        <div className='space-y-2'>
                            <h3 className='text-4xl text-plum'>Tu as tout vu !</h3>
                            <p className='text-slate-600 font-medium text-sm leading-relaxed'>
                                Tous les restaurants du coin sont passés entre tes doigts.<br />
                                Retrouve tes coups de cœur ou change d&apos;envie.
                            </p>
                        </div>
                        <div className='flex flex-col w-full gap-3'>
                            <Link href='/wishlist' className='duo-button bg-bubblegum text-plum py-4 text-base text-center'>
                                Voir mes coups de cœur
                            </Link>
                            <button onClick={() => setShowMoodSheet(true)} className='duo-button bg-white text-plum py-4 text-base'>
                                Changer d&apos;envie
                            </button>
                        </div>
                    </motion.div>
                ) : restaurants.length > 0 ? (
                    <SwipeDeck
                        ref={deckRef}
                        cards={deckCards}
                        canSwipe={canSwipe}
                        onSwipe={swiped}
                        onOpen={openDetails}
                        onBlocked={() => setShowPremiumModal(true)}
                    />
                ) : (
                    <div className='text-center space-y-6 px-8'>
                        <div className='flex justify-center'><Sticker name='ramen' size={120} rotate={-6} className='bob' /></div>
                        <div className='space-y-2'>
                            <h3 className='text-3xl text-plum'>C&apos;est le désert...</h3>
                            <p className='text-slate-600 font-medium'>Élargis tes filtres pour trouver plus de choix !</p>
                        </div>
                        <button onClick={() => window.location.reload()} className='duo-button bg-fooder-primary text-white px-12 py-4'>
                            Rechercher
                        </button>
                    </div>
                )}
            </main>

            <ActionButtons
                hidden={isLoading || currentIndex < 0}
                onNope={() => deckRef.current?.swipe('left')}
                onLike={() => deckRef.current?.swipe('right')}
            />

            {burst.active && <StickerBurst burstId={burst.id} onDone={() => setBurst(b => ({ ...b, active: false }))} />}

            <DetailSheet rest={selectedRest} onClose={() => setSelectedRest(null)} />

            <FilterSheet
                isOpen={showFilters}
                budget={budget}
                cuisine={cuisine}
                cuisines={cuisines}
                onBudget={setBudget}
                onCuisine={setCuisine}
                onApply={applyFilters}
                onClose={() => setShowFilters(false)}
            />

            <PremiumModal
                isOpen={showPremiumModal}
                onClose={() => setShowPremiumModal(false)}
                onActivate={activatePremium}
            />

            <AnimatePresence>
                {showPremiumInfo && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className='fixed inset-0 z-[200] flex items-end justify-center p-4 pb-8 bg-plum/60 backdrop-blur-sm'
                        onClick={(e) => { if (e.target === e.currentTarget) setShowPremiumInfo(false); }}
                    >
                        <motion.div
                            initial={{ y: 60, opacity: 0, scale: 0.94 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 60, opacity: 0 }}
                            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
                            className='w-full max-w-md bg-cream rounded-[32px] overflow-hidden panel'
                        >
                            <div className='p-7 space-y-5 text-center'>
                                <div className='flex justify-center'><Sticker name='cupcake' size={88} rotate={-6} /></div>
                                <div>
                                    <h2 className='text-3xl text-plum'>Tu es Premium !</h2>
                                    <p className='text-slate-600 text-sm font-medium mt-1'>Swipes illimités · Accès exclusif · Filtres avancés</p>
                                </div>
                                <button
                                    onClick={() => { deactivatePremium(); setShowPremiumInfo(false); }}
                                    className='w-full py-3.5 rounded-full bg-white border-[3px] border-plum text-plum/70 font-bold text-xs active:translate-y-0.5 transition-transform'
                                >
                                    Désactiver Premium (test)
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <MoodSheet
                isOpen={showMoodSheet}
                onClose={() => setShowMoodSheet(false)}
                currentMood={currentMoodId}
                onSelect={handleMoodSelect}
            />

            <CasinoOverlay
                visible={casinoRest !== null}
                restaurant={casinoRest || ''}
                onDone={() => setCasinoRest(null)}
            />

            <AchievementToast achievement={newAchievement} onDone={clearNewAchievement} />
        </div>
    );
}

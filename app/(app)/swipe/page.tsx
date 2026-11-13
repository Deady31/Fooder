'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { mockRestaurants, Restaurant } from '../../../data/mockRestaurants';
import { track } from '../../../lib/analytics';
import { communityPhotosFor } from '../../../lib/communityPhotos';
import { CommunityPhoto, mergeCommunityPhotos, withBetterPhoto } from '../../../lib/photoPriority';
import { useGamification } from '../../../hooks/useGamification';
import { useDailyPicks } from '../../../hooks/useDailyPicks';
import { useMissions } from '../../../hooks/useMissions';
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
import { CHECKINS_KEY, queueCheckin, readCheckins } from '../../../lib/visits';
import { fetchRestaurantPhotoDetails } from '../../../lib/cloud/social';
import { openCardProps, swipeProps } from '../../../lib/usageProps';
import { rankRichFirst } from '../../../lib/ranking';
import { applyFilters as applyDeckFilters, dietsFromProfile, toggleDiet, FILTER_DIETS } from '../../../lib/filters';
import { DIET_LABEL } from '../../../lib/diets';
import type { Diet } from '../../../data/mockRestaurants';
import { readJson, writeJson } from '../../../lib/store';
import { createRewardLedger } from '../../../components/swipe/rewardLedger';
import { LastSwipe, removeById, removePendingCheckin } from '../../../components/swipe/undo';

const OPEN_NOW_KEY = 'fooder_open_now';
const DIET_FILTER_KEY = 'fooder_diet_filter';
const PROFILE_KEY = 'fooder_profile';
const MAX_AUTO_LOADS = 3;
const EXIT_ANIM_MS = 550;

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
    const [openNow, setOpenNow] = useState(false);
    const [diets, setDiets] = useState<Diet[]>([]);
    const [now, setNow] = useState(() => new Date());
    const [lastSwipe, setLastSwipe] = useState<LastSwipe | null>(null);
    const ledger = useRef(createRewardLedger());
    const autoLoads = useRef(0);
    const [exiting, setExiting] = useState(false);
    const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current); }, []);

    useEffect(() => {
        setOpenNow(readJson<boolean>(OPEN_NOW_KEY, false) === true);
        // Régimes : choix mémorisé ; première visite = préactivation depuis le profil (une seule fois).
        const stored = readJson<unknown>(DIET_FILTER_KEY, null);
        if (Array.isArray(stored)) {
            setDiets(stored.filter((d): d is Diet => FILTER_DIETS.includes(d as Diet)));
        } else {
            let raw: string | null = null;
            try { raw = localStorage.getItem(PROFILE_KEY); } catch { /* stockage indisponible */ }
            const initial = dietsFromProfile(raw);
            setDiets(initial);
            writeJson(DIET_FILTER_KEY, initial);
        }
        const tick = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(tick);
    }, []);

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
            const add = rankRichFirst(fresh.filter(r => matchesMood(r, currentMoodId)));
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
            const cloudPhotos = await fetchRestaurantPhotoDetails(merged.map(r => r.id)).catch(() => new Map<string, CommunityPhoto[]>());
            const withCommunity = merged.map(r => {
                const photos = mergeCommunityPhotos(communityPhotosFor(r.id), cloudPhotos.get(r.id) ?? []); // la plus aimée en premier
                return withBetterPhoto(r, { source: 'community', images: photos });
            });
            const sorted = sortWithSponsored(rankRichFirst(withCommunity));
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
        setLastSwipe(null);
        setShowFilters(false);
    };

    const persistChoice = (key: 'fooder_likes' | 'fooder_dislikes', restaurant: Restaurant) => {
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        if (!list.find((r: Restaurant) => r.id === restaurant.id)) {
            localStorage.setItem(key, JSON.stringify([...list, restaurant]));
        }
    };

    const swiped = (direction: SwipeDir, restaurant: Restaurant, deckIndex: number) => {
        // Index réel dans la liste complète (le deck peut être filtré « ouvert maintenant »).
        const found = restaurants.findIndex(r => r.id === restaurant.id);
        const index = found >= 0 ? found : deckIndex;
        // Chaque récompense n'est donnée qu'une fois par resto : annuler puis re-swiper ne rapporte rien de plus.
        const firstSwipe = ledger.current.claim(`${restaurant.id}:swipe`);

        const choiceKey = direction === 'right' ? 'fooder_likes' : 'fooder_dislikes';
        setLastSwipe({
            rest: restaurant,
            dir: direction,
            wasInChoiceList: readJson<Restaurant[]>(choiceKey, []).some(r => r.id === restaurant.id),
            wasInWishlist: readJson<Restaurant[]>('fooder_wishlist', []).some(r => r.id === restaurant.id),
            hadCheckin: readCheckins().some(c => c.restId === restaurant.id),
        });
        setExiting(true);
        if (exitTimer.current) clearTimeout(exitTimer.current);
        exitTimer.current = setTimeout(() => setExiting(false), EXIT_ANIM_MS);

        track('swipe', { direction });
        if (firstSwipe) track(direction === 'right' ? 'swipe_like' : 'swipe_pass', swipeProps(restaurant));
        setCurrentIndex(index - 1);
        if (index - 1 < 6) void loadMore();

        if (firstSwipe) {
            gainXP(5);
            unlock('first_swipe');
            missionProgress('swipe_5');
            missionProgress('swipe_10');
            missionProgress('swipe_20');
        }

        if (direction === 'right') {
            const firstLike = ledger.current.claim(`${restaurant.id}:like`);
            persistChoice('fooder_likes', restaurant);
            if (firstLike) queueCheckin(restaurant);
            const wishlist = JSON.parse(localStorage.getItem('fooder_wishlist') || '[]');
            if (!wishlist.find((r: Restaurant) => r.id === restaurant.id)) {
                localStorage.setItem('fooder_wishlist', JSON.stringify([...wishlist, restaurant]));
            }
            if (typeof window !== 'undefined' && window.navigator.vibrate) {
                window.navigator.vibrate(50);
            }
            setBurst(b => ({ id: b.id + 1, active: true }));

            if (firstLike) {
                gainXP(15);
                unlock('first_like');
                missionProgress('like_3');
                if (restaurant.price < 15) missionProgress('like_cheap');
                if (restaurant.price > 50) missionProgress('like_gastro');
            }

            const likes: Restaurant[] = JSON.parse(localStorage.getItem('fooder_likes') || '[]');
            if (likes.length >= 10) unlock('likes_10');
            if (likes.length >= 50) unlock('likes_50');
            if (likes.filter((r: Restaurant) => r.price < 15).length >= 5) unlock('cheap_hunter');
            if (likes.filter((r: Restaurant) => r.price > 80).length >= 3) unlock('gasto_hunter');

            if (firstLike && Math.random() < 0.1) {
                setCasinoRest(restaurant.name);
                unlock('casino_win');
            }
        } else {
            persistChoice('fooder_dislikes', restaurant);
            if (ledger.current.claim(`${restaurant.id}:dislike`)) missionProgress('dislike_5');
        }

        const allLikes: Restaurant[] = JSON.parse(localStorage.getItem('fooder_likes') || '[]');
        const allDislikes: Restaurant[] = JSON.parse(localStorage.getItem('fooder_dislikes') || '[]');
        if (allLikes.length + allDislikes.length >= 100) unlock('swipes_100');
    };

    /** Remet la dernière carte swipée au sommet et retire son effet (likes, wishlist, dislikes). XP et missions ne sont pas rejouées au re-swipe. */
    const undoLast = () => {
        const last = lastSwipe;
        if (!last || exiting) return;
        setLastSwipe(null);
        const index = restaurants.findIndex(r => r.id === last.rest.id);
        if (index < 0) return;
        const id = last.rest.id;
        const choiceKey = last.dir === 'right' ? 'fooder_likes' : 'fooder_dislikes';
        if (!last.wasInChoiceList) writeJson(choiceKey, removeById(readJson<Restaurant[]>(choiceKey, []), id));
        if (last.dir === 'right' && !last.wasInWishlist) {
            writeJson('fooder_wishlist', removeById(readJson<Restaurant[]>('fooder_wishlist', []), id));
        }
        if (last.dir === 'right' && !last.hadCheckin) {
            writeJson(CHECKINS_KEY, removePendingCheckin(readCheckins(), id));
        }
        setCasinoRest(null);
        setCurrentIndex(index);
    };

    const toggleOpenNow = () => {
        const next = !openNow;
        setOpenNow(next);
        writeJson(OPEN_NOW_KEY, next);
    };

    const toggleDietChip = (diet: Diet) => {
        const next = toggleDiet(diets, diet);
        setDiets(next);
        writeJson(DIET_FILTER_KEY, next);
    };

    const clearFilters = () => {
        setDiets([]);
        writeJson(DIET_FILTER_KEY, []);
        if (openNow) toggleOpenNow();
    };

    const openDetails = async (restaurant: Restaurant) => {
        setSelectedRest(restaurant);
        track('open_card', openCardProps(restaurant, 'swipe'));
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
        setLastSwipe(null);
    };

    const cuisines = ['All', ...Array.from(new Set(restaurants.map(r => r.cuisine)))];
    const remaining = restaurants.slice(0, currentIndex + 1);
    // « Ouvert maintenant » (horaires inconnus = exclus) + régimes (fiches sans info exclues).
    const filterActive = openNow || diets.length > 0;
    const deckCards = filterActive ? applyDeckFilters(remaining, { openNow, diets, now }) : remaining;

    // Filtre actif et peu de cartes : on charge quelques pages de plus (plafonné).
    useEffect(() => {
        autoLoads.current = 0;
    }, [openNow, diets, currentIndex]);
    useEffect(() => {
        if (isLoading || !filterActive || deckCards.length >= 6 || autoLoads.current >= MAX_AUTO_LOADS) return;
        autoLoads.current += 1;
        void loadMore();
    }, [isLoading, filterActive, deckCards.length, restaurants.length]);

    // Aucune photo Google pendant le swipe : la carte montre un vrai plat (communauté) ou un plat typique ; Google = fiche seulement.
    const isDeckEmpty = currentIndex < 0 && restaurants.length > 0;
    const noneOpen = filterActive && !isDeckEmpty && restaurants.length > 0 && deckCards.length === 0;

    return (
        <div className='flex flex-col h-full overflow-hidden relative'>

            {/* Top bar */}
            <header className='shrink-0 flex items-center justify-between gap-2 px-4 pt-3 pb-2.5 backdrop-blur-md border-b-[3px] border-plum z-20 bg-cream/90'>
                <button
                    onClick={() => setShowFilters(true)}
                    aria-label='Filtres'
                    className='w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all'
                >
                    <SlidersHorizontal className='w-5 h-5 text-plum' strokeWidth={2.5} />
                </button>

                <div className='flex flex-col items-center gap-1.5 min-w-0'>
                    <Logo className='w-[clamp(130px,40vw,176px)]' />
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

            {!isLoading && restaurants.length > 0 && (
                <div className='shrink-0 px-4 pt-2'>
                    <div className='flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -my-1'>
                        <button
                            onClick={toggleOpenNow}
                            aria-pressed={openNow}
                            className={`chip shrink-0 min-h-[44px] text-plum active:translate-y-0.5 transition-transform ${openNow ? 'bg-fooder-mint' : 'bg-white'}`}
                        >
                            <span className={`w-2 h-2 rounded-full border-[1.5px] border-plum ${openNow ? 'bg-white' : 'bg-fooder-mint'}`} />
                            Ouvert maintenant
                        </button>
                        {FILTER_DIETS.map(d => {
                            const active = diets.includes(d);
                            return (
                                <button
                                    key={d}
                                    onClick={() => toggleDietChip(d)}
                                    aria-pressed={active}
                                    className={`chip shrink-0 min-h-[44px] min-w-[44px] justify-center text-plum active:translate-y-0.5 transition-transform ${active ? 'bg-fooder-primary !text-white shadow-hard font-extrabold' : 'bg-white'}`}
                                >
                                    {active && <span aria-hidden='true'>✓</span>}
                                    {DIET_LABEL[d]}
                                </button>
                            );
                        })}
                    </div>
                    {filterActive && !isDeckEmpty && (
                        <p className='mt-1 text-center text-xs font-bold text-plum/70' aria-live='polite'>
                            {deckCards.length} {deckCards.length > 1 ? 'restos' : 'resto'} à découvrir
                        </p>
                    )}
                </div>
            )}

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
                            {lastSwipe && (
                                <button onClick={undoLast} disabled={exiting} className='duo-button bg-white text-plum py-3 text-sm'>
                                    Annuler mon dernier swipe
                                </button>
                            )}
                        </div>
                    </motion.div>
                ) : noneOpen ? (
                    <div className='flex flex-col items-center text-center px-8 gap-5'>
                        <div className='bob' style={{ ['--r' as string]: '-6deg' }}><Sticker name='ramen' size={96} rotate={-6} /></div>
                        <div className='space-y-2'>
                            {diets.length > 0 ? (
                                <>
                                    <h3 className='text-3xl text-plum'>Pas encore de résultat</h3>
                                    <p className='text-slate-600 font-medium text-sm leading-relaxed'>
                                        Peu de restos renseignés pour ce régime (selon OpenStreetMap).
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h3 className='text-3xl text-plum'>Rien d&apos;ouvert pour le moment</h3>
                                    <p className='text-slate-600 font-medium text-sm leading-relaxed'>
                                        Aucun resto restant n&apos;est ouvert, ou ses horaires sont inconnus.
                                    </p>
                                </>
                            )}
                        </div>
                        <div className='flex flex-col w-full gap-3'>
                            <button
                                onClick={diets.length > 0 ? clearFilters : toggleOpenNow}
                                className='duo-button bg-bubblegum text-plum py-4 text-base'
                            >
                                {diets.length > 0 ? 'Voir tout' : 'Voir aussi les fermés'}
                            </button>
                            {lastSwipe && (
                                <button onClick={undoLast} disabled={exiting} className='duo-button bg-white text-plum py-3 text-sm'>
                                    Annuler mon dernier swipe
                                </button>
                            )}
                        </div>
                    </div>
                ) : restaurants.length > 0 ? (
                    <SwipeDeck
                        ref={deckRef}
                        cards={deckCards}
                        onSwipe={swiped}
                        onOpen={openDetails}
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
                hidden={isLoading || currentIndex < 0 || noneOpen}
                onNope={() => deckRef.current?.swipe('left')}
                onLike={() => deckRef.current?.swipe('right')}
                onUndo={undoLast}
                canUndo={lastSwipe !== null && !exiting}
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

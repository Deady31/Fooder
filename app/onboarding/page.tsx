'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, X, Heart, Star, MapPin, BookOpen, Pointer } from 'lucide-react';
import { Sticker } from '../../components/ui/Sticker';
import { StickerName } from '../../lib/stickers';

type StepId = 'welcome' | 'swipe' | 'tap' | 'budget' | 'cuisine';
const STEPS: StepId[] = ['welcome', 'swipe', 'tap', 'budget', 'cuisine'];
const PROGRESS_STEPS = STEPS.filter(s => s !== 'welcome');

const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
};

/* ── Welcome ─────────────────────────────────────────────────────── */
function WelcomeStep({ onNext }: { onNext: () => void }) {
    const floaters: { sticker: StickerName; top: string; left?: string; right?: string; cls: string; delay: string; size: number; rot: number }[] = [
        { sticker: 'pizza', top: '8%', left: '4%', cls: 'float-a', delay: '0s', size: 92, rot: -12 },
        { sticker: 'ramen', top: '14%', right: '4%', cls: 'float-b', delay: '0.4s', size: 88, rot: 10 },
        { sticker: 'salad', top: '84%', left: '4%', cls: 'float-c', delay: '0.8s', size: 76, rot: -8 },
        { sticker: 'burger', top: '82%', right: '4%', cls: 'float-a', delay: '1.2s', size: 84, rot: 12 },
        { sticker: 'donut', top: '36%', left: '6%', cls: 'float-b', delay: '0.2s', size: 64, rot: 8 },
        { sticker: 'icecream', top: '40%', right: '6%', cls: 'float-c', delay: '1s', size: 70, rot: -10 },
    ];
    return (
        <div className='flex flex-col items-center justify-center h-full px-6 relative overflow-hidden'>
            {floaters.map((f, i) => (
                <span key={i} className={`absolute select-none pointer-events-none ${f.cls}`}
                    style={{ top: f.top, left: f.left, right: f.right, animationDelay: f.delay }}>
                    <Sticker name={f.sticker} size={f.size} rotate={f.rot} />
                </span>
            ))}
            <div className='relative z-10 text-center space-y-6 flex flex-col items-center'>
                <motion.div
                    initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                >
                    <h1 className='wordmark text-[88px]'>fooder</h1>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className='space-y-3'>
                    <p className='font-display text-4xl text-plum leading-tight'>Swipe.<br />Mange.<br />Répète.</p>
                </motion.div>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
                    className='text-slate-500 font-medium text-base max-w-xs leading-relaxed'>
                    Trouve ton prochain resto en moins de 30 secondes, sans prise de tête.
                </motion.p>
                <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                    onClick={onNext}
                    className='w-full max-w-xs duo-button bg-fooder-primary border-fooder-primary text-white text-xl py-5 flex items-center justify-center gap-2'>
                    Commencer <ChevronRight className='w-6 h-6' />
                </motion.button>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                    className='text-slate-400 text-xs font-medium'>
                    Gratuit · Aucune inscription requise
                </motion.p>
            </div>
        </div>
    );
}

/* ── Swipe mechanic ──────────────────────────────────────────────── */
function SwipeStep({ onNext }: { onNext: () => void }) {
    return (
        <div className='flex flex-col h-full px-6 pt-4 pb-8'>
            <div className='flex-1 flex flex-col items-center justify-center gap-8'>
                <div className='text-center space-y-2'>
                    <p className='text-xs font-black text-fooder-primary uppercase tracking-[0.2em]'>Comment ça marche</p>
                    <h2 className='text-3xl font-black text-slate-900 tracking-tight leading-tight'>Swipe pour<br />choisir</h2>
                </div>
                <div className='relative flex items-center justify-center w-full'>
                    <div className='absolute left-0 flex flex-col items-center gap-1.5 z-10'>
                        <div className='w-14 h-14 rounded-full bg-white border-[3px] border-plum shadow-hard flex items-center justify-center'>
                            <X className='w-7 h-7 text-fooder-red' strokeWidth={4} />
                        </div>
                        <span className='text-xs font-black text-fooder-red uppercase tracking-wider'>Bof</span>
                        <span className='text-slate-500 text-[10px] font-bold'>← gauche</span>
                    </div>
                    <div className='card-wobble w-52 bg-white rounded-[26px] panel overflow-hidden mx-auto'>
                        <div className='h-32 bg-fooder-secondary border-b-[3px] border-plum flex items-center justify-center'>
                            <Sticker name='pizza' size={104} rotate={-6} />
                        </div>
                        <div className='p-4 space-y-2'>
                            <p className='font-display text-xl text-plum'>Pizza Lola</p>
                            <div className='flex items-center gap-2'>
                                <span className='chip bg-fooder-primary text-white !text-[10px] !px-2.5 !py-1'>Italien</span>
                                <span className='chip bg-fooder-secondary text-plum !text-[10px] !px-2.5 !py-1'>17€</span>
                            </div>
                        </div>
                    </div>
                    <div className='absolute right-0 flex flex-col items-center gap-1.5 z-10'>
                        <div className='w-14 h-14 rounded-full bg-bubblegum border-[3px] border-plum shadow-hard flex items-center justify-center'>
                            <Heart className='w-7 h-7 text-plum fill-white' strokeWidth={3.5} />
                        </div>
                        <span className='text-xs font-black text-fooder-primary uppercase tracking-wider'>Miam !</span>
                        <span className='text-slate-500 text-[10px] font-bold'>droite →</span>
                    </div>
                </div>
                <p className='text-center text-slate-500 font-medium max-w-xs leading-relaxed'>
                    Glisse à <span className='font-black text-fooder-primary'>droite</span> si ça te tente, à <span className='font-black text-fooder-red'>gauche</span> si c&apos;est niet.
                </p>
            </div>
            <button onClick={onNext} className='w-full duo-button bg-fooder-primary border-fooder-primary text-white text-lg py-5 flex items-center justify-center gap-2'>
                J&apos;ai compris ! <ChevronRight className='w-5 h-5' />
            </button>
        </div>
    );
}

/* ── Tap details ─────────────────────────────────────────────────── */
function TapStep({ onNext }: { onNext: () => void }) {
    return (
        <div className='flex flex-col h-full px-6 pt-4 pb-8'>
            <div className='flex-1 flex flex-col items-center justify-center gap-8'>
                <div className='text-center space-y-2'>
                    <p className='text-xs font-black text-fooder-primary uppercase tracking-[0.2em]'>Explore en détail</p>
                    <h2 className='text-3xl font-black text-slate-900 tracking-tight leading-tight'>Appuie pour<br />tout voir</h2>
                </div>
                <div className='relative flex items-center justify-center'>
                    <div className='w-52 bg-white rounded-[26px] panel overflow-hidden'>
                        <div className='h-28 bg-bubblegum border-b-[3px] border-plum flex items-center justify-center relative'>
                            <Sticker name='burger' size={96} rotate={-6} />
                            <div className='absolute right-5 bottom-3'>
                                <div className='relative w-10 h-10'>
                                    <div className='absolute inset-0 rounded-full bg-white/70 tap-ripple' />
                                    <div className='absolute inset-0 rounded-full bg-white/50 tap-ripple' style={{ animationDelay: '0.6s' }} />
                                    <Pointer className='relative z-10 w-7 h-7 text-plum m-1.5' strokeWidth={2.5} />
                                </div>
                            </div>
                        </div>
                        <div className='p-4 space-y-2.5'>
                            <p className='font-display text-xl text-plum'>Burger Capitole</p>
                            {[
                                { Icon: Star, text: '4.7 · 2 340 avis' },
                                { Icon: MapPin, text: 'Place du Capitole' },
                                { Icon: BookOpen, text: 'Voir le menu complet' },
                            ].map((item, i) => (
                                <motion.div key={i}
                                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 + i * 0.2, repeat: Infinity, repeatDelay: 3, repeatType: 'mirror' }}
                                    className='flex items-center gap-2 text-xs text-slate-600 font-semibold'>
                                    <item.Icon className='w-3.5 h-3.5 text-fooder-primary' strokeWidth={2.5} /><span>{item.text}</span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
                <p className='text-center text-slate-500 font-medium max-w-xs leading-relaxed'>
                    Menu complet, photos des plats, adresse et lien Google Maps en un tap.
                </p>
            </div>
            <button onClick={onNext} className='w-full duo-button bg-fooder-primary border-fooder-primary text-white text-lg py-5 flex items-center justify-center gap-2'>
                Super ! <ChevronRight className='w-5 h-5' />
            </button>
        </div>
    );
}

/* ── Budget step (standalone) ────────────────────────────────────── */
function BudgetStep({ budget, setBudget, budgetOptions, pickerRef, wheelItemHeight, wheelPadding, handleBudgetScroll, onNext }:
    { budget: number; setBudget: (v: number) => void; budgetOptions: number[]; pickerRef: React.RefObject<HTMLDivElement>; wheelItemHeight: number; wheelPadding: number; handleBudgetScroll: () => void; onNext: () => void }) {

    // Scroll to current budget on mount (after animation settles)
    useEffect(() => {
        const idx = budgetOptions.indexOf(budget);
        if (idx >= 0) {
            setTimeout(() => {
                if (pickerRef.current) {
                    pickerRef.current.scrollTop = idx * wheelItemHeight;
                }
            }, 60);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className='flex flex-col h-full px-6 pt-4 pb-8'>
            <div className='flex-1 flex flex-col items-center justify-center gap-8'>
                <div className='text-center space-y-3'>
                    <p className='text-xs font-black text-fooder-primary uppercase tracking-[0.2em]'>Ton budget</p>
                    <h2 className='text-3xl font-black text-slate-900 tracking-tight leading-tight'>Quel est ton<br />budget max ?</h2>
                    <p className='text-slate-500 font-medium text-sm'>Par personne, boissons comprises</p>
                </div>

                {/* Big budget selected display */}
                <div className='flex flex-col items-center gap-2'>
                    <span className='text-7xl font-black text-fooder-primary tracking-tighter'>{budget}€</span>
                    <span className='text-slate-400 text-sm font-bold uppercase tracking-widest'>par personne</span>
                </div>

                {/* Wheel picker */}
                <div className='relative w-full max-w-xs rounded-3xl bg-white panel overflow-hidden'>
                    {/* Selection indicator — solid, visible */}
                    <div className='pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[60px] z-10'>
                        <div className='h-full mx-4 rounded-2xl bg-fooder-secondary/60 border-[3px] border-plum' />
                    </div>
                    {/* Fade top */}
                    <div className='pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white to-transparent z-10' />
                    {/* Fade bottom */}
                    <div className='pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent z-10' />
                    <div
                        ref={pickerRef}
                        onScroll={handleBudgetScroll}
                        className='h-60 overflow-y-auto snap-y snap-mandatory no-scrollbar'
                        style={{ paddingTop: `${wheelPadding}px`, paddingBottom: `${wheelPadding}px`, scrollbarWidth: 'none' }}
                    >
                        {budgetOptions.map((value) => (
                            <button key={value} type='button' onClick={() => setBudget(value)}
                                className={`w-full h-[60px] snap-center text-center transition-all font-black relative z-20 ${budget === value ? 'text-3xl text-fooder-primary' : 'text-lg text-slate-400'}`}>
                                {value}€
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <button onClick={onNext} className='w-full duo-button bg-fooder-primary border-fooder-primary text-white text-lg py-5 flex items-center justify-center gap-2'>
                Continuer <ChevronRight className='w-5 h-5' />
            </button>
        </div>
    );
}

/* ── Cuisine / mood step ─────────────────────────────────────────── */
const MOODS: { id: string; label: string; subtitle: string; sticker: StickerName }[] = [
    { id: 'surprise', label: 'Surprends-moi', subtitle: 'Je m\'en remets à fooder', sticker: 'donut' },
    { id: 'asie', label: 'Tour en Asie', subtitle: 'Sushi, ramen, wok, pad thaï', sticker: 'ramen' },
    { id: 'terroir', label: 'Terroir & bistrots', subtitle: 'La cuisine du coin', sticker: 'steak' },
    { id: 'street', label: 'Street & Fast', subtitle: 'Burger, tacos, kebab', sticker: 'taco' },
    { id: 'veggie', label: 'Vert & sain', subtitle: 'Véggie, vegan, frais', sticker: 'salad' },
    { id: 'gros', label: 'J\'ai VRAIMENT faim', subtitle: 'Portions XXL garanties', sticker: 'burger' },
    { id: 'special', label: 'Soirée spéciale', subtitle: 'Gastronomie & romantique', sticker: 'cupcake' },
    { id: 'brunch', label: 'Slow morning', subtitle: 'Brunch, café, bagels', sticker: 'coffee' },
];

function CuisineStep({ craving, setCraving, onNext }: { craving: string; setCraving: (v: string) => void; onNext: () => void }) {
    return (
        <div className='flex flex-col h-full px-5 pt-4 pb-8'>
            <div className='flex-1 flex flex-col justify-center gap-5 min-h-0'>
                <div className='text-center space-y-1.5'>
                    <p className='text-xs font-black text-fooder-primary uppercase tracking-[0.2em]'>Ton mood du moment</p>
                    <h2 className='text-3xl font-black text-slate-900 tracking-tight leading-tight'>Tu as envie<br />de quoi ?</h2>
                    <p className='text-slate-600 font-medium text-sm'>On sait tous que tu ne sais pas ce que tu veux.</p>
                </div>

                <div className='grid grid-cols-2 gap-3'>
                    {MOODS.map((mood) => {
                        const selected = craving === mood.id;
                        return (
                            <button key={mood.id} type='button' onClick={() => setCraving(mood.id)}
                                className={`flex items-center gap-2 pl-2 pr-3 py-2.5 rounded-2xl border-[3px] border-plum text-left transition-all active:translate-y-1 ${selected
                                    ? 'bg-fooder-secondary translate-y-1'
                                    : 'bg-white shadow-hard'}`}>
                                <Sticker name={mood.sticker} size={44} rotate={-6} />
                                <div className='min-w-0'>
                                    <p className='font-bold text-sm leading-tight text-plum'>{mood.label}</p>
                                    <p className='text-[10px] font-medium text-slate-500 mt-0.5 leading-tight line-clamp-1'>{mood.subtitle}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <button onClick={onNext} disabled={!craving}
                className='w-full duo-button bg-fooder-primary border-fooder-primary text-white text-xl py-5 mt-4 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2'>
                À table !
            </button>
        </div>
    );
}

/* ── Main ────────────────────────────────────────────────────────── */
export default function Onboarding() {
    const router = useRouter();
    const [stepIdx, setStepIdx] = useState(0);
    const [dir, setDir] = useState(1);
    const [budget, setBudget] = useState(35);
    const [craving, setCraving] = useState('');

    const budgetOptions = useMemo(() => Array.from({ length: 19 }, (_, i) => 10 + i * 5), []);
    const pickerRef = useRef<HTMLDivElement>(null);
    const wheelItemHeight = 60;
    // Container is h-60 = 240px. Padding = (240 - itemHeight) / 2 so item 0 centers at scrollTop=0
    const wheelPadding = 90;

    useEffect(() => {
        if (localStorage.getItem('fooder_onboarding_done')) {
            router.replace('/swipe');
        }
    }, [router]);

    const handleBudgetScroll = () => {
        if (!pickerRef.current) return;
        const rawIndex = Math.round(pickerRef.current.scrollTop / wheelItemHeight);
        const safeIndex = Math.min(Math.max(rawIndex, 0), budgetOptions.length - 1);
        const next = budgetOptions[safeIndex];
        if (next !== budget) setBudget(next);
    };

    const next = () => {
        if (stepIdx < STEPS.length - 1) {
            setDir(1);
            setStepIdx(prev => prev + 1);
        } else {
            const moodMap: Record<string, string> = {
                asie: 'Asiatique', terroir: 'Français', street: 'Street Food',
                veggie: 'Veggie', gros: 'All', special: 'Gastronomique',
                brunch: 'Brunch & Café', surprise: 'Surprends-moi',
            };
            const label = MOODS.find(m => m.id === craving)?.label || 'Surprends-moi';
            localStorage.setItem('fooder_preferences', JSON.stringify({ budget, craving, cravingLabel: label, cuisineFilter: moodMap[craving] || craving }));
            localStorage.setItem('fooder_onboarding_done', '1');
            router.push('/swipe');
        }
    };

    const prev = () => {
        if (stepIdx > 0) {
            setDir(-1);
            setStepIdx(prev => prev - 1);
        }
    };

    const step = STEPS[stepIdx];
    const currentProgressIdx = stepIdx - 1;

    return (
        <div className='flex flex-col h-[100dvh] overflow-hidden bg-cream max-w-md mx-auto relative border-x-[3px] border-plum'>
            {/* Progress bar */}
            <AnimatePresence>
                {step !== 'welcome' && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className='flex items-center gap-3 px-5 pt-12 pb-4 z-10 flex-shrink-0'>
                        <button onClick={prev} className='p-2 rounded-full hover:bg-white transition-colors flex-shrink-0'>
                            <ArrowLeft className='w-5 h-5 text-slate-500' />
                        </button>
                        <div className='flex-1 flex gap-2'>
                            {PROGRESS_STEPS.map((s, i) => (
                                <div key={s} className='flex-1 h-4 rounded-full bg-white border-[3px] border-plum overflow-hidden'>
                                    {i <= currentProgressIdx && (
                                        <motion.div className='h-full bg-bubblegum'
                                            initial={{ width: '0%' }} animate={{ width: '100%' }}
                                            transition={{ duration: 0.4, ease: 'easeOut' }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Step content */}
            <div className='flex-1 overflow-hidden relative min-h-0'>
                <AnimatePresence mode='wait' custom={dir}>
                    <motion.div key={step} custom={dir} variants={slideVariants}
                        initial='enter' animate='center' exit='exit'
                        transition={{ type: 'tween', duration: 0.28, ease: 'easeInOut' }}
                        className='absolute inset-0 flex flex-col'>
                        {step === 'welcome' && <WelcomeStep onNext={next} />}
                        {step === 'swipe' && <SwipeStep onNext={next} />}
                        {step === 'tap' && <TapStep onNext={next} />}
                        {step === 'budget' && (
                            <BudgetStep
                                budget={budget} setBudget={setBudget}
                                budgetOptions={budgetOptions}
                                pickerRef={pickerRef as React.RefObject<HTMLDivElement>}
                                wheelItemHeight={wheelItemHeight} wheelPadding={wheelPadding}
                                handleBudgetScroll={handleBudgetScroll} onNext={next}
                            />
                        )}
                        {step === 'cuisine' && (
                            <CuisineStep craving={craving} setCraving={setCraving} onNext={next} />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Share2, ChevronRight, Pencil } from 'lucide-react';
import { useFoodDNA } from '../../../hooks/useFoodDNA';
import { useGamification, ALL_ACHIEVEMENTS } from '../../../hooks/useGamification';
import { Sticker } from '../../../components/ui/Sticker';
import { PageHeader } from '../../../components/nav/PageHeader';
import { AnimatedNumber } from '../../../components/ui/AnimatedNumber';
import { StickerName, badgeFor } from '../../../lib/stickers';
import { Avatar } from '../../../components/profile/Avatar';
import { AvatarPicker } from '../../../components/profile/AvatarPicker';
import { InstallCard } from '../../../components/pwa/InstallCard';
import { useAvatar } from '../../../hooks/useAvatar';
import { useFreemium } from '../../../hooks/useFreemium';

const TOULOUSE_QUARTIERS: { name: string; sticker: StickerName }[] = [
  { name: 'Capitole', sticker: 'plate' },
  { name: 'Carmes', sticker: 'wine' },
  { name: 'Saint-Étienne', sticker: 'croissant' },
  { name: 'Wilson', sticker: 'croque' },
  { name: 'Compans', sticker: 'cupcake' },
  { name: 'Minimes', sticker: 'burger' },
  { name: 'Arnaud Bernard', sticker: 'kebab' },
  { name: 'Saint-Aubin', sticker: 'salad' },
  { name: "Patte d'Oie", sticker: 'taco' },
];

const TABS = [
  { id: 'dna', label: 'Food DNA' },
  { id: 'achievements', label: 'Trophées' },
  { id: 'wrapped', label: 'Wrapped' },
  { id: 'map', label: 'Ma carte' },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface StoredStats {
  likes: { address?: string }[];
  totalSwipes: number;
}

function readStats(): StoredStats {
  try {
    const likes = JSON.parse(localStorage.getItem('fooder_likes') || '[]');
    const dislikes = JSON.parse(localStorage.getItem('fooder_dislikes') || '[]');
    return { likes, totalSwipes: likes.length + dislikes.length };
  } catch {
    return { likes: [], totalSwipes: 0 };
  }
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-bold text-plum/60">{children}</p>
);

export default function ProfilePage() {
  const dna = useFoodDNA();
  const { streak, xp, level, xpProgress, achievements, unlockedIds } = useGamification();
  const [activeTab, setActiveTab] = useState<TabId>('dna');
  const [stats, setStats] = useState<StoredStats>({ likes: [], totalSwipes: 0 });
  const { avatar, setAvatar } = useAvatar();
  const { isPremium } = useFreemium();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lockedHint, setLockedHint] = useState<string | null>(null);

  useEffect(() => { setStats(readStats()); }, []);

  const unlockedQuartiers = new Set<string>();
  stats.likes.forEach(r => {
    TOULOUSE_QUARTIERS.forEach(q => {
      if (r.address?.toLowerCase().includes(q.name.toLowerCase())) unlockedQuartiers.add(q.name);
    });
  });
  if (stats.likes.length > 0) unlockedQuartiers.add('Capitole');
  if (stats.likes.length >= 3) unlockedQuartiers.add('Carmes');
  const explorationPct = Math.round((unlockedQuartiers.size / TOULOUSE_QUARTIERS.length) * 100);

  const handleShare = async () => {
    const text = `Mon profil Fooder : ${dna.archetype}\nStreak : ${streak} jours\n${dna.totalLikes} restos likés\n#Fooder`;
    if (navigator.share) {
      await navigator.share({ title: 'Mon Fooder Wrapped', text });
    } else {
      navigator.clipboard?.writeText(text);
    }
  };

  const handleMatch = () => {
    const code = `FOODER-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    if (navigator.share) {
      navigator.share({ title: 'Fooder Match !', text: `Swipe les mêmes restos que moi.\nCode : ${code}\nTélécharge Fooder !` });
    } else {
      navigator.clipboard?.writeText(code);
      alert(`Ton code de match : ${code}`);
    }
  };

  const wrappedStats = [
    { label: 'Swipes totaux', value: stats.totalSwipes, suffix: '' },
    { label: 'Likes', value: dna.totalLikes, suffix: '' },
    { label: 'Streak', value: streak, suffix: 'j' },
    { label: 'XP gagnés', value: xp, suffix: '' },
  ];

  const dnaStats = [
    { label: 'Cuisine préférée', value: dna.favCuisine, sticker: 'ramen' as StickerName },
    { label: 'Budget moyen', value: dna.avgBudget > 0 ? `${dna.avgBudget}€` : '—', sticker: 'fries' as StickerName },
    { label: 'Taux de like', value: `${dna.likeRate}%`, sticker: 'cupcake' as StickerName },
    { label: 'Restos likés', value: String(dna.totalLikes), sticker: 'pizza' as StickerName },
  ];

  const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 } };

  return (
    <div className="h-full bg-cream scroll-y">
      <PageHeader
        title="Profil"
        subtitle={`Niveau ${level} · ${xp} XP`}
        right={
          <button
            onClick={handleShare}
            aria-label="Partager"
            className="w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all shrink-0"
          >
            <Share2 className="w-5 h-5 text-plum" strokeWidth={2.5} />
          </button>
        }
      />

      <section className="px-5 py-4 border-b-[3px] border-plum space-y-3">
        <div className="flex items-center gap-4">
          <button onClick={() => setPickerOpen(true)} aria-label="Changer de mascotte" className="relative shrink-0 active:scale-95 transition-transform">
            <Avatar avatar={avatar} size={64} />
            <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white border-[2.5px] border-plum flex items-center justify-center">
              <Pencil className="w-3 h-3 text-plum" strokeWidth={3} />
            </span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-display text-2xl text-plum leading-tight">Foodie niveau {level}</p>
            <p className="text-slate-600 text-xs font-semibold">{xp} XP · {dna.totalLikes} likes</p>
          </div>
          <div className="chip bg-fooder-orange text-plum flex-col !gap-0 !px-3 !py-1.5">
            <span className="font-display text-xl leading-none">{streak}</span>
            <span className="text-[10px] font-bold">{streak > 1 ? "jours" : "jour"}</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-bold text-plum/60">
            <span>Niveau {level}</span>
            <span>{Math.round(xpProgress * 100)}%</span>
          </div>
          <div className="h-4 bg-white border-[3px] border-plum rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress * 100}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
              className="h-full bg-bubblegum"
            />
          </div>
        </div>
      </section>

      <nav className="sticky top-0 z-20 flex px-3 py-2.5 gap-2 bg-cream border-b-[3px] border-plum" aria-label="Sections du profil">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 chip justify-center whitespace-nowrap !px-1 !py-2 text-[11px] transition-all active:translate-y-0.5 ${
              activeTab === id ? 'bg-fooder-primary text-white' : 'bg-white text-plum'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div>
        <AnimatePresence mode="wait">
          {activeTab === 'dna' && (
            <motion.div key="dna" {...fade} className="p-4 space-y-4">
              <div className={`relative rounded-[28px] p-5 ${dna.tint} panel overflow-hidden`}>
                <div className="absolute -right-2 -top-2 bob" style={{ ['--r' as string]: '8deg' }}>
                  <Sticker name={dna.archetypeSticker} size={104} rotate={8} />
                </div>
                <div className="relative z-10 space-y-2 pr-24">
                  <Label>Ton archétype</Label>
                  <h2 className="text-[28px] text-plum leading-none">{dna.archetype}</h2>
                  <p className="text-plum/80 text-sm font-medium leading-snug">{dna.archetypeDesc}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {dnaStats.map(s => (
                  <div key={s.label} className="bg-white rounded-2xl p-3.5 border-[3px] border-plum shadow-hard relative overflow-hidden">
                    <div className="absolute -right-1 -top-1 opacity-90">
                      <Sticker name={s.sticker} size={44} rotate={10} />
                    </div>
                    <p className="font-display text-[clamp(18px,6vw,24px)] leading-tight text-plum mt-5 break-words line-clamp-2">{s.value}</p>
                    <p className="text-slate-500 text-[11px] font-bold">{s.label}</p>
                  </div>
                ))}
              </div>

              {dna.topCuisines.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border-[3px] border-plum space-y-3">
                  <Label>Top cuisines</Label>
                  {dna.topCuisines.map(({ cuisine, count }) => (
                    <div key={cuisine} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-plum flex-1 truncate">{cuisine}</span>
                      <div className="flex-1 h-3 bg-cream border-2 border-plum rounded-full overflow-hidden">
                        <div
                          className="h-full bg-fooder-primary"
                          style={{ width: `${Math.min((count / Math.max(dna.totalLikes, 1)) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-plum w-5 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              )}

              {dna.totalLikes === 0 && (
                <div className="bg-white rounded-2xl p-6 border-[3px] border-plum text-center space-y-2 flex flex-col items-center">
                  <Sticker name="ramen" size={80} rotate={-6} className="bob" />
                  <p className="font-display text-xl text-plum">Commence à swiper !</p>
                  <p className="text-slate-600 text-sm font-medium">Ton Food DNA se révèle à travers tes likes.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'achievements' && (
            <motion.div key="ach" {...fade} className="p-4 space-y-3">
              <Label>{achievements.length}/{ALL_ACHIEVEMENTS.length} débloqués</Label>
              <div className="grid grid-cols-1 gap-3">
                {ALL_ACHIEVEMENTS.map(ach => {
                  const unlocked = unlockedIds.includes(ach.id);
                  return (
                    <div
                      key={ach.id}
                      className={`flex items-center gap-3.5 p-3 rounded-2xl border-[3px] border-plum ${
                        unlocked ? 'bg-fooder-secondary shadow-hard' : 'bg-white/60 opacity-60'
                      }`}
                    >
                      <div className={`w-12 h-12 flex items-center justify-center ${unlocked ? '' : 'opacity-25'}`}>
                        <Sticker name={badgeFor(ach.id)} size={44} rotate={-6} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-plum text-sm">{ach.title}</p>
                        <p className="text-plum/70 text-xs font-medium">{ach.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeTab === 'wrapped' && (
            <motion.div key="wrapped" {...fade} className="p-4 space-y-4">
              <div className="bg-fooder-primary rounded-[28px] p-5 text-white panel space-y-4">
                <h2 className="text-3xl leading-none">Ton Fooder Wrapped</h2>
                <div className="grid grid-cols-2 gap-3">
                  {wrappedStats.map(s => (
                    <div key={s.label} className="bg-cream rounded-2xl p-3 space-y-1 border-[3px] border-plum text-plum">
                      <p className="font-display text-3xl leading-none"><AnimatedNumber value={s.value} suffix={s.suffix} /></p>
                      <p className="text-plum/60 text-[11px] font-bold">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border-[3px] border-plum flex items-center gap-3">
                <div className={`w-14 h-14 rounded-xl ${dna.tint} border-2 border-plum flex items-center justify-center`}>
                  <Sticker name={dna.archetypeSticker} size={42} rotate={-6} />
                </div>
                <div>
                  <Label>Personnalité food</Label>
                  <p className="font-display text-xl text-plum leading-tight">{dna.archetype}</p>
                  <p className="text-slate-500 text-xs font-medium">Cuisine fav : {dna.favCuisine}</p>
                </div>
              </div>

              <button
                onClick={handleShare}
                className="w-full duo-button bg-fooder-secondary text-plum py-4 text-sm flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Partager mon Wrapped
              </button>
            </motion.div>
          )}

          {activeTab === 'map' && (
            <motion.div key="map" {...fade} className="p-4 space-y-4">
              <div className="bg-white rounded-2xl p-4 border-[3px] border-plum space-y-2">
                <div className="flex justify-between items-center">
                  <p className="font-display text-xl text-plum">Toulouse Explorer</p>
                  <span className="chip bg-fooder-mint text-plum">{explorationPct}% découvert</span>
                </div>
                <div className="h-4 bg-cream border-[3px] border-plum rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${explorationPct}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                    className="h-full bg-fooder-mint"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {TOULOUSE_QUARTIERS.map(q => {
                  const unlocked = unlockedQuartiers.has(q.name);
                  return (
                    <motion.div
                      key={q.name}
                      whileTap={{ scale: 0.93 }}
                      className={`rounded-2xl p-2.5 flex flex-col items-center gap-1 border-[3px] border-plum ${
                        unlocked ? 'bg-white shadow-hard' : 'bg-white/50'
                      }`}
                    >
                      <div className={unlocked ? '' : 'opacity-30'}>
                        <Sticker name={q.sticker} size={52} rotate={unlocked ? -6 : 0} />
                      </div>
                      <span className={`text-[10px] font-bold text-center leading-tight ${unlocked ? 'text-plum' : 'text-slate-400'}`}>
                        {q.name}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              <div className="bg-white/60 rounded-2xl p-4 border-[3px] border-dashed border-plum/40 text-center space-y-1">
                <p className="text-slate-600 text-sm font-bold">Like des restos pour découvrir Toulouse</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="px-4 pb-6 pt-1">
        <InstallCard />
        <button
          onClick={handleMatch}
          className="w-full duo-button bg-white text-plum py-3.5 text-sm flex items-center justify-center gap-2"
        >
          Matcher avec un(e) ami(e)
          <ChevronRight className="w-4 h-4" />
        </button>
        <nav aria-label="Informations légales" className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4 text-[11px] font-bold text-plum/60">
          <Link href="/legal/privacy" className="underline">Confidentialité</Link>
          <Link href="/legal/terms" className="underline">Conditions</Link>
          <Link href="/legal/mentions" className="underline">Mentions légales</Link>
        </nav>
      </footer>

      <AvatarPicker
        isOpen={pickerOpen}
        current={avatar}
        level={level}
        isPremium={isPremium}
        onClose={() => { setPickerOpen(false); setLockedHint(null); }}
        onSave={setAvatar}
        onLockedTap={reason => setLockedHint(reason)}
      />
      <AnimatePresence>
        {lockedHint && pickerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onAnimationComplete={() => setTimeout(() => setLockedHint(null), 1600)}
            className="fixed bottom-24 inset-x-0 z-[160] flex justify-center pointer-events-none"
          >
            <span className="chip bg-lemon text-plum text-xs !px-4 !py-2">
              {lockedHint === 'Premium' ? 'Mascotte réservée aux membres Premium' : `Se débloque au ${lockedHint.toLowerCase()}`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

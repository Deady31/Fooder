'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Share2, ChevronRight, Pencil, Flame, Users, Trophy } from 'lucide-react';
import { useFoodDNA } from '../../../hooks/useFoodDNA';
import { useGamification, ALL_ACHIEVEMENTS } from '../../../hooks/useGamification';
import { Sticker } from '../../../components/ui/Sticker';
import { PageHeader } from '../../../components/nav/PageHeader';
import { AnimatedNumber } from '../../../components/ui/AnimatedNumber';
import { StickerName, badgeFor } from '../../../lib/stickers';
import { Avatar } from '../../../components/profile/Avatar';
import { AvatarPicker } from '../../../components/profile/AvatarPicker';
import { LegalCenter } from '../../../components/legal/LegalCenter';
import { InstallPrompt } from '../../../components/pwa/InstallPrompt';
import { InviteCard } from '../../../components/social/InviteCard';
import { useAvatar } from '../../../hooks/useAvatar';
import { useSocial } from '../../../hooks/useSocial';
import { useWeekRank } from '../../../components/leaderboard/useLeaderboard';
import { useAuth } from '../../../components/auth/AuthProvider';
import { QUARTIERS } from '../../../lib/quartiers';
import { visitedQuartiers } from '../../../lib/visits';
import { PERKS, bestTitle, contributorTitles, monthlyChallenges } from '../../../lib/rituals';
import { FeedPost, POSTS_KEY } from '../../../lib/feed';
import { readJson } from '../../../lib/store';
import { readDislikes, readLikes, subscribeLikes } from '../../../lib/likes';
import { ScaleBar } from '../../../components/profile/ScaleBar';
import { XpGauge } from '../../../components/profile/XpGauge';
import { ActionToast, ActionToastState } from '../../../components/profile/ActionToast';
import { streakHint } from '../../../components/profile/streakHint';

const QUARTIER_STICKERS: StickerName[] = [
  'plate', 'wine', 'croissant', 'pasta', 'coffee', 'croque', 'cupcake', 'kebab', 'burger',
  'salad', 'brunch', 'boba', 'taco', 'curry', 'donut', 'ramen', 'fries', 'dumpling',
];
const TOULOUSE_QUARTIERS = QUARTIERS.map((q, i) => ({ name: q.name, sticker: QUARTIER_STICKERS[i % QUARTIER_STICKERS.length] }));

const TABS = [
  { id: 'dna', label: 'Food DNA' },
  { id: 'achievements', label: 'Trophées' },
  { id: 'wrapped', label: 'Wrapped' },
  { id: 'map', label: 'Ma carte' },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface StoredStats {
  totalSwipes: number;
}

/** Même source que Favoris, Carte et la barre d'onglets (lib/likes). */
function readStats(): StoredStats {
  return { totalSwipes: readLikes().length + readDislikes().length };
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-bold text-plum-muted">{children}</p>
);

export default function ProfilePage() {
  const dna = useFoodDNA();
  const { streak, xp, level, xpProgress, achievements, unlockedIds } = useGamification();
  const [activeTab, setActiveTab] = useState<TabId>('dna');
  const [stats, setStats] = useState<StoredStats>({ totalSwipes: 0 });
  const { avatar, setAvatar } = useAvatar();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lockedHint, setLockedHint] = useState<string | null>(null);
  const social = useSocial();
  const auth = useAuth();
  const weekRank = useWeekRank(Boolean(auth.session));
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useEffect(() => {
    const sync = () => setStats(readStats());
    sync();
    setPosts(readJson<FeedPost[]>(POSTS_KEY, []));
    return subscribeLikes(sync);
  }, []);

  const [toast, setToast] = useState<ActionToastState | null>(null);
  const toastSeq = useRef(0);
  const dismissToast = useCallback(() => setToast(null), []);
  const notify = (message: string) => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, message });
  };

  // Indice de verrouillage de la mascotte : minuteur annulé au démontage et à chaque nouvel indice.
  useEffect(() => {
    if (!lockedHint) return;
    const t = setTimeout(() => setLockedHint(null), 2200);
    return () => clearTimeout(t);
  }, [lockedHint]);

  const unlockedQuartiers = visitedQuartiers(social.visits);
  const explorationPct = Math.round((unlockedQuartiers.size / TOULOUSE_QUARTIERS.length) * 100);
  const photos = posts.filter(p => p.photo).length;
  const titles = contributorTitles(social.visits, photos);
  const title = bestTitle(titles);
  const challenges = monthlyChallenges(social.visits, posts);
  const weekly = social.streak;
  const hint = streakHint(weekly);

  const handleShare = async () => {
    const text = `Mon profil Fooder : ${dna.archetype}\nSérie : ${weekly.current} semaine(s)\n${social.visits.length} restos testés\n#Fooder`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Mon Fooder Wrapped', text });
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

  const wrappedStats = [
    { label: 'Swipes totaux', value: stats.totalSwipes, suffix: '' },
    { label: 'Restos testés', value: social.visits.length, suffix: '' },
    { label: 'Semaines de série', value: weekly.current, suffix: '' },
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
    <div className="h-full scroll-y">
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

      <section className="px-5 py-4 border-b-[3px] border-plum space-y-3 bg-cream">
        <div className="flex items-center gap-4">
          <button onClick={() => setPickerOpen(true)} aria-label="Changer de mascotte" className="relative shrink-0 active:scale-95 transition-transform">
            <Avatar avatar={avatar} size={64} />
            <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white border-[2.5px] border-plum flex items-center justify-center">
              <Pencil className="w-3 h-3 text-plum" strokeWidth={3} />
            </span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-display text-2xl text-plum leading-tight truncate">{social.me?.name ?? 'Foodie'}</p>
            <p className="text-plum-muted text-xs font-semibold truncate">{title} · niv. {level} · {social.visits.length} testés</p>
          </div>
          <div
            className={`chip flex-col !gap-0 !px-3 !py-1.5 text-plum ${weekly.thisWeekDone ? 'bg-fooder-orange' : 'bg-white'}`}
            title={weekly.thisWeekDone ? 'Semaine validée' : 'Teste un resto cette semaine pour garder ta série'}
          >
            <span className="font-display text-xl leading-none flex items-center gap-0.5">
              <Flame className={`w-4 h-4 transition-opacity ${hint?.urgent ? 'opacity-50' : ''}`} strokeWidth={2.5} aria-hidden="true" />
              {weekly.current}
            </span>
            <span className="text-xs font-bold">{weekly.current > 1 ? 'semaines' : 'semaine'}</span>
          </div>
        </div>
        <XpGauge xp={xp} level={level} xpProgress={xpProgress} />
        {!weekly.thisWeekDone && (
          <p className={`text-xs font-bold ${hint?.urgent ? 'text-danger' : 'text-plum-muted'}`}>
            {hint ? `${hint.text}. ` : 'Teste un resto cette semaine pour lancer ta série. '}
            {weekly.jokersLeft > 0 && weekly.current > 0 ? 'Joker dispo.' : ''}
          </p>
        )}
      </section>

      {auth.enabled && !auth.session && !auth.loading && (
        <Link href="/compte" className="mx-4 mt-3 flex items-center gap-3 bg-fooder-secondary rounded-3xl border-[3px] border-plum shadow-hard p-3 active:translate-y-0.5">
          <Sticker name="b_star" size={40} rotate={-8} />
          <span className="flex-1 min-w-0">
            <span className="block font-display text-lg text-plum leading-tight">Sauvegarde ta progression</span>
            <span className="block text-xs font-bold text-plum-muted">Crée ton compte en 30 s, sans mot de passe</span>
          </span>
          <ChevronRight className="w-4 h-4 text-plum shrink-0" strokeWidth={3} />
        </Link>
      )}
      {auth.session && (
        <Link href="/compte" className="mx-4 mt-3 flex items-center justify-between gap-2 min-h-[44px] bg-white rounded-2xl border-[3px] border-plum px-3 py-2 text-xs font-bold text-plum-muted">
          <span className="truncate">Compte · {auth.email}</span>
          <span className={`chip shrink-0 !px-2 !py-0.5 !text-xs ${auth.sync === 'error' ? 'bg-fooder-orange' : 'bg-fooder-mint'} text-plum`}>
            {auth.sync === 'error' ? 'synchro en échec' : 'sauvegardé'}
          </span>
        </Link>
      )}

      <Link href="/classement" className="mx-4 mt-3 flex items-center gap-3 min-h-[44px] bg-fooder-secondary rounded-3xl border-[3px] border-plum shadow-hard p-3 active:translate-y-0.5">
        <span className="w-11 h-11 shrink-0 rounded-full bg-white border-[3px] border-plum flex items-center justify-center">
          <Trophy className="w-5 h-5 text-plum" strokeWidth={2.5} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display text-lg text-plum leading-tight">Classement</span>
          <span className="block text-xs font-bold text-plum-muted leading-snug">
            {weekRank ? `#${weekRank} cette semaine` : 'Les plus belles photos de plats'}
          </span>
        </span>
        <ChevronRight className="w-4 h-4 text-plum shrink-0" strokeWidth={3} />
      </Link>

      <Link href="/amis" className="mx-4 my-3 flex items-center gap-3 bg-bubblegum rounded-3xl border-[3px] border-plum shadow-hard p-3 active:translate-y-0.5">
        <span className="w-11 h-11 shrink-0 rounded-full bg-white border-[3px] border-plum flex items-center justify-center">
          <Users className="w-5 h-5 text-plum" strokeWidth={2.5} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display text-lg text-plum leading-tight">Amis et Food Match</span>
          <span className="block text-xs font-bold text-plum leading-snug">
            {social.friends.length > 0 ? `${social.friends.length} ami${social.friends.length > 1 ? 's' : ''} · classement, défis, groupes` : 'Ton QR code, tes défis, « On mange où ? »'}
          </span>
        </span>
        <div className="flex -space-x-3 shrink-0">
          {social.friends.slice(0, 3).map(f => (
            <Avatar key={f.snapshot.id} avatar={f.snapshot.avatar} size={30} />
          ))}
        </div>
        <ChevronRight className="w-4 h-4 text-plum shrink-0" strokeWidth={3} />
      </Link>

      <InviteCard showInstall={false} className="mx-4 mb-3" />

      <div role="tablist" className="sticky top-0 z-20 flex px-3 py-2.5 gap-2 bg-cream border-b-[3px] border-plum" aria-label="Sections du profil">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            id={`profile-tab-${id}`}
            aria-selected={activeTab === id}
            aria-controls="profile-panel"
            onClick={() => setActiveTab(id)}
            className={`flex-1 chip justify-center whitespace-nowrap !px-1 !py-2 min-h-[44px] !text-xs transition-all active:translate-y-0.5 ${
              activeTab === id ? 'bg-fooder-primary text-white' : 'bg-white text-plum'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div id="profile-panel" role="tabpanel" aria-labelledby={`profile-tab-${activeTab}`}>
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
                  <p className="text-plum text-sm font-medium leading-snug">{dna.archetypeDesc}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {dnaStats.map(s => (
                  <div key={s.label} className="bg-white rounded-2xl p-3.5 border-[3px] border-plum shadow-hard relative overflow-hidden">
                    <div className="absolute -right-1 -top-1 opacity-90">
                      <Sticker name={s.sticker} size={44} rotate={10} />
                    </div>
                    <p className="font-display text-[clamp(18px,6vw,24px)] leading-tight text-plum mt-5 break-words line-clamp-2">{s.value}</p>
                    <p className="text-slate-muted text-xs font-bold">{s.label}</p>
                  </div>
                ))}
              </div>

              {dna.topCuisines.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border-[3px] border-plum space-y-3">
                  <Label>Top cuisines</Label>
                  {dna.topCuisines.map(({ cuisine, count }) => (
                    <div key={cuisine} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-plum flex-1 truncate">{cuisine}</span>
                      <div className="flex-1">
                        <ScaleBar
                          value={count / Math.max(dna.totalLikes, 1)}
                          trackClassName="h-3 bg-cream border-2 border-plum rounded-full"
                          barClassName="bg-fooder-primary"
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
                  <p className="text-plum-muted text-sm font-medium">Ton Food DNA se révèle à travers tes likes.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'achievements' && (
            <motion.div key="ach" {...fade} className="p-4 space-y-3">
              <div className="bg-white rounded-2xl p-4 border-[3px] border-plum space-y-3">
                <Label>Défis du mois</Label>
                {challenges.map(c => (
                  <div key={c.id} className="flex items-center gap-3">
                    <Sticker name={c.sticker} size={40} rotate={-6} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex justify-between gap-2">
                        <p className="text-sm font-bold text-plum leading-tight">{c.title}</p>
                        <span className="text-xs font-black text-plum shrink-0">{c.progress}/{c.goal}</span>
                      </div>
                      <ScaleBar
                        value={c.progress / c.goal}
                        trackClassName="h-2.5 bg-cream border-2 border-plum rounded-full"
                        barClassName={c.progress >= c.goal ? 'bg-fooder-mint' : 'bg-bubblegum'}
                      />
                      <p className="text-xs font-medium text-slate-muted">{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl p-4 border-[3px] border-plum space-y-2">
                <Label>Titres de contributeur</Label>
                <div className="flex flex-wrap gap-2">
                  {titles.map(t => (
                    <span key={t.id} title={t.desc} className={`chip text-xs ${t.unlocked ? 'bg-fooder-secondary text-plum' : 'bg-white text-plum-muted border-dashed'}`}>
                      {t.label}
                    </span>
                  ))}
                </div>
                <p className="text-xs font-medium text-slate-muted">Confirme tes visites et publie les vraies photos pour les débloquer.</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border-[3px] border-plum space-y-2.5">
                <Label>Avantages par niveau · exemples, en attente de restaurants partenaires</Label>
                {PERKS.map(pk => (
                  <div key={pk.level} className="flex items-center gap-3">
                    <div className={level >= pk.level ? '' : 'opacity-50'}>
                      <Sticker name={pk.sticker} size={34} rotate={-6} />
                    </div>
                    <p className={`flex-1 text-sm font-bold leading-tight ${level >= pk.level ? 'text-plum' : 'text-plum-muted'}`}>{pk.label}</p>
                    <span className={`chip shrink-0 !px-2 !text-xs ${level >= pk.level ? 'bg-fooder-mint text-plum' : 'bg-cream text-plum'}`}>niv. {pk.level}</span>
                  </div>
                ))}
              </div>

              <div className="inline-block bg-cream rounded-full border-2 border-plum px-3 py-1">
                <Label>{achievements.length}/{ALL_ACHIEVEMENTS.length} trophées débloqués</Label>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {ALL_ACHIEVEMENTS.map(ach => {
                  const unlocked = unlockedIds.includes(ach.id);
                  return (
                    <div
                      key={ach.id}
                      className={`flex items-center gap-3.5 p-3 rounded-2xl border-[3px] border-plum ${
                        unlocked ? 'bg-fooder-secondary shadow-hard' : 'bg-white'
                      }`}
                    >
                      <div className={`w-12 h-12 flex items-center justify-center ${unlocked ? '' : 'opacity-30 grayscale'}`}>
                        <Sticker name={badgeFor(ach.id)} size={44} rotate={-6} />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold text-sm ${unlocked ? 'text-plum' : 'text-plum-muted'}`}>{ach.title}</p>
                        <p className="text-plum-muted text-xs font-medium">{ach.description}</p>
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
                      <p className="text-plum-muted text-xs font-bold">{s.label}</p>
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
                  <p className="text-slate-muted text-xs font-medium">Cuisine fav : {dna.favCuisine}</p>
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
                  <p className="font-display text-xl text-plum">Ma Toulouse</p>
                  <span className="chip bg-fooder-mint text-plum">{explorationPct}% découvert</span>
                </div>
                <ScaleBar
                  value={explorationPct / 100}
                  trackClassName="h-4 bg-cream border-[3px] border-plum rounded-full"
                  barClassName="bg-fooder-mint"
                  delay={0.3}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {TOULOUSE_QUARTIERS.map(q => {
                  const unlocked = unlockedQuartiers.has(q.name);
                  return (
                    <motion.div
                      key={q.name}
                      whileTap={{ scale: 0.93 }}
                      className={`rounded-2xl p-2.5 flex flex-col items-center gap-1 border-[3px] border-plum ${
                        unlocked ? 'bg-white shadow-hard' : 'bg-white'
                      }`}
                    >
                      <div className={unlocked ? '' : 'opacity-30 grayscale'}>
                        <Sticker name={q.sticker} size={52} rotate={unlocked ? -6 : 0} />
                      </div>
                      <span className={`text-xs font-bold text-center leading-tight break-words max-w-full ${unlocked ? 'text-plum' : 'text-plum-muted'}`}>
                        {q.name}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              <div className="bg-white rounded-2xl p-4 border-[3px] border-dashed border-plum text-center space-y-1">
                <p className="text-plum-muted text-sm font-bold">Chaque visite confirmée colore son quartier. 5 quartiers = titre de Cartographe.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="mt-4 px-4 pb-6 pt-4 bg-cream border-t-[3px] border-plum">
        <InstallPrompt className="mb-4" />
        <LegalCenter />
      </footer>

      <AvatarPicker
        isOpen={pickerOpen}
        current={avatar}
        level={level}
        onClose={() => { setPickerOpen(false); setLockedHint(null); }}
        onSave={setAvatar}
        onLockedTap={reason => setLockedHint(reason)}
      />
      <ActionToast toast={toast} onDismiss={dismissToast} />
      <AnimatePresence>
        {lockedHint && pickerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-24 inset-x-0 z-[160] flex justify-center pointer-events-none"
          >
            <span className="chip bg-lemon text-plum text-xs !px-4 !py-2">
              {`Se débloque au ${lockedHint.toLowerCase()}`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

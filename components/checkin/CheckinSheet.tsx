'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Flame, X } from 'lucide-react';
import Link from 'next/link';
import { Sticker } from '../ui/Sticker';
import { communityPhotosFor } from '../../lib/communityPhotos';
import { DISH_PHOTO_TIP, shouldInviteRealPhoto } from '../../lib/photoInvite';
import { stickerFor } from '../../lib/stickers';
import { MAX_CAPTION, Verdict, compressImage } from '../../lib/feed';
import { VisitInput, addVisit, dismissCheckin, snoozeCheckin, visitedQuartiers } from '../../lib/visits';
import { weeklyStreak } from '../../lib/streak';
import { XP, awardPhotoPost, awardXp, countKnownPhotos, unlockAchievement } from '../../lib/rewards';
import { PHOTO_XP_FIRST } from '../../lib/photoXp';
import { useToast } from '../ui/Toast';
import { newPostId, publishPost } from '../../lib/share';
import { readJson } from '../../lib/store';
import { getMe } from '../../lib/identity';
import { computeLevel } from '../../hooks/useGamification';
import { AvatarChoice, DEFAULT_AVATAR } from '../../lib/avatars';
import { FeedPost, POSTS_KEY } from '../../lib/feed';
import { track } from '../../lib/analytics';
import { publishPostOnline } from '../../lib/cloud/publish';
import { verdictSlug } from '../../lib/usageProps';
import { shouldPublishOnline } from '../../lib/checkinPublish';

export type CheckinMode = 'ask' | 'confirm';

interface CheckinSheetProps {
  target: VisitInput | null;
  mode: CheckinMode;
  onClose: () => void;
  /** Appelé une fois la visite enregistrée (défis, rafraîchissements). */
  onVisited?: () => void;
}

const VISIT_VERDICTS: { id: Verdict; label: string; color: string; sticker: 'b_heart' | 'b_bolt' }[] = [
  { id: 'miam', label: 'MIAM', color: '#12B76A', sticker: 'b_heart' },
  { id: 'bof', label: 'BOF', color: '#F04438', sticker: 'b_bolt' },
];

interface Done {
  xp: number;
  streak: number;
  newWeek: boolean;
}

/** « Tu y es allé ? » : confirme une visite, verdict en 1 tap, vraie photo en option. */
export function CheckinSheet({ target, mode, onClose, onVisited }: CheckinSheetProps) {
  const [step, setStep] = useState<'ask' | 'verdict' | 'done'>('ask');
  const [verdict, setVerdict] = useState<Verdict>('miam');
  const [photo, setPhoto] = useState<string | undefined>();
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [onlineNotice, setOnlineNotice] = useState<string | null>(null);
  const [publishOnline, setPublishOnline] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast(4000);

  useEffect(() => {
    if (!target) return;
    setStep(mode === 'ask' ? 'ask' : 'verdict');
    setVerdict('miam');
    setPhoto(undefined);
    setCaption('');
    setError(null);
    setDone(null);
    setInviteOpen(false);
    setOnlineNotice(null);
    setPublishOnline(false);
    setRightsConfirmed(false);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.restId, mode]);

  if (!target) return null;
  const sticker = stickerFor(target.cuisine, target.restId, target.name);

  const later = () => {
    snoozeCheckin(target.restId);
    onClose();
  };

  const never = () => {
    dismissCheckin(target.restId);
    onClose();
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      setPhoto(await compressImage(file));
      setError(null);
    } catch {
      setError('Photo illisible, essaie une autre image.');
    }
  };

  const validate = async () => {
    if (step !== 'verdict' || busy) return;
    if (publishOnline && photo && !rightsConfirmed) {
      setError('Confirme tes droits sur la photo pour la publier, ou décoche « Publier aussi sur le fil ».');
      return;
    }
    // Photos déjà connues AVANT ce post (le sien ne compte pas) : décide +30 XP (première) ou +10 XP.
    setBusy(true);
    const knownPhotos = photo ? await countKnownPhotos(target.restId, communityPhotosFor(target.restId).length) : 0;
    setBusy(false);
    const beforeList = readJson<{ at: number }[]>('fooder_visits', []);
    const wasDone = weeklyStreak(beforeList.map(v => v.at)).thisWeekDone;
    const visits = addVisit(target, verdict);
    const isNew = visits.length > beforeList.length;
    const times = visits.map(v => v.at);
    const streak = weeklyStreak(times);

    let xp = isNew ? XP.visit : 0;
    if (photo || caption.trim()) {
      const me = getMe();
      const avatar = { ...DEFAULT_AVATAR, ...readJson<Partial<AvatarChoice>>('fooder_avatar', {}) };
      const level = computeLevel(readJson<{ total?: number }>('fooder_xp', {}).total ?? 0);
      const post: FeedPost = {
        id: newPostId(),
        author: { name: me.name, avatar, level },
        restaurantId: target.restId,
        restaurantName: target.name,
        cuisine: target.cuisine,
        sticker,
        caption: caption.trim().slice(0, MAX_CAPTION),
        verdict,
        photo,
        likes: 0,
        createdAt: Date.now(),
        mine: true,
      };
      if (!publishPost(post)) {
        setError('Stockage plein : retire une ancienne photo du fil.');
        return;
      }
      // En ligne seulement si l'utilisateur a coché « Publier aussi sur le fil » (et confirmé ses droits pour une photo).
      if (shouldPublishOnline({ publishOnline, rightsConfirmed, hasPhoto: Boolean(photo), hasCaption: Boolean(caption.trim()) })) {
        publishPostOnline(post)
          .then(r => {
            if (r.ok) {
              if (post.photo) track('photo_posted', { verdict: verdictSlug(verdict) });
            } else if (!r.silent && r.message) {
              setOnlineNotice(r.message);
            }
          })
          .catch(() => undefined);
      }
      if (photo) {
        const award = awardPhotoPost({ restId: target.restId, hasPhoto: true, knownPhotos });
        xp += award.xp;
        if (award.message) toast.show(award.message);
        const photos = readJson<FeedPost[]>(POSTS_KEY, []).filter(p => p.photo).length;
        unlockAchievement('photo_1');
        if (photos >= 5) unlockAchievement('photos_5');
      }
    }

    if (xp > 0) awardXp(xp);
    unlockAchievement('visit_1');
    if (visits.length >= 10) unlockAchievement('visits_10');
    if (visitedQuartiers(visits).size >= 5) unlockAchievement('quartiers_5');
    if (streak.current >= 4) unlockAchievement('week_streak_4');
    track('visit_confirmed', { has_photo: Boolean(photo), verdict });
    track('checkin', { verdict: verdictSlug(verdict), photo: Boolean(photo) });

    if (isNew) onVisited?.();
    const invite = shouldInviteRealPhoto({
      restId: target.restId,
      communityPhotos: communityPhotosFor(target.restId),
      myPostPhotoRestIds: readJson<FeedPost[]>(POSTS_KEY, []).filter(p => p.photo).map(p => p.restaurantId),
      postedInFlow: Boolean(photo),
    });
    setInviteOpen(invite);
    setDone({ xp, streak: streak.current, newWeek: !wasDone && streak.thisWeekDone });
    setStep('done');
  };

  return (
    <>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='fixed inset-0 z-[140] flex items-end justify-center p-3 bg-plum/60 backdrop-blur-sm'
        onClick={e => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ y: 80, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          className='w-full max-w-md max-h-[calc(100dvh-1.5rem)] scroll-y bg-cream rounded-[32px] panel p-5 space-y-4'
          role='dialog'
          aria-label={`Visite chez ${target.name}`}
        >
          <div className='flex items-start gap-3'>
            <Sticker name={sticker} size={64} rotate={-8} className='shrink-0' />
            <div className='flex-1 min-w-0'>
              <p className='text-xs font-bold text-plum/60'>{step === 'done' ? 'Visite enregistrée' : 'Alors, ce resto ?'}</p>
              <h2 className='text-[26px] leading-none text-plum break-words'>{target.name}</h2>
            </div>
            <button
              onClick={onClose}
              aria-label='Fermer'
              className='w-10 h-10 shrink-0 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5'
            >
              <X className='w-4 h-4' strokeWidth={3} />
            </button>
          </div>

          {step === 'ask' && (
            <div className='space-y-2.5'>
              <p className='text-sm font-medium text-slate-600'>Tu l’avais liké. Tu y es allé ?</p>
              <button onClick={() => setStep('verdict')} className='w-full duo-button bg-fooder-mint text-plum py-4 text-base'>
                Oui, j’y suis allé !
              </button>
              <div className='grid grid-cols-2 gap-2.5'>
                <button onClick={later} className='duo-button bg-white text-plum py-3 text-sm'>Pas encore</button>
                <button onClick={never} className='duo-button bg-white text-plum/70 py-3 text-sm'>Je n’irai pas</button>
              </div>
            </div>
          )}

          {step === 'verdict' && (
            <div className='space-y-3.5'>
              <div className='grid grid-cols-2 gap-2.5'>
                {VISIT_VERDICTS.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setVerdict(v.id)}
                    className={`font-display text-2xl leading-none py-3 rounded-2xl border-[3px] transition-all active:scale-95 ${verdict === v.id ? 'bg-white shadow-hard -rotate-2' : 'bg-cream/60 opacity-60'}`}
                    style={{ color: v.color, borderColor: v.color }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              <input ref={fileRef} type='file' accept='image/*' className='hidden' onChange={e => onFile(e.target.files?.[0])} />
              {photo ? (
                <div className='relative'>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt='Ta photo' className='w-full max-h-56 object-cover rounded-2xl border-[3px] border-plum' />
                  <button
                    onClick={() => {
                      setPhoto(undefined);
                      setRightsConfirmed(false);
                    }}
                    aria-label='Retirer la photo'
                    className='absolute top-2 right-2 w-9 h-9 bg-white border-[3px] border-plum rounded-full flex items-center justify-center'
                  >
                    <X className='w-4 h-4' strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className='w-full flex items-center gap-3 p-3 rounded-2xl border-[3px] border-dashed border-plum bg-white text-left active:translate-y-0.5'
                >
                  <span className='w-11 h-11 shrink-0 rounded-full bg-bubblegum border-[3px] border-plum flex items-center justify-center'>
                    <Camera className='w-5 h-5 text-plum' strokeWidth={2.5} />
                  </span>
                  <span>
                    <span className='block text-sm font-bold text-plum'>Ajoute la vraie photo</span>
                    <span className='block text-xs font-medium text-slate-500'>Jusqu’à +{PHOTO_XP_FIRST} XP · elle remplacera l’illustration</span>
                  </span>
                </button>
              )}

              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                placeholder='Un mot pour tes amis ? (optionnel)'
                rows={2}
                className='w-full rounded-2xl border-[3px] border-plum bg-white px-3 py-2 text-sm font-medium text-plum placeholder:text-plum/40 resize-none'
              />
              <p className='text-[11px] font-semibold text-plum/60 leading-snug'>
                Ta photo et ton mot restent sur ce téléphone, sauf si tu choisis de les publier.
              </p>
              {(photo || caption.trim()) && (
                <div className='space-y-2 rounded-2xl border-[3px] border-plum/30 bg-white p-3'>
                  <label className='flex items-start gap-2 text-sm font-bold text-plum'>
                    <input
                      type='checkbox'
                      checked={publishOnline}
                      onChange={e => setPublishOnline(e.target.checked)}
                      className='mt-0.5 w-5 h-5 shrink-0 accent-[#2B0F3A]'
                    />
                    <span>Publier aussi sur le fil</span>
                  </label>
                  {publishOnline && photo && (
                    <label className='flex items-start gap-2 text-xs font-semibold text-plum/70 leading-snug'>
                      <input
                        type='checkbox'
                        checked={rightsConfirmed}
                        onChange={e => setRightsConfirmed(e.target.checked)}
                        className='mt-0.5 w-5 h-5 shrink-0 accent-[#2B0F3A]'
                      />
                      <span>
                        Je confirme avoir pris cette photo moi-même, sans personne reconnaissable sans son accord, et qu’elle respecte les{' '}
                        <Link href='/legal/community' className='underline'>règles de la communauté</Link>. Elle pourra illustrer la fiche du restaurant.
                      </span>
                    </label>
                  )}
                </div>
              )}
              {error && <p className='text-xs font-bold text-fooder-red'>{error}</p>}
              <button onClick={validate} disabled={busy} className='w-full duo-button bg-bubblegum text-plum py-4 text-base disabled:opacity-60'>
                Valider ma visite · +{XP.visit} XP{photo ? ' + bonus photo' : ''}
              </button>
            </div>
          )}

          {step === 'done' && done && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className='space-y-3 text-center'>
              <p className='font-display text-5xl text-plum'>+{done.xp} XP</p>
              <div className='inline-flex items-center gap-2 chip bg-fooder-orange text-plum !px-4 !py-2 text-sm'>
                <Flame className='w-4 h-4' strokeWidth={2.5} />
                {done.streak > 0 ? `Série : ${done.streak} semaine${done.streak > 1 ? 's' : ''}` : 'Série lancée !'}
              </div>
              {onlineNotice && <p role='status' className='text-xs font-bold text-plum/70'>{onlineNotice}</p>}
              {done.newWeek && <p className='text-sm font-bold text-plum'>Semaine validée ! Reviens la semaine prochaine pour garder ta série.</p>}
              {inviteOpen && (
                <div className='relative text-left'>
                  <Link
                    href={`/feed?photo=${encodeURIComponent(target.restId)}&n=${encodeURIComponent(target.name)}&c=${encodeURIComponent(target.cuisine)}`}
                    onClick={onClose}
                    className='flex items-center gap-3 p-3 pr-12 bg-white border-[3px] border-dashed border-plum rounded-2xl active:translate-y-0.5 transition-transform'
                  >
                    <span className='w-11 h-11 shrink-0 rounded-full bg-bubblegum border-[3px] border-plum flex items-center justify-center'>
                      <Camera className='w-5 h-5 text-plum' strokeWidth={2.5} />
                    </span>
                    <span className='min-w-0'>
                      <span className='block font-bold text-plum text-sm leading-tight'>Ajoute la vraie photo du plat</span>
                      <span className='block text-xs font-medium text-slate-500 leading-snug'>Les prochains foodies la verront en premier.</span>
                      <span className='block mt-1 text-xs font-bold text-plum leading-snug'>{DISH_PHOTO_TIP.title}</span>
                      <span className='block text-[11px] font-medium text-slate-500 leading-snug'>{DISH_PHOTO_TIP.example}</span>
                    </span>
                  </Link>
                  <button
                    onClick={() => setInviteOpen(false)}
                    aria-label='Fermer cette suggestion'
                    className='absolute top-0 right-0 w-11 h-11 flex items-center justify-center rounded-full text-plum/60'
                  >
                    <X className='w-4 h-4' strokeWidth={3} />
                  </button>
                </div>
              )}
              <button onClick={onClose} className='w-full duo-button bg-white text-plum py-3.5 text-sm'>
                Super !
              </button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
    {toast.node}
    </>
  );
}

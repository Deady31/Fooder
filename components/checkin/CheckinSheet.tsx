'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Camera, Flame, X } from 'lucide-react';
import Link from 'next/link';
import { Sticker } from '../ui/Sticker';
import { Sheet } from '../ui/Sheet';
import { XpCounter } from './XpCounter';
import { haptic } from '../../lib/feedback';
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
import { getUploadQueue } from '../../lib/cloud/publish';
import { useUploadQueue } from '../../hooks/useFeed';
import { UploadNotice } from '../feed/ComposeSheet';
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

// `color` = contour vif ; `ink` = texte accessible (success / danger du thème).
const VISIT_VERDICTS: { id: Verdict; label: string; color: string; ink: string }[] = [
  { id: 'miam', label: 'MIAM', color: '#12B76A', ink: '#0B7A47' },
  { id: 'bof', label: 'BOF', color: '#F04438', ink: '#C4105E' },
];

interface Done {
  /** XP gagnés par cette validation (visite + bonus photo). 0 si la visite existait déjà aujourd'hui. */
  xp: number;
  streak: number;
  newWeek: boolean;
}

/** « Tu y es allé ? » : confirme une visite, verdict en 1 tap, vraie photo en option. */
export function CheckinSheet({ target: incoming, mode, onClose, onVisited }: CheckinSheetProps) {
  // Garde la dernière cible pendant l'animation de sortie (le parent remet `target` à null tout de suite).
  const lastTarget = useRef<VisitInput | null>(incoming);
  if (incoming) lastTarget.current = incoming;
  const target = incoming ?? lastTarget.current;
  const open = incoming !== null;
  const reduce = useReducedMotion();
  const [step, setStep] = useState<'ask' | 'verdict' | 'done'>('ask');
  const [verdict, setVerdict] = useState<Verdict>('miam');
  const [photo, setPhoto] = useState<string | undefined>();
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [onlinePostId, setOnlinePostId] = useState<string | null>(null);
  const uploads = useUploadQueue();
  const [publishOnline, setPublishOnline] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Verrou synchrone : deux appuis rapides sur « Valider » n'enregistrent qu'une visite. */
  const validating = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast(4000);

  useEffect(() => {
    if (!incoming) return;
    validating.current = false;
    setStep(mode === 'ask' ? 'ask' : 'verdict');
    setVerdict('miam');
    setPhoto(undefined);
    setCaption('');
    setError(null);
    setDone(null);
    setInviteOpen(false);
    setOnlinePostId(null);
    setPublishOnline(false);
    setRightsConfirmed(false);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming?.restId, mode]);

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
    if (step !== 'verdict' || busy || validating.current) return;
    if (publishOnline && photo && !rightsConfirmed) {
      setError('Confirme tes droits sur la photo pour la publier, ou décoche « Publier aussi sur le fil ».');
      return;
    }
    // Photos déjà connues AVANT ce post (le sien ne compte pas) : décide +30 XP (première) ou +10 XP.
    validating.current = true;
    setBusy(true);
    const knownPhotos = photo ? await countKnownPhotos(target.restId, communityPhotosFor(target.restId).length) : 0;
    const beforeList = readJson<{ at: number }[]>('fooder_visits', []);
    const wasDone = weeklyStreak(beforeList.map(v => v.at)).thisWeekDone;
    const visits = addVisit(target, verdict);
    const isNew = visits.length > beforeList.length;
    const times = visits.map(v => v.at);
    const streak = weeklyStreak(times);

    // XP de la visite : UN seul passage par awardXp (événements + niveau). Le bonus photo est attribué par awardPhotoPost.
    let xp = 0;
    if (isNew) {
      awardXp(XP.visit, 'visit');
      xp += XP.visit;
    }
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
        validating.current = false;
        setBusy(false);
        return;
      }
      // En ligne seulement si l'utilisateur a coché « Publier aussi sur le fil » (et confirmé ses droits pour une photo).
      // Passe par la file d'envoi : en cas d'échec la photo reste en attente (reprise automatique), cause affichée.
      if (shouldPublishOnline({ publishOnline, rightsConfirmed, hasPhoto: Boolean(photo), hasCaption: Boolean(caption.trim()) })) {
        setOnlinePostId(post.id);
        getUploadQueue()
          .submit(post.id)
          .then(s => {
            if (s.state === 'sent' && post.photo) track('photo_posted', { verdict: verdictSlug(verdict) });
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
    setBusy(false);
    if (isNew) haptic('success');
  };

  return (
    <>
      <Sheet open={open} onClose={onClose} labelledBy='checkin-titre' zIndex={140} className='bg-cream rounded-[32px] panel'>
        <div className='p-5 space-y-4'>
          <div className='flex items-start gap-3'>
            <Sticker name={sticker} size={64} rotate={-8} className='shrink-0' />
            <div className='flex-1 min-w-0'>
              <p className='text-xs font-bold text-plum-muted'>{step === 'done' ? 'Visite enregistrée' : 'Alors, ce resto ?'}</p>
              <h2 id='checkin-titre' className='text-[26px] leading-none text-plum break-words'>{target.name}</h2>
            </div>
            <button
              onClick={onClose}
              aria-label='Fermer'
              className='w-11 h-11 shrink-0 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5'
            >
              <X className='w-4 h-4' strokeWidth={3} />
            </button>
          </div>

          {step === 'ask' && (
            <div className='space-y-2.5'>
              <p className='text-sm font-medium text-plum-muted'>Tu l’avais liké. Tu y es allé ?</p>
              <button onClick={() => setStep('verdict')} className='w-full min-h-[44px] duo-button bg-fooder-mint text-plum py-4 text-base'>
                Oui, j’y suis allé !
              </button>
              <div className='grid grid-cols-2 gap-2.5'>
                <button onClick={later} className='min-h-[44px] duo-button bg-white text-plum py-3 text-sm'>Pas encore</button>
                <button onClick={never} className='min-h-[44px] duo-button bg-white text-plum-muted py-3 text-sm'>Je n’irai pas</button>
              </div>
            </div>
          )}

          {step === 'verdict' && (
            <div className='space-y-3.5'>
              <div role='radiogroup' aria-label='Ton verdict' className='grid grid-cols-2 gap-2.5'>
                {VISIT_VERDICTS.map(v => (
                  <button
                    key={v.id}
                    role='radio'
                    aria-checked={verdict === v.id}
                    onClick={() => setVerdict(v.id)}
                    className={`font-display text-2xl leading-none min-h-[44px] py-3 rounded-2xl border-[3px] transition-all active:scale-95 ${verdict === v.id ? 'bg-white shadow-hard -rotate-2' : 'bg-cream/60 opacity-70'}`}
                    style={{ color: v.ink, borderColor: v.color }}
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
                    className='absolute top-1 right-1 w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center'
                  >
                    <X className='w-4 h-4' strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className='w-full min-h-[44px] flex items-center gap-3 p-3 rounded-2xl border-[3px] border-dashed border-plum bg-white text-left active:translate-y-0.5'
                >
                  <span className='w-11 h-11 shrink-0 rounded-full bg-bubblegum border-[3px] border-plum flex items-center justify-center'>
                    <Camera className='w-5 h-5 text-plum' strokeWidth={2.5} />
                  </span>
                  <span>
                    <span className='block text-sm font-bold text-plum'>Ajoute la vraie photo</span>
                    <span className='block text-xs font-medium text-slate-muted'>Jusqu’à +{PHOTO_XP_FIRST} XP · elle remplacera l’illustration</span>
                  </span>
                </button>
              )}

              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                placeholder='Un mot pour tes amis ? (optionnel)'
                aria-label='Un mot pour tes amis'
                rows={2}
                className='w-full rounded-2xl border-[3px] border-plum bg-white px-3 py-2 text-base font-medium text-plum placeholder:text-plum-muted resize-none'
              />
              <p className='text-[11px] font-semibold text-plum-muted leading-snug'>
                Ta photo et ton mot restent sur ce téléphone, sauf si tu choisis de les publier.
              </p>
              {(photo || caption.trim()) && (
                <div className='space-y-2 rounded-2xl border-[3px] border-plum/30 bg-white p-3'>
                  <label className='flex items-start gap-2 min-h-[44px] py-1 text-sm font-bold text-plum'>
                    <input
                      type='checkbox'
                      checked={publishOnline}
                      onChange={e => setPublishOnline(e.target.checked)}
                      className='mt-0.5 w-5 h-5 shrink-0 accent-[#2B0F3A]'
                    />
                    <span>Publier aussi sur le fil</span>
                  </label>
                  {publishOnline && photo && (
                    <label className='flex items-start gap-2 min-h-[44px] py-1 text-xs font-semibold text-plum-muted leading-snug'>
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
              {error && <p role='alert' className='text-xs font-bold text-danger'>{error}</p>}
              <button onClick={validate} disabled={busy} className='w-full min-h-[44px] duo-button bg-bubblegum text-plum py-4 text-base disabled:opacity-60'>
                {busy ? 'Enregistrement…' : `Valider ma visite · +${XP.visit} XP${photo ? ' + bonus photo' : ''}`}
              </button>
            </div>
          )}

          {step === 'done' && done && (
            <div className='space-y-3 text-center'>
              <motion.div
                initial={reduce ? false : { scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 14 }}
                className='flex justify-center'
              >
                <Sticker name={sticker} size={88} rotate={6} />
              </motion.div>
              {done.xp > 0 ? (
                <p role='status' className='font-display text-5xl text-plum'>
                  <XpCounter value={done.xp} />
                </p>
              ) : (
                <p role='status' className='text-sm font-bold text-plum'>Cette visite était déjà enregistrée aujourd’hui.</p>
              )}
              <p className='text-sm font-medium text-plum-muted'>Merci, ton avis aide les prochains foodies à choisir.</p>
              <div className='inline-flex items-center gap-2 chip bg-fooder-orange text-plum !px-4 !py-2 text-sm'>
                <motion.span
                  initial={reduce ? false : { scale: 0 }}
                  animate={{ scale: done.newWeek && !reduce ? [0, 1.4, 1] : 1 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className='inline-flex'
                >
                  <Flame className={`w-4 h-4 ${done.newWeek ? 'fill-lemon' : ''}`} strokeWidth={2.5} />
                </motion.span>
                {done.streak > 0 ? `Série : ${done.streak} semaine${done.streak > 1 ? 's' : ''}` : 'Série lancée !'}
              </div>
              {onlinePostId && <UploadNotice status={uploads.statuses[onlinePostId]} onRetry={() => uploads.retry(onlinePostId)} />}
              {done.newWeek && <p className='text-sm font-bold text-plum'>Semaine validée ! Reviens la semaine prochaine pour garder ta série.</p>}
              {inviteOpen && (
                <div className='relative text-left'>
                  <Link
                    href={`/feed?photo=${encodeURIComponent(target.restId)}&n=${encodeURIComponent(target.name)}&c=${encodeURIComponent(target.cuisine)}`}
                    onClick={onClose}
                    className='flex items-center gap-3 p-3 pr-12 min-h-[44px] bg-white border-[3px] border-dashed border-plum rounded-2xl active:translate-y-0.5 transition-transform'
                  >
                    <span className='w-11 h-11 shrink-0 rounded-full bg-bubblegum border-[3px] border-plum flex items-center justify-center'>
                      <Camera className='w-5 h-5 text-plum' strokeWidth={2.5} />
                    </span>
                    <span className='min-w-0'>
                      <span className='block font-bold text-plum text-sm leading-tight'>Ajoute la vraie photo du plat</span>
                      <span className='block text-xs font-medium text-slate-muted leading-snug'>Les prochains foodies la verront en premier.</span>
                      <span className='block mt-1 text-xs font-bold text-plum leading-snug'>{DISH_PHOTO_TIP.title}</span>
                      <span className='block text-[11px] font-medium text-slate-muted leading-snug'>{DISH_PHOTO_TIP.example}</span>
                    </span>
                  </Link>
                  <button
                    onClick={() => setInviteOpen(false)}
                    aria-label='Fermer cette suggestion'
                    className='absolute top-0 right-0 w-11 h-11 flex items-center justify-center rounded-full text-plum-muted'
                  >
                    <X className='w-4 h-4' strokeWidth={3} />
                  </button>
                </div>
              )}
              <button onClick={onClose} className='w-full min-h-[44px] duo-button bg-white text-plum py-3.5 text-sm'>
                Super !
              </button>
            </div>
          )}
        </div>
      </Sheet>
      {toast.node}
    </>
  );
}

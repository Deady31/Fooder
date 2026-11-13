'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Star, MapPin, X, Zap, Quote, BookOpen, ExternalLink, Phone, Camera, Share2, Maximize2 } from 'lucide-react';
import Link from 'next/link';
import { Restaurant } from '../../data/mockRestaurants';
import { Sticker } from '../ui/Sticker';
import { FoodImage } from '../ui/FoodImage';
import { stickerFor } from '../../lib/stickers';
import { communityPhotosFor } from '../../lib/communityPhotos';
import { CommunityPhoto, galleryFor, photoLikesLine, viewerCredit } from '../../lib/photoPriority';
import { fetchRestaurantPhotoDetails } from '../../lib/cloud/social';
import { DISH_PHOTO_TIP, needsRealDishPhoto } from '../../lib/photoInvite';
import { FetchedPhoto, fetchGooglePhotos } from '../../lib/placePhotosClient';
import { outcomeLabel, shareLink } from '../../lib/share';
import { isSharable, restoUrl, shareText } from '../../lib/restoShare';
import { safeCommonsPage, safeWebUrl } from '../../lib/safeUrl';
import { DAY_LABELS, WeekHours, formatDay, openStatus, todayIndex } from '../../lib/hours';
import { track } from '../../lib/analytics';
import { Lightbox } from '../ui/Lightbox';
import { DIETS, DIET_LABEL, DIET_SOURCE_NOTE } from '../../lib/diets';

interface DetailSheetProps {
  rest: Restaurant | null;
  onClose: () => void;
}

const SectionTitle = ({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className='flex items-center gap-3 mb-4'>
    {icon && (
      <div className='w-9 h-9 bg-fooder-secondary border-2 border-plum rounded-xl flex items-center justify-center shadow-[2px_2px_0_#2B0F3A]'>
        {icon}
      </div>
    )}
    <h3 className='text-xl text-plum'>{children}</h3>
  </div>
);


function HoursSection({ hours }: { hours?: WeekHours }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  if (!hours) {
    return (
      <section>
        <SectionTitle>Horaires</SectionTitle>
        <p className='text-sm font-medium text-slate-500 bg-white rounded-2xl border-[3px] border-dashed border-plum/30 p-4'>
          Horaires non communiqués pour ce restaurant.
        </p>
      </section>
    );
  }

  const status = now ? openStatus(hours, now) : null;
  const today = now ? todayIndex(now) : -1;

  return (
    <section>
      <div className='flex items-center justify-between gap-3 mb-4'>
        <h3 className='text-xl text-plum'>Horaires</h3>
        {status && (
          <span className={`chip ${status.open ? 'bg-fooder-mint' : 'bg-fooder-red text-white'} text-plum`}>
            {status.label}
          </span>
        )}
      </div>
      <ul className='bg-white rounded-[22px] panel divide-y-2 divide-dashed divide-plum/15 overflow-hidden'>
        {DAY_LABELS.map((label, i) => (
          <li
            key={label}
            className={`flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm ${i === today ? 'bg-fooder-secondary font-bold text-plum' : 'text-slate-700 font-medium'}`}
          >
            <span>{label}</span>
            <span className='text-right tabular-nums'>{formatDay(hours[i] ?? [])}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DetailSheet({ rest, onClose }: DetailSheetProps) {
  const [community, setCommunity] = useState<string[]>([]);
  useEffect(() => {
    setCommunity(rest ? communityPhotosFor(rest.id) : []);
  }, [rest]);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  useEffect(() => {
    setShareMsg(null);
  }, [rest?.id]);
  const gallery = rest ? galleryFor(rest, community) : [];
  const [viewer, setViewer] = useState<number | null>(null);
  // Photo communautaire la plus aimée (cœurs + pseudo) : facultatif, sans donnée on n'affiche rien.
  const [best, setBest] = useState<CommunityPhoto | null>(null);
  useEffect(() => {
    setBest(null);
    if (!rest || rest.photoSource !== 'community') return;
    let alive = true;
    fetchRestaurantPhotoDetails([rest.id], true)
      .then(m => alive && setBest(m.get(rest.id)?.[0] ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [rest?.id, rest?.photoSource]);
  const bestLine = best && best.url === rest?.image ? photoLikesLine(best) : null;
  useEffect(() => {
    setViewer(null);
  }, [rest?.id]);
  // Photo Google : une seule demande à l'ouverture de la fiche, en mémoire de session, jamais stockée.
  const [google, setGoogle] = useState<FetchedPhoto | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const restId = rest?.id;
  useEffect(() => {
    setGoogle(null);
    if (!rest) {
      setGoogleLoading(false);
      return;
    }
    let cancelled = false;
    setGoogleLoading(true);
    fetchGooglePhotos(rest)
      .then((photos) => {
        if (!cancelled) setGoogle(photos[0] ?? null);
      })
      .finally(() => {
        if (!cancelled) setGoogleLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restId]);
  const viewerImages = rest
    ? [...(rest.image ? [rest.image] : []), ...gallery.filter((g) => g !== rest.image), ...(google ? [google.url] : [])]
    : [];
  const openViewer = (src: string) => {
    const i = viewerImages.indexOf(src);
    if (i >= 0) setViewer(i);
  };
  return (
    <AnimatePresence>
      {rest && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          className='fixed inset-0 z-50 bg-cream overflow-y-auto max-w-md mx-auto'
        >
          <div className='relative h-80 w-full border-b-[3px] border-plum'>
            <FoodImage src={rest.image} alt={rest.name} cuisine={rest.cuisine} className='w-full h-full object-cover' />
            <div className='absolute inset-0 bg-gradient-to-b from-plum/40 via-transparent to-transparent' />
            {rest.image && (
              <button
                onClick={() => openViewer(rest.image as string)}
                aria-label='Agrandir la photo'
                className='absolute inset-0 w-full h-full'
              >
                <span className='absolute top-6 left-5 w-9 h-9 bg-white/90 border-2 border-plum rounded-full flex items-center justify-center shadow-[2px_2px_0_#2B0F3A]'>
                  <Maximize2 className='w-4 h-4 text-plum' strokeWidth={3} />
                </span>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label='Fermer'
              className='absolute top-6 right-5 w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 transition-transform'
            >
              <X className='w-5 h-5 text-plum' strokeWidth={3} />
            </button>

            <div className='absolute -bottom-12 left-4 right-4 bg-white p-5 rounded-[26px] panel'>
              <div className='flex justify-between items-start gap-3 mb-2'>
                <h1 className='text-[26px] leading-[1.05] text-plum'>{rest.name}</h1>
                {rest.rating > 0 && (
                  <div className='chip bg-fooder-primary text-white text-sm shrink-0'>
                    <Star className='w-4 h-4 fill-white' /> {rest.rating}
                  </div>
                )}
              </div>
              <div className='flex items-center gap-2 text-slate-500 font-semibold text-xs'>
                <span>{rest.cuisine}</span>
                <span className='w-1 h-1 bg-slate-300 rounded-full' />
                <MapPin className='w-3 h-3' />
                <span className='line-clamp-1'>{rest.address}</span>
              </div>
              <div className='mt-2 flex items-center gap-2 text-slate-400 text-[11px] font-bold'>
                <span>{rest.reviews ? `${rest.reviews.toLocaleString('fr-FR')} avis` : ''}</span>
                {rest.sponsored && (
                  <span className='flex items-center gap-1 text-fooder-orange'>
                    <Zap className='w-3 h-3 fill-fooder-orange' />
                    {rest.sponsorLabel}
                  </span>
                )}
              </div>
              {rest.image && (
                <div className='absolute -top-9 right-4'>
                  <Sticker name={stickerFor(rest.cuisine, rest.id, rest.name)} size={72} rotate={8} />
                </div>
              )}
            </div>
          </div>

          <div className='px-5 pt-24 pb-8 space-y-9'>
            <section>
              <SectionTitle icon={<Quote className='w-4 h-4 text-plum' />}>{rest.dataSource === 'osm' ? 'En bref' : "L'expérience"}</SectionTitle>
              <p className='text-slate-700 font-medium leading-relaxed border-l-4 border-fooder-primary pl-4 text-base'>
                {rest.description || 'Découvrez ce restaurant et laissez-vous surprendre par sa cuisine et son ambiance.'}
              </p>
              {rest.phone && (
                <a
                  href={`tel:${rest.phone}`}
                  className='mt-4 flex items-center justify-center gap-2 py-3.5 bg-white border-[3px] border-plum text-plum font-bold text-sm rounded-full shadow-hard active:translate-y-0.5 transition-transform'
                >
                  <Phone className='w-4 h-4' /> Appeler pour réserver
                </a>
              )}
              {safeWebUrl(rest.website) && (
                <a
                  href={safeWebUrl(rest.website)}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='mt-4 flex items-center justify-center gap-2 py-3.5 bg-white border-[3px] border-plum text-plum font-bold text-sm rounded-full shadow-hard active:translate-y-0.5 transition-transform'
                >
                  <ExternalLink className='w-4 h-4' /> Site officiel
                </a>
              )}
            </section>

            {needsRealDishPhoto({ communityPhotos: community, photoSource: rest.photoSource }) && (
              <section className='p-4 bg-white border-[3px] border-dashed border-plum rounded-[22px]'>
                <div className='flex items-center gap-3'>
                  <span className='w-11 h-11 shrink-0 rounded-full bg-bubblegum border-[3px] border-plum flex items-center justify-center'>
                    <Camera className='w-5 h-5 text-plum' strokeWidth={2.5} />
                  </span>
                  <p className='font-bold text-plum text-base leading-tight'>Pas encore de photo du vrai plat. Tu y es allé ?</p>
                </div>
                <p className='mt-2 text-xs font-medium text-slate-500 leading-snug'>{DISH_PHOTO_TIP.title}. {DISH_PHOTO_TIP.example}</p>
                <Link
                  href={`/feed?photo=${encodeURIComponent(rest.id)}&n=${encodeURIComponent(rest.name)}&c=${encodeURIComponent(rest.cuisine)}`}
                  className='mt-3 flex items-center justify-center gap-2 py-3.5 bg-bubblegum border-[3px] border-plum text-plum font-bold text-sm rounded-full shadow-hard active:translate-y-0.5 transition-transform'
                >
                  <Camera className='w-4 h-4' strokeWidth={2.5} /> Poster le plat que j’ai mangé
                </Link>
              </section>
            )}

            <HoursSection hours={rest.hours} />

            {rest.diets && rest.diets.length > 0 && (
              <section>
                <SectionTitle>Régimes</SectionTitle>
                <div className='flex flex-wrap gap-2'>
                  {DIETS.filter(d => rest.diets?.includes(d)).map(d => (
                    <span key={d} className='chip bg-white text-plum'>{DIET_LABEL[d]}</span>
                  ))}
                </div>
                <p className='mt-2 text-xs font-medium text-slate-500'>Info {DIET_SOURCE_NOTE}, à confirmer avec le restaurant.</p>
              </section>
            )}

            {gallery.length > 0 && (
              <section>
                <SectionTitle>{community.length > 0 ? 'Photos des foodies' : rest.photoSource === 'dish' ? 'Plat typique' : rest.photoSource === 'restaurant' ? 'Le plat du restaurant' : rest.photoSource === 'site' ? 'Le restaurant' : 'Photos des plats'}</SectionTitle>
                <div className='flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-5 px-5'>
                  {gallery.map((img, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={img}
                      onClick={() => openViewer(img)}
                      className='w-52 h-52 rounded-[26px] object-cover flex-shrink-0 border-[3px] border-plum shadow-hard cursor-zoom-in'
                      alt='plat'
                    />
                  ))}
                </div>
                {bestLine && (
                  <p className='text-[11px] font-bold text-plum/70 -mt-2 mb-1'>{bestLine}</p>
                )}
                {(rest.photoSource === 'site' || rest.photoSource === 'restaurant') && (
                  <p className='text-[11px] font-medium text-slate-500 -mt-2'>
                    {rest.photoCredit || 'Photo du restaurant'}
                    {rest.photoSource === 'site' ? ' : elle montre le restaurant, pas forcément ton plat.' : '.'}
                  </p>
                )}
                {rest.photoSource === 'dish' && safeCommonsPage(rest.photoPage) && (
                  <p className='text-[11px] font-medium text-slate-500 -mt-2'>
                    Photo : {rest.photoCredit}, {rest.photoLicense},{' '}
                    <a href={safeCommonsPage(rest.photoPage)} target='_blank' rel='noopener noreferrer' className='underline'>Wikimedia Commons</a>.
                    Elle illustre un plat typique, pas ce restaurant.
                  </p>
                )}
              </section>
            )}

            {googleLoading && !google && (
              <p aria-hidden='true' className='text-[11px] font-medium text-slate-400 animate-pulse'>Le lieu · chargement…</p>
            )}
            {google && (
              <section>
                <SectionTitle>Le lieu · Google Maps</SectionTitle>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={google.url}
                  onClick={() => openViewer(google.url)}
                  className='w-52 h-52 rounded-[26px] object-cover border-[3px] border-plum shadow-hard cursor-zoom-in'
                  alt={`${rest.name} sur Google Maps`}
                />
                <p className='mt-2 text-[11px] font-medium text-slate-500'>
                  Photo Google Maps
                  {google.author && (
                    <>
                      {' · '}
                      {safeWebUrl(google.authorUri) ? (
                        <a href={safeWebUrl(google.authorUri)} target='_blank' rel='noopener noreferrer' className='underline'>{google.author}</a>
                      ) : (
                        google.author
                      )}
                    </>
                  )}
                  {safeWebUrl(google.googleMapsUri) && (
                    <>
                      {' · '}
                      <a href={safeWebUrl(google.googleMapsUri)} target='_blank' rel='noopener noreferrer' className='underline'>Voir sur Google Maps</a>
                    </>
                  )}
                  . Elle montre le lieu, pas forcément le plat.
                </p>
              </section>
            )}

            {rest.menu && (
              <section>
                <SectionTitle icon={<BookOpen className='w-4 h-4 text-plum' />}>À la carte</SectionTitle>
                <div className='space-y-5 bg-white p-6 rounded-[26px] panel'>
                  {rest.menu.map((item, i) => (
                    <div key={i} className='flex justify-between items-start border-b-2 border-dashed border-plum/15 pb-5 last:border-0 last:pb-0'>
                      <div className='space-y-1'>
                        <p className='font-bold text-plum text-base'>{item.name}</p>
                        {item.description && <p className='text-sm text-slate-500 font-medium leading-snug'>{item.description}</p>}
                      </div>
                      <span className='chip bg-fooder-secondary text-plum ml-4 shrink-0'>{item.price}€</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
          <div className='sticky bottom-0 z-20 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] bg-cream border-t-[3px] border-plum'>
            {shareMsg && <p role='status' className='text-xs font-bold text-plum text-center mb-2'>{shareMsg}</p>}
            {isSharable(rest.id) && (
              <button
                onClick={async () => {
                  const out = await shareLink({
                    title: rest.name,
                    text: shareText(rest.name, rest.cuisine),
                    url: restoUrl(window.location.origin, rest.id),
                  });
                  if (out === 'shared' || out === 'copied') track('share', { kind: 'resto' });
                  setShareMsg(outcomeLabel(out));
                }}
                className='w-full mb-2.5 duo-button bg-white text-plum py-3 text-sm flex items-center justify-center gap-2'
              >
                <Share2 className='w-4 h-4' strokeWidth={2.5} />
                Partager
              </button>
            )}
            <button
              onClick={() => {
                const url =
                  rest.lat !== undefined && rest.lng !== undefined
                    ? `https://www.google.com/maps/dir/?api=1&destination=${rest.lat},${rest.lng}&travelmode=walking`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rest.name + ' ' + rest.address)}`;
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
              className='w-full duo-button bg-fooder-primary text-white py-4 text-lg flex items-center justify-center gap-3'
            >
              <MapPin className='w-6 h-6' />
              Y aller
            </button>
          </div>
          {viewer !== null && viewerImages.length > 0 && (
            <Lightbox
              images={viewerImages}
              index={viewer}
              alt={rest.name}
              credit={viewerCredit(rest, viewerImages[viewer], community, google)}
              onIndexChange={setViewer}
              onClose={() => setViewer(null)}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

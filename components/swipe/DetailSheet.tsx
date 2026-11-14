'use client';
import { useEffect, useRef, useState } from 'react';
import { Star, MapPin, X, Zap, Quote, BookOpen, ExternalLink, Phone, Share2, Maximize2 } from 'lucide-react';
import { Restaurant } from '../../data/mockRestaurants';
import { Sticker } from '../ui/Sticker';
import { FoodImage } from '../ui/FoodImage';
import { Sheet } from '../ui/Sheet';
import { Lightbox } from '../ui/Lightbox';
import { CommunityPhotos } from './CommunityPhotos';
import { stickerFor } from '../../lib/stickers';
import { galleryFor, viewerCredit } from '../../lib/photoPriority';
import { FetchedPhoto, fetchGooglePhotos } from '../../lib/placePhotosClient';
import { outcomeLabel, shareLink } from '../../lib/share';
import { isSharable, restoUrl, shareText } from '../../lib/restoShare';
import { safeCommonsPage, safeWebUrl } from '../../lib/safeUrl';
import { DAY_LABELS, WeekHours, formatDay, openStatus, todayIndex } from '../../lib/hours';
import { track } from '../../lib/analytics';
import { REPORT_LABEL, reportPlace, type ReportReason } from '../../lib/reports';
import { DIETS, DIET_LABEL, DIET_SOURCE_NOTE } from '../../lib/diets';
import { googleMapsDirectionsUrl, restaurantFullAddress } from '../../lib/geo/format';

interface DetailSheetProps {
  rest: Restaurant | null;
  onClose: () => void;
}

const TITLE_ID = 'fiche-titre';

const SectionTitle = ({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className='flex items-center gap-3 mb-4'>
    {icon && (
      <div className='w-9 h-9 shrink-0 bg-fooder-secondary border-2 border-plum rounded-xl flex items-center justify-center shadow-[2px_2px_0_#2B0F3A]'>
        {icon}
      </div>
    )}
    <h3 className='text-xl text-plum min-w-0'>{children}</h3>
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
        <p className='text-sm font-medium text-plum-muted bg-white rounded-2xl border-[3px] border-dashed border-plum/30 p-4'>
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
        <h3 className='text-xl text-plum min-w-0'>Horaires</h3>
        {status && (
          <span className={`chip shrink-0 ${status.open ? 'bg-fooder-mint text-plum' : 'bg-danger text-white'}`}>{status.label}</span>
        )}
      </div>
      <ul className='selectable bg-white rounded-[22px] panel divide-y-2 divide-dashed divide-plum/15 overflow-hidden'>
        {DAY_LABELS.map((label, i) => (
          <li
            key={label}
            className={`flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm ${i === today ? 'bg-fooder-secondary font-bold text-plum' : 'text-plum font-medium'}`}
          >
            <span>{label}</span>
            <span className='text-right tabular-nums'>{formatDay(hours[i] ?? [])}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const ROUND_BTN =
  'w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 transition-transform';

/** Photo « plat typique » / restaurant / site (les photos de la communauté ont leur propre section). */
function galleryTitle(rest: Restaurant): string {
  if (rest.photoSource === 'dish') return 'Plat typique';
  if (rest.photoSource === 'restaurant') return 'Le plat du restaurant';
  if (rest.photoSource === 'site') return 'Le restaurant';
  return 'Photos des plats';
}

export function DetailSheet({ rest, onClose }: DetailSheetProps) {
  // On garde la dernière fiche pendant l'animation de sortie (rest passe à null à la fermeture).
  const last = useRef<Restaurant | null>(null);
  if (rest) last.current = rest;
  const shown = rest ?? last.current;

  const closeRef = useRef<HTMLButtonElement>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [reporting, setReporting] = useState(false);
  useEffect(() => setReporting(false), [rest?.id]);
  const restId = rest?.id;
  useEffect(() => {
    setShareMsg(null);
    setViewer(null);
  }, [restId]);

  // Photo Google : une seule demande à l'ouverture de la fiche, en mémoire de session, jamais stockée.
  const [google, setGoogle] = useState<FetchedPhoto | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  useEffect(() => {
    setGoogle(null);
    if (!rest) {
      setGoogleLoading(false);
      return;
    }
    let cancelled = false;
    setGoogleLoading(true);
    fetchGooglePhotos(rest)
      .then(photos => {
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

  // Photos de la communauté : section dédiée ; ici seulement les photos du resto, du site ou du plat typique.
  const gallery = shown && shown.photoSource !== 'community' ? galleryFor(shown, []) : [];
  const viewerImages = shown ? [...(shown.image ? [shown.image] : []), ...gallery.filter(g => g !== shown.image), ...(google ? [google.url] : [])] : [];
  const openViewer = (src: string) => {
    const i = viewerImages.indexOf(src);
    if (i >= 0) setViewer(i);
  };
  const webUrl = shown ? safeWebUrl(shown.website) : undefined;

  return (
    <Sheet
      open={rest !== null}
      onClose={onClose}
      labelledBy={TITLE_ID}
      variant='full'
      initialFocusRef={closeRef}
      className='bg-cream mx-auto max-w-2xl md:border-x-[3px] md:border-plum'
    >
      {shown && (
        <>
          <div className='relative h-[clamp(200px,38dvh,320px)] w-full border-b-[3px] border-plum'>
            <FoodImage src={shown.image} alt={`Photo de ${shown.name}`} cuisine={shown.cuisine} className='w-full h-full object-cover' />
            <div className='absolute inset-0 bg-gradient-to-b from-plum/40 via-transparent to-transparent pointer-events-none' />
            {shown.image && (
              <button
                type='button'
                onClick={() => openViewer(shown.image as string)}
                aria-label='Agrandir la photo'
                className='absolute inset-0 w-full h-full'
              >
                <span className='absolute top-[max(env(safe-area-inset-top),16px)] left-4 w-9 h-9 bg-white/90 border-2 border-plum rounded-full flex items-center justify-center shadow-[2px_2px_0_#2B0F3A]'>
                  <Maximize2 className='w-4 h-4 text-plum' strokeWidth={3} />
                </span>
              </button>
            )}
            <div className='absolute top-[max(env(safe-area-inset-top),16px)] right-4 flex items-center gap-2'>
              {isSharable(shown.id) && (
                <button
                  type='button'
                  aria-label={`Partager ${shown.name}`}
                  onClick={async () => {
                    const out = await shareLink({
                      title: shown.name,
                      text: shareText(shown.name, shown.cuisine),
                      url: restoUrl(window.location.origin, shown.id),
                    });
                    if (out === 'shared' || out === 'copied') track('share', { kind: 'resto' });
                    setShareMsg(outcomeLabel(out));
                  }}
                  className={ROUND_BTN}
                >
                  <Share2 className='w-5 h-5 text-plum' strokeWidth={3} />
                </button>
              )}
              <button ref={closeRef} type='button' onClick={onClose} aria-label='Fermer la fiche' className={ROUND_BTN}>
                <X className='w-5 h-5 text-plum' strokeWidth={3} />
              </button>
            </div>
          </div>

          <div className='relative -mt-12 mx-4 bg-white p-5 rounded-[26px] panel'>
            {shown.image && (
              <div className='absolute right-4 bottom-[calc(100%-10px)] pointer-events-none'>
                <Sticker name={stickerFor(shown.cuisine, shown.id, shown.name)} size={72} rotate={8} />
              </div>
            )}
            <div className='flex justify-between items-start gap-3 mb-2'>
              <h1 id={TITLE_ID} className='min-w-0 break-words line-clamp-3 text-[clamp(22px,7vw,26px)] leading-[1.05] text-plum'>
                {shown.name}
              </h1>
              {shown.rating > 0 && (
                <div className='chip bg-fooder-primary text-white text-sm shrink-0'>
                  <Star className='w-4 h-4 fill-white' aria-hidden='true' /> {shown.rating}
                </div>
              )}
            </div>
            <p className='text-plum-muted font-semibold text-xs'>
              {shown.cuisine}
              {shown.reviews ? ` · ${shown.reviews.toLocaleString('fr-FR')} avis` : ''}
              {shown.distance ? ` · ${shown.distance}` : ''}
            </p>
            <p className='selectable mt-1.5 flex items-start gap-1.5 text-plum font-semibold text-sm leading-snug'>
              <MapPin className='w-4 h-4 shrink-0 mt-0.5' aria-hidden='true' />
              <span className='min-w-0 break-words'>{restaurantFullAddress(shown)}</span>
            </p>
            {shown.phone && (
              <p className='selectable mt-1 flex items-start gap-1.5 text-plum font-semibold text-sm'>
                <Phone className='w-4 h-4 shrink-0 mt-0.5' aria-hidden='true' />
                <span>{shown.phone}</span>
              </p>
            )}
            {shown.sponsored && (
              <p className='mt-2 flex items-center gap-1 text-orange-ink text-xs font-bold'>
                <Zap className='w-3 h-3 fill-fooder-orange' aria-hidden='true' />
                {shown.sponsorLabel}
              </p>
            )}
          </div>

          <div className='px-5 pt-8 pb-8 space-y-8'>
            <section>
              <SectionTitle icon={<Quote className='w-4 h-4 text-plum' />}>{shown.dataSource === 'osm' ? 'En bref' : 'L’expérience'}</SectionTitle>
              <p className='selectable text-plum font-medium leading-relaxed border-l-4 border-fooder-primary pl-4 text-base break-words'>
                {shown.description || 'Découvre ce restaurant et laisse-toi surprendre par sa cuisine et son ambiance.'}
              </p>
              {shown.phone && (
                <a
                  href={`tel:${shown.phone}`}
                  className='mt-4 flex min-h-[48px] items-center justify-center gap-2 py-3 bg-white border-[3px] border-plum text-plum font-bold text-sm rounded-full shadow-hard active:translate-y-0.5 transition-transform'
                >
                  <Phone className='w-4 h-4' /> Appeler pour réserver
                </a>
              )}
              {webUrl && (
                <a
                  href={webUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='mt-4 flex min-h-[48px] items-center justify-center gap-2 py-3 bg-white border-[3px] border-plum text-plum font-bold text-sm rounded-full shadow-hard active:translate-y-0.5 transition-transform'
                >
                  <ExternalLink className='w-4 h-4' /> Site officiel
                </a>
              )}
            </section>

            {shown.diets && shown.diets.length > 0 && (
              <section>
                <SectionTitle>Régimes</SectionTitle>
                <div className='flex flex-wrap gap-2'>
                  {DIETS.filter(d => shown.diets?.includes(d)).map(d => (
                    <span key={d} className='chip bg-white text-plum'>{DIET_LABEL[d]}</span>
                  ))}
                </div>
                <p className='mt-2 text-xs font-medium text-plum-muted'>Info {DIET_SOURCE_NOTE}, à confirmer avec le restaurant.</p>
              </section>
            )}

            <HoursSection hours={shown.hours} />

            <CommunityPhotos rest={shown} />

            {gallery.length > 0 && (
              <section>
                <SectionTitle>{galleryTitle(shown)}</SectionTitle>
                <ul className='flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-5 px-5'>
                  {gallery.map((img, i) => (
                    <li key={img} className='shrink-0'>
                      <button
                        type='button'
                        onClick={() => openViewer(img)}
                        aria-label={`Agrandir la photo ${i + 1} sur ${gallery.length} : ${shown.name}`}
                        className='block rounded-[26px] cursor-zoom-in'
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img}
                          alt={`${galleryTitle(shown)} chez ${shown.name}, photo ${i + 1} sur ${gallery.length}`}
                          width={208}
                          height={208}
                          loading='lazy'
                          decoding='async'
                          draggable={false}
                          className='w-52 h-52 rounded-[26px] object-cover border-[3px] border-plum shadow-hard bg-white'
                        />
                      </button>
                    </li>
                  ))}
                </ul>
                {(shown.photoSource === 'site' || shown.photoSource === 'restaurant') && (
                  <p className='text-xs font-medium text-plum-muted'>
                    {shown.photoCredit || 'Photo du restaurant'}
                    {shown.photoSource === 'site' ? ' : elle montre le restaurant, pas forcément ton plat.' : '.'}
                  </p>
                )}
                {shown.photoSource === 'dish' && safeCommonsPage(shown.photoPage) && (
                  <p className='text-xs font-medium text-plum-muted'>
                    Photo : {shown.photoCredit}, {shown.photoLicense},{' '}
                    <a href={safeCommonsPage(shown.photoPage)} target='_blank' rel='noopener noreferrer' className='underline'>Wikimedia Commons</a>.
                    Elle illustre un plat typique, pas ce restaurant.
                  </p>
                )}
              </section>
            )}

            {googleLoading && !google && (
              <p aria-hidden='true' className='text-xs font-medium text-plum-muted motion-safe:animate-pulse'>Le lieu · chargement…</p>
            )}
            {google && (
              <section>
                <SectionTitle>Le lieu · Google Maps</SectionTitle>
                <button
                  type='button'
                  onClick={() => openViewer(google.url)}
                  aria-label={`Agrandir la photo Google Maps de ${shown.name}`}
                  className='block rounded-[26px] cursor-zoom-in'
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={google.url}
                    alt={`${shown.name} sur Google Maps`}
                    width={208}
                    height={208}
                    loading='lazy'
                    decoding='async'
                    draggable={false}
                    className='w-52 h-52 rounded-[26px] object-cover border-[3px] border-plum shadow-hard bg-white'
                  />
                </button>
                <p className='mt-2 text-xs font-medium text-plum-muted'>
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

            {shown.menu && (
              <section>
                <SectionTitle icon={<BookOpen className='w-4 h-4 text-plum' />}>À la carte</SectionTitle>
                <div className='selectable space-y-5 bg-white p-4 sm:p-6 rounded-[26px] panel'>
                  {shown.menu.map((item, i) => (
                    <div key={i} className='flex justify-between items-start gap-3 border-b-2 border-dashed border-plum/15 pb-5 last:border-0 last:pb-0'>
                      <div className='min-w-0 space-y-1'>
                        <p className='font-bold text-plum text-base break-words'>{item.name}</p>
                        {item.description && <p className='text-sm text-plum-muted font-medium leading-snug break-words'>{item.description}</p>}
                      </div>
                      <span className='chip bg-fooder-secondary text-plum shrink-0'>{item.price}€</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section className='text-center'>
              {!reporting ? (
                <button type='button' onClick={() => setReporting(true)} className='min-h-[44px] px-3 text-sm font-bold text-plum-muted underline'>
                  Signaler un problème
                </button>
              ) : (
                <div className='space-y-2'>
                  <p className='text-sm font-bold text-plum'>Quel problème ?</p>
                  {(Object.keys(REPORT_LABEL) as ReportReason[]).map(reason => (
                    <button
                      key={reason}
                      type='button'
                      onClick={() => { reportPlace(shown.id, reason); setReporting(false); onClose(); }}
                      className='flex min-h-[48px] w-full items-center justify-center rounded-full border-[3px] border-plum bg-white py-3 text-sm font-bold text-plum shadow-hard active:translate-y-0.5 transition-transform'
                    >
                      {REPORT_LABEL[reason]}
                    </button>
                  ))}
                  <p className='text-xs font-medium text-plum-muted'>La fiche disparaît de ton appli. Merci !</p>
                </div>
              )}
            </section>
          </div>

          <div className='sticky bottom-0 z-20 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] bg-cream border-t-[3px] border-plum'>
            {shareMsg && <p role='status' className='text-xs font-bold text-plum text-center mb-2'>{shareMsg}</p>}
            <a
              href={googleMapsDirectionsUrl(shown)}
              target='_blank'
              rel='noopener noreferrer'
              aria-label={`Itinéraire vers ${shown.name} (Google Maps, nouvel onglet)`}
              className='duo-button w-full min-h-[56px] bg-fooder-primary text-white py-3.5 text-base flex items-center justify-center gap-2'
            >
              <MapPin className='w-5 h-5 shrink-0' aria-hidden='true' />
              Itinéraire
            </a>
          </div>

          {viewer !== null && viewerImages.length > 0 && (
            <Lightbox
              images={viewerImages}
              index={viewer}
              alt={shown.name}
              credit={viewerCredit(shown, viewerImages[viewer], [], google)}
              onIndexChange={setViewer}
              onClose={() => setViewer(null)}
            />
          )}
        </>
      )}
    </Sheet>
  );
}

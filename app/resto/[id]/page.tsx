import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import records from '../../../data/toulouse-places.json';
import { OsmRecord, osmToRestaurant } from '../../../lib/osm';
import { HoursLine } from '../../../components/resto/HoursLine';
import { findPlaceById, shareText } from '../../../lib/restoShare';
import { safeCommonsPage } from '../../../lib/safeUrl';

// Page mise en cache 5 min ; l'état Ouvert/Fermé est calculé côté navigateur (HoursLine).
export const revalidate = 300;

interface PageProps {
  params: { id: string };
}

const PLACES = records as OsmRecord[];

export function generateMetadata({ params }: PageProps): Metadata {
  const rec = findPlaceById(PLACES, params.id);
  if (!rec) return { title: 'Restaurant introuvable - Fooder' };
  const r = osmToRestaurant(rec);
  const title = `${r.name} - Fooder`;
  const description = `${shareText(r.name, r.cuisine)}. ${r.address}.`;
  return { title, description, openGraph: { title, description, type: 'website', locale: 'fr_FR' } };
}

export default function RestoPublicPage({ params }: PageProps) {
  const rec = findPlaceById(PLACES, params.id);
  if (!rec) notFound();
  const r = osmToRestaurant(rec);
  const itineraire = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}&travelmode=walking`;

  return (
    <main className='min-h-dvh bg-cream max-w-md mx-auto pb-10'>
      <div className='h-64 w-full border-b-[3px] border-plum bg-fooder-secondary'>
        {r.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.image} alt={`Plat typique : ${r.cuisine}`} className='w-full h-full object-cover' />
        ) : null}
      </div>
      <div className='px-5 pt-5 space-y-5'>
        {r.photoSource === 'dish' && (
          <p className='text-[11px] font-medium text-slate-500'>
            Photo d&apos;un plat typique, pas de ce restaurant. Photo : {r.photoCredit}, {r.photoLicense}
            {safeCommonsPage(r.photoPage) && (
              <>
                {', '}
                <a href={safeCommonsPage(r.photoPage)} target='_blank' rel='noopener noreferrer' className='underline'>Wikimedia Commons</a>
              </>
            )}
            .
          </p>
        )}
        <header className='space-y-1'>
          <h1 className='text-[30px] leading-tight text-plum break-words'>{r.name}</h1>
          <p className='font-semibold text-slate-600'>{r.cuisine}</p>
        </header>
        <dl className='bg-white rounded-[22px] panel p-4 space-y-3 text-sm'>
          <div>
            <dt className='font-bold text-plum'>Adresse</dt>
            <dd className='font-medium text-slate-700'>{r.address}</dd>
          </div>
          <div>
            <dt className='font-bold text-plum'>Horaires</dt>
            <dd className='font-medium text-slate-700'><HoursLine hours={rec.h} /></dd>
          </div>
        </dl>
        <div className='space-y-3'>
          <Link href='/swipe' className='block text-center duo-button bg-fooder-primary text-white py-4 text-lg'>
            Ouvrir dans Fooder
          </Link>
          <a
            href={itineraire}
            target='_blank'
            rel='noopener noreferrer'
            className='block text-center duo-button bg-white text-plum py-3.5 text-base'
          >
            Itinéraire
          </a>
        </div>
        <p className='text-[11px] font-medium text-slate-500 text-center'>
          Données © contributeurs OpenStreetMap et Overture Maps.
        </p>
      </div>
    </main>
  );
}

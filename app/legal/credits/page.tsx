import { LegalPage } from '../../../components/legal/LegalPage';
import { allDishPhotos } from '../../../lib/dishes';

export const metadata = { title: 'Licences et crédits - Fooder' };

export default function CreditsPage() {
  return (
    <LegalPage title='Licences et crédits' updated='11 novembre 2026'>
      <h2>Données</h2>
      <ul>
        <li>
          Restaurants et horaires : © contributeurs <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>, licence ODbL.
        </li>
        <li>
          Adresses, sites web et téléphones : <a href='https://overturemaps.org'>Overture Maps Foundation</a>, jeu de données Places, licence CDLA Permissive 2.0.
        </li>
        <li>
          Fond de carte : <a href='https://openfreemap.org'>OpenFreeMap</a>, données OpenStreetMap, rendu MapLibre GL.
        </li>
        <li>Photos des restaurants : fournies par les utilisateurs et, à terme, par les restaurateurs, sous leur responsabilité.</li>
        <li>Photos Google Maps : affichées via l&apos;API Google Places, avec le nom de leur auteur sur la carte.</li>
        <li>Photos de plats typiques : liste ci-dessous.</li>
      </ul>
      <h2>Photos de plats typiques</h2>
      <p>
        Ces photos illustrent un type de plat et non un restaurant précis. Elles proviennent de Wikimedia Commons et sont utilisées selon leur licence
        (redimensionnées pour l&apos;affichage).
      </p>
      <ul>
        {allDishPhotos().map(d => (
          <li key={d.key}>
            {d.key} : <a href={d.page}>{d.title}</a> par {d.author}, {d.licenseUrl ? <a href={d.licenseUrl}>{d.license}</a> : d.license}.
          </li>
        ))}
      </ul>
      <h2>Typographies</h2>
      <ul>
        <li>Bagel Fat One et DM Sans, licence SIL Open Font License 1.1 (Google Fonts).</li>
      </ul>
      <h2>Bibliothèques</h2>
      <ul>
        <li>Next.js, React, Framer Motion, Tailwind CSS, Lucide, MapLibre GL : licences MIT, ISC ou BSD.</li>
      </ul>
      <h2>Illustrations</h2>
      <p>
        Les stickers, mascottes et le logo de Fooder sont des créations originales générées avec l&apos;aide d&apos;outils d&apos;IA et retravaillées
        pour l&apos;application. Toute reproduction sans autorisation est interdite.
      </p>
    </LegalPage>
  );
}

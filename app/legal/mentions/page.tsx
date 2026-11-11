import { LegalPage } from '../../../components/legal/LegalPage';

export const metadata = { title: 'Mentions légales - Fooder' };

export default function MentionsPage() {
  return (
    <LegalPage title='Mentions légales' updated='11 novembre 2026'>
      <p><strong>Éditeur :</strong> [À COMPLÉTER : nom, statut (particulier, micro-entreprise ou société), adresse]</p>
      <p><strong>Contact :</strong> [À COMPLÉTER : e-mail]</p>
      <p><strong>Directeur de la publication :</strong> [À COMPLÉTER]</p>
      <p><strong>Hébergeur :</strong> Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.</p>
      <p>
        <strong>Cartographie :</strong> © contributeurs <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>,
        tuiles OpenFreeMap.
      </p>
    </LegalPage>
  );
}

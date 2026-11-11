import { LegalPage } from '../../../components/legal/LegalPage';

export const metadata = { title: 'Mentions légales - Fooder' };

export default function MentionsPage() {
  return (
    <LegalPage title='Mentions légales' updated='11 novembre 2026'>
      <h2>Éditeur</h2>
      <p>
        <strong>[À COMPLÉTER]</strong> : nom ou raison sociale, forme juridique, capital le cas échéant, adresse du siège, numéro SIRET et RCS/RNE,
        numéro de TVA intracommunautaire si applicable. Pour un particulier éditant à titre non professionnel, l&apos;identité peut être communiquée à
        l&apos;hébergeur seulement, mais l&apos;anonymat n&apos;est plus possible dès que le service est monétisé.
      </p>
      <p><strong>Contact :</strong> [À COMPLÉTER : e-mail et, si possible, téléphone]</p>
      <p><strong>Directeur de la publication :</strong> [À COMPLÉTER]</p>

      <h2>Hébergeur</h2>
      <p>Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis. Site : vercel.com.</p>

      <h2>Propriété intellectuelle</h2>
      <p>La marque Fooder, le logo, les illustrations et le code sont protégés. Voir aussi <a href='/legal/credits'>Licences et crédits</a>.</p>

      <h2>Cartographie et données</h2>
      <p>
        © contributeurs <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>, tuiles OpenFreeMap.
      </p>

      <h2>Signalement de contenu illicite</h2>
      <p>Voir les <a href='/legal/community'>règles de la communauté</a>.</p>
    </LegalPage>
  );
}

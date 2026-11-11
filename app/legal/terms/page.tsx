import { LegalPage } from '../../../components/legal/LegalPage';

export const metadata = { title: "Conditions d'utilisation - Fooder" };

export default function TermsPage() {
  return (
    <LegalPage title="Conditions d'utilisation" updated='11 novembre 2026'>
      <p>En utilisant Fooder, tu acceptes ces conditions. Version de test : le service peut évoluer ou s&apos;interrompre.</p>
      <h2>Le service</h2>
      <p>
        Fooder aide à découvrir des restaurants à Toulouse. Les informations (horaires, adresses) peuvent être inexactes ou
        obsolètes : vérifie auprès de l&apos;établissement avant de te déplacer.
      </p>
      <h2>Contenus publiés</h2>
      <ul>
        <li>Tu restes propriétaire de tes photos et textes ; tu nous autorises à les afficher dans l&apos;application.</li>
        <li>Interdit : contenus illégaux, haineux, harcelants, publicité déguisée, photos de tiers sans accord.</li>
        <li>Tu peux signaler un contenu ; nous pouvons le retirer et suspendre un compte en cas d&apos;abus.</li>
      </ul>
      <h2>Premium</h2>
      <p>Les avantages Premium sont décrits au moment de l&apos;achat. Droit de rétractation et résiliation : selon la loi française.</p>
      <h2>Responsabilité</h2>
      <p>Le service est fourni « en l&apos;état ». Nous ne sommes pas responsables des services rendus par les restaurants.</p>
    </LegalPage>
  );
}

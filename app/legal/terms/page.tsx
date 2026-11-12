import { LegalPage } from '../../../components/legal/LegalPage';

export const metadata = { title: "Conditions d'utilisation - Fooder" };

export default function TermsPage() {
  return (
    <LegalPage title="Conditions d'utilisation" updated='11 novembre 2026'>
      <p>
        Ces conditions encadrent l&apos;usage de Fooder, éditée par <strong>[À COMPLÉTER : éditeur]</strong>. En utilisant l&apos;application, tu les
        acceptes. Version de test : le service peut évoluer ou s&apos;interrompre.
      </p>
      <h2>1. Le service</h2>
      <p>
        Fooder aide à découvrir des restaurants à Toulouse et à partager ses expériences. Les informations (horaires, adresses, cuisine) proviennent
        de sources publiques et des utilisateurs : elles peuvent être inexactes ou périmées. Vérifie auprès de l&apos;établissement avant de te
        déplacer.
      </p>
      <h2>2. Accès et compte</h2>
      <ul>
        <li>Fooder est réservé aux personnes d&apos;au moins 15 ans.</li>
        <li>Tu es responsable de ton compte et de ce qui y est publié.</li>
        <li>Les informations que tu fournis doivent être exactes.</li>
      </ul>
      <h2>3. Contenus publiés</h2>
      <ul>
        <li>Tu restes propriétaire de tes photos et textes. Tu accordes à Fooder une licence non exclusive, gratuite et mondiale pour les afficher dans l&apos;application (fil, fiche du restaurant) tant qu&apos;ils sont en ligne.</li>
        <li>Tu garantis détenir les droits sur ce que tu publies. Voir les <a href='/legal/community'>règles de la communauté</a>.</li>
        <li>Nous pouvons retirer un contenu manifestement illicite ou contraire aux règles, et suspendre un compte en cas d&apos;abus.</li>
        <li>Tu peux signaler un contenu et contester une décision de modération (voir les règles de la communauté).</li>
      </ul>
      <h2>4. Propriété intellectuelle</h2>
      <p>La marque, le logo, les illustrations et le code de Fooder sont protégés. Toute reproduction sans autorisation est interdite.</p>
      <h2>5. Responsabilité</h2>
      <p>
        Le service est fourni « en l&apos;état ». Fooder n&apos;est pas partie aux relations entre utilisateurs et restaurants et ne répond pas des services rendus par
        ces derniers. Rien dans ces conditions n&apos;exclut une responsabilité que la loi ne permet pas d&apos;exclure.
      </p>
      <h2>6. Données personnelles</h2>
      <p>Voir la <a href='/legal/privacy'>politique de confidentialité</a>.</p>
      <h2>7. Litiges et médiation</h2>
      <p>
        Écris-nous d&apos;abord à <strong>[À COMPLÉTER : e-mail]</strong>. Si le désaccord persiste, tu peux saisir gratuitement le médiateur de la consommation :{' '}
        <strong>[À COMPLÉTER : nom et coordonnées du médiateur]</strong>. Droit français applicable ; à défaut d&apos;accord amiable, les tribunaux
        compétents sont ceux désignés par la loi.
      </p>
    </LegalPage>
  );
}

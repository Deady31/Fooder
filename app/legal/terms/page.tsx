import { LegalPage } from '../../../components/legal/LegalPage';

export const metadata = { title: "Conditions d'utilisation - Fooder" };

export default function TermsPage() {
  return (
    <LegalPage title="Conditions d'utilisation" updated='13 novembre 2026'>
      <p>
        Ces conditions encadrent l&apos;usage de Fooder, éditée par <strong>[À COMPLÉTER : éditeur]</strong>. En utilisant l&apos;application (et en cochant la case à l&apos;inscription), tu les
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
      <h2>3. Photos et contenus que tu publies</h2>
      <p>« Contenus » désigne tes photos, commentaires et tout ce que tu publies dans Fooder.</p>
      <ul>
        <li><strong>Tu restes propriétaire.</strong> Tes photos et tes textes restent à toi.</li>
        <li>
          <strong>Ce que tu nous autorises.</strong> En publiant un contenu, tu accordes à Fooder une licence gratuite, non exclusive et mondiale pour
          l&apos;afficher, le reproduire et l&apos;adapter techniquement (recadrage, compression, changement de format) dans l&apos;application, et pour le
          présenter : page du restaurant, fil, partages et communication sur l&apos;application.
        </li>
        <li>
          <strong>Ce que tu garantis.</strong> Tu es l&apos;auteur de la photo et tu détiens les droits sur ce que tu publies. Aucune personne n&apos;y est
          reconnaissable sans son accord.
        </li>
        <li>
          <strong>Ce qui est interdit.</strong> Les contenus illicites, haineux ou trompeurs (par exemple une photo qui n&apos;est pas la tienne ou qui ne
          montre pas le restaurant concerné). Voir les <a href='/legal/community'>règles de la communauté</a>.
        </li>
        <li>
          <strong>Modération.</strong> Fooder peut retirer un contenu manifestement illicite ou contraire aux règles, et suspendre un compte en cas d&apos;abus.
          Tu peux signaler un contenu et contester une décision de modération (voir les règles de la communauté).
        </li>
        <li>
          <strong>Quand la licence s&apos;arrête.</strong> Elle prend fin quand tu supprimes le contenu ou ton compte : nous ne l&apos;affichons alors plus.
          Restent possibles les copies de sauvegarde et les partages déjà effectués (par exemple une image déjà envoyée ou publiée ailleurs).
        </li>
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

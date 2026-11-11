import { LegalPage } from '../../../components/legal/LegalPage';

export const metadata = { title: 'Confidentialité - Fooder' };

export default function PrivacyPage() {
  return (
    <LegalPage title='Confidentialité' updated='11 novembre 2026'>
      <p>
        Cette politique explique quelles données Fooder utilise, pourquoi et pendant combien de temps. Responsable du traitement :{' '}
        <strong>[À COMPLÉTER : éditeur]</strong>, contact : <strong>[À COMPLÉTER : e-mail]</strong>.
      </p>

      <h2>Ce qui reste sur ton téléphone</h2>
      <p>
        Tes likes, ton niveau, ton avatar, tes préférences, tes publications et commentaires sont enregistrés dans le stockage local de ton navigateur
        (liste détaillée dans <a href='/legal/cookies'>Cookies et stockage</a>). Ils ne sont envoyés à aucun serveur tant que tu n&apos;as pas de compte.
        Tu peux les exporter ou les effacer depuis ton profil.
      </p>

      <h2>Données traitées, finalités et bases légales</h2>
      <ul>
        <li><strong>Position approximative</strong> (si tu l&apos;autorises) : trier les restaurants par distance. Base : ton consentement. Envoyée au serveur pour la requête, non conservée.</li>
        <li><strong>Mesure d&apos;audience anonyme</strong> (si tu l&apos;acceptes) : améliorer l&apos;application. Base : ton consentement. Identifiant aléatoire, sans nom ni e-mail. Choix redemandé tous les 6 mois.</li>
        <li><strong>Compte et fil social</strong> (à venir) : e-mail, pseudo, avatar, publications. Base : exécution du service. Conservés tant que ton compte existe, supprimés avec lui.</li>
        <li><strong>Sécurité et modération</strong> : prévenir les abus. Base : intérêt légitime. Journaux techniques conservés 12 mois au plus.</li>
        <li><strong>Paiement Premium</strong> (à venir) : géré par un prestataire de paiement ; nous ne stockons pas ta carte. Données de facturation conservées 10 ans (obligation légale).</li>
      </ul>

      <h2>Destinataires et transferts</h2>
      <p>
        Hébergement : Vercel (fonctions déployées à Paris). Base de données du compte (à venir) : hébergeur situé dans l&apos;Union européenne. Mesure d&apos;audience :
        PostHog, région UE. Lorsqu&apos;un prestataire est établi hors UE, nous nous appuyons sur le cadre de protection des données applicable (clauses contractuelles types ou
        décision d&apos;adéquation). Aucune revente de données, aucune publicité ciblée.
      </p>

      <h2>Mineurs</h2>
      <p>Fooder est réservé aux personnes d&apos;au moins 15 ans.</p>

      <h2>Tes droits</h2>
      <p>
        Accès, rectification, effacement, limitation, opposition, portabilité, retrait du consentement à tout moment, et directives sur le sort de tes
        données après décès. Pour les données locales, utilise « Exporter mes données » et « Supprimer mes données » dans ton profil. Pour le reste, écris-nous.
        Nous répondons sous un mois. Tu peux saisir la CNIL (<a href='https://www.cnil.fr'>cnil.fr</a>).
      </p>

      <h2>Sécurité</h2>
      <p>Connexions chiffrées (HTTPS), en-têtes de sécurité, accès restreint aux données, suppression en cascade lors de la fermeture d&apos;un compte.</p>

      <h2>Données de restaurants</h2>
      <p>Les établissements proviennent d&apos;OpenStreetMap (© contributeurs OpenStreetMap, licence ODbL) et de leurs propriétaires.</p>
    </LegalPage>
  );
}

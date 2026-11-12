import { LegalPage } from '../../../components/legal/LegalPage';

export const metadata = { title: 'Confidentialité - Fooder' };

export default function PrivacyPage() {
  return (
    <LegalPage title='Confidentialité' updated='12 novembre 2026'>
      <p>
        Cette politique explique quelles données Fooder utilise, pourquoi et pendant combien de temps. Responsable du traitement :{' '}
        <strong>[À COMPLÉTER : éditeur]</strong>, contact : <strong>[À COMPLÉTER : e-mail]</strong>.
      </p>

      <h2>Ce qui reste sur ton téléphone</h2>
      <p>
        Tes likes, ton niveau, ton avatar, tes préférences, tes publications et commentaires sont enregistrés dans le stockage local de ton navigateur
        (liste détaillée dans <a href='/legal/cookies'>Cookies et stockage</a>). Ils ne sont envoyés à aucun serveur tant que tu n&apos;utilises pas une fonction en ligne
        (ajout d&apos;ami par code, session de groupe, publication de photo), qui ouvre automatiquement un compte anonyme sans e-mail.
        Tu peux les exporter ou les effacer depuis ton profil. Les liens d&apos;ami, de groupe et de défi que tu partages contiennent les informations
        affichées (pseudo, mascotte, niveau, restos likés pour la carte d&apos;ami) dans la partie de l&apos;adresse qui n&apos;est pas transmise au serveur.
      </p>

      <h2>Données traitées, finalités et bases légales</h2>
      <ul>
        <li><strong>Position approximative</strong> (si tu l&apos;autorises) : trier les restaurants par distance. Base : ton consentement. Envoyée au serveur pour la requête, non conservée.</li>
        <li><strong>Mesure d&apos;audience anonyme</strong> (si tu l&apos;acceptes) : améliorer l&apos;application. Base : ton consentement. Identifiant aléatoire, sans nom ni e-mail. Choix redemandé tous les 6 mois.</li>
        <li>
          <strong>Compte</strong> : un compte anonyme (sans e-mail ni mot de passe) est créé quand tu utilises une fonction en ligne. Tu peux ensuite le
          sauvegarder avec une adresse e-mail (code ou lien de connexion, sans mot de passe). Pseudo, mascotte, likes, visites, progression et trophées
          sont sauvegardés pour les retrouver sur un autre appareil. Base : exécution du service. Conservés tant que ton compte existe, supprimés avec lui.
          Un compte anonyme sans aucune sauvegarde depuis 30 jours est supprimé automatiquement.
        </li>
        <li>
          <strong>Mesures d&apos;usage anonymes</strong> (activées par défaut, désactivables à tout moment dans Profil, Compte) : améliorer l&apos;application en
          comptant des actions (like, passe, ouverture d&apos;une fiche, visite, ajout d&apos;ami, rejoindre un groupe, publication, partage, création ou
          sauvegarde du compte) avec leur date et heure et quelques indications générales (type de cuisine, rang dans la liste, distance au restaurant arrondie
          au kilomètre, verdict, photo oui ou non, mode d&apos;ajout d&apos;ami, taille du groupe). Ni nom, ni e-mail, ni position, ni texte libre, ni nom de
          restaurant ne sont enregistrés ; un pseudonyme qui change chaque jour, calculé avec une clé aléatoire détruite le lendemain, permet seulement de
          compter les utilisateurs actifs du jour. Base : intérêt légitime (mesure strictement limitée à
          l&apos;amélioration du service, sans suivi d&apos;une personne d&apos;un jour à l&apos;autre). Conservation : 13 mois, puis suppression automatique. Opposition :
          le réglage « Aider à améliorer Fooder » arrête toute collecte et vide les mesures en attente sur ton téléphone.
        </li>
        <li>
          <strong>Amis et groupes</strong> : ta carte (pseudo, mascotte, niveau, cuisines et restos likés, statistiques de visites) est visible de tes amis
          uniquement ; tes votes de groupe sont visibles des membres de la session. Base : exécution du service.
        </li>
        <li>
          <strong>Publications</strong> : verdict, texte et photo d&apos;un restaurant, visibles de tous avec ton pseudo et ta mascotte. Les photos sont
          recompressées et leurs métadonnées (dont la position GPS) supprimées avant l&apos;envoi. Base : exécution du service.
        </li>
        <li><strong>Sécurité et modération</strong> : prévenir les abus. Base : intérêt légitime. Journaux techniques conservés 12 mois au plus.</li>
      </ul>

      <h2>Destinataires et transferts</h2>
      <p>
        Hébergement : Vercel (fonctions déployées à Paris). Comptes, base de données et photos : Supabase, région Union européenne. Mesure d&apos;audience :
        PostHog, région UE. Lorsqu&apos;un prestataire est établi hors UE, nous nous appuyons sur le cadre de protection des données applicable (clauses contractuelles types ou
        décision d&apos;adéquation). Aucune revente de données, aucune publicité ciblée.
      </p>

      <h2>Mineurs</h2>
      <p>Fooder est réservé aux personnes d&apos;au moins 15 ans.</p>

      <h2>Tes droits</h2>
      <p>
        Accès, rectification, effacement, limitation, opposition, portabilité, retrait du consentement à tout moment, et directives sur le sort de tes
        données après décès. Pour les données locales, utilise « Exporter mes données » et « Supprimer mes données » dans ton profil. Pour ton compte,
        « Supprimer mon compte » (Profil, Compte) efface immédiatement compte, photos, amitiés et votes. Pour le reste, écris-nous.
        Nous répondons sous un mois. Tu peux saisir la CNIL (<a href='https://www.cnil.fr'>cnil.fr</a>).
      </p>

      <h2>Sécurité</h2>
      <p>Connexions chiffrées (HTTPS), en-têtes de sécurité, accès restreint aux données, suppression en cascade lors de la fermeture d&apos;un compte.</p>

      <h2>Données de restaurants</h2>
      <p>Les établissements proviennent d&apos;OpenStreetMap (© contributeurs OpenStreetMap, licence ODbL) et de leurs propriétaires.</p>
    </LegalPage>
  );
}

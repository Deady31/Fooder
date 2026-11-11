import { LegalPage } from '../../../components/legal/LegalPage';

export const metadata = { title: 'Confidentialité - Fooder' };

export default function PrivacyPage() {
  return (
    <LegalPage title='Confidentialité' updated='11 novembre 2026'>
      <p>
        Fooder est un projet en phase de test. Cette politique explique quelles données sont utilisées et pourquoi. Le
        responsable du traitement est <strong>[À COMPLÉTER : nom de l&apos;éditeur]</strong>, joignable à{' '}
        <strong>[À COMPLÉTER : e-mail de contact]</strong>.
      </p>
      <h2>Ce qui reste sur ton téléphone</h2>
      <p>
        Tes likes, ton niveau, ton avatar, tes préférences et tes publications sont enregistrés dans le stockage local de
        ton navigateur. Ils ne sont envoyés à aucun serveur tant que tu n&apos;as pas de compte Fooder. Pour les effacer :
        vide les données du site dans ton navigateur.
      </p>
      <h2>Ta position</h2>
      <p>
        Si tu l&apos;autorises, ta position sert uniquement à trier les restaurants par distance. Elle est envoyée à notre
        serveur pour cette requête et n&apos;est pas conservée. Tu peux refuser : Fooder utilise alors le centre de Toulouse.
      </p>
      <h2>Mesure d&apos;audience</h2>
      <p>
        Avec ton accord uniquement, nous mesurons des événements anonymes (écran ouvert, swipe) via un identifiant aléatoire,
        sans nom ni e-mail, pour améliorer l&apos;application. Aucune donnée n&apos;est vendue, aucune publicité ciblée.
      </p>
      <h2>Comptes et fil social (à venir)</h2>
      <p>
        Lorsque les comptes seront ouverts : e-mail, pseudo et photos publiées seront stockés chez un hébergeur situé dans
        l&apos;UE. Tu pourras exporter ou supprimer ton compte et tes publications à tout moment.
      </p>
      <h2>Données de restaurants</h2>
      <p>Les établissements proviennent d&apos;OpenStreetMap (© contributeurs OpenStreetMap, licence ODbL) et de leurs propriétaires.</p>
      <h2>Tes droits</h2>
      <p>
        Accès, rectification, effacement, opposition, portabilité : écris-nous. Tu peux aussi saisir la CNIL (
        <a href='https://www.cnil.fr'>cnil.fr</a>).
      </p>
    </LegalPage>
  );
}

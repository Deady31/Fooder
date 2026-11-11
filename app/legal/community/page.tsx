import { LegalPage } from '../../../components/legal/LegalPage';

export const metadata = { title: 'Règles de la communauté - Fooder' };

export default function CommunityPage() {
  return (
    <LegalPage title='Règles de la communauté' updated='11 novembre 2026'>
      <p>
        Le fil Fooder sert à partager de vraies expériences de table. Pour que ça reste agréable, chacun respecte ces règles.
      </p>
      <h2>Ce qu&apos;on aime</h2>
      <ul>
        <li>Des photos que tu as prises toi-même, de plats ou de lieux.</li>
        <li>Des avis honnêtes, précis et bienveillants.</li>
        <li>Des commentaires qui aident à choisir.</li>
      </ul>
      <h2>Ce qui est interdit</h2>
      <ul>
        <li>Les photos ou textes dont tu n&apos;es pas l&apos;auteur, ou qui violent les droits d&apos;un tiers.</li>
        <li>Les visages ou données personnelles d&apos;autres personnes sans leur accord.</li>
        <li>Les propos haineux, discriminatoires, harcelants, violents ou sexuellement explicites.</li>
        <li>Les avis achetés, les faux avis, la publicité déguisée ou le spam. Les contenus sponsorisés doivent être signalés comme tels.</li>
        <li>Les contenus illégaux, ou qui incitent à des comportements dangereux.</li>
        <li>Se faire passer pour quelqu&apos;un d&apos;autre, ou pour un restaurant.</li>
      </ul>
      <h2>Photos et droits</h2>
      <p>
        En publiant une photo, tu confirmes en être l&apos;auteur et tu autorises Fooder à l&apos;afficher gratuitement dans le fil et sur la fiche
        du restaurant concerné, tant que ton contenu reste en ligne. Tu peux le supprimer à tout moment ; il disparaît alors de l&apos;application.
      </p>
      <h2>Signaler un contenu</h2>
      <p>
        Tu peux signaler tout contenu qui te semble illicite ou contraire à ces règles à <strong>[À COMPLÉTER : adresse de signalement]</strong>,
        en indiquant le contenu, le motif et ton identité. Nous accusons réception, examinons le signalement rapidement et te informons de la décision.
      </p>
      <h2>Sanctions</h2>
      <p>
        Selon la gravité : retrait du contenu, avertissement, suspension ou suppression du compte. Tu peux contester une décision en écrivant à la même adresse.
      </p>
      <h2>Âge minimum</h2>
      <p>Fooder est réservé aux personnes d&apos;au moins 15 ans.</p>
    </LegalPage>
  );
}

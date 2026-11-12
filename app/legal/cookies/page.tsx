import { LegalPage } from '../../../components/legal/LegalPage';
import { ConsentSettings } from '../../../components/legal/ConsentSettings';

export const metadata = { title: 'Cookies et stockage - Fooder' };

const KEYS: [string, string][] = [
  ['fooder_likes, fooder_dislikes', 'Tes choix de restaurants'],
  ['fooder_preferences', 'Budget et envie du moment'],
  ['fooder_xp, fooder_streak, fooder_achievements', 'Niveau, série de jours et succès'],
  ['fooder_avatar', 'Ta mascotte et sa couleur'],
  ['fooder_posts, fooder_comments, fooder_post_likes', 'Tes publications et réactions du fil'],
  ['fooder_notifications', 'Tes notifications'],
  ['fooder_consent, fooder_anon_id', 'Ton choix sur la mesure d\'audience (et un identifiant aléatoire si tu acceptes)'],
];

export default function CookiesPage() {
  return (
    <LegalPage title='Cookies et stockage' updated='11 novembre 2026'>
      <p>
        Fooder <strong>ne dépose aucun cookie publicitaire ou de pistage</strong>. L&apos;application enregistre des informations dans le
        stockage local de ton navigateur, uniquement pour fonctionner et garder tes données sur ton téléphone.
      </p>
      <h2>Stockage nécessaire au service</h2>
      <p>Ces éléments sont indispensables : ils ne demandent pas de consentement.</p>
      <ul>
        {KEYS.map(([k, d]) => (
          <li key={k}>
            <code className='text-xs font-bold'>{k}</code> : {d}
          </li>
        ))}
      </ul>
      <h2>Mesure d&apos;audience (facultative)</h2>
      <p>
        Si, et seulement si, tu l&apos;acceptes, nous mesurons des événements anonymes (écran ouvert, swipe) pour améliorer l&apos;application, via
        PostHog hébergé dans l&apos;Union européenne. Ton choix est conservé 6 mois au maximum puis redemandé. Tu peux le modifier ici à tout moment.
      </p>
      <ConsentSettings />
    </LegalPage>
  );
}

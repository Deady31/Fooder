# Audit Lighthouse FOODER (13 nov. 2026)

**Méthode** : Lighthouse 13.6.0, Chrome (Program Files) headless, copie locale du projet construite en production avec Supabase, Google Places et PostHog vides, `next start -p 3200`. Profil Chrome neuf par run, `fooder_onboarding_done=1` posé dans localStorage pour les pages protégées. Une seule passe par page (variabilité de quelques points possible). Mobile = émulation par défaut (Moto G Power, 4G simulé, CPU x4) ; Ordinateur = preset desktop. **Aucune requête vers supabase.co** (0 sur les 14 runs, confirmé aussi via Playwright). Le site de production n'a pas été touché. Lighthouse 13 n'a plus de catégorie PWA : vérification manuelle plus bas.

Limite : sans cloud, feed/profil/classement s'affichent sans données serveur (états vides), donc leurs scores sont optimistes. /resto/[id] et l'état avec vraies photos Google ne sont pas mesurés.

## Scores et métriques

| Page | Format | Perf | A11y | Bonnes pr. | SEO | LCP | CLS | TBT | FCP | Transféré | Req. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| /onboarding | Mobile | 83 | 95 | 100 | 100 | 4,8 s | 0 | 0 ms | 0,9 s | 599 Ko | 28 |
| /onboarding | Desktop | 82 | 93 | 100 | 100 | 1,0 s | 0,334 | 0 ms | 0,3 s | 615 Ko | 28 |
| /swipe | Mobile | 100 | 96 | 100 | 100 | 1,6 s | 0 | 60 ms | 0,7 s | 384 Ko | 52 |
| /swipe | Desktop | 100 | 96 | 100 | 100 | 0,4 s | 0 | 0 ms | 0,2 s | 384 Ko | 52 |
| /feed | Mobile | 100 | 92 | 100 | 100 | 1,5 s | 0 | 10 ms | 0,7 s | 108 Ko | 51 |
| /feed | Desktop | 100 | 92 | 100 | 100 | 0,4 s | 0 | 0 ms | 0,2 s | 108 Ko | 51 |
| /map | Mobile | 87 | 96 | 100 | 100 | 1,7 s | 0,02 | **520 ms** | 0,8 s | 526 Ko | 60 |
| /map | Desktop | 100 | 94 | 100 | 100 | 0,4 s | 0,003 | 20 ms | 0,2 s | 526 Ko | 60 |
| /profile | Mobile | 96 | 94 | 100 | 100 | 1,7 s | 0 | 220 ms | 0,8 s | 108 Ko | 54 |
| /profile | Desktop | 100 | 94 | 100 | 100 | 0,4 s | 0 | 0 ms | 0,2 s | 108 Ko | 54 |
| /classement | Mobile | 100 | 94 | 100 | 100 | 1,4 s | 0 | 60 ms | 0,7 s | 105 Ko | 45 |
| /classement | Desktop | 100 | 94 | 100 | 100 | 0,4 s | 0 | 0 ms | 0,2 s | 105 Ko | 45 |
| /legal/privacy | Mobile | 99 | 98 | 100 | 100 | 0,9 s | 0,067 | 40 ms | 0,9 s | 430 Ko | 31 |
| /legal/privacy | Desktop | 100 | 98 | 100 | 100 | 0,3 s | 0,045 | 0 ms | 0,3 s | 430 Ko | 31 |

INP : non mesurable en mode navigation (aucune interaction) ; TBT sert de proxy. Le « transféré » des pages après /onboarding est faible car le cache HTTP/SW est partagé dans un même run seulement ; les chiffres 105-108 Ko des pages feed/profil/classement semblent anormalement bas par rapport au First Load JS de `next build` (190-260 Ko) : à recontrôler avec cache froid avant de les citer.

## PWA (vérification manuelle)

- Manifeste présent (`/manifest.json`, `display: standalone`, `start_url /onboarding`, icônes 192, 512 et maskable 512), `theme-color`, `apple-touch-icon`, viewport `viewport-fit=cover` : OK.
- Service worker `/sw.js` enregistré et actif en production : OK.
- Installabilité (CDP `getInstallabilityErrors`) : seule erreur `in-incognito`, due au contexte de test, aucune erreur de manifeste.
- À améliorer : pas de page hors-ligne dédiée (le SW est « réseau d'abord »), pas de `screenshots` dans le manifeste (installation enrichie Android/desktop), `start_url` sur /onboarding même pour un utilisateur déjà inscrit.

## 10 audits échoués les plus importants

| # | Audit | Où | Cause probable | Impact |
|---|---|---|---|---|
| 1 | Contraste des couleurs insuffisant (a11y, poids 7) | 12/14 runs (onboarding, swipe, feed, map, profile, classement) | `text-slate-400` / `text-slate-500` sur fond crème, ex. `app/onboarding/page.tsx`, `components/onboarding/Choice.tsx`, `components/checkin/CheckinSheet.tsx` | Perd 3-5 points d'accessibilité par page |
| 2 | LCP 4,8 s (mobile /onboarding) | /onboarding mobile | Logo `/logo/fooder-pink.webp` (760x318, 49 Ko) affiché à 320 px, délai de rendu 1,1 s ; pas de `priority` ni de `next/image` ; 5 stickers de ~40 Ko chacun en concurrence | Perf 83 au lieu de ~98 |
| 3 | TBT 520 ms (mobile /map) | /map mobile | Chunk `95595fba...js` (maplibre-gl) 1,29 s de JS, plus 0,67 s pour la page ; chargement non différé | Perf 87 |
| 4 | TBT 220 ms (mobile /profile) | /profile mobile | Hydratation + calculs (XP, badges, stickers) sur le fil principal | Perf 96 |
| 5 | CLS 0,334 (desktop /onboarding) | /onboarding desktop | Conteneur `h-[100dvh] max-w-md mx-auto` qui se décale horizontalement au chargement (largeur/centrage avant CSS ou police) | Perf 82 |
| 6 | Pas de landmark `main` (a11y, poids 3) | 10/14 runs (feed, profile, classement, legal, onboarding desktop...) | Pages sans `<main>` rendu : à ajouter dans `app/(app)/layout.tsx` et les pages `app/legal/*` (vérifier feed, profile, classement) | +2 a11y |
| 7 | Ordre des titres (a11y, poids 3) | /feed | `<h3>` de carte sans h2 parent dans `app/(app)/feed/page.tsx` | +2 a11y |
| 8 | Images mal dimensionnées/compressées | onboarding, swipe | stickers `/stickers/salad|ramen|burger|donut|pizza.webp` : 30-42 Ko pour 76-88 px, 235 Ko gaspillés ; logo 27 Ko gaspillés | ~235 Ko en moins |
| 9 | JavaScript hérité (legacy) | 14/14 | chunk `7199-...js` : 14,5 Ko de polyfills (cible navigateurs trop large dans `package.json`/browserslist) | ~14 Ko |
| 10 | Ressources bloquant le rendu | 14/14 | 2 feuilles CSS Next (`1fa5f9c8...css`, `352bca15...css`) ~300 ms estimé en mobile | -300 ms FCP simulé |

Aussi relevé : étiquette accessible non conforme au texte visible, bouton « Miam » de `/feed` (`aria-label="Miam"` différent du texte affiché) ; sourcemaps absentes pour le JS maplibre (`/map`, bonnes pratiques non pénalisant).

## Recommandations chiffrées

1. Foncer les textes secondaires : `text-slate-500` vers `slate-600` et `slate-400` vers `slate-500` sur fond crème (ratio visé 4,5:1) : A11y +3 à +5 partout.
2. Onboarding mobile : passer le logo en `next/image` avec `priority`, largeur 320 réelle (fichier ~12 Ko au lieu de 49) ; redimensionner les stickers à 2x leur taille affichée (<8 Ko chacun) : transféré 599 Ko vers ~330 Ko, LCP 4,8 s vers moins de 2,5 s, Perf 83 vers 95+.
3. /map : `dynamic(() => import(...), { ssr: false })` pour MapLibre et initialisation après premier rendu/`requestIdleCallback` : TBT 520 ms vers moins de 200 ms, Perf 87 vers 95+.
4. CLS desktop /onboarding : fixer la largeur du conteneur dès le CSS critique (pas de recentrage tardif) ; objectif CLS < 0,1.
5. Ajouter `<main>` dans `app/(app)/layout.tsx` et le layout legal ; corriger `h3` vers `h2` sur le feed : +2 points A11y sur 10 pages.
6. Cibler les navigateurs modernes (browserslist) pour retirer ~14 Ko de polyfills.
7. PWA : ajouter `screenshots` au manifeste et une page `/offline` servie par le SW.
8. Refaire la mesure avec données réelles (Supabase de test local ou jeu de données simulé) et cache froid pour feed/profil/classement et /resto/[id].

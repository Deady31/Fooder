# Benchmark analytics : Fooder

Date de la recherche : 2026-11-13. Toutes les sources ont été consultées ce jour, sauf mention contraire.
Méthode : WebFetch sur les pages officielles (tarifs, docs) ; un modèle léger résume la page, donc chaque chiffre est à recouper avant décision. Les chiffres marqués **agrégateur** viennent de sites tiers et ne sont pas confirmés par l'éditeur. « non trouvé » = absent de la page consultée.

## 1. Besoin rappelé

Nombre d'utilisateurs, temps d'usage, funnel (arrivée → inscription → 1er swipe → 1er like → ouverture fiche → check-in → invitation), rétention J1/J7/J30, parcours individuel. Fondateur seul, budget réduit, PWA Next.js 14 sur Vercel, Supabase, consentement requis.

## 2. Tableau comparatif

| Critère | PostHog Cloud (UE) | Amplitude | Mixpanel | Plausible Cloud | Umami Cloud | Tableau maison (Supabase) |
|---|---|---|---|---|---|---|
| Offre gratuite : événements/mois | 1 M événements + 5 K replays **agrégateur, non vérifié officiel** (page officielle tronquée) | Free : 2 M événements/mois « forever » | Free : 1 M événements/mois | non (pas de plan gratuit, essai 30 j) | Hobby : 100 000 événements/mois | Supabase Free : 50 000 MAU, 500 Mo BDD, 5 Go egress |
| Rétention des données (gratuit) | non trouvé (agrégateur : 1 an, contradictoire) | Free : accès 1 an ; replays 1 mois | 2 ans par défaut ; replays 30 j | Starter : « no retention limit » | 6 mois | illimitée (vous décidez) |
| Funnels | non trouvé officiel (inclus selon agrégateurs) | non trouvé pour Free ; funnels sur Plus / Growth à confirmer | inclus (Free) | à partir du plan Business | inclus (Hobby) | à coder (SQL) |
| Rétention / cohortes | non trouvé officiel | non trouvé pour Free | inclus (Free) | non trouvé | inclus (Hobby) | à coder (SQL) |
| Replays de sessions | non trouvé officiel (agrégateur : 5 K standard/mois) | Free : 10 000 sessions/mois | Free : 10 000/mois | non | Pro/Hobby : non ; Business : 5 000 inclus | non |
| Parcours individuel | oui (fiche personne) **non confirmé ici** | non trouvé pour Free | non trouvé pour Free | non | non | oui (requête par user_id) |
| Hébergement UE | oui, option « EU data center » **non confirmé officiel ici** | oui, « EU data center option » (Free et payants) | oui, optionnel, activé à la création du projet | oui, conçu et hébergé dans l'UE | serveurs US et UE | oui : Frankfurt `eu-central-1`, Irlande `eu-west-1`, Paris `eu-west-3`, Stockholm `eu-north-1` (Londres et Zurich hors UE) |
| Intégration Next.js | SDK JS, non vérifié ici | SDK JS, non vérifié ici | SDK JS, non vérifié ici | script léger | script léger | natif (même base) |
| Prix à ~10 000 MAU | 0 $ dans le gratuit si ~1 M événements/mois (hypothèse 30 événements/utilisateur) | 0 $ dans les seuils Free (2 M événements) | 0 $ (300 K événements < 1 M) | Starter 9 $/mois jusqu'à 10 K pages vues (pages vues ≠ MAU) | Pro 20 $/mois (1 M événements) | 0 $ (50 K MAU Free) |
| Prix à ~100 000 MAU | agrégateur : ~100–620 $/mois pour 3 M événements (non vérifié) | non trouvé au-delà des seuils Free / Plus (700 K MTU) | ~270 $/mois (interpolation entre 2 M = 185 $ et 5 M = 438 $, facturation annuelle, **estimation**) | non calculé (paliers > 10 K pages vues non trouvés) | ~80 $/mois (Pro 20 $ + 2 M × 0,00003 $) ; Business 200 $ si replays | 25 $/mois Pro (100 K MAU inclus) |

Sources par ligne :
- PostHog : https://posthog.com/pricing (page tronquée le 2026-11-13, aucun chiffre exploitable) ; https://posthog.com/docs/self-host (consulté 2026-11-13) ; agrégateurs : https://costbench.com/software/product-analytics/posthog/free-plan/ et https://dev.to/beton/posthog-pricing-teardown-2026-57oo (2026-11-13, non officiel)
- Amplitude : https://amplitude.com/pricing (consulté 2026-11-13)
- Mixpanel : https://mixpanel.com/pricing (consulté 2026-11-13)
- Plausible : https://plausible.io/ (consulté 2026-11-13) ; /pricing et /docs/pricing renvoient 404 ; agrégateur : https://www.getpricepulse.com/companies/plausible-pricing.html (2026-11-13)
- Umami : https://umami.is/pricing (consulté 2026-11-13)
- Supabase : https://supabase.com/pricing (consulté 2026-11-13) ; https://supabase.com/docs/guides/platform/regions (consulté 2026-11-13)

## 3. Détails par outil

**PostHog Cloud**
- Forces : offre gratuite généreuse, produit complet (funnels, rétention, replays, feature flags), option UE, déjà partiellement branché.
- Faiblesses : tarifs officiels non lus (page tronquée) ; coût par événement qui grimpe avec les événements automatiques ; tracking à discipliner.
- Auto-hébergement : licence MIT pour Docker Compose (docs officielles) ; minimum recommandé 4 vCPU, 16 Go RAM, 30 Go ; **non supporté officiellement** ; déconseillé pour un fondateur seul.

**Amplitude**
- Forces : analyses avancées, parcours, prévisionnel.
- Faiblesses : offre Free limitée en fonctionnalités (cohortes comportementales absentes, replays 1 mois) ; prix au-delà des seuils non trouvés ; complexité d'usage pour un solo.

**Mixpanel**
- Forces : funnels et rétention bien rodés dans le gratuit, 1 M événements/mois, rétention 2 ans, UE optionnelle.
- Faiblesses : passage à ~270 $/mois dès ~3 M événements (estimation) ; UE à activer à la création du projet (ne pas le rater).

**Plausible**
- Forces : léger, RGPD simple, UE, pas de bannière cookie nécessaire (à confirmer côté juridique).
- Faiblesses : audience et pages vues seulement ; funnels à partir du plan Business ; pas de parcours individuel ; pas de replays.

**Umami**
- Forces : gratuit jusqu'à 100 K événements, funnels/rétention/parcours inclus en Hobby, self-host MIT gratuit.
- Faiblesses : replays seulement en Business (200 $/mois) ; hébergement cloud US et UE (vérifier laquelle utilisée).

**Supabase (tableau maison)**
- Forces : coût marginal quasi nul, données dans votre base (contrôle, RGPD, suppression), chiffres métier exacts (inscriptions, swipes, likes, invitations) via vues SQL.
- Faiblesses : pas de replays, pas de UI d'analyse à construire soi-même ; rétention et funnels à coder ; Pro à 25 $/mois dès 100 K MAU, puis 0,00325 $/MAU au-delà (source Supabase).

## 4. Risques de coût

- Tout se facture au volume d'événements : un événement automatique par écran multiplie la facture. Limiter aux événements métier (une quinzaine).
- Hypothèse de volume non mesurée : 30 événements/utilisateur/mois. À remplacer par la mesure réelle après 2 semaines.
- Replays : coût et risque RGPD (consentement, masquage des saisies) ; à désactiver tant que le consentement n'est pas stabilisé.
- Mixpanel et PostHog : passage du gratuit au payant sans palier intermédiaire lisible ; surveiller le compteur mensuel.
- Auto-hébergement PostHog : coût serveur faible mais charge d'exploitation élevée et aucun support.

## 5. Recommandation pour Fooder

1. **Chiffres métier et rétention : tableau maison sur Supabase.** Table d'événements minimale (user_id, type, date), alimentée par les actions réelles (inscription, swipe, like, ouverture fiche, check-in, invitation). Vues SQL pour l'entonnoir, rétention J1/J7/J30 et temps d'usage. Coût ~0 jusqu'à 50 K MAU, 25 $/mois ensuite.
2. **Funnels détaillés, parcours individuel, replays : PostHog Cloud UE**, puisqu'il est déjà branché. Garder les replays désactivés jusqu'au consentement validé. Limiter les événements auto.
3. **Pas d'Amplitude pour l'instant** : tarifs au-delà du gratuit non trouvés, complexité trop élevée pour un solo.
4. **Pas d'auto-hébergement PostHog** : non supporté, charge d'exploitation trop lourde.
5. **Plausible ou Umami** seulement si une audience de la landing page est utile ; inutile pour le funnel de l'app.
6. **Avant de décider** : mesurer les événements réels sur 2 semaines, puis relire les tarifs PostHog officiels (page non lue ici).

Combinaison retenue : outil externe (PostHog) pour funnels et replays, tableau maison pour les chiffres métier et les pourcentages de rétention, afin de garder la source de vérité chez vous.

## 6. Points non vérifiés

- Tarifs PostHog officiels, rétention et funnels inclus : page tronquée, chiffres agrégateurs seulement.
- Intégration Next.js de chaque outil : non consultée.
- Plausible : prix 100 K pages vues non trouvé sur la page officielle ; les agrégateurs donnent 19 à 39 $, contradictoire.
- Mixpanel 270 $/mois à 3 M événements : interpolation, non tarif officiel.

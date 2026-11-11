# Mise en production sérieuse : état et marche à suivre

## État au 11/11/2026

| Chantier | État | Où |
|---|---|---|
| Tous les restos de Toulouse | **Fait (socle gratuit)** : 2 398 lieux OSM importés, API paginée par distance | `scripts/import-osm.mjs`, `data/toulouse-osm.json`, `app/api/restaurants/route.ts` |
| Horaires OSM → fiche | **Fait** (parseur strict, jamais d'horaires inventés) | `lib/osmHours.ts` |
| Avatars (12 mascottes + fonds) | **Fait** | `lib/avatars.ts`, `components/profile/` |
| Fil social | **Prototype local** (photos recompressées sans EXIF, like, suppression, exemples marqués « démo ») | `app/(app)/feed`, `lib/feed.ts` |
| Schéma base de données | **Écrit, non déployé** (PostGIS, RLS, social, signalements) | `supabase/schema.sql` |
| En-têtes de sécurité + CSP | **Fait** | `next.config.js` |
| Légal (confidentialité, CGU, mentions) | **Brouillons, champs `[À COMPLÉTER]`** | `app/legal/*` |
| Consentement + mesure d'audience | **Fait**, inactif tant que la clé n'est pas fournie | `lib/analytics.ts`, `components/legal/ConsentBanner.tsx` |
| PWA hors-ligne | **Fait** (cache assets, pages réseau d'abord) | `public/sw.js` |
| Tests | 10 tests unitaires (`npm test`) | `tests/` |

## Ce que je ne peux pas faire à ta place (comptes et décisions)

1. **Supabase** (gratuit pour démarrer, région UE) : créer le projet, exécuter `supabase/schema.sql`, activer Auth (e-mail + Google/Apple), puis renseigner `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans Vercel. Ensuite je branche comptes, sync des likes et vrai fil.
2. **PostHog** (région UE) : créer un projet et renseigner `NEXT_PUBLIC_POSTHOG_KEY`. La bannière de consentement s'active toute seule.
3. **Sentry** : créer un projet Next.js, `npx @sentry/wizard@latest -i nextjs`.
4. **Nom de domaine** (≈12 €/an) puis ajout dans Vercel.
5. **Vercel** : passer en plan Pro avant toute monétisation (le plan gratuit est non commercial) ; décider de désactiver la Deployment Protection pour rendre l'app publique.
6. **Stripe** pour Premium et Fooder Pro (nécessite statut d'entreprise : micro-entreprise suffit pour démarrer).
7. **Juridique** : compléter les mentions (éditeur, contact) ; faire relire CGU et confidentialité avant d'ouvrir les comptes.
8. **E-mail exposé** dans le premier commit GitHub : réécriture d'historique à valider avec toi.

## Passage à l'échelle des restaurants

1. *Maintenant* : JSON embarqué (430 Ko), suffisant pour Toulouse.
2. *Avec Supabase* : charger le JSON dans la table `restaurants`, remplacer le calcul en mémoire par `restaurants_near(...)` (index GiST), cache CDN 1 h (déjà en en-tête).
3. *Photos* : Google Places à la demande côté serveur pour les restos réellement affichés, cache max 30 jours (conditions Google) ; à terme photos fournies par les restaurateurs (fiche revendiquée).
4. *Rafraîchissement* : tâche planifiée hebdomadaire (Vercel Cron) qui relance l'import OSM.
5. *Autres villes* : changer la boîte englobante dans `scripts/import-osm.mjs`.

## Check-list de lancement

- [ ] Comptes + sync likes
- [ ] Mentions légales complétées, CGU relues
- [ ] Domaine + HTTPS + Deployment Protection désactivée
- [ ] Sentry + PostHog actifs, alertes d'erreur
- [ ] Test sur 3 vrais téléphones (iPhone Safari, Android Chrome, petit écran)
- [ ] Lighthouse mobile ≥ 90, poids JS < 300 Ko gzip
- [ ] Sauvegardes Supabase quotidiennes
- [ ] 20 restos fondateurs signés avant l'ouverture publique
- [ ] Procédure de modération et de signalement testée

## Choix du backend (décision à prendre avant les comptes)

| Option | Pour | Contre |
|---|---|---|
| **Supabase** (Postgres + Auth + Storage + RLS) | Tout-en-un, le plus rapide à mettre en place, région UE, PostGIS, open source, SQL standard donc portable | Les règles RLS demandent de la rigueur ; dépendance à la plateforme pour Auth/Storage |
| **Neon + Better Auth + Cloudflare R2 + Drizzle** | Plus « propre » et modulaire, intégration Vercel native, aucune dépendance forte, coûts de stockage d'images très bas | 4 briques à assembler et à maintenir soi-même (comptes, e-mails de connexion, upload signé) |
| Firebase | Temps réel, très répandu | Base NoSQL (mauvaise pour les requêtes géographiques et relationnelles), verrouillage fournisseur, hébergement hors UE par défaut |
| PocketBase / Appwrite (auto-hébergé) | Contrôle total, pas de facture | Il faut administrer un serveur, les sauvegardes et la sécurité |

Le schéma `supabase/schema.sql` est du PostgreSQL standard : il fonctionne tel quel sur Neon. Seules les lignes `auth.users` et les politiques RLS sont spécifiques à Supabase.

# Vraies photos des restaurants (Google Places)

Sans clé, l'appli fonctionne comme avant (illustrations). Avec la clé, chaque carte affichée reçoit les vraies photos Google Maps du restaurant.

## Ce que fait l'appli
- Pour la carte du dessus et les 3 suivantes seulement (jamais tout le catalogue), le serveur interroge l'API officielle Google Places (New) :
  1. recherche du lieu par nom, dans un rayon de 150 m autour de nos coordonnées (requête « identifiant seul », sans frais) ;
  2. détails minimaux (nom, position, photos) et **vérification** : même nom, à moins de 250 m. Sinon aucune photo n'est affichée ;
  3. URL temporaire de 3 photos au plus.
- Les photos ne sont jamais copiées ni stockées : seule l'URL temporaire de Google est affichée, pendant la session.
- L'auteur de la photo est crédité sur la carte (« Photo Google Maps · Léa »), comme l'exige Google.
- La clé reste côté serveur (variable `GOOGLE_PLACES_API_KEY`, sans `NEXT_PUBLIC_`).
- Garde-fous : 40 requêtes par minute et par visiteur, plafond quotidien `GOOGLE_PHOTOS_DAILY_CAP` (1 500 par défaut), mémoire de 30 min par restaurant.

## À faire une fois (10 min)
1. console.cloud.google.com → nouveau projet « fooder ».
2. **Facturation** : associer une carte (obligatoire même avec les crédits gratuits mensuels).
3. **API et services → Bibliothèque** : activer **Places API (New)**.
4. **Identifiants → Créer une clé API** : la restreindre à **Places API (New)** uniquement.
5. **Facturation → Budgets et alertes** : budget mensuel (ex. 20 €) avec alertes à 50 / 90 / 100 %. Dans **API et services → Places API (New) → Quotas**, plafonner les requêtes par jour.
6. Vercel → Settings → Environment Variables : `GOOGLE_PLACES_API_KEY` en type **Secret** (c'est un vrai secret cette fois), tous environnements, puis redéployer.

## Coût
Facturé à la requête, avec des quotas gratuits mensuels. Ordre de grandeur : quelques centimes par restaurant affiché (recherche d'identifiant gratuite, détails avec photos, puis 3 photos). Vérifier la grille tarifaire en vigueur dans la console. Le plafond quotidien et le budget limitent tout dérapage.

## Ce qu'on ne fait pas
Copier ou aspirer les photos de Google Maps (page web) : interdit par les conditions de Google, risque de blocage et de poursuites. L'API officielle est la seule voie propre.

# Vraie photo des restaurants (Google Places API (New))

Base : `docs/GOOGLE_PLACES_TERMS_COUT.md` (recherche du 2026-11-13). Sans clé, l'appli fonctionne comme avant (plat typique / illustration). Avec la clé, la **fiche** d'un resto (jamais la carte) affiche UNE photo Google Maps dans une section distincte « Le lieu · Google Maps ».

## Rôle (décision produit)
- La carte qui se swipe montre un plat qui donne envie, jamais une façade. Priorité de la carte : photo communautaire (vrai plat posté) > photo de plat typique > illustration. **Google n'est jamais l'image principale de la carte.**
- **Aucun préchargement** : le paquet de cartes n'appelle plus `/api/place-photos`. Seule l'ouverture d'une fiche déclenche UN appel (cache mémoire de session 30 min dans `lib/placePhotosClient.ts`, donc rouvrir la même fiche ne repaie pas).
- Ordre de la fiche : photos des foodies, plat typique (avec crédit), puis « Le lieu · Google Maps » (auteur + lien obligatoires ; rien d'affiché si pas de photo ou service désactivé).
- Fiche sans photo communautaire : bloc « Pas encore de photo du vrai plat. Tu y es allé ? » vers le flux de publication (aucune récompense XP en plus).
- **Pourquoi on ne stocke pas** : ces photos appartiennent à des tiers ; aucune licence ne nous autorise à les copier ou les héberger. Elles ne servent qu'à l'affichage à la demande. On construit à la place notre propre bibliothèque de vraies photos de plats via les utilisateurs.

## Ce que fait l'appli
Séquence serveur, la moins chère d'après la recherche :
1. **Text Search**, field mask `places.id` seul (« IDs Only », gratuit : « Unlimited » dans la grille, prix non affiché, à confirmer dans la console), zone ±250 m autour de nos coordonnées, 1 résultat.
2. **Place Details**, field mask `photos` seul (« IDs Only », même statut).
3. **Média de la photo**, 800 px de large : **seul appel facturé** (7 $ / 1000, 1 000 gratuits par mois ; SKU exact à confirmer).

L'étape 3 n'est lancée qu'à l'ouverture d'une fiche : jamais de préchargement ni pendant le swipe. Si le `place_id` du resto est déjà connu du navigateur, l'étape 1 est sautée.

Vérification de correspondance : en mode gratuit, la recherche est restreinte à ±250 m et le nom du resto est la requête ; le **nom renvoyé n'est pas contrôlé** (le nom est un champ de palier supérieur). Option : `GOOGLE_PHOTOS_VERIFY_NAME=1` demande nom + position et contrôle « nom proche et distance ≤ 250 m », mais la recherche passe alors au palier Pro de Text Search (32 $/1000, 5 000 gratuits/mois selon la recherche, à confirmer). Par défaut : désactivé.

## Conformité : ce qui est stocké ou non
| Donnée | Stockée ? | Pourquoi |
|---|---|---|
| `place_id` (restoId vers place_id) | Oui, navigateur seulement, `localStorage` clé `fooder_place_ids`, 3 000 entrées max, les plus anciennes évincées | Google autorise de le garder indéfiniment ; évite la recherche aux visites suivantes |
| Octets de l'image | Non | Aucune source n'autorise le stockage (à confirmer côté juridique) |
| Référence de photo (`photos[].name`) | Non | « You cannot cache a photo name. » |
| URL temporaire de la photo | Mémoire de la session du navigateur uniquement (30 min), pas de stockage durable ni côté serveur | Évite de repayer la même photo pendant la session ; statut de cette URL « à confirmer » |
| Noms, adresses, notes issus de Google | Non | Interdit de les copier |

Réponse serveur : `Cache-Control: private, max-age=300` quand une photo est renvoyée (pas de cache partagé), `no-store` sinon.

Attribution toujours renvoyée et affichée : auteur (nom + lien), lien `googleMapsUri`, affichage « Photo Google Maps · auteur » (auteur et lien Google Maps cliquables) sous la photo de la fiche et dans la visionneuse. À confirmer : lien de signalement `flagContentUri` et logo Google Maps (section 3 de la recherche) pas encore gérés par l'interface.

## Plafond de budget
- Compteur journalier du nombre d'appels **payants** (média), jour en heure de Paris, variable `GOOGLE_PHOTOS_DAILY_CAP` (défaut **30**, 0 = aucun appel payant). Au-delà, la route répond « pas de photo » et la fiche n'affiche simplement pas la section Google.
- **Limite connue** : le compteur est en mémoire de l'instance. Avec plusieurs instances serverless, chacune a son compteur : plafond approximatif. Le **vrai plafond sûr est le quota journalier de la console Google** (étape 5 ci-dessous).
- Sans `GOOGLE_PLACES_API_KEY`, la route répond « désactivé » sans erreur.

## Mode d'emploi pas à pas (fondateur, ~10 min)
1. console.cloud.google.com : créer un projet « fooder ».
2. **Facturation** : associer un moyen de paiement (obligatoire).
3. **API et services > Bibliothèque** : activer **Places API (New)**.
4. **Identifiants > Créer une clé API** : restreindre la clé à **Places API (New)** uniquement.
5. **Quota journalier** : page Quotas de la console (chemin exact du menu à vérifier), choisir Places API (New), SKU photos (Place Details Photos), régler à **30 par jour** (1 000 gratuits par mois / 31 = 32, arrondi prudent). Au-delà, les requêtes échouent jusqu'à minuit heure du Pacifique.
6. **Facturation > Budgets et alertes** : budget (ex. 10 €) avec alertes 50 / 90 / 100 %. Un budget n'est qu'une alerte : il ne coupe rien, seul le quota arrête l'usage.
7. Vercel > Settings > Environment Variables : `GOOGLE_PLACES_API_KEY` (type **Secret**), et `GOOGLE_PHOTOS_DAILY_CAP` (ex. `30`), tous environnements, puis **redéployer**.

## Coût attendu
- Étapes 1 et 2 : 0 (« Unlimited », à confirmer en console).
- Plafond 30 appels par jour = environ 900 par mois, sous le quota gratuit de 1 000 : **0 € attendu**, tant que le quota console reste à 30/jour.
- Au-delà du gratuit : 7 $ / 1000 (environ 6,4 € au taux supposé de 0,92, à actualiser). Exemple de la recherche : 4 500 photos/mois = environ 24,50 $ après gratuité.
- Compromis : 30 photos par jour ; au-delà, les fiches n'ont pas la section Google (la carte n'est pas affectée).

## Ce qu'on ne fait pas
Copier ou aspirer les photos de Google Maps (page web) : interdit. Pas de préchargement, pas de Google sur la carte, pas de stockage d'images ou de références de photo.

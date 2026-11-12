# Google Places API (New) : photo d'un restaurant, coût et conditions

Date de recherche : 2026-11-13. Toutes les sources ont été consultées ce jour. Aucune page officielle consultée n'affiche de date de mise à jour visible, sauf mention contraire. « À confirmer » = non explicite dans les sources officielles lues.

Sources principales :
- S1 : Tarifs Global, Places API (New) : https://developers.google.com/maps/billing-and-pricing/pricing (date non affichée)
- S2 : Liste des SKU et tiers : https://developers.google.com/maps/documentation/places/web-service/usage-and-billing (date non affichée)
- S3 : Politiques Places API (cache, stockage, attribution) : https://developers.google.com/maps/documentation/places/web-service/policies (date non affichée)
- S4 : Photos Places API (New) : https://developers.google.com/maps/documentation/places/web-service/place-photos (date non affichée)
- S5 : Champs et SKU associés : https://developers.google.com/maps/documentation/places/web-service/data-fields (date non affichée)
- S6 : Conditions de service spécifiques, version archivée du 2024-05-22 (section 5 « Places API ») : https://cloud.google.com/maps-platform/terms/maps-service-terms/index-20240522 . La version courante n'a pas pu être lue en entier : à confirmer.
- S7 : Gestion des coûts et quotas : https://developers.google.com/maps/billing-and-pricing/manage-costs (date non affichée)
- S8 : Page générale des tarifs (passage au quota gratuit par SKU) : https://mapsplatform.google.com/pricing/ (date non affichée ; mentionne « Starting March 1, 2025 »)

---

## 1. Séquence d'appels la moins chère

Hypothèse : on connaît le nom et la position du restaurant, et on veut UNE photo.

| Étape | Appel | SKU | Catégorie | Prix / 1000 (tranche 0-100k, USD) | Quota gratuit / mois | Source |
|---|---|---|---|---|---|---|
| 1 | Text Search (New), field mask `id` seul (ou `places.id`) | Text Search Essentials (IDs Only) | Essentials | non affiché dans S1 | « Unlimited » (illimité) | S1, S2 |
| 2 | Place Details (New), field mask `id,photos` | Place Details Essentials (IDs Only) | Essentials | non affiché dans S1 | « Unlimited » (illimité) | S1, S2, S5 |
| 3 | Accès au média photo (`GET places.googleapis.com/v1/{name}/media`) | Place Details Photos (libellé Place Photos dans une liste) | Enterprise | **7,00 $** | **1 000** | S1, S4 |

Points clés :
- L'étape 1 et l'étape 2 sont listées comme « Unlimited » dans la colonne quota gratuit de S1. Le prix n'étant pas affiché pour ces SKU, « 0 $ » n'est pas confirmé par le chiffre : à confirmer dans la console.
- S5 indique que le champ `photos` est au tier « Essentials (IDs Only) » pour Place Details. C'est la clé de la séquence bon marché. Pour Text Search et Nearby Search, `photos` est au tier Pro (S5).
- La règle de facturation indique « billed at the highest SKU applicable to your request » (S2). Une requête mixant des champs IDs Only et Pro est donc facturée au tier Pro.
- Attention : S5 ne dit pas explicitement quelle SKU est déclenchée par l'appel média (étape 3). Que le média soit facturé en « Place Details Photos » à 7 $/1000 est l'interprétation la plus probable, mais elle n'est pas formulée noir sur blanc dans les pages lues. À confirmer.
- Le champ `location` (position) est au tier Essentials, pas IDs Only (S5). Le demander fait passer l'étape 2 en Place Details Essentials (5 $/1000 après 10 000 gratuits, S1). Inutile ici : on n'en a pas besoin si la position est déjà en base.

Alternatives plus chères, à titre de comparaison :
- Text Search Pro ou Nearby Search Pro avec `photos` : 32 $/1000, 5 000 gratuits/mois (S1, S5).
- Place Details Pro : 17 $/1000, 5 000 gratuits/mois (S1).

Conclusion de l'étape 1 : pour récupérer un `place_id` (une fois), puis la référence photo (à chaque affichage), puis le média, le coût facturé certain est celui du média (étape 3).

---

## 2. Règles de cache et de stockage

### Ce qu'on peut stocker indéfiniment
- **Place ID** : oui. Citation S3 : « You can therefore store place ID values indefinitely. » (8 mots, lien S3).

### Ce qu'on peut garder un nombre limité de jours
- **Latitude / longitude** : jusqu'à 30 jours consécutifs, puis suppression obligatoire (S6, section 5.4, version archivée 2024-05-22). À confirmer dans la version courante.

### Ce qui est interdit ou non autorisé (S3, S4)
- **Référence de photo (`name`)** : interdit de mettre en cache. Citation S4 : « You cannot cache a photo name. » (6 mots, lien S4).
- **Octets de la photo** : aucune source lue n'autorise explicitement le stockage des images Google. S3 indique que le contenu Google Maps ne peut être mis en cache ou stocké que là où les conditions spécifiques l'autorisent, et interdit le pré-chargement, l'indexation, le stockage hors des Services et le téléchargement en masse. Conclusion : stockage des octets non autorisé (interprétation, à confirmer par le service juridique).
- **Noms, adresses, avis** : S3 interdit de copier et sauvegarder noms d'entreprises, adresses et avis utilisateurs.
- **Notes (`rating`, `userRatingCount`)** : non mentionnées nommément. Relèvent de la restriction générale de S3 : à confirmer, traiter comme interdit par prudence.
- **URL temporaire du média (`photoUri`, obtenue avec `skipHttpRedirect=true`)** : non traitée dans les sources lues. À confirmer.

### Durée de validité d'une référence de photo
- S4 indique que la référence « can expire » et qu'une référence expirée renvoie une erreur ; il faut alors redemander une référence via Place Details, Nearby Search ou Text Search.
- Aucune durée chiffrée n'est donnée : **non trouvé**.

### Ce que cela implique pour le schéma
- Stocker le `place_id` de façon permanente.
- Ne pas stocker la référence `photos[].name`, ni les octets, ni les noms/adresses/notes copiés depuis Google.
- Pour chaque affichage : redemander la référence (Place Details IDs Only) puis servir le média à la volée.

---

## 3. Obligations d'attribution (S4, S3)

- **Auteur** : si `authorAttributions` est présent, il faut l'afficher là où l'image est montrée (S4 : « you must include the additional attribution »). Dans une galerie ou une vignette, l'attribution peut être omise si l'utilisateur peut accéder à une version plus grande qui la contient (S3).
- **Lien vers la source** : donner accès à la photo sur Google Maps via `googleMapsUri` (S3). Noter que S4 ne mentionne pas `googleMapsUri`, donc la règle vient de S3.
- **Signalement** : fournir `flagContentUri` pour que l'utilisateur puisse signaler un contenu (S3).
- **Logo Google** : utiliser le logo Google Maps si possible ; le texte « Google Maps » est accepté si l'espace manque. Logo non modifié, ratio conservé, hauteur entre 16 et 19 dp (S3).

---

## 4. Plafonner les coûts

### Quotas (console Google Cloud)
- Chemin indiqué par S7 : ouvrir la page Quotas de la console Cloud, choisir l'API, modifier le quota. Le chemin exact du menu « APIs & Services > Enabled APIs > Quotas » n'est pas écrit mot pour mot dans S7 : à vérifier dans la console.
- Règle de S7 : pour un quota journalier, diviser le quota gratuit mensuel par 31 et arrondir à l'inférieur. Pour Place Details Photos : 1 000 / 31 = **32 requêtes par jour**.
- Une fois la limite atteinte, les requêtes échouent jusqu'à la réinitialisation à minuit heure du Pacifique (S7).
- S7 recommande de fixer le quota légèrement sous le budget maximum, car quotas et facturation sont deux systèmes distincts.

### Budgets et alertes
- S7 : « Setting a budget does not automatically cap Google Cloud or Google Maps Platform usage or spending. » Les budgets déclenchent uniquement des alertes. Ils ne coupent ni la facturation ni l'API.
- Seul le quota arrête l'usage.
- Une augmentation de quota « doesn't cap your spending » (S7).

### Free usage cap
- Le quota gratuit est calculé mensuellement (S1 : « Service usage is calculated on a monthly basis »). S1 indique que l'agrégation se fait pour tous les projets liés au compte de facturation : le quota gratuit n'est donc pas par projet. À confirmer pour un compte multi-projets.
- Depuis le 1er mars 2025, le crédit mensuel de 200 $ a été remplacé par des appels gratuits par SKU (S8).

---

## 5. Simulation de coût

Hypothèses explicites :
- Prix Place Details Photos : 7 $ / 1 000 (tranche 0-100 000, S1), facturé par appel média (à confirmer).
- Quota gratuit : 1 000 appels par mois pour ce SKU (S1).
- Étapes 1 et 2 : gratuites (« Unlimited », S1/S2), donc 0 €.
- Taux de change : 1 USD = 0,92 EUR. **Hypothèse non vérifiée**, à remplacer par le taux du jour.
- Un appel média = une photo affichée ou téléchargée. Pas de cache des octets (voir section 2).

### (a) 4 300 restaurants, une seule fois

| Cas | Appels média | Facturés | Coût USD | Coût EUR approx. |
|---|---|---|---|---|
| Avec quota gratuit (1 000) | 4 300 | 3 300 | 23,10 $ | ~21 € |
| Sans quota gratuit | 4 300 | 4 300 | 30,10 $ | ~28 € |

Remarque légale : un pré-chargement en masse de 4 300 restaurants relève du « pre-fetching » et du « bulk download » que S3 interdit. Ce chiffre sert au calcul de coût, pas à valider la légalité de l'opération.

### (b) 150 restaurants par jour pendant un mois (30 jours)

Hypothèse : 150 affichages distincts par jour, soit 4 500 appels média sur le mois.

| Cas | Appels média | Facturés | Coût USD | Coût EUR approx. |
|---|---|---|---|---|
| Avec quota gratuit (1 000) | 4 500 | 3 500 | 24,50 $ | ~23 € |
| Sans quota gratuit | 4 500 | 4 500 | 31,50 $ | ~29 € |

Plafond quotidien recommandé pour ce scénario : 32 appels média par jour (section 4), soit 150 affichages/jour à répartir sur la journée. À vérifier : 150/jour dépasse 32/jour, donc le quota journalier doit être relevé ou les affichages étalés. Si le quota est atteint, le média échoue : prévoir un repli sans photo.

---

## 6. Verdict (schéma de cache recommandé)

1. **Base** : stocker uniquement le `place_id` (permanent) et les données que nous possédons nous-mêmes. Ne pas stocker noms, adresses, notes, références photo, ni octets d'image issus de Google.
2. **Position** : si on garde lat/lng issus de Google, les supprimer au plus tard après 30 jours consécutifs (S6 5.4, à confirmer en version courante).
3. **Image** : pas de cache des octets ni des références photo. Un endpoint serveur reçoit `place_id`, appelle Place Details (IDs Only, `photos`), puis le média, et renvoie l'image sans la stocker. Le cache HTTP sur cette réponse est à confirmer.
4. **Affichage** : afficher `authorAttributions`, lien vers `googleMapsUri`, lien de signalement `flagContentUri`, logo ou texte « Google Maps » (section 3).
5. **Plafond** : quota journalier sur Place Details Photos ≈ 32/jour (1 000 / 31), budget en alerte uniquement, repli sans photo quand le quota est atteint.

Points restant « non trouvé » : durée de validité chiffrée des références photo ; le chemin exact du menu quota ; le prix de Text Search Essentials (IDs Only) et de Place Details Essentials (IDs Only) (non affiché dans S1 ; gratuit au sens « Unlimited »).

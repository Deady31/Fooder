# MVP Fooder : périmètre et spec du chantier en cours

Date : 2026-11-14. Statut : **brouillon à valider par Riyan**, aucune ligne de code écrite pour ce chantier.

## Problème, cible, valeur

- **Problème** : « on ne sait pas où manger ce soir ».
- **Cible initiale** : étudiants et 25-35 ans à Toulouse, béta fermée.
- **Valeur** : trouver un resto qui donne envie en quelques swipes, le sauvegarder, y aller.
- **Parcours principal** : onboarding court → swipe → coup de cœur → Favoris → y aller.

## MoSCoW (Fil et gamification restent au programme, voir `DECISION_LOG.md`)

| | Contenu |
|---|---|
| **Must** | Carte de swipe sans défaut visuel, icônes cohérentes, onboarding verrouillé (sans défilement), Favoris, fiche, position et rayon, fin de paquet claire, toasts lisibles avec croix |
| **Should** | Filtres simplifiés, Carte des envies dans Favoris, MIAM/BOF dans la fiche, pages légales complétées |
| **Could** | Groupe, Food DNA enrichi, photos des restaurateurs |
| **Won't now** | Classement avancé, monétisation, Play Store, autres villes |

Chantiers : 1 Découvrir · 2 Onboarding · 3 Favoris et Carte · 4 Fiche et fin de paquet · 5 Fil · 6 Gamification · 7 Groupe.

---

## Chantier 1 : Découvrir

### Constats (vus le 2026-11-14, app locale, cloud coupé, 375×812 et 320×568)

| # | Constat | Gravité |
|---|---|---|
| D1 | Le logo n'est pas centré : l'en-tête met deux boutons à gauche et un seul à droite, le logo est poussé vers la droite | Haute |
| D2 | Bordure de 3 px sous l'en-tête et séparations dures entre les blocs (en-tête, position, filtres, carte) | Haute |
| D3 | La rangée de filtres est coupée net à droite (« Ha… ») : défilement sans indice visuel | Haute |
| D4 | 5 contrôles de filtre visibles en permanence (lieu, rayon, ouvert, végétarien, vegan, halal…) en plus de deux boutons ronds | Moyenne |
| D5 | À 320×568 la photo de la carte disparaît : il ne reste que badges et titre | Haute |
| D6 | La description de la carte est coupée par le bas de la carte | Moyenne |
| D7 | La fiche de démo « Burger Gourmet Capitole » s'affiche avec « Partenaire Fooder » et une note 4.7 : fausses données (règle produit : aucune fausse donnée) | **Bloquante** |
| D8 | Icônes : couverture correcte (97 %), pertinence et style à préciser avec un exemple | À constater |

### Icônes : état mesuré (3 228 fiches présentables, mesure corrigée)

- 52 icônes de plats existent déjà. Couverture spécifique **avant correction : 97,0 %** ; après ajout des codes anglais manquants (`lebanese`, `american`, `vegetarian`, `brazilian`, `peruvian`, `ethiopian`, `teahouse`, `frozen_yogurt`, `fine_dining`, `hookah`) : **97,1 %**.
- Une première mesure à 90,4 % était fausse : elle ignorait l'étiquette de type (bar, pub, café) que l'app utilise vraiment.
- Il reste environ 93 fiches sans icône précise (assiette neutre), dont 65 sans aucune cuisine.
- Le problème « icônes » ne vient donc plus de la couverture. À constater sur un exemple : style mélangé entre anciennes et nouvelles icônes, ou icône générique « français » (522 fiches, 16 %).
- Test automatique à ajouter sur les fiches réelles (≥ 95 %, jamais de dessert sur un lieu salé, résultat stable).

### Spec fonctionnelle (à valider)

1. **En-tête** : logo parfaitement centré (trois zones de largeur égale : actions à gauche, logo au centre, cloche à droite), sans trait dur dessous : un fondu crème vers la zone suivante.
2. **Filtres** : une seule ligne « lieu · rayon » plus un bouton « Filtres (n) ». Le régime vient du profil et s'applique tout seul ; « Ouvert » est actif par défaut. Budget, cuisine, humeur dans la feuille. Voir les deux maquettes plus bas.
3. **Rangée de puces restante** (si on en garde une) : fondu à droite, jamais de coupure franche.
4. **Bordures** : 2 px pour les contrôles, 3 px réservés à la carte et aux boutons d'action ; plus de trait plein entre les blocs.
5. **Carte** : la photo garde une hauteur minimale ; sous 600 px de hauteur, la description est masquée ; badges sur une ligne maximum ; plus de texte coupé.
6. **Toasts** : croix de fermeture, texte entier (police réduite si besoin), aucun « … ».
7. **Fausses données** : la fiche de démo n'apparaît plus dans le paquet réel ; aucun « Partenaire Fooder » sans contrat.

### Maquettes de filtres (choix demandé)

- **A, « Une ligne »** : `[📍 Centre de Toulouse] [⊙ 2 km] [⚙ Filtres 2]`. Tout le reste dans la feuille. Le plus épuré.
- **B, « Une ligne + Ouvert »** : A plus une puce « Ouvert » (la seule action vraiment fréquente). Un peu plus chargé, un geste de moins.

### Critères d'acceptation

- Logo centré à 320, 375 et 768 px (écart inférieur à 2 px).
- Aucun texte ni bouton coupé, à 320×568, 375×812, 768×1024 et en paysage.
- Couverture d'icônes ≥ 95 % sur les fiches présentables, test vert (déjà 97 %).
- Aucune fiche de démo ni « Partenaire » dans le paquet réel.
- Toasts : croix présente, texte entier, aucun « … ».
- `tsc`, tests et build verts ; aucune requête vers `supabase.co` pendant les essais.

### Risques

- Retirer les filtres visibles peut cacher une fonction : on garde tout dans la feuille.
- Les fiches de démo servent peut-être au premier lancement hors ligne : à vérifier avant de les retirer.

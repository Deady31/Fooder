# Étude de marché Fooder (B2C découverte de restaurants)

> Recherche web du 11/11/2026, sources publiques, chiffres non vérifiés en direct (à recouper avant tout dossier investisseur).

## 1. Qui fait déjà quelque chose de proche ?

| Acteur | Ce qu'il fait | Point commun avec Fooder | Ce qui manque (opportunité) |
|---|---|---|---|
| **Beli** (NY, 2021) | Classement perso des restos par comparaisons, fil d'amis, listes | Aspect social, public Gen Z, croissance par parrainage (>80 % des inscrits, source Ivey Business Review) | Pas de swipe, très centré États-Unis, comparaison forcée entre restos très différents (critique fréquente) |
| **Apps « Tinder pour restos »** : MonchMatch, SwipeEats, Sawa Eats, Hangrily, Tonight's Bite, Findalicious | Swipe pour décider **à plusieurs** (match quand tout le monde like) | Mécanique du swipe | Outils de décision de groupe, pas de découverte locale ni de profil, pas de gamification, projets petits |
| **TheFork** | Réservation et avis, domine l'Europe | Base de restos en France | Utilitaire de réservation, pas d'envie ni de communauté |
| **Zenchef** | SaaS B2B de réservation (≈8 000 restos en France) | Relation restaurateurs | Pas de produit grand public |
| **Le Fooding** | Guide éditorial (~2 000 adresses en France) | Curation, ton | Éditorial, peu de couverture locale, pas interactif |
| **Google Maps / Instagram / TikTok** | Découverte par recherche et vidéo | Là où les gens cherchent aujourd'hui | Pas de goût personnalisé, bruit, pas de décision rapide |

Conclusion : personne ne combine **swipe de découverte locale + profil de goûts (Food DNA) + fil social de proches + gamification** sur une ville. Les apps de swipe existantes restent des outils de groupe sans rétention ; Beli montre que le social est le moteur de croissance (parrainage), mais sans la rapidité du swipe.

## 2. Positionnement proposé

**« Le Tinder des restos, mais avec tes potes et ta ville. »**
- Entrée : 10 secondes de swipe, aucune saisie.
- Rétention : Food DNA, streaks, mascottes à débloquer, quartiers à explorer.
- Croissance : fil social + « Match avec un ami » (déjà présent) + partage du profil.
- Terrain : Toulouse d'abord (étudiants, 25-35 ans), puis Bordeaux, Montpellier, Lyon.

## 3. Le fil social : risques et règles

| Sujet | Décision |
|---|---|
| Modération | Signalement + retrait, liste de mots bloqués, photos recompressées (EXIF/GPS supprimé, déjà fait), comptes mineurs (<15 ans) interdits |
| Droit | CGU, mentions, politique de confidentialité (pages faites), suppression de compte et de contenu, DSA : point de contact et procédure de signalement |
| Démarrage à froid | Fil vide = app morte. Amorcer avec : posts des 20 restos fondateurs, « tes amis ont aimé » seulement quand 3 amis sont connectés, sinon « tendances Toulouse » |
| Lien avec le swipe | Un like = proposition de partager ; un post = lien direct vers la carte du resto |
| Spam / pubs | Posts sponsorisés étiquetés « Partenaire » (obligation loi influence), jamais mélangés sans marquage |

## 4. Monétisation (hiérarchisée)

1. **Restaurants (B2B) : visibilité locale**, le cœur du modèle. Fiche revendiquée gratuite, **Fooder Pro 29-79 €/mois** : mise en avant dans le deck (déjà prévue par le champ `sponsored`), offres du jour, statistiques de likes/vues, réponse aux posts. Paiement à la performance possible (coût par like/visite).
2. **Premium utilisateur (déjà codé) 2,99-4,99 €/mois** : swipes illimités, mascottes exclusives, filtres avancés. Ne jamais bloquer le cœur de l'expérience.
3. **Affiliation** : réservation (TheFork/Zenchef), livraison, billetterie. Revenus faibles mais sans friction.
4. **Données agrégées anonymes** (tendances de cuisine par quartier) vendues aux restaurateurs et à la ville, uniquement agrégées et conformes RGPD.

Ordre de test : 20 restos fondateurs gratuits → première offre payante dès ~2 000 utilisateurs actifs hebdomadaires à Toulouse.

## 5. Indicateurs à suivre

Rétention J1 / J7 / J30, swipes par session, taux de like, % d'utilisateurs qui ouvrent une fiche (appui long), posts par utilisateur actif, invitations envoyées, taux de conversion Premium, nombre de restos revendiqués.

## 6. Sources
- [Beli (Wikipedia)](https://en.wikipedia.org/wiki/Beli_(app)), [Ivey Business Review](https://www.iveybusinessreview.ca/magazine/articles/beli), [Food Network](https://www.foodnetwork.com/fn-dish/news/beli-app-trend)
- [MonchMatch](https://monchmatch.com/about/), [SwipeEats](https://swipeeats.app/), [Sawa Eats](https://getsawa.app/), [Hangrily](https://hangrily.app/tinder-for-restaurants), [Findalicious](https://github.com/kelvinfan001/findalicious)
- [TheFork / concurrents (CB Insights)](https://www.cbinsights.com/company/the-fork/alternatives-competitors), [Zenchef (Businesscoot)](https://businesscoot.com/en/company/zenchef), [Fooding (Marlvel.ai)](https://marlvel.ai/apps/fooding)

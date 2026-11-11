# Plan : icônes cohérentes pour tous les restaurants + inscription sans friction

## 1. Diagnostic (mesuré sur les 3 221 fiches présentables)

- **1 368 fiches (42 %) recevaient une icône tirée au hasard** parce qu'aucune règle ne les reconnaissait. C'est la cause du donut sur un libanais.
- Causes :
  - la détection lit le **libellé français** (« Libanais ») au lieu du **code de cuisine** d'OpenStreetMap/Overture (`lebanese`) ;
  - seulement **23 icônes** pour plus de 60 types de cuisine ;
  - 371 fiches n'ont **aucune cuisine** (« Restaurant ») et on ne regarde pas leur nom ;
  - les 4 petites icônes autour de la couverture étaient elles aussi tirées au hasard ;
  - 22 des 23 icônes existantes sont l'ancienne génération (avant la recette « pizza » validée).
- Déjà corrigé : plus de tirage au hasard (assiette neutre à la place), étincelles autour des couvertures.

Plus gros trous de couverture : Français 426, Restaurant (inconnu) 371, Italien 86, Sandwich 60, Africain 42, Terroir 34, Thaï 30, Libanais 27, Poulet 26, Crêperie 24, Poissons 19, Tapas 16, Marocain 16, Coréen 13, Espagnol 10, Poké 10.

## 2. La liste : 72 icônes (✔ = existe mais à refaire, ✚ = à créer)

**Asie**
1. ✚ Vietnamien (bol de phở, herbes, citron vert)
2. ✚ Chinois (boîte à emporter + baguettes)
3. ✔ Japonais / ramen
4. ✔ Sushi
5. ✚ Izakaya / yakitori (brochettes japonaises)
6. ✚ Coréen (bibimbap en bol de pierre)
7. ✚ Barbecue coréen (grill de table + viande)
8. ✚ Thaï (pad thaï ou mangue-riz)
9. ✔ Raviolis / dim sum
10. ✚ Wok / nouilles sautées
11. ✔ Indien / curry
12. ✚ Tandoori / naan
13. ✚ Népalais / tibétain (momo)
14. ✚ Poké / bowl hawaïen
15. ✔ Bubble tea

**Moyen-Orient et Afrique**
16. ✔ Kebab / döner
17. ✚ Turc (pide, thé turc)
18. ✚ Libanais / mezzé (assortiment houmous, falafel, pita)
19. ✚ Oriental / syrien / arabe (plateau de mezzés)
20. ✚ Falafel
21. ✚ Marocain (tajine)
22. ✚ Couscous
23. ✚ Africain (plat à l'arachide, plantain)
24. ✚ Éthiopien (injera)
25. ✚ Israélien / orient méditerranéen (pita-shakshuka)

**Europe**
26. ✚ Français traditionnel (coq au vin, cocotte)
27. ✚ Bistrot / brasserie (ardoise, entrecôte-frites)
28. ✚ Terroir / sud-ouest (cassoulet, saucisse de Toulouse)
29. ✚ Gastronomique (cloche d'argent, étoile)
30. ✚ Italien / trattoria (assiette de pâtes rouges)
31. ✔ Pâtes
32. ✔ Pizza
33. ✚ Espagnol / tapas (assiette de tapas, jambon)
34. ✚ Paella
35. ✚ Grec (gyros, salade grecque)
36. ✚ Portugais (sardine, pastel de nata)
37. ✚ Méditerranéen (poisson grillé, olives)
38. ✚ Fondue / raclette / savoyard
39. ✚ Allemand / belge (bretzel, moules-frites)
40. ✚ Crêperie (crêpe pliée)
41. ✚ Fruits de mer / poissons (plateau d'huîtres)
42. ✚ Moules-frites

**Amériques**
43. ✔ Mexicain / tacos
44. ✚ Tex-Mex / burrito
45. ✚ French tacos (tacos lyonnais, croustillant)
46. ✔ Burger
47. ✚ Steakhouse / grill (côte de bœuf)
48. ✔ Steak
49. ✚ Argentin (empanada, asado)
50. ✚ Péruvien / ceviche
51. ✚ Brésilien (churrasco, feijoada)
52. ✚ Américain / diner (milkshake, pancakes)
53. ✚ Cajun / créole / caribéen (crevettes épicées)
54. ✔ Hot-dog
55. ✔ Poulet frit / rôti (✚ à créer : le poulet n'existe pas)

**Formats et moments**
56. ✔ Fast-food / frites
57. ✔ Sandwich / panini (✚ nouveau : baguette garnie)
58. ✔ Croque-monsieur
59. ✔ Boulangerie / viennoiserie
60. ✔ Café / coffee shop
61. ✚ Salon de thé (théière, scones)
62. ✔ Brunch / pancakes
63. ✔ Salade / healthy
64. ✚ Végétarien / vegan (légumes)
65. ✔ Glace
66. ✔ Dessert / cupcake
67. ✚ Gaufres
68. ✚ Bar à vin / cave
69. ✚ Bar à cocktails
70. ✚ Pub / bar à bières
71. ✚ Food truck / street food (camionnette)
72. ✚ Neutre : couvert + assiette (cuisine inconnue)

Les icônes de base sont à refaire dans le style « pizza » pour éviter un mélange de styles. Au total : **env. 50 à créer, 22 à refaire.**

## 3. Nouveau moteur de correspondance

Ordre de décision, du plus fiable au moins fiable :

1. **Code de cuisine brut** (`lebanese`, `korean`, `french_tacos`…) vers une icône, via une table complète. Une même fiche peut avoir plusieurs codes : on garde le plus spécifique (`pizza` bat `italian`, `lebanese` bat `mediterranean`).
2. **Mots du nom** si la cuisine est inconnue : « Beyrouth », « Pho », « Sushi », « Tajine », « Trattoria », « Crêperie », « Brasserie », « Kebab »… (liste vérifiée sur les noms réels des 371 fiches sans cuisine).
3. **Format** du lieu (café, bar, glacier).
4. **Icône neutre** couvert + assiette. Jamais de tirage au hasard, jamais d'icône sucrée sur un lieu salé.

Garde-fous : un test automatique sur les fiches réelles, qui échoue si (a) moins de 97 % des fiches ont une icône spécifique, (b) un dessert/boisson apparaît sur un lieu salé, (c) une même fiche change d'icône entre deux calculs.

Autour de la couverture, les 4 petites icônes viennent de la même « famille » (ex. libanais : pita, olives, citron, menthe), pas de la liste globale.

## 4. Génération

- Recette validée sur la pizza : référence de style IPAdapter (poids 0,35), invite courte « une seule portion », liste de rejets contre les collages, détourage, contour prune, ombre portée.
- 3 variantes par icône, contrôle sur planches-contact (je te montre, tu valides).
- Cible 2D plat, même regard sur toute la série.
- Durée estimée : environ 3 h de calcul sur la carte graphique, par lots de 12 icônes. Tu valides chaque lot.
- Rien n'est généré avant ton accord sur cette liste.

## 5. Ordre de travail

| Étape | Contenu | Résultat |
|---|---|---|
| 0 | Garde-fou (fait) | Plus d'icône aléatoire |
| 1 | Table cuisine → icône, règles de nom, tests sur données réelles | Précision mesurable |
| 2 | Lot 1 : 15 cuisines les plus fréquentes (français, bistrot, terroir, italien, sandwich, thaï, libanais, africain, marocain, coréen, poulet, crêperie, poissons, tapas, neutre) | Couvre environ 85 % des fiches |
| 3 | Lot 2 : Asie, Moyen-Orient, Amériques | Couverture 97 % |
| 4 | Lot 3 : refaire les 22 anciennes + bars et formats | Série homogène |
| 5 | Familles d'icônes pour les couvertures | Couvertures cohérentes |

## 6. Inscription sans friction

**Problème.** Demander un e-mail dès l'arrivée fait fuir (le gain est nul avant d'avoir vu la valeur).

**Solution retenue : compte anonyme, puis promotion douce.**

1. Au premier lancement, **aucun écran d'inscription**. En coulisses, l'appli crée un compte anonyme Supabase (pas d'e-mail, pas de mot de passe, invisible).
2. L'utilisateur swipe, like, ajoute des amis, vote dans des groupes comme un compte normal. Rien n'est perdu et il garde le même identifiant.
3. On propose **« Sauvegarder ma progression »** uniquement à des moments où l'utilisateur a quelque chose à perdre :
   - après sa 1re visite confirmée (« ta série démarre, sauvegarde-la ») ;
   - après sa 10e like ;
   - quand il publie une vraie photo ;
   - quand il change de téléphone ou veut retrouver son compte ;
   - le dimanche si sa série est en jeu.
4. La sauvegarde = **bouton Google / Apple en un geste**, ou e-mail avec code. L'identifiant ne change pas : amis, likes et photos suivent (liaison d'identité Supabase, pas de fusion).
5. On ne bloque **jamais** le swipe. Le refus est mémorisé (on redemande 7 jours plus tard au plus).

**Conditions de sécurité** (déjà prévues dans le schéma, à renforcer) :
- Publication de posts publics réservée aux comptes liés à un e-mail ou à Google (empêche le spam par comptes jetables).
- CAPTCHA invisible (Cloudflare Turnstile) à la création du compte anonyme.
- Limites par compte et par jour déjà en place pour les posts et les signalements.

**Impact :** l'inscription n'est plus un mur mais une assurance. Les amis par lien fonctionnent dès la première minute avec ajout réciproque côté serveur.

À préparer côté Supabase : activer « Anonymous sign-ins » (Authentication → Sign In / Providers), puis Google et Apple quand tu veux.

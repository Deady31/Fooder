# FOODER — Audit visuel et d'usage (13/11/2026)

**Conditions** : serveur local `next dev -p 3100`, Supabase **désactivé** (`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` vides), clés Google vidées aussi. localStorage vidé, parcours nouvel utilisateur. Navigateur intégré, 375×812 (plus 320×568, 812×375 paysage, 1440×900).
**Vérification réseau** : aucune requête vers `supabase.co`. Hôtes contactés : `localhost:3100`, `images.unsplash.com` (images des fiches de démo), `tiles.openfreemap.org` (fonds de carte). `/api/place-photos` n'a été appelé qu'en local, à l'ouverture d'une fiche, et la clé vide le coupe court (`reason: disabled`) : rien n'est parti chez Google. Rien n'a été publié ni envoyé. Le partage a été intercepté en JS pour récupérer le lien, sans ouvrir de feuille de partage.
**Profil joué** : pseudo tiré au sort, « Je préfère ne pas dire », 25-34 ans, Japonais/Ramen/Italien, **Végétarien**, €€, Calme, Régulièrement, aucun interdit, Carmes, Entre amis.
**Limites** : l'appui long a été testé par événement synthétique : il ouvre la fiche. Le pincement n'est pas testable à la souris : seul le zoom à la molette a été vérifié. « Réduire les animations » n'a pas pu être émulé ; la prise en charge a été vérifiée dans le code (`MotionConfig reducedMotion='user'` + règle CSS globale). Les temps de transition sont mesurés en mode dev et peuvent être plus longs qu'en production.

Notation /5 : **PI** première impression · **Cl** clarté · **Fb** feedback · **Do** dopamine · **Fl** fluidité · **Ac** accessibilité · **Ro** robustesse.

---

## 1. Onboarding (accueil + 13 écrans + récap)

| PI | Cl | Fb | Do | Fl | Ac | Ro |
|---|---|---|---|---|---|---|
| 4 | 4 | 3 | 3 | 3 | 2 | **1** |

Ce qui marche : écran d'accueil très fort (logo 3D rose, stickers, « Swipe. Mange. Répète. »), barre de progression en segments avec étoile, auto-avance sur les choix uniques, grille de cuisines illustrée, récap « Bienvenue, BurgerJoyeux77 ! » avec mode d'emploi du swipe.

| # | Sév. | Effort | Constat (vu) | Correction précise |
|---|---|---|---|---|
| O1 | **P0** | S | **Recharger la page en plein onboarding efface tout** : après 13 réponses, retour à l'écran d'accueil et `localStorage` vide (`Object.keys(localStorage)` = `[]`). | Écrire un brouillon `fooder_onboarding_draft` {step, answers} à chaque réponse, le relire au montage, le supprimer à la fin. |
| O2 | **P0** | M | **13 questions avant le premier restaurant**, alors que l'accueil promet « Gratuit · 1 minute chrono ». Le genre et l'âge arrivent en 2e et 3e position, avant toute valeur. | Garder 4 écrans (pseudo, cuisines, régime, budget), puis le swipe. Poser le reste en « questions bonus » dans le deck (une carte-question tous les 8 swipes, +10 XP chacune). Supprimer le genre ou le passer en fin, facultatif. |
| O3 | P1 | S | Texte coupé : « Végétarier » (tuile Végétarien) et « Romantique » coupé à 375 px. | `min-w-0` + `break-words` sur le libellé, ou police de libellé à `clamp(13px,3.6vw,15px)` ; icône 40 px au lieu de 48 px. |
| O4 | P1 | S | Le 7e choix de cuisine est **ignoré sans rien dire** (Bistrot ne réagit pas, le compteur reste « (6/6) »). | Secousse de 200 ms sur la tuile et sur « (6/6) », vibration de 30 ms, toast « 6 max : retire-en une ». Griser les tuiles non choisies une fois 6 atteint. |
| O5 | P1 | S | « Autre » dans « Ce que tu ne manges pas ? » se sélectionne mais **n'ouvre aucun champ** : donnée inutile. | Ouvrir un champ « Quoi ? » de 40 caractères max, ou supprimer l'option. |
| O6 | P1 | S | Comportement incohérent : genre, âge, budget et « à table » avancent seuls ; quartier (choix unique) attend « Continuer ». Le bouton « Continuer » reste visible sur les écrans qui avancent seuls, rendu comme désactivé (blanc, texte gris). | Règle unique : choix unique → avance seul (300 ms après la coche). Masquer le CTA sur ces écrans ou le remplacer par « Passer ». |
| O7 | P1 | S | Les options du genre ont `role="checkbox"` pour un choix unique. Bouton retour 36×36, « Tire au sort » 33 px de haut. | `role="radio"` dans un `role="radiogroup"` ; cibles de 44 px minimum (`min-h-11 min-w-11`). |
| O8 | P1 | S | Le récap n'affiche pas les **cuisines choisies** ni les **interdits**, les choix qui comptent le plus. Il montre « 25-34 ans » en premier. | Ordre : cuisines (3 max + « +3 »), régime, budget, quartier ; retirer l'âge. |
| O9 | P2 | S | Icônes réutilisées sans logique : cœur pour « Vegan » **et** « En couple », pizza pour « Entre amis » **et** pour l'en-tête de l'écran, cupcake pour « Romantique », glace pour « Terrasse », hot-dog pour « Rapide ». Le sticker « verres de vin » de l'en-tête « L'ambiance » touche le sur-titre. | Un sticker unique par concept (feuille pour végé, bougie pour romantique, parasol pour terrasse, chrono pour rapide). `mb-2` sous les stickers d'en-tête. |
| O10 | P2 | S | « Tire au sort » remplit le champ sans animation. | Effet machine à sous de 400 ms sur le pseudo (3 noms qui défilent) + petit « tic ». |
| O11 | P2 | S | Écran « Fooder, c'est ton appareil photo » : on demande une contribution avant d'avoir donné quoi que ce soit, et la formule est maladroite. Apostrophes mélangées (’ et '). | Déplacer cet écran après la première visite confirmée. Uniformiser sur l'apostrophe typographique ’. |
| O12 | P2 | S | Grands vides entre les options et le CTA (environ 40 % de l'écran sur genre, âge, rythme). | Centrer le bloc d'options verticalement, ou mettre une illustration en bas. |
| O13 | P2 | S | 320 px : stickers salade et burger sous le CTA « Créer mon profil ». | Masquer 2 stickers sous 360 px. |

## 2. Swipe (deck, carte, actions, filtres, humeur)

| PI | Cl | Fb | Do | Fl | Ac | Ro |
|---|---|---|---|---|---|---|
| 4 | 3 | 3 | 3 | 4 | 3 | 2 |

Ce qui marche : carte « sticker » épaisse avec ombre dure, plat illustré en médaillon, badges distance/cuisine/régime, boutons ✕ et ♥ massifs, annulation qui marche (Yūjō Ramen revient), surprise « JACKPOT FOODIE ! » rare (10 % au premier like) avec trophée, vibration au like, anneau de focus clavier visible.

| # | Sév. | Effort | Constat (vu) | Correction précise |
|---|---|---|---|---|
| S1 | **P0** | M | **Utilisateur végétarien : la première carte montre des crevettes en tempura** (Yūjō Ramen, « Plat typique · Daderot ») ; Juguem montre des brochettes de viande ; le médaillon de Juguem est un sushi au saumon. La photo « plat typique » ne tient pas compte du régime. | Dans le sélecteur de plat typique, filtrer la bibliothèque par `diet` (tags `veg/vegan/halal` sur chaque image) quand le filtre régime est actif ; sinon prendre une image neutre (bol de légumes). |
| S2 | **P0** | S | **Humeur « Tour en Asie » choisie d'office** : le deck ne propose que de l'asiatique (9 restos) alors que l'utilisateur a aussi choisi Italien. | Humeur par défaut « Surprends-moi », ou dérivée des cuisines choisies dans l'onboarding (toutes, pas seulement la première famille). |
| S3 | **P0** | S | **Mise en page de carte cassée** quand il y a 4 badges (Jiao Zi Guan : « Sans gluten » passe à la ligne) : le titre est rogné en haut et « Touche pour ouvrir » recouvre la description. | Hauteur de photo flexible (`flex-1 min-h-[38%]`), badges limités à une ligne (`flex-nowrap overflow-hidden` + « +1 »), description `line-clamp-2`, CTA dans le flux et non en absolu. |
| S4 | **P0** | M | **À 320×568, la carte est illisible** : photo écrasée en bandeau, nom masqué, badges superposés, « Touche pour ouvrir » sur les horaires ; « Découvrir » coupé dans la barre du bas. **Paysage 812×375 : la carte disparaît** (seuls les filtres et les boutons restent). | Sous 600 px de hauteur : masquer la ligne de filtres (les mettre dans le bouton Filtres), photo à 45 % de la hauteur de la carte, description cachée. En paysage : carte en 2 colonnes (photo à gauche, infos à droite) ou message « Tourne ton téléphone ». |
| S5 | **P0** | S | **Fin de paquet mal libellée** : après le dernier swipe : « 0 resto à découvrir / Pas encore de résultat / Peu de restos renseignés pour ce régime (selon OpenStreetMap). » Ce n'est pas une absence de résultat, l'utilisateur a **tout vu**. Le texte est posé directement sur le motif chargé : sous-titre gris illisible. | Deux états distincts : « Tu as tout swipé ! » (avec compteur de likes de la session et CTA « Voir mes 3 coups de cœur » / « Élargir à 5 km ») et « Aucun resto pour ces filtres ». Placer le texte dans une carte crème opaque. |
| S6 | **P0** | M | **Données de démo mélangées aux vraies** : « Pizza Lola », « Burger Gourmet Capitole », « Michel Sarran » viennent de `data/mockRestaurants.ts` avec un badge **« Partenaire Fooder »**, une note 4.6, « 1820 avis », « Classée meilleure pizza de Toulouse par Toulouse Secret » et un menu inventé. L'étiquette « Illustration · vraie photo à venir » est posée sur une photo Unsplash. | Retirer les fiches de démo du deck en production (garde `NODE_ENV`/flag) ou les marquer « démo » comme dans le Fil. Ne jamais afficher « Partenaire » sans contrat. Supprimer note, avis et citations inventés. |
| S7 | P1 | S | « Touche pour ouvrir » (carte) contre « Maintiens pour tout voir » (récap onboarding) : deux consignes pour le même geste. Le tap **et** l'appui long ouvrent tous deux la fiche. | Une seule consigne : « Touche pour la fiche ». Réserver l'appui long à un aperçu « peek » (photo en grand + horaires, relâcher pour fermer) ou supprimer le libellé de l'appui long. |
| S8 | P1 | S | « à 170 m **de toi** » alors qu'aucune géolocalisation n'a été demandée : la distance est calculée depuis le Capitole, et l'utilisateur a choisi Carmes. | Sans géoloc : « à 170 m du Capitole » ou distance depuis le quartier choisi ; demander la position au premier swipe avec un écran d'explication. |
| S9 | P1 | S | Les flèches ← → du clavier ne font rien (vérifié : aucun like/dislike enregistré). | Raccourcis ← (passer), → (aimer), Entrée (fiche), Retour arrière (annuler) quand le focus n'est pas dans un champ. |
| S10 | P1 | S | « Voir tout » (fin de paquet) retire **en silence** le filtre Végétarien **et** « Ouvert maintenant ». | Toast « Filtre Végétarien retiré · Annuler ». Ne retirer que le filtre qui bloque. |
| S11 | P1 | S | Feedback de like peu visible : impossible de capturer une « explosion » à 150 ms ; aucun tampon « MIAM » au doigt pendant un drag de 70 px. | Pendant le drag : tampon MIAM/BOF dont l'opacité suit `x/120`, rotation de ±8°. Au like : cœur qui s'envole vers l'onglet Favoris avec +1 qui rebondit sur le badge. |
| S12 | P1 | S | Échap ne ferme ni la feuille Filtres ni la fiche (seule la visionneuse photo se ferme). | Écouteur `keydown Escape` commun à toutes les feuilles (`useSheetDismiss`). |
| S13 | P1 | S | Filtres : la catégorie « Restaurant » n'en est pas une ; le vocabulaire diffère de l'onboarding (« Crêperie » contre « Crêpes », « Népalais » présent, Italien/Burger/Libanais absents) ; « Budget max 35€ » alors que €€ = 20–40 €. Michel Sarran à 145 € apparaît malgré le budget €€. | Une seule liste de cuisines partagée (`lib/cuisines.ts`) ; budget initialisé à 40 € pour €€ ; le budget filtre aussi les fiches dont le prix est connu. |
| S14 | P1 | S | Le compteur « 9 restos à découvrir » est en partie caché par le haut de la carte. | Le placer dans la ligne des filtres, ou `mb-2` + `z-10`. |
| S15 | P2 | S | Crédit photo brut sur la carte : « Plat typique · Ser Amantio di Nicolao », « · Ocdp », « · N509FZ » (pseudos Wikimedia). | Sur la carte : « Plat typique » seul ; crédit complet dans la fiche et la visionneuse. |
| S16 | P2 | S | Formats horaires mélangés : « Ouvert jusqu'à 14 h » (carte), « Ouvert · ferme à 14h » (fiche), « 10h30 – 14h » (tableau). | Un formateur unique : « 14 h », « 10 h 30 ». |
| S17 | P2 | S | Badge de notifications qui grimpe à 8 en 10 minutes, pour de simples trophées. | Ne compter que l'utile (vendredi Fooder, ami ajouté), regrouper les trophées. |
| S18 | P2 | S | `/api/restaurants?...offset=0` appelé 3 fois au chargement. | Dédoublonner (requête en cours partagée ou cache SWR). |

## 3. Fiche restaurant (feuille)

| PI | Cl | Fb | Do | Fl | Ac | Ro |
|---|---|---|---|---|---|---|
| 4 | 4 | 3 | 2 | 4 | 2 | 3 |

Ce qui marche : grande photo, carte-titre qui chevauche la photo, « En bref » avec citation, horaires avec **le jour courant surligné en jaune** et pastille « Ouvert · ferme à 14h », section Régimes avec source (« Info selon OpenStreetMap, à confirmer »), bloc « Pas encore de photo du vrai plat » en pointillés, visionneuse avec zoom à la molette et crédit.

| # | Sév. | Effort | Constat | Correction |
|---|---|---|---|---|
| F1 | **P0** | S | **Aucun bouton MIAM / BOF dans la fiche** : pour décider, il faut fermer puis swiper. | Pied de page : ✕ / ♥ (comme le deck) + « Y aller » ; fermer la feuille et animer la carte qui part. |
| F2 | P1 | S | Retour du navigateur avec la fiche ouverte : on revient à `/onboarding`, qui renvoie vers `/swipe` (flash). La fiche ne s'est pas inscrite dans l'historique. | `history.pushState({sheet:id})` à l'ouverture, fermeture sur `popstate`. Fin d'onboarding en `router.replace('/swipe')`. |
| F3 | P1 | S | Le pied de page fixe (« Partager » + « Y aller ») occupe 160 px et masque « Site officiel » au premier écran ; l'adresse est tronquée (« 31000,... »). | Pied de page sur une ligne (Partager en icône 48 px + « Y aller » plein) ; adresse sur 2 lignes. |
| F4 | P1 | S | « Plat typique » montre **la même photo** que la photo principale. | Ne pas afficher la section quand l'image est la même, ou afficher 2 autres plats typiques de la cuisine. |
| F5 | P1 | S | Fiches de démo et fiches OSM incohérentes : « L'expérience » contre « En bref » ; « Partager » absent des fiches de démo. | Même gabarit pour tout. |
| F6 | P1 | M | Accessibilité : fiche ouverte, le deck et la barre du bas restent atteignables (pas d'`aria-modal`/`inert`). Les liens de la barre du bas n'ont pas de nom accessible (`link href="/swipe"` sans libellé). | `inert` sur `<main>` + nav pendant les feuilles ; `aria-label` sur les liens de la barre. |
| F7 | P2 | S | Visionneuse : le double-clic à la souris ferme au lieu de zoomer ; aucun indice de zoom. | Ne fermer que sur un tap hors de l'image ; indice « Pince pour zoomer » à la première ouverture. |

## 4. Favoris (wishlist) et check-in

| PI | Cl | Fb | Do | Fl | Ac | Ro |
|---|---|---|---|---|---|---|
| 4 | 3 | 4 | 3 | 3 | 2 | 4 |

Ce qui marche : « Ton vendredi Fooder » (top 3 du week-end) : très bonne idée ; segment « Coups de cœur (3) / Écartés (3) » ; feuille « Alors, ce resto ? » MIAM/BOF + photo + mot ; récompense « +40 XP · Série : 1 semaine ».

| # | Sév. | Effort | Constat | Correction |
|---|---|---|---|---|
| W1 | P1 | S | Icône « Retirer » de **16×16 px** ; « Y aller » et « J'y suis allé » de 33 px de haut. | Cibles de 44 px ; retirer par glissement vers la gauche avec annulation. |
| W2 | P1 | S | Deux appels au groupe empilés (« On mange où ? » puis « Invite tes potes ») : la vraie liste commence sous la ligne de flottaison. | Garder un seul bloc ; placer la liste juste après « Ton vendredi Fooder ». |
| W3 | P1 | S | Récompense de visite statique : « +40 XP » apparaît d'un coup. | Compteur de 0 à 40 en 600 ms, la barre de niveau qui se remplit, confettis si le niveau change. |
| W4 | P1 | S | Transition d'onglet d'environ 2 s (dev) : page délavée et indicateur de la barre du bas qui passe par « Carte » avant « Favoris ». | Fondu de page ≤ 200 ms ; indicateur posé directement sur l'onglet cible. |
| W5 | P2 | S | Le rappel photo (« pas la devanture ») revient une 4e fois après la visite. | Le montrer une seule fois (première publication), ensuite une ligne. |

## 5. Fil

| PI | Cl | Fb | Do | Fl | Ac | Ro |
|---|---|---|---|---|---|---|
| 4 | 3 | 3 | 2 | 4 | 3 | 2 |

Ce qui marche : cartes « ticket » à encoches, verdicts MIAM / À TESTER, pastille « démo » honnête, 3 boutons ronds de 44 px.

| # | Sév. | Effort | Constat | Correction |
|---|---|---|---|---|
| FE1 | **P0** | S | **Ma visite confirmée (Juguem, MIAM) n'apparaît pas dans le Fil**, qui ne montre que 4 posts de démo (« lea_mange · il y a 1 h », 42 cœurs). L'explication « Exemples de démo · le vrai fil arrive avec les comptes » est tout en bas. | Afficher d'abord mes posts locaux (« Toi · à l'instant ») ; bandeau « démo » en haut ; heure relative en direct. |
| FE2 | P2 | S | « Partager un resto » reprend encore le même encart pédagogique photo. | Le réduire à une ligne. |

## 6. Carte

| PI | Cl | Fb | Do | Fl | Ac | Ro |
|---|---|---|---|---|---|---|
| 4 | 3 | 4 | 3 | 4 | 3 | **1** |

Ce qui marche : fond de carte crème/jaune très cohérent, épingles stickers, vol animé vers l'épingle, carte du bas « Une Table à Deux · Y aller · Fiche · ♡ ».

| # | Sév. | Effort | Constat | Correction |
|---|---|---|---|---|
| M1 | **P0** | M | **« Coups de cœur » : « 0 spot à Toulouse / Aucun coup de cœur »** alors que la barre du bas affiche 3 favoris. « Tous » ne montre que **8 spots** (les fiches de démo), aucune des fiches OSM swipées. | La carte lit `fooder_wishlist` et les mêmes données que le deck (`/api/restaurants`) ; regrouper les épingles au dézoom. |
| M2 | P2 | S | Le libellé « Toulouse » du fond de carte passe sous les épingles. | Masquer les libellés de lieu du style à ce zoom, ou décaler les épingles avec `icon-allow-overlap`. |

## 7. Profil (XP, niveau, trophées, Wrapped)

| PI | Cl | Fb | Do | Fl | Ac | Ro |
|---|---|---|---|---|---|---|
| 3 | 3 | 3 | 4 | 3 | 2 | 3 |

Ce qui marche : flamme de série « 1 semaine », barre de niveau, Food DNA avec archétype illustré, défis du mois avec progression (« Tour du monde 1/5 »), Wrapped avec compteurs qui démarrent à l'entrée dans l'écran (6 / 1 / 1 / 130).

| # | Sév. | Effort | Constat | Correction |
|---|---|---|---|---|
| P1 | **P0** | S | « Avantages par niveau » : **« Un café offert chez un partenaire · niv. 2 » s'affiche comme acquis (pastille verte)** alors qu'aucun partenaire n'existe (« exemples, en attente de restaurants partenaires »). Promesse non tenue au moment où l'utilisateur est niveau 2. | Masquer la section tant qu'il n'y a pas de partenaire, ou cadenas + « bientôt » sans état « débloqué ». |
| P2 | P1 | S | Le pseudo est tronqué (« BurgerJoyc… ») alors qu'il reste de la place ; « 1 testés » ; avatar burger et archétype « Street Food Addict » (en anglais) pour un végétarien qui a aimé japonais et chinois. | `truncate` remplacé par `text-balance` + police à `clamp` ; pluriel conditionnel ; archétypes en français, avatar par défaut neutre. |
| P3 | P1 | S | Le bloc « Invite tes potes » avec 5 boutons (Partager, Copier, WhatsApp, Story, QR) occupe la moitié du premier écran, et existe aussi dans Amis. | Dans Profil, un seul bouton « Inviter » ; le bloc complet seulement dans Amis. |
| P4 | P1 | S | Trophées verrouillés en transparence sur le motif : illisibles (« 3 jours foodie », « Semaine parfaite »). « 4/25 trophées débloqués » est posé sur le motif. | Verrouillé = carte crème opaque, sticker en niveaux de gris + cadenas, texte à 70 % d'opacité ; tout le texte dans un conteneur opaque. |
| P5 | P1 | S | Changer d'onglet (Wrapped) laisse la vue sur la section légale : le contenu de l'onglet est hors écran. | `scrollIntoView({block:'start'})` sur le contenu de l'onglet après le changement. |
| P6 | P2 | S | Trophées en doublon : « Éclaireur — Première vraie photo publiée » et « Premier cliché — Ta première photo de plat publiée ». « Lucky Foodie » reste débloqué après l'annulation du like. | Fusionner les deux ; pour le jackpot, débloquer à la fermeture de l'overlay plutôt qu'au like. |
| P7 | P1 | S | « Les mesures d'usage anonymes se désactivent dans Compte » → Compte n'a aucun réglage (« Comptes bientôt disponibles »). | Mettre l'interrupteur de mesure d'usage dans Profil > Mes données. |

## 8. Amis, Food Match, Groupe, Défi

| PI | Cl | Fb | Do | Fl | Ac | Ro |
|---|---|---|---|---|---|---|
| 4 | 3 | 3 | 4 | 4 | 2 | 4 |

Ce qui marche : carte QR « Fais-moi scanner », écran Food Match « 100 % · Âmes sœurs culinaires · Vous aimez tous les deux Kouang-Wa et Himari Sushi », avertissement anti-usurpation, « Lien illisible » géré proprement, défi à l'aveugle avec indice modifiable.

| # | Sév. | Effort | Constat | Correction |
|---|---|---|---|---|
| A1 | P1 | S | Ajout d'ami sans célébration : « AmiTest est ton ami ! » et « +25 XP » en petit texte **posé sur le motif** (comme « Vérifie que c'est bien la bonne personne… »). Le passage au niveau 3 n'a été vu que dans les notifications. | Pourcentage du Food Match qui monte de 0 à 100 sur 900 ms + confettis ; tout le texte dans la carte ; overlay « Niveau 3 ! » au moment du passage. |
| A2 | **P0** | S | Groupe, « Nouvelle session » : sélection pré-cochée de **McDonald's, Tacos Corner, Five Guys, Les Burgers de Papa** pour un végétarien, ainsi que **Yūjō Ramen, que j'avais écarté**. | Pré-cocher uniquement les coups de cœur, compléter avec des restos qui respectent régime et budget, exclure `fooder_dislikes`. |
| A3 | P1 | S | Groupe : la barre « Annuler / Lancer la session » flotte au-dessus de la barre du bas, avec la liste visible entre les deux (Five Guys). Explication en 3 étapes lourde (« renvoie son lien : ouvre-les »). | Barre d'action collée à la barre du bas avec un fond opaque. Réduire à « 1. Choisis · 2. Envoie au groupe · 3. On compte les votes ». |
| A4 | P2 | S | QR présent deux fois sur Amis (bouton « QR code » et carte QR). | Garder la carte QR seule. |

## 9. Classement, Compte, Notifications

| PI | Cl | Fb | Do | Fl | Ac | Ro |
|---|---|---|---|---|---|---|
| 3 | 4 | 3 | 2 | 4 | 3 | 3 |

- Classement Global hors ligne : « Classement indisponible » propre. Onglet **Amis** : podium à **0 photo** pour les deux (« Toi : #1 · 0 photo · 2 en lice »). **P1, S** : sous 1 photo, remplacer le podium par « Publie ta première photo pour ouvrir le podium (+30 XP) ».
- Compte : « Comptes bientôt disponibles… Rien n'est perdu » : clair. Le message est rassurant, mais le titre de page « Sauvegarde, amis et groupes en direct » promet ce qui n'existe pas. **P2** : sous-titre « Bientôt ».
- Notifications : liste claire avec stickers. **P2** : chaque trophée génère une notification, ce qui fait 8 non lues en 10 minutes ; « Tout effacer » en petit texte gris.

## 10. Pages légales, page publique, 404

| PI | Cl | Fb | Do | Fl | Ac | Ro |
|---|---|---|---|---|---|---|
| 2 | 4 | 3 | 1 | 4 | 4 | 2 |

| # | Sév. | Effort | Constat | Correction |
|---|---|---|---|---|
| L1 | **P0** | S | **Mentions visibles « [À COMPLÉTER : éditeur] », « [À COMPLÉTER : e-mail] »** : mentions ×6, CGU ×6, confidentialité ×4, communauté ×2. | Remplir avant tout lancement public (éditeur, adresse, hébergeur, contact). |
| L2 | P1 | S | **404 Next par défaut, en anglais** (« This page could not be found. »), sans navigation ni marque. Même chose pour `/resto/<id inconnu>`. | `app/not-found.tsx` : sticker « assiette vide », « Ce plat n'est pas au menu », boutons « Swiper » et « Mes favoris ». |
| L3 | P1 | S | Page publique `/resto/osm-…` (lien partagé) : photo + adresse + « Ouvrir dans Fooder », **sans logo Fooder ni accroche**. C'est la porte d'entrée virale. | Logo en haut, « 3 secondes pour savoir où manger à Toulouse », CTA « Swipe tes restos », aperçu de 3 cartes floutées. |

## 11. Transversal

- **Retour du navigateur** : sortie de feuille par un retour vers `/onboarding` (voir F2). **P1**.
- **Rechargement** : en plein onboarding, tout est perdu (O1, **P0**). En plein swipe, le deck et la carte du dessus sont conservés : OK.
- **Clavier** : anneau de focus visible (contour violet de 3 px), ordre logique ; flèches inopérantes sur le deck (S9).
- **Réduire les animations** : prise en charge globale dans le code (`MotionConfig` + CSS). Non émulé ici.
- **Grand écran 1440** : colonne mobile centrée, propre. Rien à signaler.
- **Contrastes** : les textes sur carte crème passent (seul « MIAM ! » est à 2,44:1, mais il fait 41 px). Le **vrai problème : tous les textes posés directement sur le motif illustré** (états vides, sous-titres, « +25 XP », avertissements) sont illisibles. Règle : jamais de texte sur le motif sans conteneur opaque.
- **Cohérence** : « Coups de cœur » / « Favoris » / « likés » / « MIAM » désignent la même chose ; « Restos testés » / « visites confirmées » / « J'y suis allé » aussi. Fixer un lexique : **MIAM** (swipe) → **Coups de cœur** (liste) → **J'y suis allé** (visite).
- **Liseré violet** de 2–3 px sur les bords gauche et droit du viewport sur l'écran d'accueil (fond de `body` visible). **P2** : `body { background: var(--cream) }`.

---

## (a) TOP 15, classé par impact sur la rétention et la première minute

1. **O2** : onboarding ramené à 4 écrans, le reste en cartes-questions dans le deck (P0, M).
2. **S1** : plus de viande ni de fruits de mer en photo pour un végétarien (P0, M).
3. **S2** : humeur par défaut « Surprends-moi », pas « Tour en Asie » (P0, S).
4. **O1** : brouillon d'onboarding qui survit au rechargement (P0, S).
5. **S3 + S4** : mise en page de carte robuste (4 badges, 320 px, paysage) (P0, M).
6. **S6 + P1** : retirer « Partenaire Fooder », notes et avis inventés, et l'avantage « café offert » affiché comme acquis (P0, S).
7. **S5** : vraie fin de paquet « Tu as tout swipé ! » avec compteur et CTA (P0, S).
8. **F1** : boutons MIAM / BOF dans la fiche (P0, S).
9. **M1** : la carte affiche les vrais coups de cœur et les vraies fiches (P0, M).
10. **FE1** : mes visites en tête du Fil (P0, S).
11. **A2** : sélection du groupe qui respecte régime et écartés (P0, S).
12. **S11 + W3 + A1** : feedback au doigt (tampon MIAM), compteur d'XP animé, célébration de niveau (P1, S).
13. **Texte jamais posé sur le motif** : conteneur opaque pour tous les états vides et messages (P1, S).
14. **L1 + L2 + L3** : légal complété, 404 de marque, page publique `/resto` qui convertit (P0/P1, S).
15. **F2 + S12 + S9** : retour navigateur, Échap et flèches du clavier qui ferment ou agissent comme attendu (P1, S).

## (b) 10 moments « waouh » absents (sans fausses données)

1. **Révélation du profil goût** à la fin de l'onboarding : les 6 tuiles choisies s'envolent et fusionnent en sticker d'archétype (« Explorateur Umami »), en 1,2 s, partageable.
2. **Tampon MIAM au doigt** : le tampon grossit avec le drag, puis s'écrase sur la carte au relâchement avec une vibration de 50 ms.
3. **Cœur qui vole vers Favoris** : au like, un cœur suit une courbe jusqu'à l'onglet, le badge passe de 2 à 3 avec un rebond.
4. **Match du jour** : au 10e like, une carte dorée « Ton match du jour » choisie parmi tes likes ouverts maintenant (données réelles : horaires OSM + distance).
5. **Fin de paquet en récap** : « 12 swipes, 4 MIAM, ton trio du soir » avec les 3 vignettes et « Y aller » sur le plus proche ouvert.
6. **Montée de niveau plein écran** : barre qui se remplit, médaillon du nouveau niveau qui tourne et trophée de mascotte débloqué (les mascottes existent déjà).
7. **Compte à rebours de série** dans le Profil : « Plus que 2 jours pour garder ta série de 3 semaines », avec une flamme qui faiblit visuellement.
8. **Food Match animé** : 0 → 100 % en 900 ms, les restos communs apparaissent un par un comme des cartes distribuées.
9. **Ouverture du défi à l'aveugle sur place** : grattage façon ticket pour révéler le nom quand on est à moins de 100 m (géoloc réelle, opt-in).
10. **Première photo publiée** : la photo remplace l'illustration de la carte sous les yeux de l'utilisateur (fondu croisé), avec « +30 XP · Tu es le premier à photographier ce plat ».

## (c) Ce qui est déjà excellent (ne pas toucher)

- L'**identité Bubbly Maximalism** : logo rose 3D, ombres dures, stickers, boutons à ombre décalée. Cohérente partout, mémorable.
- L'**écran d'accueil** (« Swipe. Mange. Répète. ») et la **grille de cuisines illustrée**.
- Les **boutons ✕ / ♥ massifs** et le **bouton d'annulation** fiable (likes, wishlist et check-in correctement retirés).
- Le **jackpot rare** (10 %) : vraie surprise à récompense variable, bien dosée.
- Les **horaires de la fiche** avec le jour surligné, et la **section Régimes sourcée** (« à confirmer avec le restaurant »).
- **Ton vendredi Fooder** dans les Favoris.
- La **feuille de check-in** MIAM/BOF + photo + mot, et la **série hebdomadaire** (pas quotidienne, donc tenable).
- Le **Food Match par lien** (aucune donnée envoyée au serveur, avertissement anti-usurpation) et le **défi à l'aveugle**.
- La **transparence** : pastille « démo » dans le Fil, « Comptes bientôt disponibles, rien n'est perdu », « Classement indisponible ».
- Le **fond de carte** stylé crème/jaune avec épingles stickers et le vol vers l'épingle.
- L'**anneau de focus** clavier visible et la prise en charge de « réduire les animations ».

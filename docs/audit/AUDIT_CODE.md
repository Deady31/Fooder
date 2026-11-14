# FOODER — Audit UX, animations et qualité front, fait par lecture du code

Date : 13/11/2026. Méthode : lecture seule de `app/**`, `components/**`, `hooks/**`, `lib/**`, `app/globals.css`, `tailwind.config.js`, `next.config.js`, `package.json`, avec des inventaires par grep. Aucun serveur lancé, aucun service externe appelé. Les numéros de ligne correspondent à l'état du dépôt au commit `4409d26`, avec les fichiers non suivis présents à ce moment-là.

Légende. **P0** : bloque l'objectif « produit fini », visible par tout utilisateur. **P1** : défaut net, à corriger avant le lancement. **P2** : finition ou dette. Effort : **S** < 2 h, **M** ½ à 1 jour, **L** > 1 jour.

---

## 0. Synthèse : les 12 points qui comptent le plus

| # | Prio | Constat | Où |
|---|---|---|---|
| 1 | P0 | Le deck de swipe reste bloqué sur l'écran de chargement tant que l'utilisateur n'a pas répondu à la demande de géolocalisation (`await getCoords()` passe avant tout le reste) | `app/(app)/swipe/page.tsx:208-216` |
| 2 | P0 | La couleur `lemon` n'existe pas dans Tailwind : 9 éléments n'ont pas de fond, **dont tous les toasts** (récompenses XP photo, messages de partage) | `tailwind.config.js:11-21`, `components/ui/Toast.tsx:24` et 8 autres usages |
| 3 | P0 | Aucun passage de niveau n'est célébré. `gainXP` change le niveau sans rien afficher, et `awardXp` ne fait qu'ajouter une ligne dans la cloche | `hooks/useGamification.ts:113-121`, `lib/rewards.ts:21-35` |
| 4 | P0 | Les missions quotidiennes ne sont visibles nulle part, leur XP n'est jamais versée et `progress()` renvoie toujours `null` | `hooks/useMissions.ts:60-75`, `app/(app)/swipe/page.tsx:288-311` |
| 5 | P0 | La carte n'affiche que les 8 restos de démonstration : les coups de cœur pris dans les données OSM (presque tous) n'y apparaissent jamais | `app/(app)/map/page.tsx:30` |
| 6 | P1 | Les timers des célébrations sont relancés à chaque rendu parent (callbacks `onDone` recréés à chaque rendu). Le toast de trophée ne disparaît pas tant qu'on swipe, et les succès simultanés s'écrasent | `app/(app)/swipe/page.tsx:578,603,606`, `hooks/useGamification.ts:154` |
| 7 | P1 | Retour à l'onglet Découvrir = nouveau chargement complet (géoloc, API, Supabase) et position dans le deck perdue | `app/(app)/template.tsx`, `app/(app)/swipe/page.tsx:197-241` |
| 8 | P1 | Les feuilles et modales n'ont ni `role="dialog"`/`aria-modal`, ni piège de focus, ni Échap, ni fermeture par le geste retour Android (seule la Lightbox est correcte) | DetailSheet, FilterSheet, MoodSheet, ComposeSheet, NotificationBell, CheckinSheet, CasinoOverlay |
| 9 | P1 | Plusieurs actions asynchrones ne sont pas verrouillées : ajout d'ami (XP comptée 2 fois), publication pendant l'animation de sortie, envoi de défi (XP à volonté) | `amis/ajouter/page.tsx:53`, `ComposeSheet.tsx:247`, `DefiComposer.tsx:69-72` |
| 10 | P1 | Compteur de « miam » d'un post en ligne compté deux fois (le serveur inclut déjà mon cœur et le client ajoute +1) | `components/feed/PostCard.tsx:24`, `lib/cloud/social.ts:250-263` |
| 11 | P1 | Contrastes insuffisants : étiquettes inactives de la barre d'onglets 3,9:1, horodatages `plum/40` 2,5:1, tampon/verdict MIAM `#12B76A` 2,4:1, `slate-400` 2,6:1 | voir §5 |
| 12 | P1 | La CheckinSheet n'a aucune animation de sortie, et son écran de fin (« +40 XP », l'action la plus précieuse de l'app) affiche un chiffre fixe, sans compteur, sans haptique et sans confettis | `components/checkin/CheckinSheet.tsx:80,187,323-325` |

---

## 1. Animations

### Ce qui est déjà bien
- Le deck est solide : un seul ressort de pile `STACK_SPRING` (290/28/0,9), une sortie en ease-out expo qui garde l'élan, la carte suivante qui avance (« peek ») pendant le drag, des tampons MIAM/BOF indexés sur `x`, un appui long avec retour haptique (`components/swipe/SwipeDeck.tsx:22-56,73-81`).
- `MotionConfig reducedMotion='user'` (`components/Providers.tsx:19`) et la règle CSS globale pour `prefers-reduced-motion` (`app/globals.css:167-173`). La couverture de base est donc correcte.
- La Lightbox est exemplaire (zoom, panoramique, réduction des animations, focus) et peut servir de référence pour les autres overlays.

### Constats

| ID | Prio | Effort | Constat | Correction |
|---|---|---|---|---|
| A1 | P1 | S | **Annuler un swipe fait réapparaître la carte d'un coup, sans animation** : l'id est déjà dans `seen`, donc `entering=false` (`SwipeDeck.tsx:230-236`). Pour une annulation, c'est le moment où l'utilisateur a le plus besoin de voir ce qui se passe. | Exposer `undo(dir)` sur le handle : la carte revient depuis le côté de sortie (`initial={{ x: dir==='right'?600:-600, rotate: ±18 }}`) avec `STACK_SPRING`. Retirer l'id de `seen` au moment de l'annulation. |
| A2 | P1 | S | **Les boutons ♥/✕ déclenchent la sortie sans montrer la décision**. La carte part sans afficher le tampon MIAM/BOF, alors que c'est le retour visuel le plus parlant (`SwipeDeck.tsx:218-226`). | Dans `commit` via bouton : `await animate(x, dir==='right'?140:-140, {duration:.12})`, puis commit. Le tampon apparaît alors grâce à `likeOpacity`. |
| A3 | P1 | S | **Les propriétés de mise en page sont animées** : barre d'XP du profil `width` (`profile/page.tsx:157-162`), exploration `width` (`:406-411`), barre d'onboarding `width` et étincelle `left` (`components/onboarding/StepProgress.tsx:60-64,75-79`), maintien sur la carte `width` à chaque frame (`components/swipe/RestaurantCard.tsx:22,26`), commentaires `height:auto` (`PostCard.tsx:120-124`, `FriendRow.tsx:38`). | Passer par `scaleX` avec `origin-left` (`style={{ scaleX: progress }}`) pour les barres. Pour l'étincelle, utiliser `x` en pourcentage du conteneur (`useTransform` → `translateX`). Garder `height:auto` seulement pour les petits blocs. |
| A4 | P1 | M | **Il n'y a pas de transition de page, seulement une entrée** : `template.tsx` fait un fondu avec y=14 en 0,28 s à chaque navigation, sans sortie (un template ne peut pas animer sa sortie). Toute la page est remontée, y compris le deck (voir P1). La même entrée sert pour un onglet frère et pour un écran enfant (Amis → Ajouter), donc aucune notion de profondeur. | Supprimer le `y` (garder un fondu de 150 ms) pour les onglets frères. Pour les écrans enfants (`/amis/ajouter`, `/classement`, `/groupe`, `/defi`), faire une entrée latérale `x: 24 → 0`. Option : la View Transitions API, avec repli sur le fondu. |
| A5 | P1 | S | **La CheckinSheet n'a pas d'animation de sortie** : le composant renvoie `null` quand `target` est nul (`CheckinSheet.tsx:80`), donc l'`AnimatePresence` interne (`:187`) est démonté avec lui. | Sortir l'`AnimatePresence` dans le parent, ou garder le composant monté et conditionner `{target && <motion.div …/>}` à l'intérieur. |
| A6 | P2 | S | **Les ressorts des feuilles ne sont pas harmonisés** : DetailSheet 26/260 avec `y:40` et fondu, FilterSheet 26/260 avec `y:100%`, MoodSheet 22/260 avec `scale:.94`, CheckinSheet 24/280 avec `scale:.95`, ComposeSheet 22/260, cloche 24/280 depuis le haut, AchievementToast 14/300 (très rebondissant). Il y a aussi 6 durées différentes (0,22 à 0,6 s). | Créer `lib/motion.ts` : `SPRING.sheet = {stiffness:320, damping:32}`, `SPRING.pop = {stiffness:500, damping:18}`, `SPRING.stack`, `EASE.outExpo`, `DUR.fast=.15/.base=.25/.slow=.4`, et l'utiliser partout. |
| A7 | P2 | S | **Il manque une continuité visuelle entre la carte et la fiche** : la DetailSheet arrive par en bas comme un écran indépendant (`DetailSheet.tsx:149-154`), alors que l'utilisateur vient de toucher la photo de la carte. | Mettre un `layoutId={'photo-'+rest.id}` sur la photo de la carte et le hero de la fiche, encapsulé dans `LayoutGroup`, pour que la photo s'agrandisse jusqu'à devenir le hero. |
| A8 | P2 | S | **La carte ne se « soulève » pas pendant le drag** : l'ombre `shadow-hard-lg` reste fixe et le `scale` ne bouge pas (`RestaurantCard.tsx:39`). | `whileDrag={{ scale: 1.02 }}` et une ombre portée par une variable CSS pilotée par `useTransform(x)`. Éviter d'animer `box-shadow` : utiliser un pseudo-élément dont on anime `opacity`. |
| A9 | P2 | S | **Trop d'animations infinies à l'écran en même temps** : `.bob` sur l'autocollant de chaque carte de la pile (3 cartes, `RestaurantCard.tsx:78`), étincelle de l'onboarding (`StepProgress.tsx:82-85`), rayures animées, pastille « moi » sur la carte. Elles tournent en continu et réveillent le GPU. | Mettre `.bob` uniquement sur la carte du dessus (`isTop`), et mettre en pause les animations infinies quand l'onglet est masqué (`animation-play-state: paused` via `document.hidden`). |
| A10 | P2 | S | **Réduction des animations** : sous `reducedMotion='user'`, la sortie de carte (transforms) est coupée net, ce qui est acceptable. En revanche, les particules de `CasinoOverlay` et `StickerBurst` restent empilées au centre (x/y désactivés, opacité conservée). | Avec `useReducedMotion()`, ne pas monter les particules du tout et garder seulement un fondu. |
| A11 | P2 | S | `HoldHint` affiche « Touche pour ouvrir » alors que la barre se remplit sur un **appui long**. Les deux gestes ouvrent la fiche (`SwipeDeck.tsx:118-132`), donc la barre animée n'a pas de raison d'être. | Soit supprimer la barre de progression, soit écrire « Touche ou maintiens ». |
| A12 | P2 | S | `buzz(8)` part à **chaque** début de toucher, swipe compris (`SwipeDeck.tsx:100`). Cela fait du bruit haptique et en dilue la valeur. | Ne vibrer qu'à la validation (commit) ou à l'ouverture. |

### Risques de saccades (jank)
- `backdrop-blur-md` sur les en-têtes collants (`components/nav/PageHeader.tsx:11`, `swipe/page.tsx:416`) et `backdrop-blur-sm` sur tous les fonds de modale. C'est coûteux sur un Android d'entrée de gamme. **P2, S** : passer à `bg-cream` opaque pour les en-têtes et à `bg-plum/70` sans flou pour les fonds de modale, ou appliquer le flou seulement si `@supports` et que l'appareil n'est pas en économie d'énergie.
- `SwipePage` (609 lignes) se re-rend en entier toutes les minutes à cause de deux intervalles : `now` (`:114`) et `useDailyPicks` (compte à rebours inutile, `hooks/useDailyPicks.ts:50-63`). `DeckCard` et `RestaurantCard` ne sont pas mémoïsés, et `RestaurantCard` recalcule `new Date()` et `cardSummary` à chaque rendu (`:34-36`). **P2, S** : `React.memo(DeckCard)` avec des callbacks stables (`useCallback`), et `now` passé en prop.
- `useSocial` recharge **tout** (amis, groupes, défis, visites, carte perso) à chaque `STORE_EVENT`, quelle que soit la clé, XP comprise (`hooks/useSocial.ts:53-56`). **P2, S** : filtrer `e.detail` sur les clés qui concernent le hook.
- `will-change` n'est jamais déclaré explicitement. Ce n'est pas nécessaire, Framer le gère pendant les animations. À ne pas ajouter de façon globale.

---

## 2. Retours « dopamine »

### Carte des retours actuels

| Action | Visuel | Haptique | Son | XP visible | Manque |
|---|---|---|---|---|---|
| Swipe droite (j'aime) | Tampon, StickerBurst, badge de l'onglet Favoris | 50 ms | aucun | **non** (+5/+15 XP silencieux) | « +15 XP » qui flotte vers le profil, compteur de série du jour |
| Swipe gauche | Tampon BOF | aucun | aucun | non (+5) | micro-retour haptique de 10 ms |
| Passage de niveau | **rien** (cloche seulement) | non | non | non | écran plein « Niveau 4 ! » avec la mascotte débloquée et l'avantage (PERKS) |
| Succès | Toast sur /swipe uniquement | non | non | — | file d'attente, toast global sur toutes les pages, haptique |
| Mission accomplie | **rien** (missions invisibles) | non | non | jamais versée | carte « Missions du jour » et célébration |
| Visite (check-in) | « +40 XP » fixe | non | non | oui | compteur animé, confettis, série qui s'allume |
| Photo publiée | Toast (sans fond, voir P0) | non | non | toast | animation polaroïd, « +30 XP » |
| Like d'un post | Cœur à ressort (bien) | non | non | — | petit éclat de cœurs, haptique de 10 ms |
| Ajout d'ami | Texte « +25 XP » | non | non | texte | avatars qui se rejoignent, haptique |
| Défi envoyé | Toast | non | non | non | — |
| Classement | Podium (statique) | — | — | — | animation « tu gagnes N places » quand le rang progresse |
| Jackpot (10 % au 1er like) | Plein écran avec particules | oui | non | — | bouton d'action (« Voir la fiche », « Y aller ») |

### Constats

| ID | Prio | Effort | Constat | Correction |
|---|---|---|---|---|
| D1 | P0 | M | **Aucune célébration de passage de niveau.** C'est pourtant le plus fort levier de rétention d'un produit gamifié, et `LEVEL_THRESHOLDS`, `PERKS` et `AvatarPicker` (mascottes par niveau) existent déjà. | Créer `lib/celebrations.ts` (bus d'événements) et `components/celebrate/CelebrationHost.tsx`, monté dans `app/(app)/layout.tsx`. `awardXp` et `gainXP` émettent `{type:'level', level}` quand `computeLevel(after) > computeLevel(before)`. Le host affiche un plein écran avec ressort, compteur `AnimatedNumber`, la mascotte débloquée, le prochain avantage et une haptique `[30,40,60]`. |
| D2 | P0 | M | **Les missions ne servent à rien en l'état** : 8 modèles, progression écrite dans le stockage, mais aucun affichage, aucune récompense, et `progress()` lit `completed` avant que l'updater ait tourné : en React 18 les mises à jour sont regroupées, donc la valeur vaut toujours `null` (`hooks/useMissions.ts:60-75`). | Soit les supprimer (hook, appels dans `swipe/page.tsx:85,288-311,326,375`), soit les finir : calculer `next` hors de l'updater (lire `missionsRef`), écrire, `setMissions(next)`, puis si une mission est terminée → `awardXp(m.xpReward)` et `emit({type:'mission', …})`. Ajouter une puce « 2/3 missions » dans l'en-tête de /swipe qui ouvre une feuille. |
| D3 | P1 | S | **Les gains d'XP liés au swipe sont invisibles** (`swipe/page.tsx:286,307`). | Émettre `{type:'xp', amount}`. Le host affiche un « +15 » en `font-display` qui monte de 40 px et disparaît en 600 ms près du bouton ♥. Regrouper les gains successifs en moins de 800 ms (« +20 »). |
| D4 | P1 | S | **Le toast de succès n'existe que sur /swipe** (`swipe/page.tsx:606`). Les succès débloqués ailleurs via `unlockAchievement` (ami, visite, photo, groupe, défi : `lib/rewards.ts:38-46`) ne finissent que dans la cloche. | `unlockAchievement` et `unlock` émettent `{type:'achievement', id}`. Le `CelebrationHost` global les affiche partout. Retirer `AchievementToast` de la page swipe. |
| D5 | P1 | S | **Pas de file d'attente : les célébrations s'écrasent.** Au premier like, `first_swipe` puis `first_like` sont débloqués dans le même événement et seul le second s'affiche (`useGamification.ts:131`). Le jackpot, le burst et le toast peuvent aussi s'empiler. | Une file FIFO dans `CelebrationHost` avec priorités (niveau > jackpot > succès > XP), 1 élément plein écran à la fois et un délai de 250 ms entre deux éléments. |
| D6 | P1 | S | **Le check-in, la meilleure action de l'app, est célébré a minima** : un « +{xp} XP » fixe (`CheckinSheet.tsx:325`). | `<AnimatedNumber value={done.xp} prefix='+' />`, une `StickerBurst` centrée, `haptic('success')`, une flamme de série qui « s'allume » (scale 0→1,2→1 et changement de couleur) quand `newWeek` est vrai. |
| D7 | P1 | S | **Aucune haptique sur iOS** : `navigator.vibrate` n'existe pas sur Safari iOS. Les appels sont dispersés dans 5 fichiers (`SwipeDeck.tsx:47`, `swipe/page.tsx:301`, `CasinoOverlay.tsx:33`, `map/page.tsx:52`). | Créer `lib/feedback.ts` avec `haptic('tap'|'success'|'level'|'error')`. En repli : un son court optionnel (Web Audio, 30 ms, désactivé par défaut, réglage dans Profil) et un micro-retour visuel (scale 0,96). Respecter `prefers-reduced-motion`. |
| D8 | P2 | S | Le jackpot n'a pas de bouton d'action : « C'est TON restaurant du destin », puis rien (`CasinoOverlay.tsx:70-76`). | Ajouter deux boutons, « Voir la fiche » (ouvre la DetailSheet) et « Y aller ». Proposer d'ajouter le resto aux défis de la semaine. |
| D9 | P2 | S | La série quotidienne (`fooder_streak`, succès `streak_3/7/30`, « jours consécutifs ») cohabite avec la série **hebdomadaire** de visites affichée dans le profil. Deux notions portent le même nom et la série quotidienne n'est affichée nulle part (`useGamification.ts:22-24,65-85` contre `profile/page.tsx:140-149`). | Garder une seule série (hebdomadaire = visites) et renommer les succès, ou afficher les deux avec des noms différents (« Jours actifs » / « Semaines de série »). |
| D10 | P2 | S | Barre d'XP du profil : elle part de 0 à chaque visite (`initial={{width:0}}`) au lieu de partir de la dernière valeur vue. Cela ne montre pas le gain. | Mémoriser `lastSeenXp` dans le stockage local, animer de l'ancienne valeur vers la nouvelle et afficher « +35 XP depuis ta dernière visite ». |
| D11 | P2 | S | Classement : pas d'effet quand le rang progresse. Le rang épinglé est du texte statique (`classement/page.tsx:137-142`). | Mémoriser le dernier rang et afficher « ↑ 3 places » avec un `AnimatedNumber`. |
| D12 | P2 | M | Récompenses variables : le seul aléa est le jackpot (10 % au 1er like). | Ajouter un « coffre » au 10e swipe du jour (XP aléatoire entre 10 et 50) et un bonus surprise sur le 3e check-in du mois. Toujours plafonné et sans pénalité. |

---

## 3. États

| ID | Prio | Effort | Constat | Correction |
|---|---|---|---|---|
| E1 | P0 | S | **Le chargement attend la géolocalisation.** `loadAppData` attend `getCoords()` avant tout (`swipe/page.tsx:208-216`). Le `timeout: 5000` ne démarre qu'**après** l'acceptation : tant que la demande système reste ouverte, l'écran « On cherche des pépites… » reste affiché indéfiniment, alors que les 8 fiches de démonstration sont déjà disponibles. | Afficher tout de suite les fiches de démonstration et une première page API sans coordonnées. Lancer la géoloc en parallèle, puis remplacer les cartes non vues par la page géolocalisée quand les coordonnées arrivent. Mettre un `Promise.race` avec un délai de 3 s **pour l'affichage**. |
| E2 | P1 | S | **Le chargement attend aussi Supabase** : `await fetchRestaurantPhotoDetails(...)` sur plus de 50 ids avant la première carte (`:227`). | Afficher la pile, puis enrichir les photos de la communauté en arrière-plan (setState fusionné, sans toucher à la carte du dessus si elle est en cours de drag). |
| E3 | P1 | S | **Géolocalisation refusée : rien n'est dit.** Les distances sont calculées depuis le centre de Toulouse, donc « 300 m » est trompeur (`lib/osm.ts:107`, puce distance dans `RestaurantCard.tsx:89-92`). | Mettre un indicateur `geo: 'ok'|'denied'|'pending'`. Si l'accès est refusé : un bandeau discret « Distances depuis le Capitole · Activer » et des puces au format « ~1,2 km du centre ». |
| E4 | P1 | M | **Pas de mise en cache du deck** : chaque retour sur /swipe relance géoloc, API et Supabase et réaffiche le loader (le template remonte la page). | Créer un store de module `lib/deckStore.ts` (pile, index, coordonnées, horodatage) réutilisé s'il a moins de 10 min, plus `sessionStorage` en secours. |
| E5 | P1 | S | **Hors ligne et erreurs muets.** `loadMore` avale tout (`:190`). ComposeSheet affiche « Aucun résultat » quand le réseau est coupé (`ComposeSheet.tsx:69-71,163`). Les partages (`navigator.share`) refusés produisent des rejets non gérés (`profile/page.tsx:89-93`, `wishlist/page.tsx:80-87`). | Un hook `useOnline()` et un bandeau « Hors ligne : tes actions sont gardées ici ». Recherche : un état `error` distinct de l'état vide. Partage : passer par `lib/share.shareLink` (qui gère déjà les cas) partout et afficher « Lien copié ». |
| E6 | P1 | S | **Écrans vides pendant le chargement** : `app/page.tsx:15` renvoie `null`, l'onboarding affiche un `div` crème (`onboarding/page.tsx:100`), Ajouter un ami un `div` vide (`amis/ajouter/page.tsx:90`). Un utilisateur qui revient fait `/` → `/onboarding` → `/swipe` : deux redirections et deux écrans vides. | Faire la redirection dans `middleware.ts` ou un composant serveur avec cookie `onboarded=1`, ou au minimum afficher un logo animé. Ajouter un squelette de carte (forme de la RestaurantCard, avec un shimmer en `opacity` uniquement). |
| E7 | P1 | S | **Doubles clics et actions non verrouillées** : `add()` ajout d'ami, sans `busy`, ce qui donne +25 XP en double (`amis/ajouter/page.tsx:53-79`). « Publier » reste cliquable pendant l'animation de sortie de la feuille (`ComposeSheet.tsx:91-96,247`). Envoi de défi : +10 XP à chaque copie du lien, **sans plafond** (`DefiComposer.tsx:69-72`). Partages en double (`InvalidStateError`). | Un `busy` local et `disabled` sur les boutons. Pour les défis : passer par le registre `createRewardLedger` (`components/swipe/rewardLedger.ts`, déjà présent) avec une clé par défi et un plafond quotidien. |
| E8 | P1 | S | **Suppression sans confirmation ni annulation** : la poubelle des Favoris (`wishlist/page.tsx:176-182`), « Tout effacer » dans les notifications (`NotificationBell.tsx:121`), la suppression d'un post (`PostCard.tsx:112`). | Un toast « Retiré · Annuler » pendant 5 s, avec l'état précédent gardé en mémoire. C'est le modèle de `undoLast`, déjà en place sur le swipe. |
| E9 | P2 | S | Filtres : 4 systèmes cohabitent (humeur, régime, ouvert maintenant, budget + cuisine dans FilterSheet). `applyFilters` **supprime** les restos de la pile et ne revient pas en arrière, rien n'est mémorisé, et le libellé « All » est en anglais (`swipe/page.tsx:243-252,392`). Le budget par défaut (50) ignore le budget choisi à l'onboarding. | Intégrer budget et cuisine dans `lib/filters.applyFilters` (filtres non destructifs, comme « ouvert maintenant »), les mémoriser, les initialiser depuis le profil, et remplacer « All » par « Toutes ». |
| E10 | P2 | S | Première utilisation : aucune explication du geste sur la première carte. | Au 1er affichage (drapeau en stockage local) : la carte du dessus oscille de ±30 px avec les tampons visibles (`card-wobble` existe déjà, `globals.css:149-153`), et un texte « Glisse à droite si ça te tente ». |
| E11 | P2 | S | Noms longs : bien gérés sur la carte (`line-clamp-2`), les posts (`break-words`) et le profil (`truncate`). En revanche, le titre de la DetailSheet n'a pas de limite (`DetailSheet.tsx:180`) et peut pousser la puce de note. | `line-clamp-3` et `min-w-0` sur le titre. |

---

## 4. Performance

| ID | Prio | Effort | Constat | Correction |
|---|---|---|---|---|
| F1 | P1 | M | **/swipe pèse environ 253 kB de JS au premier chargement.** Contributeurs probables, à confirmer avec `@next/bundle-analyzer` : `framer-motion` complet (`motion.*` utilisé partout), `@supabase/supabase-js` chargé statiquement par `AuthProvider` dans le layout et par `lib/cloud/social.ts`, `data/mockRestaurants.ts` (15 ko), et `data/dishPhotos.json` (40 ko) via `lib/dishes.ts` ← `lib/osm.ts`. | 1) `LazyMotion` + `m` avec `domAnimation` (gain d'environ 20 ko gzip, mais beaucoup de fichiers touchés, donc lot dédié). 2) `import()` dynamique de Supabase dans `lib/cloud/client.ts` (le client est déjà paresseux, il ne faut pas que le type `RealtimeChannel` entraîne le runtime). 3) Le manifeste des plats côté serveur seulement. Objectif : ≤ 200 kB. |
| F2 | P2 | S | **`data/toulouse-places.json` (1,2 Mo)** : importé côté serveur par 4 routes API et `resto/[id]`, ce qui est correct (filtrage au chargement du module). Mais **`app/(app)/feed/page.tsx:46` fait un `import()` côté client** du fichier entier pour retrouver nom et cuisine d'un seul id quand on arrive avec `?photo=`. | Créer `/api/restaurants/[id]` (ou réutiliser `resto/[id]`) qui renvoie `{id,name,cuisine}`. |
| F3 | P1 | M | **Images** : 15 `<img>` sans `width`/`height` ni `loading="lazy"`, aucune `next/image`. La photo de la carte du dessus (le LCP de /swipe) n'a pas `fetchpriority="high"` (`components/ui/FoodImage.tsx:24-25`). La galerie de la fiche n'a ni lazy ni dimensions (`DetailSheet.tsx:274-280,303-308`). Les 1 254 photos de `public/restaurant-photos` (90 Mo, JPEG de 72 ko en moyenne, jusqu'à 270 ko), pas encore branchées, sont prêtes à devenir un problème. | `FoodImage` : props `priority`, `sizes`, et `decoding="async"`. `loading="lazy"` sauf pour la carte du dessus. Convertir les photos en WebP/AVIF à 640 px et 1 080 px avec `srcset` (le script `scripts/convert-photos.ps1` existe déjà). Précharger l'image de la carte n°2 quand la n°1 est affichée (`new Image().src`). |
| F4 | P2 | S | **Autocollants** : 62 WebP de 33 ko en moyenne (jusqu'à 54 ko), affichés entre 30 et 104 px. Le premier `StickerBurst` charge 7 fichiers au moment du like : les autocollants apparaissent en retard la première fois. | Produire des versions en 128 px (environ 5 ko) et précharger les 7 du premier burst au montage de /swipe. Option : une planche (sprite) unique. |
| F5 | P2 | S | Polices : `Bagel_Fat_One` + `DM_Sans` via `next/font` (auto-hébergées, `display: swap` par défaut). C'est correct. `DM_Sans` sans `weight` charge la police variable, ce qui est acceptable. Rien à faire, à part vérifier que `font-weight: 400 !important` sur `h1-h3` (`globals.css:58`) ne contredit pas le design. | — |
| F6 | P1 | S | **Timers recréés à chaque rendu** : `AchievementToast` (`useEffect([achievement,onDone])`, avec `clearNewAchievement` non mémoïsé, `useGamification.ts:154`), `StickerBurst` (`onDone` en ligne, `swipe/page.tsx:578`) et `CasinoOverlay` (`:603`). À chaque re-rendu de `SwipePage`, ce qui arrive à chaque swipe, le délai repart de zéro : le toast reste affiché tant qu'on swipe et le burst reste monté. | `clearNewAchievement = useCallback(...)`, `onDone` stabilisé par `useCallback`, ou une ref `onDoneRef` dans les composants. |
| F7 | P2 | S | **Timers jamais annulés** : `RitualsRunner.tsx:65` (`setTimeout(setPrompt,1400)`), `profile/page.tsx:464` et `map/page.tsx:131` (`setTimeout` dans `onAnimationComplete`, appelé aussi à la sortie), `SwipeDeck.tsx:110,127`. | Garder les ids dans des refs et les annuler au démontage. |
| F8 | P2 | S | **Code mort exécuté** : `useDailyPicks` (tri, écriture en stockage, intervalle chaque minute, résultat inutilisé, `swipe/page.tsx:84`), `haversineDistance`/`formatDistance`/`userCoords` (`:41-53,78,211`), `lib/googlePlaces.ts` (importé nulle part), et les dépendances `@react-spring/web`, `react-tinder-card`, `@googlemaps/js-api-loader` (aucun import). | À supprimer. |
| F9 | P2 | S | Confidentialité et cache : les coordonnées exactes de l'utilisateur sont envoyées dans l'URL `/api/restaurants?lat=…&lng=…` (`swipe/page.tsx:161-165`), ce qui donne un cache CDN différent pour chaque position. | Arrondir à 3 décimales (environ 100 m) : meilleur taux de cache et moins de données personnelles dans les journaux. |

---

## 5. Accessibilité

### Contrastes calculés (WCAG 2.x, luminance relative)

| Paire | Ratio | Usage | Verdict |
|---|---|---|---|
| plum `#2B0F3A` sur cream `#FFF6E5` | **15,9:1** | texte courant | ✅ |
| blanc sur violet `#6C2BFF` | **6,1:1** | puces de cuisine, boutons principaux | ✅ |
| plum sur bubblegum `#FF7EC8` | **7,4:1** | bouton J'aime, badges | ✅ |
| plum/55 sur cream (≈ `#8A7787`) | **3,9:1** | étiquettes inactives de la TabBar, 11 px (`TabBar.tsx:76`) | ❌ (seuil 4,5) |
| slate-500 `#64748B` sur cream | **4,4:1** | sous-titres de 11-12 px | ❌ (de peu) |
| plum/40 sur cream (≈ `#AA99A1`) | **2,5:1** | horodatages, mentions de 10 px (`NotificationBell.tsx:112`, `PostCard.tsx:133`) | ❌ |
| slate-400 `#94A3B8` sur blanc | **2,6:1** | nombre d'avis (`DetailSheet.tsx:193`), poubelle | ❌ |
| `#12B76A` sur cream ou blanc | **2,4 à 2,6:1** | tampon MIAM, verdict MIAM (`SwipeDeck.tsx:196`, `CheckinSheet.tsx:38`) | ❌ même pour du grand texte (3:1) |
| fooder-red `#FF3D8B` sur cream | **3,1:1** | tampon BOF (grand texte) | ⚠️ tout juste |
| blanc sur fooder-red | **3,3:1** | puce « Fermé » de la fiche | ❌ |
| fooder-orange `#FF8A1F` sur blanc | **2,4:1** | libellé sponsor de 11 px (`DetailSheet.tsx:196`) | ❌ |

| ID | Prio | Effort | Constat | Correction |
|---|---|---|---|---|
| X1 | P1 | S | Contrastes du tableau ci-dessus. | Ajouter des tokens `plum-muted: #5E4A66` (environ 7:1 sur cream), `success: #0B7A47` (environ 5:1), `danger: #C4105E` (environ 5,6:1 sur blanc). Remplacer `plum/40-55`, `slate-400`, `#12B76A` et `text-fooder-orange` sur blanc. Garder les couleurs vives pour les **fonds** et les **contours**. |
| X2 | P1 | M | **Modales** : seules la Lightbox (`Lightbox.tsx:266-267`, focus, Échap, Tab) et en partie CheckinSheet, ConsentBanner, InstallPrompt et DefiComposer (`role="dialog"` sans `aria-modal`) sont annoncées. DetailSheet, FilterSheet, MoodSheet, ComposeSheet, le panneau de la cloche, AvatarPicker et CasinoOverlay n'ont ni rôle, ni focus initial, ni piège de focus, ni Échap, ni retour du focus au déclencheur. | Une primitive `components/ui/Sheet.tsx` reprenant la logique de la Lightbox : `role="dialog" aria-modal aria-labelledby`, focus sur le titre, Tab bouclé, Échap, `history.pushState` pour fermer au geste retour, `inert` sur `#app-root` pendant l'ouverture, retour du focus au déclencheur, et une animation de sortie unifiée. |
| X3 | P1 | S | **Cibles tactiles < 44 px** : poubelle des Favoris (icône de 16 px sans zone autour, `wishlist/page.tsx:176-182`), puces d'action des Favoris « Y aller », « Détail », partage (environ 28 px, `:202-229`), bouton retour de l'onboarding (36 px, `onboarding/page.tsx:108-110`), fermeture de la CheckinSheet (40 px, `:214`), retrait de photo (36 px, `:259`), bouton agrandir de la fiche (36 px, il est vrai couvert par le bouton plein écran). | `min-w-11 min-h-11` (avec padding si besoin), ou une zone de toucher élargie via `before:absolute before:-inset-3`. |
| X4 | P1 | S | **Éléments interactifs sans sémantique** : les `<li onClick>` de la cloche ne sont pas atteignables au clavier (`NotificationBell.tsx:99-106`). Les images de la galerie de la fiche ont `onClick` sans être des boutons (`DetailSheet.tsx:274-280`). Les onglets Profil et Favoris n'ont pas de `role="tablist"`/`aria-selected` (`profile/page.tsx:225-236`, `wishlist/page.tsx:100-117`), alors que le Classement le fait correctement. | Utiliser `<button>` ou `<Link>` à l'intérieur des `li`, et appliquer le motif tablist du Classement. |
| X5 | P2 | S | `focus-visible` n'est stylé que dans l'admin. Ailleurs, c'est l'anneau par défaut du navigateur, souvent masqué par les bordures de 3 px. | Ajouter dans `globals.css` : `:focus-visible { outline: 3px solid var(--violet); outline-offset: 3px; }`. |
| X6 | P2 | S | Annonces : le passage de carte n'est pas annoncé aux lecteurs d'écran. Le compteur de restos a `aria-live`, ce qui est bien. Les galeries ont un alt générique « plat ». La page /swipe n'a pas de `h1` (le logo est une image). | Une région `aria-live="polite"` « J'aime : {nom}. Carte suivante : {nom} ». `alt={`Plat chez ${rest.name}`}`. Un `h1` masqué visuellement « Découvrir ». |
| X7 | P2 | S | `body { user-select:none }` (`globals.css:32-33`) empêche de copier une adresse ou un numéro de téléphone dans la fiche. | Rétablir `select-text` sur l'adresse, le téléphone, les horaires et les descriptions. |
| X8 | ✅ | — | `<html lang='fr'>`, autocollants en `alt=''`, `aria-label` sur les boutons d'icône (en général), `aria-pressed` sur les filtres, `role=progressbar` sur l'onboarding, épingles de carte en `<button aria-label>` (`MapView.tsx:26-29`). | — |

---

## 6. Cohérence du design system

| ID | Prio | Effort | Constat | Correction |
|---|---|---|---|---|
| S1 | P0 | S | `bg-lemon` / `bg-lemon/70` / `bg-lemon/90` utilisés 9 fois alors que la couleur n'existe pas : `Toast.tsx:24`, `profile/page.tsx:467`, `PostCard.tsx:48,76,106`, `ConsentSettings.tsx:21,24`, `HelpStep.tsx:28`, `InviteCard.tsx:88`. Les toasts n'ont pas de fond, l'étape « De l'XP à chaque photo » de l'onboarding non plus. | Ajouter `lemon: '#FFD83D'` dans `tailwind.config.js` (même valeur que `fooder-secondary`), puis harmoniser sur un seul nom. |
| S2 | P1 | M | **Deux jeux de noms pour la même palette** : `cream/plum/bubblegum` contre `fooder-*`, plus les variables CSS `--lemon/--violet/--mint`, en double. Il y a aussi `fooder-beige` qui duplique `cream`. Des couleurs en dur contournent les tokens : `#2B0F3A` (14 fichiers, `shadow-[2px_2px_0_#2B0F3A]` alors que `shadow-hard-sm` existe), `#12B76A`, `#F04438`, `accent-[#2B0F3A]`. | Une seule source : des variables CSS dans `:root`, mappées dans Tailwind (`colors: { plum: 'rgb(var(--plum) / <alpha-value>)' }`), avec des noms sémantiques (`success`, `danger`, `muted`). Supprimer les alias. Mettre une règle ESLint `no-restricted-syntax` sur `#[0-9A-F]{6}` dans les `className`. |
| S3 | P2 | S | **Rayons** : la config redéfinit `xl/2xl/3xl` (12/16/24), et on trouve aussi `rounded-[22px]`, `[24px]`, `[26px]`, `[28px]` (19 fois), `[32px]`. Cela fait 8 rayons pour 3 types de surfaces. | Créer `radius.card = 28px` (cartes, feuilles), `radius.panel = 22px` (panneaux internes), `radius.chip = full`, et remplacer les valeurs arbitraires. |
| S4 | P2 | S | **Composants dupliqués** : le bouton rond d'en-tête `w-11 h-11 bg-white border-[3px] border-plum rounded-full … shadow-hard` est copié environ 15 fois. La « carte lien » (Classement, Amis, Groupe) est copiée 4 fois. `readJson`/`writeJson` sont redéfinis dans `hooks/useFeed.ts:13-29`, sans `STORE_EVENT` : le reste de l'app n'est pas informé. Le like est écrit de 3 façons différentes (`swipe/page.tsx:254-259,297-300`, `lib/likes.ts`, `wishlist/page.tsx:63-74`), avec ou sans liste de souhaits, file de check-in et événement. | Créer `components/ui/IconButton.tsx` et `LinkCard.tsx`. Faire de `lib/likes.ts` la seule source (like, retrait, liste de souhaits, file de check-in, événement), et supprimer la clé redondante `fooder_wishlist`. |
| S5 | P2 | S | **Microcopie : franglais et vouvoiement.** On trouve en anglais « Food DNA », « Wrapped », « Food Match », « Street & Fast », « Slow morning », « Swipe addict », « Street Foodie », « Gastro Hunter », « Lucky Foodie », « JACKPOT FOODIE », « All », et le titre « Fooder - Swipe your Food ». Le vouvoiement apparaît dans « Découvrez ce restaurant et laissez-vous surprendre » (`DetailSheet.tsx:214`) et « Trouvez votre prochain restaurant » (`app/layout.tsx:12`), alors que tout le reste tutoie. Le vocabulaire flotte : « Favoris » (onglet), « Coups de cœur » (liste), « wishlist » (route et clé) ; « Trophées » contre « succès » ; « Découvrir » contre « Swiper ». | Rédiger un lexique (garder Fooder, swipe, MIAM et BOF comme marqueurs de marque, franciser le reste : « ADN food », « Ton bilan », « Compatibilité », « Lève-tôt »). Passer tout au tutoiement et renommer la route `/wishlist` en `/favoris` (avec une redirection). |
| S6 | P2 | S | Icônes : lucide partout (c'est cohérent), mais `strokeWidth` vaut 2, 2,5, 3, 3,5 ou 4 selon les fichiers. Les émojis de `ALL_ACHIEVEMENTS` et des missions ne sont pas utilisés (ce sont les autocollants qui s'affichent). | Garder 2,5 par défaut et 3 pour les icônes de 16 px ou moins. Supprimer le champ `emoji`. |
| S7 | P2 | S | Puce de statut de la fiche : `bg-fooder-red text-white text-plum` donne deux classes de couleur contradictoires (`DetailSheet.tsx:67`). | `bg-fooder-red text-plum` (5,1:1) ou le token `danger` avec du blanc. |

---

## 7. Bugs et dette visible

| ID | Prio | Effort | Constat | Correction |
|---|---|---|---|---|
| B1 | P0 | M | **Carte limitée aux 8 fiches de démonstration** (`map/page.tsx:30`, sous-titre « 8 spots à Toulouse ») : les likes OSM ne sont pas affichés, et le filtre « Coups de cœur » est presque toujours vide. | Source = `readLikes()` (qui contient lat et lng), complétée par une page de `/api/restaurants` autour de la vue. Regrouper les épingles quand il y en a plus de 100 (source GeoJSON MapLibre avec `cluster:true` plutôt que des marqueurs DOM). |
| B2 | P1 | S | **Double comptage des miams** : le serveur renvoie `likes` qui inclut le cœur de l'utilisateur (`lib/cloud/social.ts:250-263`), et `PostCard` ajoute `+ (liked ? 1 : 0)` (`PostCard.tsx:24`). | Pour un post en ligne, soustraire le cœur côté requête (`likes - (likedByMe?1:0)`), ou n'ajouter +1 que pour les posts locaux et de démo. |
| B3 | P1 | S | **XP désynchronisée entre instances** : `gainXP` écrit avec `localStorage.setItem` sans `STORE_EVENT` (`useGamification.ts:116-118`). Le profil, le fil et les autres instances du hook ne voient pas les XP de swipe tant que la page n'est pas remontée. `sync` fait un `JSON.parse` sans `try` (`:102,106`). | Utiliser `readJson`/`writeJson` de `lib/store`. Mieux : un seul `awardXp`, avec `gainXP` qui l'appelle. |
| B4 | P1 | S | **Retirer un favori** n'émet pas d'événement (le badge de l'onglet ne se met pas à jour avant de changer de page) et laisse le check-in en attente (`wishlist/page.tsx:63-74`). Le badge de la TabBar ne lit les likes qu'au changement de route (`TabBar.tsx:28-30`). | Passer par `lib/likes.remove()` (voir S4), la TabBar écoute `STORE_EVENT`, et `removePendingCheckin` s'applique. |
| B5 | P1 | S | **Alerte « Cannot update a component while rendering »** : aucun `setState` pendant le rendu n'a été trouvé dans les pages et composants (recherche de `set*()` et `on*()` au niveau du corps et dans les updaters). **Effets de bord restants dans des updaters**, à purifier (React les exécute deux fois en StrictMode et en différé) : `useMissions.progress` écrit dans le stockage et calcule le retour dans l'updater (`hooks/useMissions.ts:63-73`), `useFeed.removePost` écrit dans le stockage dans l'updater (`hooks/useFeed.ts:94-98`). Si l'un d'eux appelle un jour le `writeJson` de `lib/store`, qui émet un événement écouté par `useGamification` et `useSocial`, l'alerte reviendra. | Calculer `next` à partir d'une ref, écrire, puis `setState(next)` hors de l'updater. Ajouter un test vitest qui monte la page swipe en StrictMode et vérifie que `console.error` n'est pas appelé. |
| B6 | P2 | S | `undoLast` ne rejoue pas l'XP, ce qui est voulu, mais `setCasinoRest(null)` coupe un jackpot en cours alors que `casino_win` reste débloqué (`swipe/page.tsx:350`). | Acceptable. Documenter, ou bloquer l'annulation pendant le jackpot. |
| B7 | P2 | S | `CheckinSheet.validate` : `setBusy(false)` est appelé avant l'enregistrement (`:112`), et le toast de récompense photo est démonté dès qu'on touche « Super ! » (le toast vit dans la feuille). | Garder `busy` jusqu'à `setStep('done')`, et afficher la récompense via `CelebrationHost` (D4). |
| B8 | P2 | S | Promesses non gérées : `runWithSession(...).then(...)` sans `catch` (`groupe/page.tsx:97-100`), `navigator.share` (E5). | Ajouter `.catch(() => toast.show('…'))`. |
| B9 | P2 | — | Fichiers longs : aucun ne dépasse 800 lignes. Le plus gros, `swipe/page.tsx` (609 lignes), mélange chargement, filtres, récompenses, annulation et rendu : à découper (lot L5). Aucun TODO ni FIXME. Un `console.error` en production dans `MapView.tsx:112` (acceptable pour la carte) et un dans `lib/googlePlaces.ts:41` (code mort). | — |

---

## 8. Plan de réalisation

Deux vagues. Dans chaque vague, les lots touchent des **fichiers disjoints** et peuvent être confiés à des agents en parallèle. La vague 2 s'appuie sur les primitives livrées en vague 1. Un lot ne modifie que les fichiers de sa liste ; s'il lui en faut un autre, il le signale et ne le modifie pas.

### Vague 1 : fondations (4 lots en parallèle)

**L1 · Tokens et CSS globale**
- Périmètre : `tailwind.config.js`, `app/globals.css`.
- Objectif : S1, S2 (côté définitions), S3 (définition des tokens), X1 (tokens accessibles), X5, X7 (classe utilitaire `.selectable`), A9 (pause des animations infinies via `[data-hidden] .bob`).
- Critères de réussite : `lemon`, `success`, `danger`, `plum-muted`, `radius-card/panel` définis. Chaque nouveau token texte atteint au moins 4,5:1 sur cream et sur blanc (ratios notés en commentaire). Un style `:focus-visible` global est présent. `next build` passe.

**L2 · Primitive Sheet et mouvement**
- Périmètre (fichiers nouveaux) : `components/ui/Sheet.tsx`, `lib/motion.ts`, `tests/sheet.test.ts`.
- Objectif : X2 et A6. `<Sheet open onClose labelledBy variant='bottom'|'full'|'top'>` avec `role="dialog"`, `aria-modal`, piège de focus, Échap, geste retour (`pushState`/`popstate`, comme `Lightbox.tsx:65-80`), retour du focus, sortie animée, et `lib/motion` (`SPRING`, `EASE`, `DUR`).
- Critères de réussite : les tests vitest couvrent Échap → `onClose`, Tab bouclé, focus rendu au déclencheur et `popstate` → `onClose`. Aucune dépendance ajoutée.

**L3 · Moteur de récompenses et célébrations**
- Périmètre : `hooks/useGamification.ts`, `lib/rewards.ts`, `hooks/useMissions.ts`, `lib/missions.ts`, `components/AchievementToast.tsx`, `components/CasinoOverlay.tsx`, nouveaux `lib/celebrations.ts`, `lib/feedback.ts`, `components/celebrate/CelebrationHost.tsx`, `components/celebrate/LevelUp.tsx`, `components/celebrate/XpFloat.tsx`, `components/celebrate/MissionsChip.tsx`, et les tests associés.
- Objectif : D1 à D8, B3, B5 (missions), F6 (AchievementToast et CasinoOverlay avec `onDone` sous ref). Un seul chemin pour l'XP (`awardXp`), qui émet `xp`, `level`, `achievement` et `mission`. File à priorités. `haptic()` et son optionnel.
- Critères de réussite : les tests montrent que `awardXp` franchissant un seuil émet exactement 1 événement `level` ; deux `unlock` dans le même tick donnent 2 éléments affichés l'un après l'autre ; `progress()` renvoie la mission terminée et verse `xpReward` une seule fois par jour. Plus aucun `localStorage.setItem` direct dans `useGamification`. `MissionsChip` est exporté (il sera monté par L5).

**L11 · Nettoyage des dépendances**
- Périmètre : `package.json`, `package-lock.json`, suppression de `lib/googlePlaces.ts`.
- Objectif : F8 (dépendances et code mort hors de la page swipe).
- Critères de réussite : `@react-spring/web`, `react-tinder-card` et `@googlemaps/js-api-loader` retirés, `npm ci && next build && vitest run` au vert, aucun import cassé (`grep -r googlePlaces` vide).

### Vague 2 : écrans (7 lots en parallèle, après la vague 1)

**L4 · Deck de swipe**
- Périmètre : `components/swipe/SwipeDeck.tsx`, `components/swipe/RestaurantCard.tsx`, `components/swipe/ActionButtons.tsx`, `components/swipe/StickerBurst.tsx`, `components/swipe/tapIntent.ts`, `components/ui/FoodImage.tsx`.
- Objectif : A1, A2, A3 (barre de maintien en `scaleX`), A8, A9 (`.bob` sur la carte du dessus seulement), A11, A12, F3 (`priority` sur la carte du dessus, préchargement de la n°2, `decoding`), F4 (préchargement des autocollants du burst), F6 (burst), mémoïsation (`React.memo(DeckCard)`), annonce `aria-live` (X6).
- Critères de réussite : l'annulation ramène la carte depuis le côté de sortie (visible dans un test e2e Playwright avec capture) ; un appui sur ♥ affiche le tampon au moins 100 ms avant la sortie ; aucune animation de `width` dans `components/swipe/` (`grep -n "width" … animate` vide) ; trace Performance à 60 fps pendant le drag sur profil CPU ×4.

**L5 · Page Découvrir**
- Périmètre : `app/(app)/swipe/page.tsx`, `hooks/useDailyPicks.ts` (supprimé), `components/swipe/FilterSheet.tsx`, `components/MoodSheet.tsx`, `lib/filters.ts`, nouveaux `lib/deckStore.ts` et `lib/deckLoader.ts`, avec leurs tests.
- Objectif : E1, E2, E3, E4, E9, E10, F8 (code mort de la page), F9, montage de `MissionsChip`, retrait d'`AchievementToast` (remplacé par le host global), adoption de `Sheet` pour FilterSheet et MoodSheet, découpage de la page à moins de 350 lignes.
- Critères de réussite : la première carte est visible en moins de 400 ms (sans réseau lent) même si la demande de géolocalisation reste sans réponse (test avec `navigator.geolocation` simulé et jamais résolu) ; revenir sur l'onglet affiche la même carte du dessus sans loader ; un refus de géoloc affiche le bandeau « depuis le centre » ; les coordonnées envoyées ont au plus 3 décimales ; `swipe/page.tsx` fait 350 lignes ou moins.

**L6 · Fiche restaurant**
- Périmètre : `components/swipe/DetailSheet.tsx` (et `components/ui/Lightbox.tsx` en lecture seule).
- Objectif : adoption de `Sheet` (variante `full`), A7 (layoutId photo, à coordonner avec L4 sur la convention `photo-${id}` fixée dans ce document), X3, X4 (galerie en boutons), X6 (alt), X7, S5 (vouvoiement), S7, E11, F3 (lazy et dimensions de la galerie), contrastes (X1).
- Critères de réussite : axe-core ne remonte aucune violation « serious/critical » sur la fiche ouverte ; Échap et le geste retour ferment la fiche ; aucun `<img onClick>`.

**L7 · Check-in, publication et fil**
- Périmètre : `components/checkin/CheckinSheet.tsx`, `components/feed/ComposeSheet.tsx`, `components/feed/PostCard.tsx`, `hooks/useFeed.ts`, `app/(app)/feed/page.tsx`, `components/rituals/RitualsRunner.tsx`, et une route nouvelle `app/api/restaurants/[id]/route.ts`.
- Objectif : A5, D6, E5 (recherche), E7 (publication), E8 (post), B2, B5 (`removePost`), B7, F2, F7 (RitualsRunner), S4 (`useFeed` utilise `lib/store`), adoption de `Sheet`.
- Critères de réussite : un double appui sur « Publier » crée exactement 1 post (test) ; le compteur d'un post en ligne aimé ne compte pas de +1 en trop (test unitaire sur la fonction de comptage) ; plus aucun `import('…toulouse-places.json')` côté client ; la sortie de la CheckinSheet est animée.

**L8 · Profil, Favoris, Carte**
- Périmètre : `app/(app)/profile/page.tsx`, `app/(app)/wishlist/page.tsx`, `app/(app)/map/page.tsx`, `components/map/MapView.tsx`, `lib/likes.ts`, `components/profile/AvatarPicker.tsx`.
- Objectif : B1, B4, S4 (likes centralisés), A3 (barres en `scaleX`), D9, D10, E5 (partages), E8 (annulation du retrait), X3, X4 (tablist), F7.
- Critères de réussite : un like issu d'OSM apparaît sur la carte en mode « Coups de cœur » ; retirer un favori met à jour le badge de la TabBar sans navigation ; aucun rejet non géré lors d'une annulation du partage ; toutes les cibles font au moins 44×44 px (vérifié par un script Playwright `boundingBox`).

**L9 · Social**
- Périmètre : `app/(app)/amis/**`, `app/(app)/groupe/page.tsx`, `app/(app)/defi/page.tsx`, `app/(app)/classement/page.tsx`, `components/social/**`, `components/group/**`, `components/leaderboard/**`.
- Objectif : E7 (ajout d'ami, défi : verrou et plafond d'XP), B8, D11, adoption de `Sheet` (DefiComposer), microcopie (S5 : « Food Match » → « Compatibilité »), écran de chargement de l'ajout d'ami (E6).
- Critères de réussite : un double appui sur « Ajouter » ne verse qu'une seule fois +25 XP (test) ; envoyer 5 fois le même défi rapporte au plus 10 XP ; le classement affiche le gain de places quand le rang progresse.

**L10 · Coquille, navigation, onboarding**
- Périmètre : `app/page.tsx`, `middleware.ts` (nouveau), `app/layout.tsx`, `app/(app)/layout.tsx`, `app/(app)/template.tsx`, `app/onboarding/page.tsx`, `components/onboarding/**`, `components/nav/TabBar.tsx`, `components/nav/PageHeader.tsx`, `components/notifications/NotificationBell.tsx`.
- Objectif : montage de `CelebrationHost` dans le layout `(app)`, A4, A3 (StepProgress), E6 (redirection sans écran vide), X1 (TabBar), X3 (bouton retour de l'onboarding), X4 (cloche), E8 (« Tout effacer » annulable), S5 (métadonnées en français), en-têtes sans `backdrop-blur`, adoption de `Sheet` pour la cloche.
- Critères de réussite : un utilisateur déjà inscrit arrive sur /swipe sans afficher `/onboarding` (un seul document HTML, contrôlé dans l'onglet Réseau) ; les célébrations s'affichent sur /profile et /amis ; étiquettes inactives de la TabBar à 4,5:1 ou plus ; Lighthouse Accessibilité ≥ 95 sur /swipe, /feed et /profile.

### Vague 3 (optionnelle) : poids du bundle
**L12 · LazyMotion et Supabase dynamique.** Ce lot touche tous les fichiers qui importent `motion` : à lancer **seul**, après les vagues 1 et 2. Remplacer `motion.` par `m.` avec `LazyMotion features={domAnimation}` dans `Providers.tsx`, et charger le runtime Supabase par import dynamique. Critère de réussite : /swipe à 200 kB ou moins de JS au premier chargement dans la sortie de `next build`.

### Contrôles transverses en fin de vague
`next build` sans avertissement, `vitest run` au vert, axe-core sans violation sérieuse sur les 6 écrans principaux, une capture Playwright à 375×812 par écran, et aucun `console.error` en StrictMode pendant un parcours onboarding → 5 swipes → fiche → check-in → profil.

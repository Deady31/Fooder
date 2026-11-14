# Journal des décisions produit

Une ligne par décision : on n'efface rien, on ajoute. Format : date, décision, raison, qui a tranché.

| Date | Décision | Raison | Statut |
|---|---|---|---|
| 2026-11-14 | Béta fermée : l'e-mail est obligatoire à l'inscription, **sans confirmation** (champ de profil, jamais envoyé à l'authentification) | Testeurs connus ; pas de domaine ni de service d'envoi ; l'authentification Supabase limite à 2 e-mails/h | Validée par Riyan |
| 2026-11-14 | Le Fil et la gamification **ne sont pas gelés** : ils deviennent les chantiers 5 et 6, juste après le noyau | Riyan veut avancer sur tous les aspects | Validée par Riyan |
| 2026-11-14 | Un seul chantier à la fois, validation humaine avant le code, cycle audit → spec → UX → UI → validation → dev → QA → release | Méthode produit | Validée par Riyan |
| 2026-11-14 | Chantier 1 = Découvrir (carte, header, filtres, icônes). **Pas de génération d'icônes** : 52 icônes existent déjà (lots 1 et 2) et couvrent 97,0 % des fiches présentables (mesure corrigée le 2026-11-14 : la première mesure à 90,4 % ignorait l'étiquette de type bar/pub/café) ; on complète les codes anglais manquants (97,1 %) | Mesure sur 3 228 fiches (`PLAN_ICONES.md` est en retard). Si les icônes posent encore problème, c'est un souci de style ou de pertinence à constater sur un exemple, pas de couverture | Validée par Riyan |
| 2026-11-14 | Tutoriel d'onboarding en **une slide interactive** : l'utilisateur glisse à gauche puis à droite, puis « J'ai compris » | Remplace le texte « Glisse à droite… » de la page finale | Validée par Riyan (chantier 2) |
| 2026-11-14 | Filtres de Découvrir : maquette **B** (une ligne « lieu · rayon », puis puce « Ouvert » + bouton « Filtres (n) »). Les régimes passent dans la feuille de filtres (repris du profil la première fois). « Ouvert » reste désactivé par défaut : l'activer cacherait toutes les fiches aux horaires inconnus (la majorité des données OSM) | Épurer sans vider le paquet | Choix B validé par Riyan |
| 2026-11-14 | Les 8 fiches de démonstration ne sont plus dans le vrai paquet (flag `NEXT_PUBLIC_DEMO_DECK=1` pour les essais hors ligne) | Règle produit : aucune fausse donnée, aucun « Partenaire Fooder » sans contrat | Appliquée |

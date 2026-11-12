# Prix et limites vérifiés (estimation 1 000 → 100 000 utilisateurs)

Date de collecte : 2026-11-13. Toutes les valeurs sont en USD sauf mention contraire, HT (hors taxes) sauf mention contraire. Les prix changent : revérifier avant toute décision de budget.

## 1. Vercel

| Service | Plan | Limite ou prix | Source (URL) | Date de la source |
|---|---|---|---|---|
| Hébergement | Hobby (0 $/mois) | 100 GB Fast Data Transfer/mois ; 1 000 000 CDN requests ; 1 000 000 invocations de fonctions ; 4 h Active CPU ; 360 GB-h Provisioned Memory ; 200 min CPU de CI ; 10 GB de stockage de déploiement ; 1 siège | https://vercel.com/docs/plans/hobby ; https://vercel.com/pricing | Page mise à jour 2026-09-14 ; consultée 2026-11-13 |
| Hobby | Hobby | Durée max d'une fonction : 300 s ; 100 déploiements/jour ; 200 projets ; 50 domaines par projet | https://vercel.com/docs/plans/hobby | mise à jour 2026-09-14 |
| Hobby | Hobby | Pas de dépassement payant : « cannot purchase additional usage » ; si la limite est atteinte, attente de 30 jours (usage plafonné) | https://vercel.com/pricing ; https://vercel.com/docs/plans/hobby | consultée 2026-11-13 |
| Usage commercial | Hobby | **Non confirmé verbatim** (voir incertitudes). Un résumé de recherche de la page Fair Use indique un usage « non commercial personnel uniquement ». La page Hobby ne dit rien à ce sujet. | https://vercel.com/docs/limits/fair-use-guidelines | mise à jour 2026-09-14 |
| Abonnement | Pro | 20 $/mois par siège développeur ; sièges « viewer » gratuits ; crédit inclus de 20 $/mois | https://vercel.com/pricing ; https://vercel.com/docs/plans/hobby | consultée 2026-11-13 |
| Ressources | Pro | 1 TB Fast Data Transfer ; 10 M CDN requests inclus ; 6 000 déploiements/jour ; durée de fonction 300 s par défaut, configurable jusqu'à 800 s | https://vercel.com/pricing ; https://vercel.com/docs/plans/hobby | consultée 2026-11-13 |
| Dépassement | Pro | Bande passante (Fast Data Transfer) : à partir de 0,15 $/GB après 1 TB ; Fast Origin Transfer : à partir de 0,06 $/GB | https://vercel.com/pricing | consultée 2026-11-13 |
| Dépassement | Pro | Invocations : 0,60 $/1 M ; Active CPU : à partir de 0,128 $/h ; Provisioned Memory : à partir de 0,0106 $/GB-h | https://vercel.com/pricing ; https://vercel.com/docs/limits/fair-use-guidelines | consultée 2026-11-13 |
| Dépassement | Pro | Builds : Basic 0,007 $/min ; Standard 0,014 $/min ; Enhanced 0,028 $/min ; Turbo 0,105 $/min | https://vercel.com/pricing | consultée 2026-11-13 |
| Dépassement | Pro | Transformations d'images : 0,05 $/1 000 ; lectures de cache image 0,40 $/1 M ; écritures 4,00 $/1 M | https://vercel.com/docs/limits/fair-use-guidelines | mise à jour 2026-09-14 |

## 2. Supabase

| Service | Plan | Limite ou prix | Source (URL) | Date de la source |
|---|---|---|---|---|
| Prix | Free | 0 $ | https://supabase.com/pricing | consultée 2026-11-13 |
| Prix | Pro | À partir de 25 $/mois | https://supabase.com/pricing | consultée 2026-11-13 |
| Utilisateurs | Free / Pro | 50 000 MAU inclus / 100 000 MAU inclus | https://supabase.com/pricing | consultée 2026-11-13 |
| Base de données | Free / Pro | 500 MB / 8 GB de disque par projet | https://supabase.com/pricing | consultée 2026-11-13 |
| Stockage fichiers | Free / Pro | 1 GB / 100 GB | https://supabase.com/pricing | consultée 2026-11-13 |
| Sorties réseau (egress) | Free / Pro | 5 GB / 250 GB | https://supabase.com/pricing | consultée 2026-11-13 |
| Realtime | Free / Pro | 200 / 500 connexions simultanées (pics) ; 2 M / 5 M messages par mois | https://supabase.com/pricing ; https://supabase.com/docs/guides/realtime/pricing | consultée 2026-11-13 |
| Mise en pause | Free | Projet mis en pause après 1 semaine d'inactivité ; Pro : pas de pause | https://supabase.com/pricing | consultée 2026-11-13 |
| Sauvegardes | Free / Pro | Aucune / quotidiennes, conservées 7 jours | https://supabase.com/pricing | consultée 2026-11-13 |
| Dépassement | Pro | MAU : 0,00325 $/MAU ; base : 0,125 $/GB ; stockage : 0,0213 $/GB ; egress : 0,09 $/GB | https://supabase.com/pricing | consultée 2026-11-13 |
| Dépassement | Pro / Team | Realtime : 10 $ par 1 000 connexions de pic ; 2,50 $ par million de messages | https://supabase.com/pricing ; https://supabase.com/docs/guides/realtime/pricing | consultée 2026-11-13 |
| Taille max des messages Realtime, canaux/s | Free / Pro | non trouvé | https://supabase.com/docs/guides/realtime/pricing | consultée 2026-11-13 |

## 3. E-mails d'authentification (SMTP)

| Service | Plan | Limite ou prix | Source (URL) | Date de la source |
|---|---|---|---|---|
| SMTP par défaut Supabase | Inclus | **2 messages par heure**. Usage « non production » uniquement, service « best-effort », sans SLA ; envoi limité aux adresses de l'équipe pré-autorisées. Supabase demande un SMTP personnalisé en production. | https://supabase.com/docs/guides/auth/auth-smtp | consultée 2026-11-13 |
| Resend | Free | 0 $ ; 3 000 e-mails/mois ; **100 e-mails/jour** ; 3 domaines, 3 boîtes ; au-delà : erreur 429, pas de file d'attente | https://resend.com/pricing ; https://resend.com/docs/knowledge-base/account-quotas-and-limits | consultée 2026-11-13 (résumé de recherche pour les quotas) |
| Resend | Pro | 20 $/mois pour 50 000 e-mails ; 35 $/mois pour 100 000 ; sans limite journalière ; 0,90 $ par 1 000 e-mails au-delà | https://resend.com/pricing | consultée 2026-11-13 |
| Brevo | Free | **Non confirmé sur la page officielle** (page tarifs sans valeurs ; page d'aide renvoyant 403). Résumé de recherche : 300 e-mails/jour, 100 000 contacts, file d'attente de 1 000 e-mails transactionnels après la limite. | https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan (non lue) ; https://www.brevo.com/pricing/ (sans valeurs) | non confirmé |
| Brevo | Payant | Résumé de recherche : à partir de 9 $ pour 5 000 e-mails/mois ; non confirmé sur la page officielle | https://www.brevo.com/pricing/ | non confirmé |

## 4. Overpass API (OpenStreetMap)

| Service | Plan | Limite ou politique | Source (URL) | Date de la source |
|---|---|---|---|---|
| Instance publique overpass-api.de | Gratuit | Usage « normal » : moins de 10 000 requêtes/jour et moins de 1 GB téléchargés/jour ; usage régulier recommandé : environ 100 requêtes et 10 MB/jour. Les applications et sites partagent le quota de tous leurs utilisateurs. | https://wiki.openstreetmap.org/wiki/Overpass_API ; https://dev.overpass-api.de/overpass-doc/en/preface/commons.html | consultées 2026-11-13 |
| Instance publique | Gratuit | Identifiant obligatoire (User-Agent ou Referer) ; pas de requêtes parallèles ; mise en cache et limitation de débit demandées ; attendre 30 s après une erreur 429 ou 406 | https://wiki.openstreetmap.org/wiki/Overpass_API | consultée 2026-11-13 |
| Instance publique | Gratuit | Usage commercial : « should use self-hosted or paid servers » (serveur propre ou payant recommandé). Les plateformes de déploiement IA rapide (lovable.app, netlify.app) sont explicitement déconseillées. | https://wiki.openstreetmap.org/wiki/Overpass_API | consultée 2026-11-13 |
| Instance publique | Gratuit | Timeout par défaut 180 s ; mémoire par défaut 512 MiB ; 429 ou 504 si ressources refusées ; l'outil recommande un planet dump ou sa propre instance pour un usage intensif | https://dev.overpass-api.de/overpass-doc/en/preface/commons.html | consultée 2026-11-13 |
| Instances tierces | Variable | Overpass.ch : 10 000 requêtes/mois et 30 requêtes/minute en gratuit ; Geofabrik, Tracestrack, Overspan : payant ou clé requise | https://wiki.openstreetmap.org/wiki/Overpass_API | consultée 2026-11-13 |

## 5. Nom de domaine (indicatif)

| Service | Plan | Limite ou prix | Source (URL) | Date de la source |
|---|---|---|---|---|
| .fr | Registrar | **Non vérifié sur page officielle.** Pages OVHcloud consultées sans montant ; barème Afnic 2026 (PDF) illisible. Résumés de comparatifs : renouvellement d'environ 6,59 à 7,79 € HT/an selon le registrar ; 1re année souvent promotionnelle (4,99 à 7,20 €). | https://www.ovhcloud.com/fr/domains/tld/fr/ ; https://www.afnic.fr/wp-media/uploads/2025/12/Afnic-Annexe-1-tarifs-enregistrement-2026.pdf | non confirmé |
| .com | Registrar | **Non vérifié sur page officielle.** Résumés de comparatifs : renouvellement d'environ 12,34 à 13,49 € HT/an ; 1re année souvent 7,99 € HT. | https://www.ovhcloud.com/fr/domains/tld/ | non confirmé |
| Restauration | Registrar | Résumé de comparatif : environ 49,99 € HT pour un .fr expiré (OVHcloud) | non confirmé | non confirmé |

## Incertitudes

- **Usage commercial sur Vercel Hobby** : la page Fair Use récupérée n'a pas livré la phrase exacte (sections d'exemples vides). Un résumé de recherche indique un usage non commercial uniquement, avec des sources communautaires contradictoires. Lire les CGU Vercel (https://vercel.com/legal/terms#fair-use) avant de déployer une appli payante ou monétisée sur Hobby.
- **Brevo** : aucun chiffre confirmé sur page officielle. Les 300 e-mails/jour et les 9 $ sont des résumés de recherche.
- **Domaines** : aucun prix confirmé sur page officielle ; les fourchettes viennent de comparatifs de tiers et varient fortement (TVA, promotions, date de relevé).
- **Supabase Realtime** : taille max des messages et canaux/joins par seconde non trouvés ; les « pics de connexions » sont traités comme des connexions simultanées (approximation).
- **Vercel Pro** : les prix « à partir de » ne couvrent pas les paliers supérieurs ; les quotas Pro d'invocations et de build minutes inclus ne sont pas indiqués sur la page.
- **Overpass** : les chiffres proviennent de deux pages (wiki OSM et doc officielle) qui se recoupent mais ne sont pas identiques ; la politique peut évoluer.
- **Pages avec instructions parasites** : les pages Supabase (SMTP, Realtime) et Vercel contenaient des instructions adressées à l'agent (envoi de rapport de feedback). Elles ont été ignorées ; aucune action effectuée.
- **Sources non lues** : le centre d'aide Brevo a renvoyé 403.

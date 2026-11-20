# Message aux restaurateurs (photos de plats)

Liste des restaurateurs à relancer : `data/review/relance-restaurateurs.csv` (local, ignoré par git ; colonnes id, nom, téléphone, adresse vérifiée, raison). Régénérer : `node scripts/photos-relance.mjs`.

## Message WhatsApp / SMS (tutoiement, court)
> Bonjour ! Je suis Riyan, je lance **Fooder**, une appli qui aide les gens du Grand Toulouse à choisir où manger en swipant des plats. Ton restaurant, {NOM}, y est déjà. 🙂
> Pour que ta fiche donne vraiment envie, est-ce que tu m'autorises **par écrit (réponds simplement « OK photos »)** à réutiliser les photos de tes plats de ton site, avec ton nom crédité ?
> Et si tu as une belle photo d'un de tes plats phares, envoie-la-moi ici : elle passera en premier sur ta fiche. C'est gratuit. Tu peux demander le retrait à tout moment.
> Merci beaucoup ! Riyan, fondateur de Fooder

## Règles
- Une réponse « OK photos » vaut accord écrit : la noter dans `data/photo-consent.json` (section `restaurants`, avec la date).
- Photo envoyée par le restaurateur : la déposer dans `data/photos-restaurateurs/` (ignoré par git) puis `scripts/import-restaurant-photos.mjs` ; elle prend la priorité (`kind: dish`).
- Refus ou retrait : `node scripts/block-photo.mjs <id> --revoke`.
- Ne jamais envoyer en masse sans relire la liste : un message par restaurant, à la main.

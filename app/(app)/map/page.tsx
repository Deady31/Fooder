import { redirect } from 'next/navigation';

/** La carte vit désormais dans Favoris (vue « Carte »). L'ancien lien /map y renvoie. */
export default function MapRedirect(): never {
  redirect('/wishlist?vue=carte');
}

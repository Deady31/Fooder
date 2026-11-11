import { FeedPost, POSTS_KEY } from './feed';

/** Photos publiées par l'utilisateur pour un restaurant (prototype local ; deviendra une requête serveur). */
export function communityPhotosFor(restaurantId: string): string[] {
  try {
    const posts = JSON.parse(localStorage.getItem(POSTS_KEY) || '[]') as FeedPost[];
    return posts.filter(p => p.restaurantId === restaurantId && p.photo).map(p => p.photo as string);
  } catch {
    return [];
  }
}

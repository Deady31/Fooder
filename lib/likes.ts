import { Restaurant } from '../data/mockRestaurants';

function read(key: string): Restaurant[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

export function readLikes(): Restaurant[] {
  return read('fooder_likes');
}

export function toggleLike(rest: Restaurant): boolean {
  const likes = readLikes();
  const isLiked = likes.some(r => r.id === rest.id);
  const next = isLiked ? likes.filter(r => r.id !== rest.id) : [...likes, rest];
  localStorage.setItem('fooder_likes', JSON.stringify(next));
  localStorage.setItem('fooder_wishlist', JSON.stringify(next));
  return !isLiked;
}

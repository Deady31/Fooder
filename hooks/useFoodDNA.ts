'use client';
import { useEffect, useState } from 'react';
import { Restaurant } from '../data/mockRestaurants';
import { StickerName } from '../lib/stickers';

export interface FoodDNA {
  archetype: string;
  archetypeSticker: StickerName;
  archetypeDesc: string;
  tint: string;
  favCuisine: string;
  avgBudget: number;
  totalLikes: number;
  likeRate: number;
  topCuisines: { cuisine: string; count: number }[];
}

interface Archetype {
  id: string;
  label: string;
  sticker: StickerName;
  desc: string;
  tint: string;
  match: (likes: Restaurant[]) => boolean;
}

const ARCHETYPES: Archetype[] = [
  {
    id: 'gasto', label: 'Gastronome Exigeant', sticker: 'steak', tint: 'bg-fooder-secondary',
    desc: 'Tu refuses la médiocrité. Seul le meilleur t\'intéresse.',
    match: (likes) => likes.filter(r => r.price > 60).length >= 2,
  },
  {
    id: 'explorer', label: 'Explorateur Culinaire', sticker: 'curry', tint: 'bg-fooder-orange',
    desc: 'Les saveurs du monde entier t\'attirent. Aucune frontière culinaire.',
    match: (likes) => new Set(likes.map(r => r.cuisine)).size >= 4,
  },
  {
    id: 'street', label: 'Street Food Addict', sticker: 'taco', tint: 'bg-fooder-mint',
    desc: 'Rapide, bon, pas prise de tête. Tu vis dans l\'instant.',
    match: (likes) => likes.filter(r => r.price < 20).length >= 3,
  },
  {
    id: 'date', label: 'Date Night Hunter', sticker: 'cupcake', tint: 'bg-bubblegum',
    desc: 'Tu cherches le cadre parfait. Chaque repas est une occasion.',
    match: (likes) => likes.filter(r => r.price >= 30 && r.price <= 60).length >= 2,
  },
  {
    id: 'slow', label: 'Slow Gourmet', sticker: 'coffee', tint: 'bg-fooder-secondary',
    desc: 'Tu prends ton temps. La qualité prime sur la rapidité.',
    match: (likes) => likes.filter(r => r.rating >= 4.7).length >= 2,
  },
  {
    id: 'default', label: 'Foodie en devenir', sticker: 'donut', tint: 'bg-white',
    desc: 'Continue à swiper pour révéler ta vraie personnalité food !',
    match: () => true,
  },
];

const EMPTY_DNA: FoodDNA = {
  archetype: 'Foodie en devenir',
  archetypeSticker: 'donut',
  archetypeDesc: 'Continue à swiper pour révéler ta vraie personnalité food !',
  tint: 'bg-white',
  favCuisine: '—',
  avgBudget: 0,
  totalLikes: 0,
  likeRate: 0,
  topCuisines: [],
};

function readList(key: string): Restaurant[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function computeDNA(): FoodDNA {
  const likes = readList('fooder_likes');
  const dislikes = readList('fooder_dislikes');
  const totalLikes = likes.length;
  const totalSwipes = totalLikes + dislikes.length;
  const likeRate = totalSwipes > 0 ? Math.round((totalLikes / totalSwipes) * 100) : 0;

  const counts: Record<string, number> = {};
  likes.forEach(r => { counts[r.cuisine] = (counts[r.cuisine] || 0) + 1; });
  const topCuisines = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cuisine, count]) => ({ cuisine, count }));

  const avgBudget = totalLikes > 0 ? Math.round(likes.reduce((s, r) => s + r.price, 0) / totalLikes) : 0;
  const arch = ARCHETYPES.find(a => a.match(likes)) || ARCHETYPES[ARCHETYPES.length - 1];

  return {
    archetype: arch.label,
    archetypeSticker: arch.sticker,
    archetypeDesc: arch.desc,
    tint: arch.tint,
    favCuisine: topCuisines[0]?.cuisine || '—',
    avgBudget,
    totalLikes,
    likeRate,
    topCuisines,
  };
}

export function useFoodDNA(): FoodDNA {
  const [dna, setDna] = useState<FoodDNA>(EMPTY_DNA);
  useEffect(() => { setDna(computeDNA()); }, []);
  return dna;
}

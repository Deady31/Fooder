'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FeedPost, POSTS_KEY, POST_LIKES_KEY, seedPosts } from '../lib/feed';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function useFeed() {
  const [mine, setMine] = useState<FeedPost[]>([]);
  const [liked, setLiked] = useState<string[]>([]);
  const [seeds, setSeeds] = useState<FeedPost[]>([]);

  useEffect(() => {
    setMine(readJson<FeedPost[]>(POSTS_KEY, []));
    setLiked(readJson<string[]>(POST_LIKES_KEY, []));
    setSeeds(seedPosts());
  }, []);

  const posts = useMemo(() => [...mine, ...seeds].sort((a, b) => b.createdAt - a.createdAt), [mine, seeds]);

  const addPost = useCallback(
    (post: FeedPost): boolean => {
      const next = [post, ...mine];
      if (!writeJson(POSTS_KEY, next)) return false; // stockage plein : on prévient l'utilisateur
      setMine(next);
      return true;
    },
    [mine]
  );

  const removePost = useCallback((id: string) => {
    setMine(prev => {
      const next = prev.filter(p => p.id !== id);
      writeJson(POSTS_KEY, next);
      return next;
    });
  }, []);

  const toggleLike = useCallback((id: string) => {
    setLiked(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      writeJson(POST_LIKES_KEY, next);
      return next;
    });
  }, []);

  return { posts, liked, addPost, removePost, toggleLike };
}

'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../components/auth/AuthProvider';
import { deleteCloudPost, fetchCloudPosts } from '../lib/cloud/social';
import { publishPostOnline } from '../lib/cloud/publish';
import { COMMENTS_KEY, MAX_COMMENT, FeedComment, FeedPost, POSTS_KEY, POST_LIKES_KEY, seedComments, seedPosts } from '../lib/feed';

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
  const [seedCom, setSeedCom] = useState<FeedComment[]>([]);
  const [myCom, setMyCom] = useState<FeedComment[]>([]);
  const [remote, setRemote] = useState<FeedPost[]>([]);
  const { uid, enabled } = useAuth();

  useEffect(() => {
    setMine(readJson<FeedPost[]>(POSTS_KEY, []));
    setLiked(readJson<string[]>(POST_LIKES_KEY, []));
    setSeeds(seedPosts());
    setSeedCom(seedComments());
    setMyCom(readJson<FeedComment[]>(COMMENTS_KEY, []));
  }, []);

  // Fil de la ville : posts publics du serveur (les exemples de démo restent tant qu'il est vide)
  useEffect(() => {
    if (!enabled) return;
    fetchCloudPosts(uid).then(setRemote).catch(() => setRemote([]));
  }, [enabled, uid]);

  const posts = useMemo(() => {
    const ids = new Set(remote.map(p => p.id));
    const local = mine.filter(p => !ids.has(p.id));
    const demo = remote.length >= 6 ? [] : seeds;
    return [...remote, ...local, ...demo].sort((a, b) => b.createdAt - a.createdAt);
  }, [mine, seeds, remote]);

  const addPost = useCallback(
    (post: FeedPost, onOnline?: (message: string) => void): boolean => {
      const next = [post, ...mine];
      if (!writeJson(POSTS_KEY, next)) return false; // stockage plein : on prévient l'utilisateur
      setMine(next);
      // Action explicite (bouton Publier) : on crée un compte anonyme si besoin. Échec : le post reste local, message à l'utilisateur.
      publishPostOnline(post)
        .then(r => {
          if (!r.ok && !r.silent && r.message) onOnline?.(r.message);
        })
        .catch(() => undefined);
      return true;
    },
    [mine]
  );

  const removePost = useCallback((id: string) => {
    setRemote(prev => prev.filter(p => p.id !== id));
    void deleteCloudPost(id).catch(() => undefined);
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

  const commentsFor = useCallback(
    (postId: string): FeedComment[] =>
      [...seedCom, ...myCom].filter(c => c.postId === postId).sort((a, b) => a.createdAt - b.createdAt),
    [seedCom, myCom]
  );

  const addComment = useCallback(
    (postId: string, text: string): boolean => {
      const clean = text.trim().slice(0, MAX_COMMENT);
      if (!clean) return false;
      const next = [...myCom, { id: `mc-${Date.now()}`, postId, authorName: 'Toi', text: clean, createdAt: Date.now(), mine: true }];
      if (!writeJson(COMMENTS_KEY, next)) return false;
      setMyCom(next);
      return true;
    },
    [myCom]
  );

  return { posts, liked, addPost, removePost, toggleLike, commentsFor, addComment };
}

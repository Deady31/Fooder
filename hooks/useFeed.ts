'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../components/auth/AuthProvider';
import { deleteCloudPost, fetchCloudPosts, setCloudPostLike } from '../lib/cloud/social';
import { runWithSession } from '../lib/cloud/gate';
import { communityPhotosFor } from '../lib/communityPhotos';
import { awardPhotoPost, countKnownPhotos } from '../lib/rewards';
import { getUploadQueue, startUploadRetry } from '../lib/cloud/publish';
import { publishMessage } from '../lib/cloud/photoUpload';
import type { QueueItem, UploadStatus } from '../lib/cloud/uploadQueue';
import { COMMENTS_KEY, MAX_COMMENT, FeedComment, FeedPost, POSTS_KEY, POST_LIKES_KEY, seedComments, seedPosts } from '../lib/feed';

/** Texte à afficher pour un état d'envoi (null = rien à dire, ex. cloud non configuré). */
export function uploadStatusText(s: UploadStatus | undefined): string | null {
  if (!s) return null;
  if (s.state === 'sending') return 'Envoi en ligne en cours…';
  if (s.state === 'sent') return 'Publié en ligne.';
  if (s.reason === 'cloud_off') return null;
  return publishMessage({ ok: false, reason: s.reason ?? 'server', message: s.message });
}

/** États d'envoi en direct + file en attente + reprise manuelle (bouton « Réessayer »). */
export function useUploadQueue() {
  const [statuses, setStatuses] = useState<Record<string, UploadStatus>>({});
  const [pending, setPending] = useState<QueueItem[]>([]);

  useEffect(() => {
    const q = getUploadQueue();
    startUploadRetry();
    setPending(q.pending());
    return q.subscribe((id, s) => {
      setStatuses(prev => ({ ...prev, [id]: s }));
      setPending(q.pending());
    });
  }, []);

  const retry = useCallback((postId?: string) => {
    const q = getUploadQueue();
    void (postId ? q.submit(postId) : q.flush()).catch(() => undefined);
  }, []);

  return { statuses, pending, retry };
}

const CLOUD_POST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const likedRef = useRef<string[]>([]);

  useEffect(() => {
    setMine(readJson<FeedPost[]>(POSTS_KEY, []));
    likedRef.current = readJson<string[]>(POST_LIKES_KEY, []);
    setLiked(likedRef.current);
    setSeeds(seedPosts());
    setSeedCom(seedComments());
    setMyCom(readJson<FeedComment[]>(COMMENTS_KEY, []));
    // Photos restées en attente (réseau, session) : elles repartent toutes seules.
    startUploadRetry();
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
      // Photos déjà connues AVANT d'enregistrer ce post (sinon il compterait pour lui-même).
      const localBefore = post.photo ? communityPhotosFor(post.restaurantId).length : 0;
      const next = [post, ...mine];
      if (!writeJson(POSTS_KEY, next)) return false; // stockage plein : on prévient l'utilisateur
      setMine(next);
      // XP de la photo (une fois par publication), puis envoi en ligne : le comptage serveur précède l'envoi.
      const settled = post.photo
        ? countKnownPhotos(post.restaurantId, localBefore)
            .then(known => {
              const award = awardPhotoPost({ restId: post.restaurantId, hasPhoto: true, knownPhotos: known });
              if (award.message) onOnline?.(award.message);
            })
            .catch(() => undefined)
        : Promise.resolve();
      // Action explicite (bouton Publier) : on crée un compte anonyme si besoin. Échec : le post reste local ET dans la file
      // d'envoi (reprise automatique), avec la cause précise affichée à l'utilisateur.
      settled
        .then(() => getUploadQueue().submit(post.id))
        .then(s => {
          const text = uploadStatusText(s);
          if (text) onOnline?.(text);
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
    const current = likedRef.current;
    const wasLiked = current.includes(id);
    const next = wasLiked ? current.filter(x => x !== id) : [...current, id];
    likedRef.current = next;
    writeJson(POST_LIKES_KEY, next);
    setLiked(next);
    // Les cœurs des posts publiés comptent pour le classement des photos (échec silencieux : le cœur reste local).
    if (CLOUD_POST_ID.test(id)) void runWithSession(uid => setCloudPostLike(id, uid, !wasLiked)).catch(() => undefined);
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

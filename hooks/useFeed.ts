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
import { COMMENTS_KEY, FeedAuthor, FeedComment, FeedPost, POSTS_KEY, POST_LIKES_KEY, seedComments, seedPosts } from '../lib/feed';
import { STORE_EVENT, readJson, writeJson } from '../lib/store';
import { VISITS_KEY, Visit } from '../lib/visits';
import { AvatarChoice, DEFAULT_AVATAR } from '../lib/avatars';
import { computeLevel } from './useGamification';
import { cleanCommentText, editComment, type EditResult, type StoredComment } from '../components/feed/commentEdit';
import { buildFeed, isCloudPostId, isDemoPost, isVisitPost, miamCount, removeById } from '../components/feed/feedLogic';

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

/** Clés de stockage dont un changement (même depuis une autre feuille) rafraîchit le Fil. */
const WATCHED_KEYS = new Set<string>([POSTS_KEY, VISITS_KEY, 'fooder_xp', 'fooder_avatar']);

function readMe(): FeedAuthor {
  const avatar = { ...DEFAULT_AVATAR, ...readJson<Partial<AvatarChoice>>('fooder_avatar', {}) };
  const level = computeLevel(readJson<{ total?: number }>('fooder_xp', {}).total ?? 0);
  return { name: 'Toi', avatar, level };
}

const asList = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function useFeed() {
  const [mine, setMine] = useState<FeedPost[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [me, setMe] = useState<FeedAuthor | null>(null);
  const [liked, setLiked] = useState<string[]>([]);
  const [seeds, setSeeds] = useState<FeedPost[]>([]);
  const [seedCom, setSeedCom] = useState<FeedComment[]>([]);
  const [myCom, setMyCom] = useState<StoredComment[]>([]);
  const myComRef = useRef<StoredComment[]>([]);
  const [remote, setRemote] = useState<FeedPost[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const { uid, enabled } = useAuth();
  const likedRef = useRef<string[]>([]);
  const minesRef = useRef<FeedPost[]>([]);
  /** Posts en ligne que j'avais déjà aimés quand le serveur a renvoyé les compteurs (ils contiennent mon cœur). */
  const likedAtLoadRef = useRef<Set<string>>(new Set());

  const syncLocal = useCallback(() => {
    const posts = asList<FeedPost>(readJson<unknown>(POSTS_KEY, []));
    minesRef.current = posts;
    setMine(posts);
    setVisits(asList<Visit>(readJson<unknown>(VISITS_KEY, [])));
    setMe(readMe());
  }, []);

  useEffect(() => {
    syncLocal();
    likedRef.current = asList<string>(readJson<unknown>(POST_LIKES_KEY, []));
    setLiked(likedRef.current);
    setSeeds(seedPosts());
    setSeedCom(seedComments());
    myComRef.current = asList<StoredComment>(readJson<unknown>(COMMENTS_KEY, []));
    setMyCom(myComRef.current);
    // Photos restées en attente (réseau, session) : elles repartent toutes seules.
    startUploadRetry();
    // Une visite confirmée ou un post publié depuis une feuille apparaît tout de suite.
    const onStore = (e: Event) => {
      const key = (e as CustomEvent<unknown>).detail;
      if (typeof key === 'string' && WATCHED_KEYS.has(key)) syncLocal();
    };
    window.addEventListener(STORE_EVENT, onStore);
    return () => window.removeEventListener(STORE_EVENT, onStore);
  }, [syncLocal]);

  // Fil de la ville : posts publics du serveur. Hors ligne ou cloud coupé : on garde le local, sans erreur.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setRemoteLoading(true);
    fetchCloudPosts(uid)
      .then(list => {
        if (cancelled) return;
        likedAtLoadRef.current = new Set(likedRef.current.filter(id => list.some(p => p.id === id)));
        setRemote(list);
      })
      .catch(() => {
        if (!cancelled) setRemote([]);
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, uid]);

  /** Faux tant que le stockage local n'est pas lu (affiche un chargement plutôt qu'un faux vide). */
  const ready = me !== null;
  const posts = useMemo(() => (me ? buildFeed({ remote, mine, visits, seeds, me }) : []), [remote, mine, visits, seeds, me]);
  const hasDemo = posts.length > 0 && posts.every(isDemoPost);

  const addPost = useCallback((post: FeedPost, onOnline?: (message: string) => void): boolean => {
    // Idempotent : le même id ne crée jamais deux posts (double appui, rejeu).
    if (minesRef.current.some(p => p.id === post.id)) return true;
    // Photos déjà connues AVANT d'enregistrer ce post (sinon il compterait pour lui-même).
    const localBefore = post.photo ? communityPhotosFor(post.restaurantId).length : 0;
    const next = [post, ...minesRef.current];
    if (!writeJson(POSTS_KEY, next)) return false; // stockage plein : on prévient l'utilisateur
    minesRef.current = next;
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
  }, []);

  const removePost = useCallback((id: string) => {
    if (isVisitPost({ id })) return; // une visite confirmée n'est pas un post : elle ne se supprime pas d'ici
    // Aucun effet de bord dans un updater : on calcule, on écrit, puis on met l'état à jour.
    const next = removeById(minesRef.current, id);
    minesRef.current = next;
    writeJson(POSTS_KEY, next);
    setMine(next);
    setRemote(prev => removeById(prev, id));
    void deleteCloudPost(id).catch(() => undefined);
  }, []);

  const toggleLike = useCallback((id: string) => {
    const current = likedRef.current;
    const wasLiked = current.includes(id);
    const next = wasLiked ? current.filter(x => x !== id) : [...current, id];
    likedRef.current = next;
    writeJson(POST_LIKES_KEY, next);
    setLiked(next);
    // Les cœurs des posts publiés comptent pour le classement des photos (échec silencieux : le cœur reste local).
    if (isCloudPostId(id)) void runWithSession(uid => setCloudPostLike(id, uid, !wasLiked)).catch(() => undefined);
  }, []);

  /** Nombre de « miam » à afficher pour un post (voir miamCount). */
  const likeCount = useCallback(
    (post: FeedPost): number => miamCount(post.likes, liked.includes(post.id), likedAtLoadRef.current.has(post.id)),
    [liked]
  );

  const commentsFor = useCallback(
    (postId: string): StoredComment[] =>
      [...seedCom, ...myCom].filter(c => c.postId === postId).sort((x, y) => x.createdAt - y.createdAt),
    [seedCom, myCom]
  );

  const addComment = useCallback((postId: string, text: string): boolean => {
    const clean = cleanCommentText(text);
    if (!clean) return false;
    const current = myComRef.current;
    const next = [...current, { id: `mc-${Date.now()}-${current.length}`, postId, authorName: 'Toi', text: clean, createdAt: Date.now(), mine: true }];
    if (!writeJson(COMMENTS_KEY, next)) return false;
    myComRef.current = next;
    setMyCom(next);
    return true;
  }, []);

  /** Modifie MON commentaire (aucun XP, aucune notification). Renvoie le résultat pour afficher la bonne consigne. */
  const editCommentText = useCallback((commentId: string, text: string): EditResult => {
    const result = editComment(myComRef.current, commentId, text);
    if (!result.ok) return result;
    if (!writeJson(COMMENTS_KEY, result.comments)) return { ok: false, reason: 'not_found' };
    myComRef.current = result.comments;
    setMyCom(result.comments);
    return result;
  }, []);

  return { posts, liked, ready, remoteLoading, hasDemo, likeCount, addPost, removePost, toggleLike, commentsFor, addComment, editCommentText };
}

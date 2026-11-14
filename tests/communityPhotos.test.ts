import { describe, expect, it } from 'vitest';
import {
  authorLabel,
  canLike,
  cardPhotoPostId,
  displayLikes,
  heartsLabel,
  localPhotoPosts,
  mergeCommunityPosts,
  photoAlt,
  toggleSet,
  viewerLine,
} from '../components/swipe/communityPhotosLogic';
import type { CommunityPhotoPost } from '../lib/cloud/social';

const UUID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UUID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UUID_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const post = (over: Partial<CommunityPhotoPost> = {}): CommunityPhotoPost => ({
  postId: UUID_A,
  url: 'https://cdn/a.jpg',
  likes: 0,
  createdAt: 1000,
  mine: false,
  likedByMe: false,
  ...over,
});

describe('localPhotoPosts', () => {
  it('garde seulement les posts de ce resto qui ont une photo, marqués « à moi »', () => {
    const out = localPhotoPosts(
      [
        { id: 'p1', restaurantId: 'r1', photo: 'data:image/jpeg;base64,AAA', createdAt: 5, author: { name: 'Toi', avatar: { id: 'taco', bg: 'mint' }, level: 2 } },
        { id: 'p2', restaurantId: 'r2', photo: 'data:image/jpeg;base64,BBB', createdAt: 6 },
        { id: 'p3', restaurantId: 'r1', createdAt: 7 },
      ],
      'r1'
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ postId: 'p1', mine: true, likes: 0, likedByMe: false, author: { name: 'Toi', avatar: { id: 'taco', bg: 'mint' } } });
  });
  it('entrée invalide ou vide : liste vide, sans erreur', () => {
    expect(localPhotoPosts(null, 'r1')).toEqual([]);
    expect(localPhotoPosts('x', 'r1')).toEqual([]);
    expect(localPhotoPosts([null, 3, {}], 'r1')).toEqual([]);
  });
  it('un auteur absent reçoit la mascotte par défaut', () => {
    const [p] = localPhotoPosts([{ id: 'p1', restaurantId: 'r1', photo: 'data:x', createdAt: 1 }], 'r1');
    expect(p.author?.avatar.id).toBe('burger');
  });
});

describe('mergeCommunityPosts', () => {
  it('trie par cœurs décroissants puis par récence', () => {
    const out = mergeCommunityPosts(
      [],
      [
        post({ postId: UUID_A, likes: 1, createdAt: 10 }),
        post({ postId: UUID_B, likes: 5, createdAt: 1 }),
        post({ postId: UUID_C, likes: 1, createdAt: 99 }),
      ]
    );
    expect(out.map(p => p.postId)).toEqual([UUID_B, UUID_C, UUID_A]);
  });
  it('un post local déjà en ligne n\'apparaît qu\'une fois : l\'URL du serveur gagne, il reste « à moi »', () => {
    const local = localPhotoPosts([{ id: UUID_A, restaurantId: 'r1', photo: 'data:image/jpeg;base64,L', createdAt: 5 }], 'r1');
    const out = mergeCommunityPosts(local, [post({ postId: UUID_A, url: 'https://cdn/a.jpg', likes: 3, mine: false })]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ url: 'https://cdn/a.jpg', likes: 3, mine: true });
  });
  it('un post local pas encore envoyé reste visible', () => {
    const local = localPhotoPosts([{ id: 'local-1', restaurantId: 'r1', photo: 'data:x', createdAt: 5 }], 'r1');
    expect(mergeCommunityPosts(local, [])).toHaveLength(1);
  });
  it('ne modifie pas les listes reçues et ignore les photos sans URL', () => {
    const cloud = [post({ postId: UUID_A, url: '' }), post({ postId: UUID_B, url: 'https://cdn/b.jpg' })];
    const snapshot = JSON.stringify(cloud);
    const out = mergeCommunityPosts([], cloud);
    expect(JSON.stringify(cloud)).toBe(snapshot);
    expect(out.map(p => p.postId)).toEqual([UUID_B]);
  });
  it('des cœurs invalides comptent pour 0', () => {
    const out = mergeCommunityPosts([], [post({ postId: UUID_A, likes: Number.NaN, createdAt: 1 }), post({ postId: UUID_B, likes: -4, createdAt: 2 })]);
    expect(out.map(p => p.postId)).toEqual([UUID_B, UUID_A]);
  });
});

describe('canLike (jamais sur sa propre photo)', () => {
  it('autorise une photo d\'un autre, publiée en ligne', () => {
    expect(canLike(post({ postId: UUID_A, mine: false }))).toBe(true);
  });
  it('refuse sa propre photo', () => {
    expect(canLike(post({ postId: UUID_A, mine: true }))).toBe(false);
  });
  it('refuse un post qui n\'existe pas en ligne', () => {
    expect(canLike(post({ postId: 'local-1', mine: false }))).toBe(false);
  });
});

describe('displayLikes (pas de +1 en trop)', () => {
  it('mon cœur déjà compté par le serveur : le retirer fait -1', () => {
    const p = post({ likes: 4, likedByMe: true });
    expect(displayLikes(p, true)).toBe(4);
    expect(displayLikes(p, false)).toBe(3);
  });
  it('pas encore aimé : aimer fait +1', () => {
    const p = post({ likes: 4, likedByMe: false });
    expect(displayLikes(p, false)).toBe(4);
    expect(displayLikes(p, true)).toBe(5);
  });
  it('jamais négatif', () => {
    expect(displayLikes(post({ likes: 0, likedByMe: true }), false)).toBe(0);
  });
});

describe('toggleSet (mise à jour optimiste et retour arrière)', () => {
  it('ajoute puis retire sans modifier l\'ensemble d\'origine', () => {
    const base = new Set<string>(['x']);
    const added = toggleSet(base, 'y');
    expect(Array.from(base)).toEqual(['x']);
    expect(Array.from(added).sort()).toEqual(['x', 'y']);
    expect(Array.from(toggleSet(added, 'y'))).toEqual(['x']);
  });
});

describe('cardPhotoPostId (badge « Photo affichée sur la carte »)', () => {
  const entries = [post({ postId: UUID_A, url: 'https://cdn/a.jpg', likes: 5 }), post({ postId: UUID_B, url: 'https://cdn/b.jpg', likes: 1 })];
  it('désigne le post dont la photo est celle de la carte', () => {
    expect(cardPhotoPostId(entries, { image: 'https://cdn/a.jpg', photoSource: 'community' })).toBe(UUID_A);
  });
  it('rien si la carte n\'affiche pas une photo de la communauté', () => {
    expect(cardPhotoPostId(entries, { image: 'https://cdn/a.jpg', photoSource: 'site' })).toBeNull();
    expect(cardPhotoPostId(entries, { photoSource: 'community' })).toBeNull();
  });
  it('rien si la photo de la carte n\'est pas dans la liste', () => {
    expect(cardPhotoPostId(entries, { image: 'https://cdn/z.jpg', photoSource: 'community' })).toBeNull();
  });
});

describe('textes', () => {
  it('heartsLabel : accord singulier / pluriel', () => {
    expect(heartsLabel(0)).toBe('Aucun cœur');
    expect(heartsLabel(1)).toBe('1 cœur');
    expect(heartsLabel(12)).toBe('12 cœurs');
  });
  it('authorLabel : « Toi » pour mes photos, le pseudo sinon, null si inconnu', () => {
    expect(authorLabel(post({ mine: true }))).toBe('Toi');
    expect(authorLabel(post({ author: { name: 'lea', avatar: { id: 'donut', bg: 'mint' } } }))).toBe('lea');
    expect(authorLabel(post())).toBeNull();
  });
  it('photoAlt : descriptif, avec l\'auteur quand il est connu', () => {
    expect(photoAlt(post({ author: { name: 'lea', avatar: { id: 'donut', bg: 'mint' } } }), 'Chez Pierre', 1, 3)).toBe(
      'Photo 2 sur 3 de la communauté, chez Chez Pierre, par lea'
    );
    expect(photoAlt(post(), 'Chez Pierre', 0, 1)).toBe('Photo 1 sur 1 de la communauté, chez Chez Pierre');
  });
  it('viewerLine : cœurs et auteur, rien d\'inventé', () => {
    expect(viewerLine(post({ author: { name: 'lea', avatar: { id: 'donut', bg: 'mint' } } }), 12)).toBe('12 ♥ · photo de @lea');
    expect(viewerLine(post({ mine: true }), 0)).toBe('Ta photo');
    expect(viewerLine(post(), 0)).toBeNull();
    expect(viewerLine(post(), 3)).toBe('3 ♥');
  });
});

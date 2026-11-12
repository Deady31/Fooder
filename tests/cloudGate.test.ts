import { describe, expect, it, vi } from 'vitest';
import { LOCAL_FALLBACK_MESSAGE, runWithSession } from '../lib/cloud/gate';
import { FAILURE_MESSAGE } from '../lib/cloud/session';
import { cuisineSlug, distanceKm, openCardProps, swipeProps, verdictSlug } from '../lib/usageProps';
import { buildRow, createUsageTracker } from '../lib/usage';

describe('runWithSession', () => {
  it('exécute l\'action avec l\'uid de la session', async () => {
    const action = vi.fn(async (uid: string) => `ok:${uid}`);
    const r = await runWithSession(action, async () => ({ ok: true, uid: 'u1' }));
    expect(r).toEqual({ ok: true, value: 'ok:u1' });
    expect(action).toHaveBeenCalledWith('u1');
  });

  it('cloud absent : repli silencieux, action non appelée', async () => {
    const action = vi.fn();
    const r = await runWithSession(action, async () => ({ ok: false, reason: 'cloud_off', message: 'x' }));
    expect(r).toEqual({ ok: false, silent: true });
    expect(action).not.toHaveBeenCalled();
  });

  it('connexions anonymes désactivées : message clair, action non appelée', async () => {
    const action = vi.fn();
    const r = await runWithSession(action, async () => ({ ok: false, reason: 'anon_disabled', message: FAILURE_MESSAGE.anon_disabled }));
    expect(r.ok).toBe(false);
    expect(r.silent).toBeUndefined();
    expect(r.message).toBe(FAILURE_MESSAGE.anon_disabled);
    expect(action).not.toHaveBeenCalled();
  });

  it('ensure qui lève : pas d\'exception', async () => {
    const r = await runWithSession(async () => 1, async () => {
      throw new Error('boom');
    });
    expect(r).toEqual({ ok: false, message: LOCAL_FALLBACK_MESSAGE });
  });

  it('action qui lève : pas d\'exception', async () => {
    const r = await runWithSession(
      async () => {
        throw new Error('réseau');
      },
      async () => ({ ok: true, uid: 'u1' })
    );
    expect(r).toEqual({ ok: false, message: LOCAL_FALLBACK_MESSAGE });
  });

  it('session ok sans uid : traité comme un échec', async () => {
    const r = await runWithSession(async () => 1, async () => ({ ok: true }));
    expect(r.ok).toBe(false);
  });
});

describe('props de mesures', () => {
  it('cuisineSlug normalise accents et espaces', () => {
    expect(cuisineSlug('Thaï')).toBe('thai');
    expect(cuisineSlug('Du monde')).toBe('du-monde');
    expect(cuisineSlug('Crêperie')).toBe('creperie');
  });

  it('cuisineSlug : vide, non texte, texte trop long', () => {
    expect(cuisineSlug('')).toBe('autre');
    expect(cuisineSlug(undefined)).toBe('autre');
    expect(cuisineSlug('!!!')).toBe('autre');
    expect(cuisineSlug('a'.repeat(80)).length).toBeLessThanOrEqual(24);
  });

  it('distanceKm borne et arrondit', () => {
    expect(distanceKm(1400)).toBe(1);
    expect(distanceKm(undefined)).toBe(0);
    expect(distanceKm(-5)).toBe(0);
    expect(distanceKm(9e9)).toBe(100);
  });

  it('les props produites passent le filtre de la liste blanche sans perte', () => {
    const like = buildRow('swipe_like', swipeProps({ cuisine: 'Italien', distanceMeters: 2300 }));
    expect(like).toEqual({ name: 'swipe_like', props: { cuisine: 'italien', distance_km: 2 } });
    const card = buildRow('open_card', openCardProps({ cuisine: 'Thaï' }, 'swipe'));
    expect(card?.props).toEqual({ cuisine: 'thai', from: 'swipe' });
  });

  it('verdictSlug', () => {
    expect(verdictSlug('miam')).toBe('miam');
    expect(verdictSlug('Chez Paul')).toBe('autre');
  });
});

describe('refus des mesures', () => {
  it('rien n\'est mis en file ni envoyé quand l\'utilisateur refuse', async () => {
    const send = vi.fn(async () => 'ok' as const);
    const t = createUsageTracker({ cloudEnabled: () => true, optedIn: () => false, hasSession: async () => true, send, storage: null, setTimer: () => 0 });
    expect(t.track('swipe_like', { cuisine: 'thai' })).toBe(false);
    await t.flush();
    expect(t.size()).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('un nom hors liste blanche n\'est jamais mis en file', () => {
    const t = createUsageTracker({ cloudEnabled: () => true, optedIn: () => true, hasSession: async () => true, send: async () => 'ok', storage: null, setTimer: () => 0 });
    expect(t.track('swipe', { direction: 'right' })).toBe(false);
    expect(t.track('post_published', { has_photo: true })).toBe(false);
    expect(t.size()).toBe(0);
  });
});

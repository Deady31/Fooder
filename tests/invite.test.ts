import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/share', () => ({ shareLink: vi.fn() }));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));

import {
  REF_KEY,
  RefStore,
  captureRef,
  formatCode,
  inviteText,
  inviteUrl,
  isValidRef,
  parseRefFromSearch,
  readRef,
  shareInvite,
  whatsappUrl,
} from '../lib/invite';
import { shareLink } from '../lib/share';
import { track } from '../lib/analytics';

const CODE = 'a1b2c3d4e5f6';
const OTHER = '0123456789ab';

function fakeStore(initial: Record<string, string> = {}): RefStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('isValidRef', () => {
  it('accepte 12 caractères hexadécimaux minuscules', () => {
    expect(isValidRef(CODE)).toBe(true);
  });
  it.each([null, undefined, '', 'abc', 'A1B2C3D4E5F6', 'a1b2c3d4e5fg', `${CODE}0`, '<script>1234', 42 as unknown as string])('refuse %s', v => {
    expect(isValidRef(v)).toBe(false);
  });
});

describe('inviteUrl', () => {
  it('ajoute le ref', () => {
    expect(inviteUrl('https://fooder.app', CODE)).toBe(`https://fooder.app/?ref=${CODE}`);
  });
  it('sans code valide, lien simple', () => {
    expect(inviteUrl('https://fooder.app', undefined)).toBe('https://fooder.app/');
    expect(inviteUrl('https://fooder.app', 'nimporte quoi')).toBe('https://fooder.app/');
  });
  it('retire le slash final de l’origine', () => {
    expect(inviteUrl('https://fooder.app/', CODE)).toBe(`https://fooder.app/?ref=${CODE}`);
  });
});

describe('inviteText / whatsappUrl / formatCode', () => {
  it('texte court en français, sans le lien', () => {
    const t = inviteText();
    expect(t).toContain('Fooder');
    expect(t.length).toBeLessThan(160);
    expect(t).not.toContain('http');
  });
  it('lien WhatsApp encodé avec texte et lien', () => {
    const u = whatsappUrl('Salut & à toi', 'https://x.fr/?ref=abc');
    expect(u.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(u.split('text=')[1])).toBe('Salut & à toi https://x.fr/?ref=abc');
  });
  it('formate le code par blocs de 4', () => {
    expect(formatCode(CODE)).toBe('A1B2-C3D4-E5F6');
    expect(formatCode(undefined)).toBe('');
  });
});

describe('parseRefFromSearch', () => {
  it('lit un ref valide', () => {
    expect(parseRefFromSearch(`?ref=${CODE}`)).toBe(CODE);
    expect(parseRefFromSearch(`?a=1&ref=${CODE}`)).toBe(CODE);
  });
  it('refuse absent ou invalide', () => {
    expect(parseRefFromSearch('')).toBeNull();
    expect(parseRefFromSearch('?ref=')).toBeNull();
    expect(parseRefFromSearch('?ref=zzz')).toBeNull();
  });
});

describe('captureRef', () => {
  let local: ReturnType<typeof fakeStore>;
  let session: ReturnType<typeof fakeStore>;
  beforeEach(() => {
    local = fakeStore();
    session = fakeStore();
  });

  it('écrit dans localStorage ET sessionStorage', () => {
    expect(captureRef(`?ref=${CODE}`, [local, session])).toBe(CODE);
    expect(local.data[REF_KEY]).toBe(CODE);
    expect(session.data[REF_KEY]).toBe(CODE);
  });
  it('n’écrase jamais un ref déjà enregistré', () => {
    local.data[REF_KEY] = CODE;
    expect(captureRef(`?ref=${OTHER}`, [local, session])).toBeNull();
    expect(local.data[REF_KEY]).toBe(CODE);
    expect(session.data[REF_KEY]).toBeUndefined();
  });
  it('ignore un ref invalide', () => {
    expect(captureRef('?ref=hack', [local, session])).toBeNull();
    expect(local.data[REF_KEY]).toBeUndefined();
  });
  it('ignore son propre code', () => {
    expect(captureRef(`?ref=${CODE}`, [local, session], CODE)).toBeNull();
    expect(local.data[REF_KEY]).toBeUndefined();
  });
  it('tolère un stockage qui lève', () => {
    const broken: RefStore = {
      getItem: () => {
        throw new Error('no');
      },
      setItem: () => {
        throw new Error('no');
      },
    };
    expect(captureRef(`?ref=${CODE}`, [broken, session])).toBe(CODE);
    expect(session.data[REF_KEY]).toBe(CODE);
  });
});

describe('readRef', () => {
  it('lit le premier ref valide', () => {
    expect(readRef([fakeStore(), fakeStore({ [REF_KEY]: CODE })])).toBe(CODE);
  });
  it('ignore une valeur corrompue', () => {
    expect(readRef([fakeStore({ [REF_KEY]: 'x' })])).toBeNull();
  });
});

describe('shareInvite', () => {
  beforeEach(() => vi.clearAllMocks());

  it('partage le lien avec ref et trace le partage', async () => {
    vi.mocked(shareLink).mockResolvedValue('shared');
    const out = await shareInvite(CODE, 'https://fooder.app');
    expect(out).toBe('shared');
    expect(shareLink).toHaveBeenCalledWith(expect.objectContaining({ url: `https://fooder.app/?ref=${CODE}`, text: inviteText() }));
    expect(track).toHaveBeenCalledWith('share', { kind: 'app' });
  });
  it('trace aussi la copie en repli', async () => {
    vi.mocked(shareLink).mockResolvedValue('copied');
    await shareInvite(undefined, 'https://fooder.app');
    expect(track).toHaveBeenCalledWith('share', { kind: 'app' });
  });
  it.each(['cancelled', 'failed'] as const)('ne trace pas %s', async o => {
    vi.mocked(shareLink).mockResolvedValue(o);
    await shareInvite(CODE, 'https://fooder.app');
    expect(track).not.toHaveBeenCalled();
  });
});

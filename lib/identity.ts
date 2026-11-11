import { randomId, readJson, writeJson } from './store';

export interface Me {
  id: string;
  name: string;
  createdAt: number;
  /** Code d'ami du compte (présent une fois connecté) */
  code?: string;
}

const KEY = 'fooder_me';
export const MAX_NAME = 20;

const PSEUDOS = ['foodie', 'gourmand', 'croqueur', 'miam', 'papille', 'fourchette'];

/** Identité locale : un identifiant stable + un pseudo modifiable. Créée au premier appel. */
export function getMe(): Me {
  const existing = readJson<Me | null>(KEY, null);
  if (existing?.id && existing.name) return existing;
  const me: Me = {
    id: randomId('u'),
    name: `${PSEUDOS[Math.floor(Math.random() * PSEUDOS.length)]}${Math.floor(10 + Math.random() * 89)}`,
    createdAt: Date.now(),
  };
  writeJson(KEY, me);
  return me;
}

export function cleanName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, MAX_NAME);
}

export function renameMe(name: string): Me {
  const clean = cleanName(name);
  const me = getMe();
  if (!clean) return me;
  const next = { ...me, name: clean };
  writeJson(KEY, next);
  return next;
}

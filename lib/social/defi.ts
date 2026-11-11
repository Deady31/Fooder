import { readJson, writeJson } from '../store';
import { num, obj, str, ts } from './codec';

/**
 * Défi à l'aveugle : un ami te choisit un resto, tu ne vois qu'un indice.
 * Le nom se révèle quand tu décides d'y aller.
 */
export interface Defi {
  v: 1;
  id: string;
  from: string;
  restId: string;
  name: string;
  cuisine: string;
  quartier: string;
  hint: string;
  lat?: number;
  lng?: number;
  at: number;
}

export interface StoredDefi extends Defi {
  revealed: boolean;
  done: boolean;
}

export const DEFIS_KEY = 'fooder_defis';
export const MAX_HINT = 80;

export const readDefis = (): StoredDefi[] => readJson<StoredDefi[]>(DEFIS_KEY, []);

export function saveDefi(d: Defi): 'added' | 'known' {
  const list = readDefis();
  if (list.some(x => x.id === d.id)) return 'known';
  writeJson(DEFIS_KEY, [{ ...d, revealed: false, done: false }, ...list].slice(0, 30));
  return 'added';
}

export function updateDefi(id: string, patch: Partial<StoredDefi>): void {
  writeJson(DEFIS_KEY, readDefis().map(d => (d.id === id ? { ...d, ...patch } : d)));
}

export function parseDefi(raw: unknown): Defi | null {
  const o = obj(raw);
  if (!o || o.v !== 1) return null;
  const id = str(o.id, 40);
  const from = str(o.from, 20);
  const restId = str(o.restId, 40);
  const name = str(o.name, 60);
  if (!id || !/^d[a-z0-9]+$/i.test(id) || !from || !restId || !name) return null;
  const lat = num(o.lat, 42, 45);
  const lng = num(o.lng, 0, 3);
  return {
    v: 1,
    id,
    from,
    restId,
    name,
    cuisine: str(o.cuisine, 40) ?? '',
    quartier: str(o.quartier, 30) ?? '',
    hint: str(o.hint, MAX_HINT) ?? '',
    lat: lat ?? undefined,
    lng: lng ?? undefined,
    at: ts(o.at),
  };
}

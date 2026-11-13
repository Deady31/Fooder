'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Diet } from '../../data/mockRestaurants';
import { FILTER_DIETS, dietsFromProfile, toggleDiet } from '../../lib/filters';
import { DEFAULT_RADIUS_M, RADIUS_KEY, parseRadius, serializeRadius, type Radius } from '../../lib/geo/radius';
import { readJson, writeJson } from '../../lib/store';

const OPEN_NOW_KEY = 'fooder_open_now';
const DIET_FILTER_KEY = 'fooder_diet_filter';
const BUDGET_FILTER_KEY = 'fooder_budget_filter';
const CUISINE_FILTER_KEY = 'fooder_cuisine_filter';
const PROFILE_KEY = 'fooder_profile';
const PREFS_KEY = 'fooder_preferences';
/** Cran maximal du curseur : sans limite. */
export const BUDGET_MAX = 150;

export interface DeckFilters {
  openNow: boolean;
  diets: Diet[];
  radius: Radius;
  /** null = sans limite */
  maxPrice: number | null;
  /** null = toutes */
  cuisine: string | null;
  now: Date;
  ready: boolean;
  /** Incrémenté à chaque changement voulu par l'utilisateur (libère les cartes épinglées). */
  version: number;
  toggleOpenNow: () => void;
  toggleDietChip: (d: Diet) => void;
  setRadius: (r: Radius) => void;
  setBudgetAndCuisine: (maxPrice: number | null, cuisine: string | null) => void;
  clearFilters: () => void;
}

const budgetFromPrefs = (): number | null => {
  const prefs = readJson<Record<string, unknown>>(PREFS_KEY, {});
  const b = prefs && typeof prefs === 'object' ? prefs.budget : undefined;
  return typeof b === 'number' && b >= 10 && b < BUDGET_MAX ? b : null;
};

/** Filtres du deck, tous non destructifs et mémorisés (initialisés depuis le profil la première fois). */
export function useDeckFilters(): DeckFilters {
  const [openNow, setOpenNow] = useState(false);
  const [diets, setDiets] = useState<Diet[]>([]);
  const [radius, setRadiusState] = useState<Radius>(DEFAULT_RADIUS_M);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  const bump = () => setVersion(v => v + 1);

  useEffect(() => {
    setOpenNow(readJson<boolean>(OPEN_NOW_KEY, false) === true);
    const stored = readJson<unknown>(DIET_FILTER_KEY, null);
    if (Array.isArray(stored)) {
      setDiets(stored.filter((d): d is Diet => FILTER_DIETS.includes(d as Diet)));
    } else {
      let raw: string | null = null;
      try { raw = localStorage.getItem(PROFILE_KEY); } catch { /* stockage indisponible */ }
      const initial = dietsFromProfile(raw);
      setDiets(initial);
      writeJson(DIET_FILTER_KEY, initial);
    }
    setRadiusState(parseRadius(readJson<unknown>(RADIUS_KEY, null)));
    const budget = readJson<unknown>(BUDGET_FILTER_KEY, undefined);
    setMaxPrice(budget === undefined ? budgetFromPrefs() : typeof budget === 'number' && budget < BUDGET_MAX ? budget : null);
    const c = readJson<unknown>(CUISINE_FILTER_KEY, null);
    setCuisine(typeof c === 'string' && c !== '' ? c : null);
    setReady(true);
    const tick = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(tick);
  }, []);

  // Écritures hors des fonctions de mise à jour d'état (pas d'effet de bord rejoué en StrictMode).
  const toggleOpenNow = useCallback(() => {
    writeJson(OPEN_NOW_KEY, !openNow);
    setOpenNow(!openNow);
    bump();
  }, [openNow]);

  const toggleDietChip = useCallback((d: Diet) => {
    const next = toggleDiet(diets, d);
    writeJson(DIET_FILTER_KEY, next);
    setDiets(next);
    bump();
  }, [diets]);

  const setRadius = useCallback((r: Radius) => {
    setRadiusState(r);
    writeJson(RADIUS_KEY, serializeRadius(r));
    bump();
  }, []);

  const setBudgetAndCuisine = useCallback((price: number | null, c: string | null) => {
    setMaxPrice(price);
    setCuisine(c);
    writeJson(BUDGET_FILTER_KEY, price ?? BUDGET_MAX);
    writeJson(CUISINE_FILTER_KEY, c ?? '');
    bump();
  }, []);

  const clearFilters = useCallback(() => {
    setDiets([]);
    writeJson(DIET_FILTER_KEY, []);
    setOpenNow(false);
    writeJson(OPEN_NOW_KEY, false);
    bump();
  }, []);

  return { openNow, diets, radius, maxPrice, cuisine, now, ready, version, toggleOpenNow, toggleDietChip, setRadius, setBudgetAndCuisine, clearFilters };
}

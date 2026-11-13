'use client';
import { useEffect, useRef, useState } from 'react';
import { SEARCH_DEBOUNCE_MS, createDebouncer } from './reviewSearch';

/**
 * Valeur « posée » après `ms` sans changement. Renvoie aussi `flush` (applique tout de suite, ex. effacer la recherche).
 * Le minuteur est annulé au démontage.
 */
export function useDebouncedValue<T>(value: T, ms: number = SEARCH_DEBOUNCE_MS): [T, (next: T) => void] {
  const [settled, setSettled] = useState(value);
  const debouncer = useRef(createDebouncer<T>(setSettled, ms));

  useEffect(() => {
    debouncer.current.call(value);
  }, [value]);

  useEffect(() => {
    const d = debouncer.current;
    return () => d.cancel();
  }, []);

  return [settled, (next: T) => debouncer.current.flush(next)];
}

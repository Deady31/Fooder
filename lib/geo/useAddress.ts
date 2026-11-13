'use client';
import { useEffect, useRef, useState } from 'react';
import { addressClient, createDebouncer, type Address } from './address';
import type { Coords, PositionState } from './position';

export type AddressStatus = 'idle' | 'loading' | 'ok' | 'failed';

/**
 * Adresse lisible de la position (géocodage inverse BAN). Rien n'est demandé pour le centre par défaut
 * ni pour une adresse saisie (son libellé suffit) ; le client ne redemande pas sous 30 m de déplacement.
 */
export function useUserAddress(position: PositionState): { address: Address | null; status: AddressStatus } {
  const [address, setAddress] = useState<Address | null>(null);
  const [status, setStatus] = useState<AddressStatus>('idle');
  const { lat, lng } = position.coords;
  const needs = position.source === 'gps' || position.source === 'last';

  useEffect(() => {
    if (!needs) {
      setAddress(null);
      setStatus('idle');
      return;
    }
    let alive = true;
    setStatus(s => (s === 'ok' ? s : 'loading'));
    addressClient()
      .reverse({ lat, lng })
      .then(a => {
        if (!alive) return;
        setAddress(a);
        setStatus(a ? 'ok' : 'failed');
      });
    return () => {
      alive = false;
    };
  }, [lat, lng, needs]);

  return { address, status };
}

/** Autocomplétion d'adresse : debounce 300 ms, 3 caractères minimum, repli liste vide. */
export function useAddressSearch(near: Coords | null): {
  query: string;
  setQuery: (q: string) => void;
  results: Address[];
  status: AddressStatus;
} {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<Address[]>([]);
  const [status, setStatus] = useState<AddressStatus>('idle');
  const nearRef = useRef(near);
  nearRef.current = near;
  const seq = useRef(0);
  const debouncer = useRef<ReturnType<typeof createDebouncer<[string]>> | null>(null);

  if (debouncer.current === null) {
    debouncer.current = createDebouncer<[string]>(q => {
      const id = ++seq.current;
      addressClient()
        .search(q, nearRef.current)
        .then(list => {
          if (id !== seq.current) return;
          setResults(list);
          setStatus(list.length > 0 ? 'ok' : 'failed');
        });
    });
  }

  useEffect(() => () => debouncer.current?.cancel(), []);

  const setQuery = (q: string) => {
    setQueryState(q);
    if (q.trim().length < 3) {
      debouncer.current?.cancel();
      seq.current++;
      setResults([]);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    debouncer.current?.call(q);
  };

  return { query, setQuery, results, status };
}

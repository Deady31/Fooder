'use client';
import { useCallback, useEffect, useState } from 'react';
import { AvatarChoice, DEFAULT_AVATAR } from '../lib/avatars';

const KEY = 'fooder_avatar';

export function useAvatar() {
  const [avatar, setAvatarState] = useState<AvatarChoice>(DEFAULT_AVATAR);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setAvatarState({ ...DEFAULT_AVATAR, ...JSON.parse(raw) });
    } catch {
      /* stockage indisponible : on garde l'avatar par défaut */
    }
  }, []);

  const setAvatar = useCallback((next: AvatarChoice) => {
    setAvatarState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignoré */
    }
  }, []);

  return { avatar, setAvatar };
}

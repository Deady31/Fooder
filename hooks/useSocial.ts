'use client';
import { useCallback, useEffect, useState } from 'react';
import { getMe, Me } from '../lib/identity';
import { STORE_EVENT } from '../lib/store';
import { Friend, buildMySnapshot, readFriends } from '../lib/social/friends';
import { FriendSnapshot } from '../lib/social/snapshot';
import { GroupSession, readGroups } from '../lib/social/group';
import { StoredDefi, readDefis } from '../lib/social/defi';
import { Checkin, Visit, readCheckins, readVisits } from '../lib/visits';
import { WeeklyStreak, weeklyStreak } from '../lib/streak';

export interface SocialState {
  me: Me | null;
  snapshot: FriendSnapshot | null;
  friends: Friend[];
  groups: GroupSession[];
  defis: StoredDefi[];
  visits: Visit[];
  checkins: Checkin[];
  streak: WeeklyStreak;
}

const EMPTY: SocialState = {
  me: null,
  snapshot: null,
  friends: [],
  groups: [],
  defis: [],
  visits: [],
  checkins: [],
  streak: { current: 0, thisWeekDone: false, jokerUsed: false, jokersLeft: 1 },
};

function load(): SocialState {
  const visits = readVisits();
  return {
    me: getMe(),
    snapshot: buildMySnapshot(),
    friends: readFriends(),
    groups: readGroups(),
    defis: readDefis(),
    visits,
    checkins: readCheckins(),
    streak: weeklyStreak(visits.map(v => v.at)),
  };
}

/** État social local, rechargé à chaque écriture (même onglet) ou modification depuis un autre onglet. */
export function useSocial(): SocialState & { refresh: () => void } {
  const [state, setState] = useState<SocialState>(EMPTY);
  const refresh = useCallback(() => setState(load()), []);

  useEffect(() => {
    refresh();
    window.addEventListener(STORE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(STORE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  return { ...state, refresh };
}

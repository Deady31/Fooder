export interface RewardLedger {
  /** true la première fois qu'une clé est réclamée, false ensuite (anti-farm d'XP après annulation) */
  claim: (key: string) => boolean;
}

export function createRewardLedger(): RewardLedger {
  const claimed = new Set<string>();
  return {
    claim: key => {
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    },
  };
}

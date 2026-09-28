import { useCallback, useState } from "react";
import type { Tier } from "../types";

const TIER_KEY = "polygl0ts_tier";
const TIERS: readonly Tier[] = ["bronze", "silver", "gold"];

function stored(): Tier {
  try {
    const value = localStorage.getItem(TIER_KEY);
    return TIERS.includes(value as Tier) ? (value as Tier) : "bronze";
  } catch {
    return "bronze";
  }
}

/** The difficulty tab last picked on any challenge-grid page. */
export function useStoredTier(): [Tier, (tier: Tier) => void] {
  const [tier, setTier] = useState<Tier>(stored);

  const update = useCallback((next: Tier) => {
    setTier(next);
    try {
      localStorage.setItem(TIER_KEY, next);
    } catch {
      // storage can be unavailable (private mode); the tab still switches
    }
  }, []);

  return [tier, update];
}

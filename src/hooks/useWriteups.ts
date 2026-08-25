import { useQuery } from "@tanstack/react-query";
import { getWriteupCards } from "../api/extras";
import type { WriteupCard } from "../types";

/**
 * Every published writeup, grouped by challenge.
 */
export function useWriteupCards() {
  return useQuery<Record<string, WriteupCard[]>>({
    queryKey: ["writeupCards"],
    queryFn: async () => {
      const cards = await getWriteupCards();
      const byChallenge: Record<string, WriteupCard[]> = {};
      for (const card of cards) {
        (byChallenge[card.challenge_id] ??= []).push(card);
      }
      return byChallenge;
    },
  });
}

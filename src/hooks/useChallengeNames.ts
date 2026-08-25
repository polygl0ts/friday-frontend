import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listChallenges } from "../api/rctf";

/**
 * `challengeId -> name`, resolved against rCTF rather than a stored copy.
 *
 * Writeups carry only the challenge id: polygl0ts-extras keeps a submit-time
 * name for its Discord messages but never serves it, since rCTF owns the
 * current one and a rename would leave the stored copy wrong.
 *
 * Not `useChallenges`: that list is filtered down to the tiered grid, and
 * writeups exist for INTRO2 challenges too. Shares the `challengeList` query
 * key with the home page, so this is usually served from cache.
 *
 * Falls back to the id, which is all anyone could show for a challenge rCTF
 * has since deleted.
 */
export function useChallengeNames(): (challengeId: string) => string {
  const { data } = useQuery({ queryKey: ["challengeList"], queryFn: listChallenges });

  const names = useMemo(
    () => new Map((data ?? []).map((chall) => [chall.id, chall.name])),
    [data],
  );

  return (challengeId: string) => names.get(challengeId) ?? challengeId;
}

import { useQuery } from "@tanstack/react-query";
import {
  LEADERBOARD_MAX_LIMIT,
  getLeaderboard,
  getLeaderboardChallenges,
  getTeamName,
  listChallenges,
} from "../api/rctf";
import { useAuth } from "../auth/AuthContext";
import type { ChallengeWithMeta } from "../types";
import { INTRO2_TAG, tierFromTags } from "../utils";

/**
 * First bloods come from rCTF, not from a companion service.
 *
 * `/v2/leaderboard/challs` returns every challenge's `firstSolvers` - ordered,
 * so index 0 *is* the blood - in one public request, and rCTF recomputes it on
 * every accepted flag (`forceLeaderboardUpdate` in its submit path), so it is
 * not the 30s-stale snapshot its `leaderboard.updateInterval` suggests.
 * polygl0ts-extras used to poll this into its own table and serve the result
 * over an SSE stream; that was a cache of an answer rCTF already gives, and one
 * that could only drift from it - deleting a cheated solve corrected rCTF and
 * not the cache.
 *
 * `firstSolvers` carries ids and no names, hence the standings lookup below.
 */
async function resolveFirstBloods(): Promise<Record<string, string>> {
  const [challenges, board] = await Promise.all([
    getLeaderboardChallenges(),
    getLeaderboard(LEADERBOARD_MAX_LIMIT),
  ]);

  const names = new Map(board.entries.map((entry) => [entry.id, entry.name]));

  const bloodIds = new Map<string, string>();
  for (const chall of challenges) {
    const blood = chall.firstSolvers[0];
    if (blood) bloodIds.set(chall.id, blood);
  }

  // A solver the standings did not name is looked up individually - a team that
  // does not rank at all is the case `firstSolvers` cannot resolve on its own.
  // Deduped by team, since one team can hold several bloods.
  const unresolved = [...new Set([...bloodIds.values()].filter((id) => !names.has(id)))];
  await Promise.all(
    unresolved.map(async (id) => {
      // A failure here costs this one solver's name, not the whole grid.
      const name = await getTeamName(id).catch(() => "");
      if (name) names.set(id, name);
    }),
  );

  return Object.fromEntries(
    [...bloodIds].map(([challengeId, teamId]) => [challengeId, names.get(teamId) ?? teamId]),
  );
}

export function useChallenges() {
  const { profile, isLoggedIn } = useAuth();
  const solves = profile?.solves ?? [];
  const solvedIds = new Set(solves.map((s) => s.id));
  // Challenges this team drew first blood on, straight off its own v2 profile.
  // The authoritative answer for the one case where the leaderboard could still
  // lag - the flag you just submitted - and it costs nothing: the profile is
  // already fetched, and already refetched on a correct flag. This is what the
  // old `POST /challs/refresh-bloods` probe existed to do.
  const myBloods = new Set(solves.filter((s) => s.bloodIndex === 0).map((s) => s.id));
  const myName = profile?.name;

  return useQuery<ChallengeWithMeta[]>({
    queryKey: ["challenges", [...solvedIds].sort().join(","), [...myBloods].sort().join(",")],
    enabled: isLoggedIn,
    queryFn: async () => {
      const [challenges, firstBloods] = await Promise.all([
        listChallenges(),
        // The grid is still worth showing without blood markers.
        resolveFirstBloods().catch(() => ({}) as Record<string, string>),
      ]);

      return challenges.flatMap((chall): ChallengeWithMeta[] => {
        if ((chall.tags ?? []).includes(INTRO2_TAG)) return [];

        const tier = tierFromTags(chall.tags);
        if (tier === null) {
          console.warn(
            `challenge "${chall.id}" has no tier/* tag and is not on the INTRO2 ` +
              `track, so it cannot be shown in the grid. Add tier/bronze, ` +
              `tier/silver or tier/gold to it in rCTF.`,
          );
          return [];
        }

        // Our own blood wins over the standings-derived name: it is the same
        // team either way, but this branch is right immediately.
        const ownBlood = myBloods.has(chall.id) ? myName : undefined;

        return [
          {
            ...chall,
            tier,
            points_current: chall.points,
            solved: solvedIds.has(chall.id),
            solveCount: chall.solves ?? 0,
            firstBlood: ownBlood ?? firstBloods[chall.id] ?? null,
          } satisfies ChallengeWithMeta,
        ];
      });
    },
  });
}

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
import {
  INTRO2_TAG,
  archiveFromTags,
  isJuicerFromTag,
  tierFromTags,
} from "../utils";

/**
 * First bloods come from rCTF, not from a companion service.
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

  const unresolved = [
    ...new Set([...bloodIds.values()].filter((id) => !names.has(id))),
  ];
  await Promise.all(
    unresolved.map(async (id) => {
      // A failure here costs this one solver's name, not the whole grid.
      const name = await getTeamName(id).catch(() => "");
      if (name) names.set(id, name);
    }),
  );

  return Object.fromEntries(
    [...bloodIds].map(([challengeId, teamId]) => [
      challengeId,
      names.get(teamId) ?? teamId,
    ]),
  );
}

export function useChallenges() {
  const { profile, isLoggedIn } = useAuth();
  const solves = profile?.solves ?? [];
  const solvedIds = new Set(solves.map((s) => s.id));
  const myBloods = new Set(
    solves.filter((s) => s.bloodIndex === 0).map((s) => s.id),
  );
  const myName = profile?.name;

  return useQuery<ChallengeWithMeta[]>({
    queryKey: [
      "challenges",
      [...solvedIds].sort().join(","),
      [...myBloods].sort().join(","),
    ],
    enabled: isLoggedIn,
    queryFn: async () => {
      const [challenges, firstBloods] = await Promise.all([
        listChallenges(),
        resolveFirstBloods().catch(() => ({}) as Record<string, string>),
      ]);

      const withMeta = challenges.flatMap((chall): ChallengeWithMeta[] => {
        if ((chall.tags ?? []).includes(INTRO2_TAG)) return [];

        const tier = tierFromTags(chall.tags);
        const archived = archiveFromTags(chall.tags);
        const juicer = isJuicerFromTag(chall.tags);
        if (tier === null && archived === null && !juicer) {
          console.warn(
            `challenge "${chall.id}" has no tier/*, archive/* or juicer tag ` +
              `and is not on the INTRO2 track, so it cannot be shown in any ` +
              `grid. Add tier/bronze, tier/silver, tier/gold, an archive/* tag ` +
              `or juicer to it in rCTF.`,
          );
          return [];
        }

        const ownBlood = myBloods.has(chall.id) ? myName : undefined;

        return [
          {
            ...chall,
            tier,
            archived,
            juicer,
            points_current: chall.points,
            solved: solvedIds.has(chall.id),
            solveCount: chall.solves ?? 0,
            firstBlood: ownBlood ?? firstBloods[chall.id] ?? null,
          } satisfies ChallengeWithMeta,
        ];
      });

      return withMeta.sort(
        (a, b) => a.sortWeight - b.sortWeight || a.name.localeCompare(b.name),
      );
    },
  });
}

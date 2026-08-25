import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboardChallenges } from "../api/rctf";
import { useAuth } from "../auth/AuthContext";
import type { LeaderboardChallenge } from "../api/rctf";
import type { RctfLeaderboardEntry } from "../types";

/**
 * Teams x challenges solve grid, shown under the scoreboard: one row per team,
 * one column per challenge, grouped by category. A solve plants a flag - red
 * for the first blood, white for everyone after it.
 *
 * Both halves of the join arrive already fetched, so this component issues
 * exactly one request of its own:
 *
 * - **who solved what** rides in on `teams`. v2 leaderboard entries carry the
 *   team's whole `solves[]`, so the grid is a lookup rather than a fan-out.
 *   (An earlier version called `/challs/:id/solves` once per column, on the
 *   belief that rCTF had no bulk equivalent. v2 has one.)
 * - **the columns, and who drew blood** come from `/v2/leaderboard/challs`.
 *
 * Bloods deliberately come from that route's `firstSolvers` rather than from
 * the standings: the first team to solve something may sit below the page
 * being displayed, or not rank at all (a team whose only solves are the
 * zero-point INTRO2 track). Ordering the visible teams by solve time would
 * then hand the red flag to whoever is merely earliest *on screen*.
 */

/** Drawn rather than an emoji flag: U+1F6A9/U+1F3F3 render at the mercy of the
 *  platform's emoji font and ignore `color`, so they can't be recoloured to
 *  match the theme or be sized to sit on the grid's baseline. */
function Flag({ first }: { first: boolean }) {
  return (
    <svg
      className={`matrix-flag${first ? " first" : ""}`}
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
    >
      <path d="M4.4 1.6v12.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.4 2.5h7.9l-2.3 3 2.3 3H5.4z" fill="currentColor" />
    </svg>
  );
}

// Cycled over the categories present, in sorted order, so a given category
// keeps its colour for as long as the challenge set does.
const CATEGORY_COLORS = [
  "#ff2b3e",
  "#4fae5a",
  "#f5a623",
  "#7d5cff",
  "#2bb8d8",
  "#ff6fb5",
  "#8ec07c",
];

/** `#rrggbb` + alpha -> `rgba(...)`, for the per-category column tints. */
function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function truncate(name: string, max = 20): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

interface Group {
  category: string;
  color: string;
  challenges: LeaderboardChallenge[];
}

/** Challenges grouped into the column bands: categories A-Z, and inside each
 *  the highest-value challenge first (matching how the grid reads). */
function groupByCategory(challenges: LeaderboardChallenge[]): Group[] {
  const byCategory = new Map<string, LeaderboardChallenge[]>();
  for (const chall of challenges) {
    const key = chall.category || "other";
    const group = byCategory.get(key);
    if (group) group.push(chall);
    else byCategory.set(key, [chall]);
  }
  return [...byCategory.keys()].sort().map((category, i) => ({
    category,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    challenges: byCategory
      .get(category)!
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)),
  }));
}

/** How a solve is described in a cell's tooltip. rCTF publishes the first
 *  three solvers of each challenge and no finer position, so a later solve is
 *  just a solve. */
const BLOOD_LABEL = ["drew first blood on", "took second blood on", "took third blood on"];

export function SolveMatrix({ teams }: { teams: RctfLeaderboardEntry[] }) {
  const { profile } = useAuth();

  const challengesQuery = useQuery({
    queryKey: ["leaderboardChallenges"],
    queryFn: getLeaderboardChallenges,
    // Start-gated like the standings themselves, and the scoreboard is public -
    // an error here means "no matrix yet", not something worth retrying.
    retry: false,
  });

  const challenges = challengesQuery.data;

  /** team id -> the challenge ids it has solved. */
  const solved = useMemo(
    () => new Map(teams.map((t) => [t.id, new Set((t.solves ?? []).map((s) => s.id))])),
    [teams],
  );

  /** challenge id -> team id -> blood position (0, 1 or 2). */
  const bloods = useMemo(
    () =>
      new Map(
        (challenges ?? []).map((c) => [
          c.id,
          new Map(c.firstSolvers.map((teamId, place) => [teamId, place])),
        ]),
      ),
    [challenges],
  );

  const groups = useMemo(() => groupByCategory(challenges ?? []), [challenges]);
  const columns = groups.flatMap((g) => g.challenges.map((c) => ({ chall: c, group: g })));

  if (challengesQuery.isLoading) return <div className="loading">Loading solve matrix...</div>;
  if (challengesQuery.error) {
    return (
      <div className="empty-text" style={{ padding: "16px 0" }}>
        The challenge list isn&apos;t available yet, so there&apos;s no solve matrix to show.
      </div>
    );
  }
  if (columns.length === 0 || teams.length === 0) {
    return (
      <div className="empty-text" style={{ padding: "16px 0" }}>
        No challenges to chart yet.
      </div>
    );
  }

  return (
    <>
      <div className="matrix-scroll">
      <table className="matrix">
        <thead>
          <tr>
            <th className="matrix-team matrix-corner" />
            {columns.map(({ chall, group }, i) => (
              <th
                key={chall.id}
                className={`matrix-chall${i > 0 && columns[i - 1].group !== group ? " group-start" : ""}`}
                style={{ background: withAlpha(group.color, 0.035) }}
              >
                <div className="matrix-chall-name" style={{ color: group.color }} title={chall.name}>
                  {truncate(chall.name)}
                </div>
              </th>
            ))}
            <th className="matrix-tail" />
          </tr>
          <tr>
            <th className="matrix-team matrix-corner" />
            {columns.map(({ chall, group }, i) => (
              <th
                key={chall.id}
                className={`matrix-points${i > 0 && columns[i - 1].group !== group ? " group-start" : ""}`}
                style={{ background: withAlpha(group.color, 0.035) }}
              >
                {chall.points}
              </th>
            ))}
            <th className="matrix-tail" />
          </tr>
          <tr>
            <th className="matrix-team matrix-corner">
              <span className="matrix-corner-label">TEAM</span>
            </th>
            {groups.map((group) => (
              <th
                key={group.category}
                className="matrix-cat"
                colSpan={group.challenges.length}
                style={{
                  background: withAlpha(group.color, 0.1),
                  color: group.color,
                  borderTop: `1px solid ${withAlpha(group.color, 0.35)}`,
                }}
                title={group.category}
              >
                <span className="matrix-cat-label">{group.category.toUpperCase()}</span>
              </th>
            ))}
            <th className="matrix-tail" />
          </tr>
        </thead>

        <tbody>
          {teams.map((team, rank) => (
            <tr key={team.id} className={team.id === profile?.id ? "me" : undefined}>
              <th className="matrix-team" scope="row">
                <div className="matrix-team-inner">
                  <span className="matrix-team-rank">{rank + 1}</span>
                  <span className="matrix-team-name" title={team.name}>
                    {team.name}
                  </span>
                  <span className="matrix-team-score">{team.score}</span>
                </div>
              </th>
              {columns.map(({ chall, group }, i) => {
                const hasSolved = solved.get(team.id)?.has(chall.id) ?? false;
                const blood = bloods.get(chall.id)?.get(team.id);
                const groupStart = i > 0 && columns[i - 1].group !== group;
                return (
                  <td
                    key={chall.id}
                    className={`matrix-cell${groupStart ? " group-start" : ""}`}
                    style={{ background: withAlpha(group.color, 0.035) }}
                    title={
                      hasSolved
                        ? `${team.name} ${
                            blood === undefined ? "solved" : BLOOD_LABEL[blood]
                          } ${chall.name}`
                        : `${team.name} has not solved ${chall.name}`
                    }
                  >
                    {hasSolved ? (
                      <Flag first={blood === 0} />
                    ) : (
                      <span className="matrix-dot" />
                    )}
                  </td>
                );
              })}
              <td className="matrix-tail" />
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

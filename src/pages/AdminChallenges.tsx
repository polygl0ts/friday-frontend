import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getLeaderboard,
  getLeaderboardChallenges,
  listAdminChallenges,
} from "../api/rctf";
import { staticFlag } from "../utils";
import { HideChallButton } from "../components/HideChallButton";
import { ReleaseButton } from "../components/ReleaseButton";
import { DeleteFlagButton } from "../components/DeleteFlagButton";
import { ChangeTierButton } from "../components/ChangeTierButton";
import type { RctfAdminChallenge, RctfFlagEntry } from "../types";
import { AddFlagButton } from "../components/AddFlagButton";
import { ChangePointsButton } from "../components/ChangePointsButton";

/**
 * Every challenge rCTF has.
 */

/** Category first, then name.*/
function byCategoryThenName(
  a: RctfAdminChallenge,
  b: RctfAdminChallenge,
): number {
  const category = a.category.localeCompare(b.category, undefined, {
    sensitivity: "base",
  });
  return category !== 0
    ? category
    : a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

const FLAG_MASK = "•".repeat(12);

/**
 * One flag, hidden until clicked.
 */
function Flag({
  challId,
  flags,
  entry,
}: {
  challId: string;
  flags: RctfFlagEntry[];
  entry: RctfFlagEntry;
}) {
  const [revealed, setRevealed] = useState(false);
  const flag = staticFlag(entry);

  if (flag === null) {
    return (
      <code
        className="admin-flag admin-flag-computed"
        title={`Computed by ${entry.provider} at submit time`}
      >
        {entry.provider}
      </code>
    );
  }

  return (
    <>
      <button
        type="button"
        className="admin-flag admin-flag-secret"
        onClick={() => setRevealed((r) => !r)}
        aria-pressed={revealed}
        aria-label={revealed ? undefined : "Flag hidden. Reveal it."}
        title={revealed ? "Hide" : "Reveal"}
      >
        {revealed ? (
          <code>{flag}</code>
        ) : (
          <span className="token-mask" aria-hidden="true">
            {FLAG_MASK}
          </span>
        )}
      </button>
      <DeleteFlagButton challengeId={challId} flags={flags} flag={entry} />
    </>
  );
}

/** One flag per line: a challenge accepts any of its entries, and collapsing
 *  them to the first would hide the alternates that make a solve count. */
function FlagCell({
  challId,
  flags,
}: {
  challId: string;
  flags: RctfFlagEntry[];
}) {
  if (flags.length === 0)
    return <span className="admin-cell-empty">no flag</span>;

  return (
    <span className="admin-flags">
      {flags.map((entry, i) => (
        <Flag key={i} challId={challId} flags={flags} entry={entry} />
      ))}
    </span>
  );
}

/**
 * Solves as `x/y` - x teams out of y have it.
 */
function SolvesCell({
  solveCount,
  teamCount,
}: {
  solveCount: number | null;
  teamCount: number | null;
}) {
  if (solveCount === null)
    return (
      <span
        className="admin-cell-empty"
        title="Only released, visible challenges are counted on the leaderboard."
      >
        &mdash;
      </span>
    );

  const share = teamCount ? solveCount / teamCount : null;
  return (
    <span
      className="admin-solves"
      title={
        share === null ? undefined : `${Math.round(share * 100)}% of teams`
      }
    >
      <span
        style={{
          color:
            solveCount === teamCount
              ? "var(--text-bright)"
              : "var(--text-dimmer)",
        }}
      >
        {solveCount}
      </span>
      {teamCount !== null && (
        <span className="admin-solves-total">/{teamCount}</span>
      )}
    </span>
  );
}

export function AdminChallenges() {
  const challengesQuery = useQuery({
    queryKey: ["adminChallenges"],
    queryFn: listAdminChallenges,
  });
  const teamsQuery = useQuery({
    queryKey: ["leaderboardTotal"],
    queryFn: () => getLeaderboard(1),
  });
  const teamCount = teamsQuery.data?.total ?? null;
  // Required because full list doesn't have the solve count.
  const solvesQuery = useQuery({
    queryKey: ["leaderboardChallenges"],
    queryFn: getLeaderboardChallenges,
    retry: false,
  });
  const solvesById = useMemo(
    () => new Map((solvesQuery.data ?? []).map((c) => [c.id, c.solves])),
    [solvesQuery.data],
  );

  const challenges = [...(challengesQuery.data ?? [])].sort(byCategoryThenName);
  const hiddenCount = challenges.filter((c) => c.hidden).length;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          margin: "30px 0 16px",
        }}
      >
        <div className="page-subtitle" style={{ margin: 0 }}>
          ALL CHALLENGES
        </div>
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.15em",
            color: "var(--text-dimmer)",
          }}
        >
          {challenges.length} TOTAL &middot; {hiddenCount} HIDDEN
        </span>
      </div>

      {challengesQuery.isLoading && <div className="loading">Loading...</div>}
      {challengesQuery.error && (
        <div className="error-text">
          {(challengesQuery.error as Error).message}
        </div>
      )}
      {challengesQuery.data?.length === 0 && (
        <div className="empty-text">rCTF has no challenges configured.</div>
      )}

      {challenges.length > 0 && (
        <div className="table">
          <div className="table-row table-challs table-head">
            <span>NAME</span>
            <span>CATEGORY</span>
            <span>POINTS</span>
            <span>SOLVES</span>
            <span>FLAG</span>
            <span>TAGS</span>
            <span>HIDDEN</span>
            <span>RELEASE</span>
          </div>

          {challenges.map((chall) => (
            <div className="table-row table-challs" key={chall.id}>
              <span>
                <span style={{ color: "var(--text-bright)" }}>
                  {chall.name}
                </span>
                {chall.id !== chall.name && (
                  <span className="admin-chall-id">{chall.id}</span>
                )}
              </span>
              <span style={{ color: "var(--text-dim)" }}>{chall.category}</span>
              <ChangePointsButton
                challengeId={chall.id}
                challengeName={chall.name}
                minChallPoints={chall.points.min}
                maxChallPoints={chall.points.max}
              />
              <SolvesCell
                solveCount={solvesById.get(chall.id) ?? null}
                teamCount={teamCount}
              />
              <AddFlagButton
                challengeId={chall.id}
                challengeName={chall.name}
                flags={chall.flags}
              />
              <FlagCell challId={chall.id} flags={chall.flags} />
              <ChangeTierButton
                challengeId={chall.id}
                challengeName={chall.name}
                tags={chall.tags}
              />
              <HideChallButton challengeId={chall.id} hidden={chall.hidden} />
              <ReleaseButton
                challengeId={chall.id}
                challengeName={chall.name}
                releaseTime={chall.releaseTime}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

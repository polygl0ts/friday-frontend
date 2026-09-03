// rCTF-shaped types. The challenge list is read from v2 (see api/rctf.ts);
// these mirror `good-challenges-v2.ts` in rCTF's own types package.

export interface RctfChallengeFile {
  name: string;
  url: string;
  size: number | null;
}

export interface RctfChallenge {
  id: string;
  name: string;
  category: string;
  description: string;
  points: number;
  tags?: string[] | null;
  solves?: number;
  files?: RctfChallengeFile[];
}

/**
 * One flag entry on a challenge's admin view. rCTF validates a submission
 * against every entry and solves the challenge if any of them accepts, so a
 * challenge has a *list* of these rather than one flag.
 *
 * `config` is provider-specific and deliberately untyped here: only
 * `flags/static` carries a literal string (in `config.flag`), and every other
 * provider computes its answer server-side. Read it through `staticFlag` in
 * utils.ts rather than indexing into it.
 */
export interface RctfFlagEntry {
  provider: string;
  config?: Record<string, unknown> | null;
}

/**
 * A challenge as `/v2/admin/challs` sees it - mirrors
 * `good-admin-challenge-v2.ts` in rCTF's types package.
 *
 * Not a superset of `RctfChallenge`: `points` here is the configured
 * `{min, max}` curve endpoints, where the player-facing list sends the single
 * *current* score. The two names collide and mean different things, which is
 * why this is its own type rather than an extension.
 *
 * Fields rCTF also returns but nothing here reads yet - `instancerConfig`,
 * `adminBotConfig`, `scoring` - are left off until something needs them.
 */
export interface RctfAdminChallenge {
  id: string;
  name: string;
  category: string;
  description: string;
  author: string;
  points: { min: number; max: number };
  files: RctfChallengeFile[];
  flags: RctfFlagEntry[];
  tags: string[] | null;
  /** Teams that have solved it. Counted over every challenge, hidden ones
   *  included - the public `/v2/challs` list only reports solves for
   *  challenges it shows in the first place. */
  solveCount: number;
  /** Hidden challenges are absent from `/v2/challs` entirely, so this is the
   *  only listing that shows they exist. */
  hidden: boolean;
  /** Scheduled release, Unix milliseconds, or null for "released already". */
  releaseTime: number | null;
  sortWeight: number | null;
  tiebreakEligible: boolean;
}

/**
 * A team as `/v2/admin/users` sees it - mirrors `good-admin-users-v2.ts` in
 * rCTF's types package.
 *
 * The only listing that reports *registered* teams: the leaderboard drops
 * banned teams and unranked ones, which is why `banned` and `email` exist here
 * and nowhere else the frontend can reach.
 *
 * `division` is one string, not a list - rCTF puts a team in exactly one.
 * Fields the route also returns but nothing reads yet - `countryCode`,
 * `statusText`, `createdAt` - are left off until something needs them.
 */
export interface RctfAdminUser {
  id: string;
  name: string;
  /** Null when unset - rCTF allows teams created without one. */
  email: string | null;
  division: string;
  /** rCTF's permission bitmask. See `permissionNames` in utils.ts. */
  perms: number;
  /** A banned team still authenticates; it just stops ranking. */
  banned: boolean;
  score: number;
  solveCount: number;
  /** Resolved to an absolute URL by `listAdminUsers`, for the same reason
   *  `RctfProfile.avatarUrl` is. `null` when the team has no picture. */
  avatarUrl: string | null;
}

/**
 * What produced a submission. `flag` is a flag typed into a challenge;
 * `admin_bot` is a job sent to a challenge's admin bot, logged in the same
 * table and never carrying a flag.
 */
export type RctfSubmissionKind = "flag" | "admin_bot";

/**
 * How rCTF answered a submission - `SubmissionResult` in its types package,
 * in the enum's own order, which is also the order `sortBy=result` sorts in.
 *
 * The first four belong to flag submissions and the last four to admin-bot
 * jobs. `cheated` means the flag was valid but issued to *another* team: a
 * per-team flag that was shared. The solve is still recorded.
 */
export type RctfSubmissionResult =
  | "correct"
  | "cheated"
  | "incorrect"
  | "already_solved"
  | "queued"
  | "active_job"
  | "invalid_input"
  | "bad_instancer_state";

/** The columns `/v2/admin/submissions` will sort on. Anything else is a 400. */
export type RctfSubmissionSortBy =
  "createdAt" | "challenge" | "team" | "ip" | "kind" | "result";

/**
 * One row of `/v2/admin/submissions` - rCTF's submission log, and the only
 * place a *rejected* flag is visible at all.
 *
 * Not a solve list: a solve is what survived, where this is every attempt rCTF
 * evaluated, wrong guesses included, with the literal string that was typed in
 * `details.submittedFlag`. What it is *not* is a record of every request -
 * rate-limited submissions, and submissions from a banned team or to an unknown
 * challenge, are refused before a row is written.
 *
 * The team fields are denormalised onto every row by rCTF, and two of them -
 * `userCountryCode`, `userStatusText` - reach the frontend only here;
 * `/v2/admin/users` returns them but `RctfAdminUser` does not carry them.
 */
export interface RctfSubmission {
  /** The log row's own id. Not a solve id - see `relatedId`. */
  id: string;
  kind: RctfSubmissionKind;
  challengeId: string;
  /** Falls back to `challengeId` server-side when the challenge is deleted. */
  challengeName: string;
  /** `"deleted"` when the challenge is gone - rCTF's own placeholder. */
  challengeCategory: string;
  userId: string;
  userName: string;
  userDivision: string;
  /** Resolved to an absolute URL by `listTeamSubmissions`. */
  userAvatarUrl: string | null;
  userCountryCode: string | null;
  userStatusText: string | null;
  userBanned: boolean;
  /** `"unknown"` when rCTF had no address for the request. */
  ip: string;
  result: RctfSubmissionResult;
  /** On a `cheated` row, the team the flag was issued to. Null otherwise, and
   *  `cheatedFromName` is null on its own when that team has been deleted. */
  cheatedFromId: string | null;
  cheatedFromName: string | null;
  /**
   * Result-specific payload. For a flag submission: `submittedFlag`, plus
   * `matchedFlagIndex`/`matchedFlagProvider`/`matchedFlagConfig` when one
   * matched. For an admin-bot job: the `inputs` and the config revision. Empty
   * for a solve an admin granted by hand - there was no flag to record.
   */
  details: Record<string, unknown>;
  /** The solve this submission created, or the admin-bot job it queued. */
  relatedId: string | null;
  /** Parsed to Unix milliseconds by `listTeamSubmissions`; null when rCTF sent
   *  something unparseable - see `parseRctfTimestamp`. */
  createdAt: number | null;
  /** Exactly what rCTF sent, so an unparseable timestamp can still be shown. */
  createdAtRaw: string;
}

export interface RctfSolve {
  id: string;
  category?: string;
  name?: string;
  points?: number;
  createdAt?: number;
  /** 0 for a first blood, 1 or 2 for the next two, null after that. v2 only. */
  bloodIndex?: number | null;
}

export interface RctfProfile {
  id: string;
  name: string;
  score: number;
  globalPlace?: number;
  divisionPlace?: number;
  solves: RctfSolve[];
  /**
   * Long-lived credential that logs this team in on another device, and the
   * only way back into an account whose browser storage was cleared. Returned
   * by `/users/me` and never by the public `/users/:id` - so it is present on
   * the signed-in team's own profile and nowhere else.
   *
   * Treat it like a password: rCTF also accepts it for account recovery.
   */
  teamToken?: string;
  /** v2 only. A banned team still authenticates; it just stops ranking. */
  banned?: boolean;
  /** rCTF's permission bitmask - `null`/absent for a plain team, and `0` on a
   *  real instance. Read via `isAdminPerms`, which is what gates the Admin
   *  nav; polygl0ts-extras reads the same bit off the same response. */
  perms?: number | null;
  /**
   * v2 only. Team avatar, ready to render: `getMyProfile` resolves it to an
   * absolute URL, because rCTF's local upload provider answers with a path
   * relative to *rCTF's* origin and this app is served from another one.
   * `null` means the team has no avatar - there is no second empty value.
   */
  avatarUrl?: string | null;
}

/** One entry in a v2 leaderboard row's `solves[]`. `id` is the *challenge*. */
export interface RctfLeaderboardSolve {
  id: string;
  solveTime: number;
}

export interface RctfLeaderboardEntry {
  id: string;
  name: string;
  score: number;
  /**
   * Every challenge this team has solved. v2 only - v1 entries stop at
   * `score`, which is why there is no `solveCount` here: the field never
   * existed on either version, and reading one left the scoreboard's SOLVES
   * column blank on any real instance.
   */
  solves?: RctfLeaderboardSolve[];
  /**
   * v2 only, and resolved to an absolute URL by the leaderboard readers for
   * the same reason `RctfProfile.avatarUrl` is. `null` when the team has no
   * picture - which is most of them, so the row has to have a fallback.
   */
  avatarUrl?: string | null;
}

export interface RctfLeaderboardPoint {
  id: string;
  name: string;
  points: { score: number; time: number }[];
}

// ---------- derived / frontend-only ----------

export type Tier = "bronze" | "silver" | "gold";

/** Which archive a challenge belongs to. A separate axis from `Tier`: an
 *  archived challenge still has a difficulty. */
export type ArchivedCat = "general" | "Lake25" | "Lake26";

export const TAG_OPTIONS = [
  "tier/bronze",
  "tier/silver",
  "tier/gold",
  "archived/general",
  "archived/Lake25",
  "archived/Lake26",
] as const;

/** Tier or archived cna be null, need to be foolguarded */
export interface ChallengeWithMeta extends RctfChallenge {
  tier: Tier | null;
  archived: ArchivedCat | null;
  points_current: number;
  solved: boolean;
  solveCount: number;
  firstBlood: string | null;
}

// ---------- polygl0ts-extras ----------

export type WriteupStatus = "pending" | "published" | "rejected";

/** Grid view. Carries no body at all - every published writeup is listed to
 *  everyone, and only the body is ever gated. */
export interface WriteupCard {
  id: number;
  /** No name: rCTF owns it, and the client already has the challenge list.
   *  Resolve with `useChallengeNames`. */
  challenge_id: string;
  team_name: string;
  summary: string;
  created_at: string;
  votes: number;
  voted: boolean;
}

export type WriteupSort = "new" | "top";

export interface Writeup {
  id: number;
  /** See `WriteupCard.challenge_id`. */
  challenge_id: string;
  team_id: string;
  team_name: string;
  summary: string;
  /** The spoiler-free half, readable by anyone logged in. */
  intro_md: string;
  solution_md: string | null;
  url: string | null;
  redacted: boolean;
  status: WriteupStatus;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  votes: number;
  voted: boolean;
}

export interface Deck {
  id: number;
  title: string;
  meta: string;
  file_url: string;
  sort_order: number;
}

/** The single writeup-lifecycle webhook. First bloods are announced by rCTF's
 *  own blood bot, configured in rCTF's config file - not here. */
export interface DiscordConfig {
  webhook_configured: boolean;
}

export type DiscordConfigUpdate = {
  webhook_url?: string;
};

export interface DiscordTestResult {
  ok: boolean;
  detail: string;
}

export interface Intro2Step {
  challenge_id: string;
  step: number;
  title: string;
  description: string;
  status: "done" | "in_progress" | "locked";
  category: string;
  files: RctfChallengeFile[];
}

/** Only what polygl0ts-extras owns. Player and challenge counts come from
 *  rCTF directly - see `pages/Admin.tsx`. */
export interface AdminStats {
  submissions: number;
  pending_writeups: number;
}

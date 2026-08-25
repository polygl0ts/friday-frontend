/**
 * Client for rCTF's own REST API - auth, challenges, flag submission,
 * leaderboard.
 */
import { ApiError, request } from "./client";
import { resolveFileUrl, parseRctfTimestamp, STATIC_FLAG_PROVIDER, staticFlag } from "../utils";
import { rctfOrigin as ORIGIN } from "../config";
import type {
  RctfAdminChallenge,
  RctfAdminUser,
  RctfChallenge,
  RctfFlagEntry,
  RctfLeaderboardEntry,
  RctfLeaderboardPoint,
  RctfProfile,
  RctfSubmission,
  RctfSubmissionKind,
  RctfSubmissionResult,
  RctfSubmissionSortBy,
} from "../types";

// Some route weren't ported into the v2 so v1 is still necessary.
// The only one still on v1 are auth and submit
const V1_BASE = "/api/v1";
const V2_BASE = "/api/v2";

function unwrap<T>(res: unknown): T {
  if (res && typeof res === "object" && "data" in res) {
    return (res as { data: T }).data;
  }
  return res as T;
}

export interface RegisterResult {
  /**
   * `null` when rCTF emailed a login link instead of creating the team now. 
   * A non-null value means the team exists and this session is authenticated.
   */
  authToken: string | null;
  /** Only present alongside an `authToken`. See `RctfProfile.teamToken`. */
  teamToken: string | null;
}

/**
 * Create a team.
 */
export async function register(email: string, name: string): Promise<RegisterResult> {
  const res = await request<unknown>(ORIGIN, `${V2_BASE}/auth/register`, {
    method: "POST",
    body: { email, name },
    auth: false,
  });
  // `goodVerifySent` carries no `data` at all, so both fields fall to null.
  const data = unwrap<{ authToken?: string; teamToken?: string }>(res);
  return { authToken: data?.authToken ?? null, teamToken: data?.teamToken ?? null };
}

export type VerifyKind = "register" | "team" | "update";

export interface VerifyInfo {
  /** What submitting this token will actually do. */
  kind: VerifyKind;
  email: string | null;
  name?: string;
}

/**
 * Read what a verification token is for *without spending it*.
 */
export async function getVerifyInfo(token: string): Promise<VerifyInfo> {
  const res = await request<unknown>(
    ORIGIN,
    `${V2_BASE}/auth/verify-info?token=${encodeURIComponent(token)}`,
    { auth: false },
  );
  return unwrap<VerifyInfo>(res);
}

export interface VerifyResult {
  authToken: string;
  teamToken: string | null;
}

/**
 * Spend a verification token. One request body field, `verifyToken`: the extra
 * `token` this used to send alongside it was dev-mock compatibility that
 * outlived the mock.
 */
export async function verify(verifyToken: string): Promise<VerifyResult> {
  const res = await request<unknown>(ORIGIN, `${V2_BASE}/auth/verify`, {
    method: "POST",
    body: { verifyToken },
    auth: false,
  });
  const data = unwrap<{ authToken: string; teamToken?: string }>(res);
  return { authToken: data.authToken, teamToken: data.teamToken ?? null };
}

/**
 * Email yourself a login link for a team that already exists.
 *
 * The other half of running with a mail provider: without this, a player who
 * lost their team token has no way back into their account, since rCTF has no
 * passwords. Answers `goodVerifySent` whether or not the address is known - it
 * does not confirm who is registered - so there is nothing to report but "sent".
 */
export async function recoverAccount(email: string): Promise<void> {
  await request<unknown>(ORIGIN, `${V2_BASE}/auth/recover`, {
    method: "POST",
    body: { email },
    auth: false,
  });
}

export async function loginWithTeamToken(teamToken: string): Promise<string> {
  const res = await request<unknown>(ORIGIN, `${V1_BASE}/auth/login`, {
    method: "POST",
    body: { teamToken },
    auth: false,
  });
  return unwrap<{ authToken: string }>(res).authToken;
}

/**
 * The authenticated team's own profile.
 */
export async function getMyProfile(): Promise<RctfProfile> {
  const res = await request<unknown>(ORIGIN, `${V2_BASE}/users/me`);
  const profile = unwrap<RctfProfile>(res);
  return {
    ...profile,
    avatarUrl: profile.avatarUrl ? resolveFileUrl(profile.avatarUrl, ORIGIN) || null : null,
  };
}

/**
 * One team's display name, from the public profile route.
 */
export async function getTeamName(teamId: string): Promise<string> {
  const res = await request<unknown>(ORIGIN, `${V2_BASE}/users/${teamId}`, { auth: false });
  return unwrap<{ name?: string }>(res)?.name ?? "";
}

export async function listChallenges(): Promise<RctfChallenge[]> {
  const res = await request<unknown>(ORIGIN, `${V2_BASE}/challs`);
  return unwrap<RctfChallenge[]>(res);
}

/** Absolute URL for a challenge attachment. */
export function challengeFileUrl(url: string): string {
  return resolveFileUrl(url, ORIGIN);
}

/**
 * Every challenge as configured, hidden and unreleased ones included.
 *
 * A different route from `listChallenges`, not a richer variant of it: this one
 * is `authRequired` and gated on the `challsRead` permission - the same bit
 * `isAdminPerms` reads to put ADMIN in the nav, so anyone who can reach the
 * admin panel can reach this. It answers with the *stored* challenge rows,
 * which is why flags, `hidden` and `releaseTime` appear here and nowhere else.
 */
export async function listAdminChallenges(): Promise<RctfAdminChallenge[]> {
  const res = await request<unknown>(ORIGIN, `${V2_BASE}/admin/challs`);
  const raw = unwrap<Partial<RctfAdminChallenge>[]>(res) ?? [];
  return raw.map((c) => ({
    id: String(c.id ?? ""),
    name: c.name ?? String(c.id ?? ""),
    category: c.category ?? "",
    description: c.description ?? "",
    author: c.author ?? "",
    points: { min: c.points?.min ?? 0, max: c.points?.max ?? 0 },
    files: c.files ?? [],
    flags: c.flags ?? [],
    tags: c.tags ?? null,
    solveCount: c.solveCount ?? 0,
    hidden: c.hidden ?? false,
    releaseTime: c.releaseTime ?? null,
    sortWeight: c.sortWeight ?? null,
    tiebreakEligible: c.tiebreakEligible ?? true,
  }));
}

/**
 * rCTF's page-size cap on `/v2/admin/users`, the same 1-100 range the
 * leaderboard enforces: 101 is `400 badBody`, not a bigger page. Both `limit`
 * and `offset` are *required* on this route - omitting them is a 400 too.
 */
export const ADMIN_USERS_MAX_LIMIT = 100;

export interface AdminUsers {
  /** Teams matching the query, independent of `limit`. Unlike the
   *  leaderboard's `total`, this counts registered teams - banned and unranked
   *  ones included. */
  total: number;
  users: RctfAdminUser[];
}

/**
 * Every registered team, for the admin team panel.
 *
 * Gated on `usersWrite`, a different bit from the `challsRead` that puts ADMIN
 * in the nav - so an account can reach the admin panel and still get 403
 * `badPerms` here. That is a real state to render, not a bug.
 */
export async function listAdminUsers(
  limit = ADMIN_USERS_MAX_LIMIT,
  offset = 0,
): Promise<AdminUsers> {
  const capped = Math.min(Math.max(limit, 1), ADMIN_USERS_MAX_LIMIT);
  const res = await request<unknown>(
    ORIGIN,
    `${V2_BASE}/admin/users?limit=${capped}&offset=${Math.max(offset, 0)}`,
  );
  const data = unwrap<{ total?: number; users?: Partial<RctfAdminUser>[] }>(res);
  const users = (data?.users ?? []).map((u) => ({
    id: String(u.id ?? ""),
    name: u.name ?? "",
    email: u.email ?? null,
    division: u.division ?? "",
    perms: u.perms ?? 0,
    banned: u.banned ?? false,
    score: u.score ?? 0,
    solveCount: u.solveCount ?? 0,
    // Same resolution the leaderboard and profile do, and for the same reason:
    // rCTF's local upload provider answers with a path relative to *rCTF's*
    // origin, and this app is served from another one.
    avatarUrl: u.avatarUrl ? resolveFileUrl(u.avatarUrl, ORIGIN) || null : null,
  }));
  return { total: data?.total ?? users.length, users };
}

/**
 * Ban or unban a team.
 *
 * Reversible, and nothing is deleted: a banned team keeps its score and its
 * solves, it just stops ranking. The leaderboard expresses that by omission,
 * so `/v2/admin/users` is the only place the state is visible at all.
 */
export async function setBannedTeam(teamId: string, banned: boolean): Promise<void> {
  const path = `${V2_BASE}/admin/users/${encodeURIComponent(teamId)}`;
  await request<unknown>(ORIGIN, path, {
    method: "PUT",
    body: { data: { banned }},
  });
}

/**
 * Page-size cap on `/v2/admin/submissions` - the same 1-100 range every other
 * paginated rCTF route enforces. 101 is `400 badBody`, and both `limit` and
 * `offset` are *required*: omitting either is a 400 as well.
 */
export const ADMIN_SUBMISSIONS_MAX_LIMIT = 100;

export interface AdminSubmissionsPage {
  /** Submissions matching the filters, independent of `limit`. This is the
   *  number the pager counts against, and it can be far larger than any solve
   *  count: a team's wrong guesses are all in here. */
  total: number;
  submissions: RctfSubmission[];
}

export interface TeamSubmissionsQuery {
  limit?: number;
  offset?: number;
  sortBy?: RctfSubmissionSortBy;
  sortOrder?: "asc" | "desc";
  /** Free-text over challenge *name and category*, matched server-side. */
  challengeSearch?: string;
  /** Keep only these results. Empty or absent means every result. */
  results?: RctfSubmissionResult[];
  /** Keep only these kinds. Empty or absent means both. */
  kinds?: RctfSubmissionKind[];
  /** ISO 8601. Pinning this to the moment a view opened is what makes paging
   *  stable while an event is live - see `TeamSubmissionsModal`. */
  createdBefore?: string;
  createdAfter?: string;
}

/** rCTF's include/exclude filter shape. An *empty* `include` is not "match
 *  nothing" - the server treats it as no filter at all and answers with every
 *  row, which is why every caller here omits the key instead. */
function includeFilter<T>(values: T[] | undefined): { include: T[] } | undefined {
  return values && values.length > 0 ? { include: values } : undefined;
}

/**
 * One team's submission log.
 *
 * rCTF's audit trail of every submission it *evaluated* - not a solve list.
 * Wrong flags are in here, with the literal string that was typed
 * (`details.submittedFlag`), which exists nowhere else in the API: solves only
 * record what worked. Some attempts never reach the log at all, so this is not
 * a request log either - see `RctfSubmission`.
 *
 * `POST` rather than `GET`, for the same route: the filters live in a body,
 * and the team filter is the whole point of this call. The page controls stay
 * in the query string even on the POST, which is rCTF's own split, not a
 * choice made here.
 *
 * Needs `usersWrite` *and* `challsRead` - the route requires both bits, so an
 * admin who can open the team panel (`challsRead`) but cannot read teams gets
 * `403 badPerms` here, exactly as they would from `/v2/admin/users`.
 */
export async function listTeamSubmissions(
  teamId: string,
  query: TeamSubmissionsQuery = {},
): Promise<AdminSubmissionsPage> {
  if (!teamId) throw new Error("A team id is required to read a submission log.");

  const limit = Math.min(Math.max(query.limit ?? ADMIN_SUBMISSIONS_MAX_LIMIT, 1), ADMIN_SUBMISSIONS_MAX_LIMIT);
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(Math.max(query.offset ?? 0, 0)),
    sortBy: query.sortBy ?? "createdAt",
    sortOrder: query.sortOrder ?? "desc",
  });
  // Omitted rather than sent empty: rCTF's schema caps the search at 100 chars
  // and rejects an empty string outright, so a cleared search box would 400.
  const search = query.challengeSearch?.trim();
  if (search) params.set("challengeSearch", search.slice(0, 100));

  const res = await request<unknown>(ORIGIN, `${V2_BASE}/admin/submissions?${params}`, {
    method: "POST",
    body: {
      // Never an empty include - see `includeFilter`. This one is always
      // present, and it is what keeps the response to this one team.
      team: { include: [teamId] },
      result: includeFilter(query.results),
      kind: includeFilter(query.kinds),
      createdBefore: query.createdBefore,
      createdAfter: query.createdAfter,
    },
  });

  const data = unwrap<{ total?: number; submissions?: Partial<RctfSubmission>[] }>(res);
  const submissions = (data?.submissions ?? []).map((s) => {
    const raw = typeof s.createdAt === "string" ? s.createdAt : String(s.createdAt ?? "");
    return {
      id: String(s.id ?? ""),
      kind: (s.kind ?? "flag") as RctfSubmissionKind,
      challengeId: String(s.challengeId ?? ""),
      challengeName: s.challengeName || String(s.challengeId ?? ""),
      challengeCategory: s.challengeCategory ?? "",
      userId: String(s.userId ?? ""),
      userName: s.userName ?? "",
      userDivision: s.userDivision ?? "",
      // Same resolution the leaderboard and the team panel do: rCTF's local
      // upload provider answers with a path relative to *rCTF's* origin.
      userAvatarUrl: s.userAvatarUrl ? resolveFileUrl(s.userAvatarUrl, ORIGIN) || null : null,
      userCountryCode: s.userCountryCode ?? null,
      userStatusText: s.userStatusText ?? null,
      userBanned: s.userBanned ?? false,
      ip: s.ip ?? "",
      result: (s.result ?? "incorrect") as RctfSubmissionResult,
      cheatedFromId: s.cheatedFromId ?? null,
      cheatedFromName: s.cheatedFromName ?? null,
      details: (s.details ?? {}) as Record<string, unknown>,
      relatedId: s.relatedId ?? null,
      createdAt: parseRctfTimestamp(raw),
      createdAtRaw: raw,
    };
  });
  return { total: data?.total ?? submissions.length, submissions };
}

/** The flag a team typed, when the row records one. Admin-bot jobs and
 *  admin-granted solves carry no flag, and there is nothing to print for them.
 */
export function submittedFlag(submission: RctfSubmission): string | null {
  const flag = submission.details?.submittedFlag;
  return typeof flag === "string" ? flag : null;
}

/** One of rCTF's configured divisions. */
export interface RctfDivision {
  /** The key stored on the team - what the DIVISION column prints. */
  id: string;
  /** The display name from the config. Free text, not derivable from `id`. */
  name: string;
}

/**
 * The divisions this rCTF is configured with.
 *
 * Divisions are *config*, not data. rCTF has no divisions table: the set lives
 * in `rctf.d/config.yaml` as `divisions: {key: display name}` - defaulting to
 * `{open: "Open"}` - and is read once at process start. So there is nothing to
 * list from the admin API, and deriving the list from the teams on screen
 * would silently drop every division that has no teams in it yet.
 */
export async function listDivisions(): Promise<RctfDivision[]> {
  const res = await request<unknown>(ORIGIN, `${V2_BASE}/integrations/client/config`, {
    auth: false,
  });
  const data = unwrap<{ divisions?: Record<string, string> }>(res);
  // Config order, not sorted: `divisions` is an ordered mapping in the YAML, and
  // an event's own order (open, epfl, alumni...) is more useful than alphabet.
  return Object.entries(data?.divisions ?? {}).map(([id, name]) => ({ id, name: name || id }));
}

/**
 * Move a team into a division.
 *
 * rCTF does *not* validate this value. The route's schema types `division` as
 * a bare string and declares no division error, so any string answers 200 and
 * is stored verbatim - including one matching no configured division. Nor does
 * writing a new name create one: divisions come from the config (see
 * `listDivisions`), and a team written to an unconfigured key is orphaned. It
 * keeps its score and its place on the global leaderboard, drops off every
 * division board, and cannot be listed back, because `?division=<that key>` is
 * itself rejected with `400 Invalid division`. Checked against rCTF, not
 * inferred - and note that the player's own route, `PATCH /v2/users/me`,
 * *does* reject the same value with `badDivisionNotAllowed`. Only this is open.
 */
export async function setDivisionTeam(teamId: string, division: string): Promise<void> {

  const path = `${V2_BASE}/admin/users/${encodeURIComponent(teamId)}`;
  await request<unknown>(ORIGIN, path, {
    method: "PUT",
    body: { data: { division } },
  });
}

/**
 * Show or hide one challenge.
 *
 * GET to the path is used a gate to prevent a PUT for unexisting challenge id. 
 * Present because a PUT over an unexisting challenge id will create a new challenge
 * with default parameters.
 */
export async function setChallengeHidden(challengeId: string, hidden: boolean): Promise<void> {
  const path = `${V2_BASE}/admin/challs/${encodeURIComponent(challengeId)}`;
  await request<unknown>(ORIGIN, path);
  await request<unknown>(ORIGIN, path, {
    method: "PUT",
    body: { data: { hidden } },
  });
}

/**
 * Set a new release time for the given challenge.
 */
export async function setReleaseTime(challengeId: string, releaseTime: number): Promise<void> {
  const path = `${V2_BASE}/admin/challs/${encodeURIComponent(challengeId)}`;
  await request<unknown>(ORIGIN, path);
  await request<unknown>(ORIGIN, path, {
    method: "PUT",
    body: { data: { releaseTime } },
  });
}

/**
 * Append one static flag to a challenge, keeping the ones already there.
 */
export async function addFlag(challengeId: string, oldflags: RctfFlagEntry[], newflag: string): Promise<RctfFlagEntry[]>{

  const flag = newflag.trim();
  if (!flag) throw new Error("New flag cannot be empty.");
  if (oldflags.some((entry) => staticFlag(entry) === flag))
    throw new Error("This flag already exists for this challenge."); 
  
  const path = `${V2_BASE}/admin/challs/${encodeURIComponent(challengeId)}`;
  await request<unknown>(ORIGIN, path);
  
  const flags = [...oldflags, { provider: STATIC_FLAG_PROVIDER, config: { flag } }];

  await request<unknown>(ORIGIN, path, {
    method: "PUT",
    body: { data: { flags }},
  });

  return flags;
}

/**
 * Delete the given flag from the give challenge if possible. 
 * Safeguarded for existence and based flag.
 */
export async function deleteFlag(challengeId: string, oldflags: RctfFlagEntry[], removedFlag: RctfFlagEntry): Promise<RctfFlagEntry[]> {

  const flag = staticFlag(removedFlag);
  if ( flag === null)
      throw new Error("Flag entry to remove cannot be null.")

  const flagTrimed = flag.trim();
  if (!flagTrimed) throw new Error("Flag to remove cannot be empty.");

  const pos = oldflags.map((e) => staticFlag(e) === flag ? 1 : 0)
  if (!pos.includes(1))
    throw new Error("This flag does not exist for this challenge.");
  if (pos.indexOf(1) === 0)
      throw new Error("This is the base flag, it cannot be removed.")

  const path = `${V2_BASE}/admin/challs/${encodeURIComponent(challengeId)}`;
  await request<unknown>(ORIGIN, path);

  const flags = oldflags.filter((entry) => staticFlag(entry) !== flagTrimed);

  await request<unknown>(ORIGIN, path, {
    method: "PUT",
    body: { data: { flags } },
  });

  return flags;
}

/**
 * Change challenge tag to the given one, completely overriding the pre-existing one.
 */
export async function changeChallengeTag(challengeId: string, tag: string): Promise<string[]> {

  const allowedTags = ["tier/bronze", "tier/silver", "tier/gold"];
  if (!allowedTags.some((t) => t === tag))
      throw new Error("This tier is not supported, you cannot move this challenge.")

  const tags = [tag];

  const path = `${V2_BASE}/admin/challs/${encodeURIComponent(challengeId)}`;
  await request<unknown>(ORIGIN, path);
  await request<unknown>(ORIGIN, path, {
    method: "PUT",
    body: { data: { tags } },
  });

  return tags;
}

export interface ChallengeSolve {
  /** The solve row's own id. Useful as a list key, and nothing else. */
  solveId: string;
  /** The team that solved it. This is the id that matches a leaderboard
   *  entry's `id` */
  teamId: string;
  name: string;
  createdAt?: number;
  /** `0` for the first blood, `1`/`2` for the next two, `null` after that.*/
  bloodIndex: number | null;
}

/**
 * rCTF's raw solve object, on both v1 and v2.
 *
 * `id` and `userId` are two *different* identifiers: `id` is the solve row,
 * `userId` is the team.
 */
interface RawSolve {
  id?: string;
  userId?: string;
  userName?: string;
  createdAt?: number;
  bloodIndex?: number | null;
}

export async function getChallengeSolves(challengeId: string): Promise<ChallengeSolve[]> {
  const res = await request<unknown>(
    ORIGIN,
    `${V2_BASE}/challs/${challengeId}/solves?limit=100&offset=0`,
    { auth: false },
  );
  const data = unwrap<{ solves?: RawSolve[] } | RawSolve[]>(res);
  const raw = Array.isArray(data) ? data : (data.solves ?? []);
  return raw.map((s) => ({
    solveId: String(s.id ?? ""),
    teamId: String(s.userId ?? ""),
    name: s.userName ?? "unknown",
    createdAt: s.createdAt,
    bloodIndex: s.bloodIndex ?? null,
  }));
}

export interface FlagResult {
  correct: boolean;
  alreadySolved: boolean;
  message: string;
}

/**
 * Submit a flag. rCTF signals the outcome by HTTP status + response `kind`,
 * not a boolean: a correct flag is 200 `goodFlag`, a wrong one is 400
 * `badFlag`, an already-solved challenge is 409 `badAlreadySolvedChallenge`,
 * and rate-limiting is 429.
 */
export async function submitFlag(challengeId: string, flag: string): Promise<FlagResult> {
  try {
    const res = await request<unknown>(ORIGIN, `${V1_BASE}/challs/${challengeId}/submit`, {
      method: "POST",
      body: { flag },
    });
    const data = unwrap<{ correct?: boolean }>(res);
    const correct = data?.correct ?? true; // real rCTF: HTTP 200 == correct
    return {
      correct,
      alreadySolved: false,
      message: correct ? "The flag is correct." : "The flag is incorrect.",
    };
  } catch (e) {
    if (e instanceof ApiError) {
      return { correct: false, alreadySolved: e.status === 409, message: e.message };
    }
    throw e;
  }
}

/**
 * rCTF's `leaderboard.maxLimit`, whose default this mirrors. A larger `limit`
 * is not a bigger page - it is `400 badBody {"reason": "Invalid limit or
 * offset"}`, which surfaces as a failed query and an empty widget. Asking for
 * 500 here is how the home page's team counter read "-" for a whole event.
 */
export const LEADERBOARD_MAX_LIMIT = 100;

export interface Leaderboard {
  /**
   * Every *ranked* team, independent of `limit`. Not the same as registered
   * teams - banned teams are excluded, and so is anyone whose only solves are
   * worth zero points (the whole INTRO2 track). A true registration count
   * lives behind `/v2/admin/users`, which needs `usersWrite`.
   */
  total: number;
  entries: RctfLeaderboardEntry[];
}

/**
 * Leaderboard rows carry an origin-relative `avatarUrl`, exactly as the
 * profile route does - so resolve it in the same place, at the boundary,
 * rather than leaving the scoreboard to work out which origin a row's URL
 * belongs to. Absent and empty both become null: one value for "no picture".
 */
function withResolvedAvatars(entries: RctfLeaderboardEntry[]): RctfLeaderboardEntry[] {
  return entries.map((entry) => ({
    ...entry,
    avatarUrl: entry.avatarUrl ? resolveFileUrl(entry.avatarUrl, ORIGIN) || null : null,
  }));
}

export async function getLeaderboard(limit = LEADERBOARD_MAX_LIMIT): Promise<Leaderboard> {
  const capped = Math.min(Math.max(limit, 1), LEADERBOARD_MAX_LIMIT);
  const res = await request<unknown>(
    ORIGIN,
    `${V2_BASE}/leaderboard/now?limit=${capped}&offset=0`,
    { auth: false },
  );
  const data = unwrap<
    { leaderboard?: RctfLeaderboardEntry[]; total?: number } | RctfLeaderboardEntry[]
  >(res);
  if (Array.isArray(data)) {
    return { total: data.length, entries: withResolvedAvatars(data) };
  }
  const entries = data.leaderboard ?? [];
  return { total: data.total ?? entries.length, entries: withResolvedAvatars(entries) };
}

export interface LeaderboardWithGraph extends Leaderboard {
  /** Score-over-time series, for the teams the leaderboard worker sampled. */
  graph: RctfLeaderboardPoint[];
}

/**
 * Standings, each team's solves, and the score graph - in one request.
 *
 * `division` restricts the whole response to one division - rows, `total` and
 * graph series alike - and the places come back renumbered within it, so the
 * caller never has to re-rank. Omitting it is the global board, which is not
 * the same as the union of the divisions: a team sitting on a division key
 * that is not configured ranks globally and in no division at all (see
 * `setDivisionTeam`).
 *
 * The value must be a configured division key, not a display name. rCTF
 * validates this one - unlike the admin write - and answers `400 badBody`
 * "Invalid division" for anything else, which is why it comes from
 * `listDivisions()` rather than from a team row.
 */
export async function getLeaderboardWithGraph(
  limit = LEADERBOARD_MAX_LIMIT,
  division?: string,
): Promise<LeaderboardWithGraph> {
  const capped = Math.min(Math.max(limit, 1), LEADERBOARD_MAX_LIMIT);
  const scope = division ? `&division=${encodeURIComponent(division)}` : "";
  const res = await request<unknown>(
    ORIGIN,
    `${V2_BASE}/leaderboard/with-graph?limit=${capped}&offset=0${scope}`,
    { auth: false },
  );
  const data = unwrap<{
    leaderboard?: RctfLeaderboardEntry[];
    total?: number;
    graph?: RctfLeaderboardPoint[];
  }>(res);
  const entries = data?.leaderboard ?? [];
  return {
    total: data?.total ?? entries.length,
    entries: withResolvedAvatars(entries),
    graph: data?.graph ?? [],
  };
}

export interface LeaderboardChallenge {
  id: string;
  name: string;
  category: string;
  points: number;
  solves: number;
  /** Team ids of the first three solvers, in solve order. */
  firstSolvers: string[];
}

/** Raw shape - `firstSolvers` arrives as objects carrying an id. */
interface RawLeaderboardChallenge {
  name?: string;
  category?: string;
  points?: number;
  solves?: number;
  firstSolvers?: { id?: string }[];
}

/**
 * Per-challenge metadata for the scoreboard's solve matrix, keyed by id.
 */
export async function getLeaderboardChallenges(): Promise<LeaderboardChallenge[]> {
  const res = await request<unknown>(ORIGIN, `${V2_BASE}/leaderboard/challs`, { auth: false });
  const data = unwrap<{ challenges?: Record<string, RawLeaderboardChallenge> }>(res);
  return Object.entries(data?.challenges ?? {}).map(([id, meta]) => ({
    id,
    name: meta.name ?? id,
    category: meta.category ?? "other",
    points: meta.points ?? 0,
    solves: meta.solves ?? 0,
    firstSolvers: (meta.firstSolvers ?? []).map((s) => String(s?.id ?? "")).filter(Boolean),
  }));
}

/**
 * rCTF's `maxAvatarSize`, whose default this mirrors - the deployment does not
 * override it. Worth checking before uploading rather than letting the server
 * say no: the avatar endpoint allows a burst of 2 attempts per 2 minutes, so a
 * file that was never going to be accepted still costs a real attempt.
 */
export const MAX_AVATAR_SIZE = 1024 * 1024;

/**
 * Upload a new team avatar. rCTF stores the image itself - resized to 256x256
 * WebP - and answers with its URL, absolute here because the local upload
 * provider's is relative to rCTF's origin, not the frontend's. Throws if the
 * upload did not happen, for any reason.
 */
export async function setAvatar(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("avatar", file);
  const res = await request<unknown>(ORIGIN, `${V2_BASE}/users/me/avatar`, {
    method: "PATCH",
    body: fd,
  });
  const url = unwrap<{ url: string | null }>(res)?.url ?? null;
  if (!url) {
    throw new Error("Failed to upload image, please try again or chose another one.");
  }
  return resolveFileUrl(url, ORIGIN) || url;
}

/**
 * Clear the team avatar. Same endpoint as `setAvatar`: an empty form body -
 * one with no `avatar` field - is what tells rCTF to remove it. Returns rCTF's
 * confirmation message.
 */
export async function deleteAvatar(): Promise<string> {
  const res = await request<{ message?: string }>(ORIGIN, `${V2_BASE}/users/me/avatar`, {
    method: "PATCH",
    body: new FormData(),
  });
  return res?.message ?? "";
}

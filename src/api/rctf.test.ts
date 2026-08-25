import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAuthToken } from "./client";
import {
  LEADERBOARD_MAX_LIMIT,
  getChallengeSolves,
  getLeaderboard,
  getLeaderboardChallenges,
  getLeaderboardWithGraph,
  getMyProfile,
  getVerifyInfo,
  listAdminChallenges,
  listTeamSubmissions,
  recoverAccount,
  register,
  setAvatar,
  setChallengeHidden,
  submittedFlag,
  verify,
} from "./rctf";

/**
 * Regression cover for three bugs that all had the same cause: the dev mock
 * was more generous than rCTF, so the wrong field name and the wrong page size
 * both worked locally and silently failed in production.
 */

// See client.test.ts - this env's `localStorage` global is unreliable.
function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
}

function stubFetch(body: unknown) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestedUrl(fetchMock: ReturnType<typeof stubFetch>): string {
  return String(fetchMock.mock.calls[0][0]);
}

/** One response per call, for the calls that are a sequence of requests. */
function stubFetchSequence(...responses: { body: unknown; status?: number }[]) {
  const fetchMock = vi.fn();
  for (const { body, status } of responses) {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status: status ?? 200 }),
    );
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(stubLocalStorage);
afterEach(() => {
  vi.unstubAllGlobals();
  // One test re-imports the module under a stubbed VITE_RCTF_ORIGIN; leaving
  // it set would silently change what a later re-import resolves against.
  vi.unstubAllEnvs();
});

describe("getChallengeSolves", () => {
  it("reads solves from v2, the only version carrying bloodIndex", async () => {
    const fetchMock = stubFetch({
      kind: "goodChallengeSolvesV2",
      data: {
        solves: [
          { id: "s1", userId: "t7", userName: "n1ght0wl", createdAt: 1000, bloodIndex: 0 },
          { id: "s2", userId: "t8", userName: "second", createdAt: 2000, bloodIndex: 1 },
          { id: "s3", userId: "t9", userName: "later", createdAt: 3000, bloodIndex: null },
        ],
      },
    });

    const solves = await getChallengeSolves("c1");

    expect(requestedUrl(fetchMock)).toContain("/api/v2/challs/c1/solves");
    expect(solves.map((s) => s.bloodIndex)).toEqual([0, 1, null]);
  });

  it("reports no blood at all on a v1-shaped response", async () => {
    // v1's schema stops at `userName`, so every bloodIndex is absent. Better a
    // list with no blood marked than one that crowns whoever is listed first.
    stubFetch({ data: { solves: [{ id: "s1", userId: "t7", userName: "n1ght0wl" }] } });

    expect((await getChallengeSolves("c1"))[0].bloodIndex).toBeNull();
  });

  it("reads the solver from userId, never from the solve row's own id", async () => {
    stubFetch({
      kind: "goodChallengeSolvesV2",
      data: {
        solves: [
          { id: "solve_c1_t7", userId: "t7", userName: "n1ght0wl", createdAt: 1000 },
        ],
      },
    });

    const [solve] = await getChallengeSolves("c1");

    // The distinction is the whole point: `id` is the solve, `userId` is the
    // team, and only the latter matches a leaderboard entry.
    expect(solve.teamId).toBe("t7");
    expect(solve.solveId).toBe("solve_c1_t7");
    expect(solve.name).toBe("n1ght0wl");
  });

  it("leaves teamId empty rather than falling back to the solve id", async () => {
    stubFetch({ data: { solves: [{ id: "solve_c1_t7", userName: "n1ght0wl" }] } });

    const [solve] = await getChallengeSolves("c1");

    // A fallback here would look like it worked and match nothing - better an
    // obviously absent team than a plausible wrong one.
    expect(solve.teamId).toBe("");
  });
});

describe("register", () => {
  it("registers on v2, which returns the team token alongside the auth one", async () => {
    const fetchMock = stubFetch({
      kind: "goodRegisterV2",
      data: { authToken: "auth_1", teamToken: "team_1" },
    });

    const result = await register("you@example.com", "n1ght0wl");

    expect(requestedUrl(fetchMock)).toContain("/api/v2/auth/register");
    expect(result).toEqual({ authToken: "auth_1", teamToken: "team_1" });
  });

  it("reports the emailed-link case as no tokens rather than as a failure", async () => {
    // `goodVerifySent` carries no `data` at all - the team does not exist yet.
    stubFetch({ kind: "goodVerifySent", message: "Check your email." });

    expect(await register("you@example.com", "n1ght0wl")).toEqual({
      authToken: null,
      teamToken: null,
    });
  });
});

describe("recoverAccount", () => {
  it("asks v2 to email a login link, and reports nothing back about the address", async () => {
    // rCTF answers `goodVerifySent` whether or not the team exists, so there is
    // no "unknown email" branch to surface - only a request that succeeded.
    const fetchMock = stubFetch({ kind: "goodVerifySent", message: "Check your email." });

    await expect(recoverAccount("you@example.com")).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v2/auth/recover");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "you@example.com" });
  });
});

describe("getVerifyInfo", () => {
  it("previews a token on v2 without a POST that would spend it", async () => {
    const fetchMock = stubFetch({
      data: { kind: "register", email: "you@example.com", name: "n1ght0wl" },
    });

    const info = await getVerifyInfo("verifytok_abc");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v2/auth/verify-info");
    // A GET is what makes this safe to run on mount, and safe to run twice.
    expect(init.method ?? "GET").toBe("GET");
    expect(info.kind).toBe("register");
  });

  it("escapes the token rather than pasting it into the query string", async () => {
    const fetchMock = stubFetch({ data: { kind: "team", email: null } });

    await getVerifyInfo("a b&c=d");

    expect(requestedUrl(fetchMock)).toContain("token=a%20b%26c%3Dd");
  });
});

describe("verify", () => {
  it("spends the token on v2 and sends only verifyToken", async () => {
    const fetchMock = stubFetch({ data: { authToken: "auth_1", teamToken: "team_1" } });

    const result = await verify("verifytok_abc");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v2/auth/verify");
    // The extra `token` field this used to send was dev-mock compatibility.
    expect(JSON.parse(init.body)).toEqual({ verifyToken: "verifytok_abc" });
    expect(result).toEqual({ authToken: "auth_1", teamToken: "team_1" });
  });

  it("returns a null teamToken when the token was not a pending registration", async () => {
    // `goodVerify` - an existing team logging back in - carries only authToken.
    stubFetch({ kind: "goodVerify", data: { authToken: "auth_1" } });

    expect(await verify("teamtok_abc")).toEqual({ authToken: "auth_1", teamToken: null });
  });
});

describe("getLeaderboardChallenges", () => {
  it("flattens the keyed record into a list and lifts firstSolvers to team ids", async () => {
    const fetchMock = stubFetch({
      data: {
        challenges: {
          c1: {
            name: "Baby XOR",
            category: "crypto",
            points: 100,
            solves: 2,
            firstSolvers: [{ id: "t2" }, { id: "t1" }],
          },
        },
      },
    });

    const [chall] = await getLeaderboardChallenges();

    expect(requestedUrl(fetchMock)).toContain("/api/v2/leaderboard/challs");
    expect(chall).toEqual({
      id: "c1",
      name: "Baby XOR",
      category: "crypto",
      points: 100,
      solves: 2,
      firstSolvers: ["t2", "t1"],
    });
  });

  it("drops solver entries with no id rather than emitting empty strings", async () => {
    stubFetch({ data: { challenges: { c1: { firstSolvers: [{ id: "t1" }, {}, null] } } } });

    // An empty id would match no team, but it would still occupy a blood slot
    // and push every later solver down a place.
    expect((await getLeaderboardChallenges())[0].firstSolvers).toEqual(["t1"]);
  });
});

describe("getMyProfile", () => {
  it("reads the own-profile route on v2", async () => {
    const fetchMock = stubFetch({ data: { id: "t1", name: "n1ght0wl", score: 0, solves: [] } });

    await getMyProfile();

    expect(requestedUrl(fetchMock)).toContain("/api/v2/users/me");
  });

  it("surfaces the team token, which is the only place it is served", async () => {
    stubFetch({
      data: {
        id: "t1",
        name: "n1ght0wl",
        score: 325,
        solves: [],
        teamToken: "teamtok_abc",
      },
    });

    // Without this the profile page cannot show a player the credential the
    // register screen told them to save from it.
    expect((await getMyProfile()).teamToken).toBe("teamtok_abc");
  });

  it("resolves the avatar against rCTF's origin, not the frontend's", async () => {
    // rCTF's local upload provider answers with a path relative to its own
    // origin. Rendered as-is it resolves against the frontend's host and 404s,
    // so the profile route has to hand back something already absolute.
    vi.stubEnv("VITE_RCTF_ORIGIN", "https://rctf.example");
    vi.resetModules();
    const { getMyProfile: freshGetMyProfile } = await import("./rctf");
    stubFetch({
      data: {
        id: "t1",
        name: "n1ght0wl",
        score: 0,
        solves: [],
        avatarUrl: "/uploads/avatars/t1/abc.webp",
      },
    });

    expect((await freshGetMyProfile()).avatarUrl).toBe(
      "https://rctf.example/uploads/avatars/t1/abc.webp",
    );
  });

  it("reports a team with no avatar as null, the one empty value", async () => {
    stubFetch({ data: { id: "t1", name: "n1ght0wl", score: 0, solves: [], avatarUrl: null } });

    expect((await getMyProfile()).avatarUrl).toBeNull();
  });
});

describe("leaderboard avatars", () => {
  it("resolves each row's avatar against rCTF's origin", async () => {
    vi.stubEnv("VITE_RCTF_ORIGIN", "https://rctf.example");
    vi.resetModules();
    const { getLeaderboardWithGraph: fresh } = await import("./rctf");
    stubFetch({
      data: {
        leaderboard: [
          { id: "t1", name: "n1ght0wl", score: 10, avatarUrl: "/uploads/avatars/t1/a.webp" },
          { id: "t2", name: "second", score: 5, avatarUrl: null },
          { id: "t3", name: "third", score: 1 },
        ],
        total: 3,
      },
    });

    const { entries } = await fresh(100);

    expect(entries[0].avatarUrl).toBe("https://rctf.example/uploads/avatars/t1/a.webp");
    // A team with no picture and a team whose row omits the field are the same
    // thing to the row that renders them - one fallback, not two branches.
    expect(entries[1].avatarUrl).toBeNull();
    expect(entries[2].avatarUrl).toBeNull();
  });
});

describe("setAvatar", () => {
  const png = new File([new Uint8Array(8)], "me.png", { type: "image/png" });

  it("sends the image as multipart, under the field name rCTF reads", async () => {
    // Needs a real origin: on success this resolves the returned URL against
    // it. See the getMyProfile case above for why the module is re-imported.
    vi.stubEnv("VITE_RCTF_ORIGIN", "https://rctf.example");
    vi.resetModules();
    const { setAvatar: freshSetAvatar } = await import("./rctf");
    const fetchMock = stubFetch({ kind: "goodAvatarUpdated", data: { url: "/uploads/a.webp" } });

    await freshSetAvatar(png);

    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("avatar")).toBeInstanceOf(File);
  });

  it("treats a 200 with no URL as a failure, not as an upload", async () => {
    // Set and clear are the same request: a body that reaches rCTF without an
    // `avatar` part clears the avatar and answers 200. Returning normally here
    // is how an upload silently deletes the picture and reports success.
    stubFetch({ kind: "goodAvatarUpdated", data: { url: null } });

    // Rejecting is the behaviour under test - the wording is the UI's to own.
    await expect(setAvatar(png)).rejects.toThrow();
  });
});

describe("getLeaderboard", () => {
  it("reads standings from v2, which is the only version carrying solves[]", async () => {
    const fetchMock = stubFetch({ data: { total: 0, leaderboard: [] } });

    await getLeaderboard(100);

    expect(requestedUrl(fetchMock)).toContain("/api/v2/leaderboard/now");
  });

  it("never asks for more than rCTF's page cap", async () => {
    const fetchMock = stubFetch({ data: { total: 250, leaderboard: [] } });

    // rCTF answers an oversized `limit` with 400 badBody, not a bigger page.
    await getLeaderboard(500);

    expect(requestedUrl(fetchMock)).toContain(`limit=${LEADERBOARD_MAX_LIMIT}`);
  });

  it("reports the full ranked count from total, not from the page length", async () => {
    stubFetch({
      data: {
        total: 250,
        leaderboard: [{ id: "t1", name: "n1ght0wl", score: 325, solves: [] }],
      },
    });

    const board = await getLeaderboard(1);

    expect(board.total).toBe(250);
    expect(board.entries).toHaveLength(1);
  });

  it("fetches standings, solves and graph in one request via with-graph", async () => {
    const fetchMock = stubFetch({
      data: {
        total: 2,
        leaderboard: [{ id: "t1", name: "n1ght0wl", score: 325, solves: [] }],
        graph: [{ id: "t1", name: "n1ght0wl", points: [{ score: 325, time: 1000 }] }],
      },
    });

    const board = await getLeaderboardWithGraph(100);

    expect(requestedUrl(fetchMock)).toContain("/api/v2/leaderboard/with-graph");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(board.total).toBe(2);
    expect(board.entries).toHaveLength(1);
    expect(board.graph).toHaveLength(1);
  });

  it("carries each team's solves so the scoreboard can count them", async () => {
    stubFetch({
      data: {
        total: 1,
        leaderboard: [
          {
            id: "t1",
            name: "n1ght0wl",
            score: 325,
            solves: [
              { id: "c1", solveTime: 1000 },
              { id: "p1", solveTime: 2000 },
            ],
          },
        ],
      },
    });

    const board = await getLeaderboard(100);

    expect(board.entries[0].solves).toHaveLength(2);
  });
});

describe("listAdminChallenges", () => {
  it("reads the admin route, not the player-facing challenge list", async () => {
    // The two are different endpoints with different response shapes, and the
    // player one carries neither flags nor `hidden` - reading it here would
    // leave every one of those columns permanently blank.
    const fetchMock = stubFetch({ kind: "goodAdminChallengesV2", data: [] });

    await listAdminChallenges();

    expect(requestedUrl(fetchMock)).toContain("/api/v2/admin/challs");
  });

  it("sends the auth token: the route is permission-gated, not public", async () => {
    // Through `setAuthToken`, not localStorage directly - the client caches
    // the token in a module variable after its first read, so a value written
    // straight to storage is invisible to it once any earlier test has looked.
    setAuthToken("authtok_1");
    const fetchMock = stubFetch({ data: [] });
    try {
      await listAdminChallenges();
    } finally {
      setAuthToken(null);
    }

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer authtok_1");
  });

  it("keeps the admin-only fields the player list has no answer for", async () => {
    stubFetch({
      kind: "goodAdminChallengesV2",
      data: [
        {
          id: "baby-rev",
          name: "baby rev",
          category: "rev",
          description: "A gentle introduction.",
          author: "es3n1n",
          points: { min: 100, max: 500 },
          files: [],
          flags: [{ provider: "flags/static", config: { flag: "friday{baby_rev}" } }],
          tags: ["tier/bronze"],
          hidden: true,
          releaseTime: 1767225600000,
          sortWeight: 5,
          tiebreakEligible: true,
          solveCount: 12,
        },
      ],
    });

    const [chall] = await listAdminChallenges();

    expect(chall.hidden).toBe(true);
    expect(chall.solveCount).toBe(12);
    expect(chall.releaseTime).toBe(1767225600000);
    expect(chall.flags[0].config).toEqual({ flag: "friday{baby_rev}" });
    // `points` is the configured curve here, where /v2/challs sends the single
    // current score under the same key.
    expect(chall.points).toEqual({ min: 100, max: 500 });
  });

  it("defaults the nullish fields so a sparse row still renders", async () => {
    // rCTF normalises most of these itself, but a challenge created through
    // its own admin UI can come back with no tags and no release time, and a
    // missing `flags` must read as "no flag" rather than crashing the table.
    stubFetch({ data: [{ id: "sparse", category: "misc" }] });

    const [chall] = await listAdminChallenges();

    expect(chall.flags).toEqual([]);
    expect(chall.files).toEqual([]);
    expect(chall.tags).toBeNull();
    expect(chall.releaseTime).toBeNull();
    expect(chall.hidden).toBe(false);
    expect(chall.solveCount).toBe(0);
    // No name of its own: the id is the only thing left to call it.
    expect(chall.name).toBe("sparse");
  });
});

describe("setChallengeHidden", () => {
  const CHALL = {
    kind: "goodAdminChallengeV2",
    data: { id: "baby-rev", name: "baby rev", hidden: false },
  };

  it("sends the flag under rCTF's `data` envelope, and nothing else", async () => {
    // Flat fields are a 400 the reason of which reads `name: Required`, and
    // any *extra* field here would be merged into the stored challenge - this
    // route is a partial update, so the body is exactly the change.
    const fetchMock = stubFetchSequence(
      { body: CHALL },
      { body: { kind: "goodChallengeUpdateV2", data: {} } },
    );

    await setChallengeHidden("baby-rev", true);

    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/api/v2/admin/challs/baby-rev");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ data: { hidden: true } });
  });

  it("does not write to a challenge that is gone", async () => {
    // The regression this guards: `PUT /v2/admin/challs/:id` inserts on an
    // unknown id rather than 404ing, so hiding a challenge deleted since the
    // panel loaded used to recreate it as a blank - no name, no flags, zero
    // points - and report success. The read has to come first, and a 404 from
    // it has to stop the write.
    const fetchMock = stubFetchSequence({
      body: { kind: "badChallenge", message: "The challenge could not be found." },
      status: 404,
    });

    await expect(setChallengeHidden("deleted-chall", true)).rejects.toThrow(
      "The challenge could not be found.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method ?? "GET").toBe("GET");
  });

  it("escapes the id, so both requests address the same challenge", async () => {
    const fetchMock = stubFetchSequence({ body: CHALL }, { body: { data: {} } });

    await setChallengeHidden("web/sql injection", false);

    const paths = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(paths[0]).toContain("/api/v2/admin/challs/web%2Fsql%20injection");
    expect(paths[1]).toBe(paths[0]);
  });
});

/** One row as rCTF sends it, including the timestamp format it really uses -
 *  Postgres timestamptz text, not the ISO 8601 its schema documents. */
function submissionRow(over: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    kind: "flag",
    challengeId: "cookie_monster",
    challengeName: "cookie monster",
    challengeCategory: "web",
    userId: "t7",
    userName: "n1ght0wl",
    userDivision: "epfl",
    userAvatarUrl: null,
    userCountryCode: null,
    userStatusText: null,
    userBanned: false,
    ip: "203.0.113.7",
    result: "incorrect",
    cheatedFromId: null,
    cheatedFromName: null,
    details: { submittedFlag: "friday{guess}" },
    relatedId: null,
    createdAt: "2026-08-17 20:54:09.493+00",
    ...over,
  };
}

describe("listTeamSubmissions", () => {
  it("POSTs the team filter, and keeps paging in the query string", async () => {
    // rCTF's own split, and not a symmetric one: the include/exclude sets live
    // in the body while `limit`, `offset` and the sort stay in the query, so a
    // client that moved either would get a 400 about a missing parameter.
    const fetchMock = stubFetch({ kind: "goodAdminSubmissions", data: { total: 0, submissions: [] } });

    await listTeamSubmissions("t7", { limit: 50, offset: 100, sortBy: "result", sortOrder: "asc" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v2/admin/submissions?");
    expect(String(url)).toContain("limit=50");
    expect(String(url)).toContain("offset=100");
    expect(String(url)).toContain("sortBy=result");
    expect(String(url)).toContain("sortOrder=asc");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ team: { include: ["t7"] } });
  });

  it("never sends an empty include - that is 'no filter' to rCTF, not 'nothing'", async () => {
    // Verified against a real instance: an empty `include` builds no condition
    // at all, so a cleared result filter sent as `{include: []}` would answer
    // with every row it was supposed to narrow.
    const fetchMock = stubFetch({ data: { total: 0, submissions: [] } });

    await listTeamSubmissions("t7", { results: [], kinds: [] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ team: { include: ["t7"] } });
    expect(body.result).toBeUndefined();
    expect(body.kind).toBeUndefined();
  });

  it("sends the filters it was given", async () => {
    const fetchMock = stubFetch({ data: { total: 0, submissions: [] } });

    await listTeamSubmissions("t7", {
      results: ["cheated"],
      kinds: ["admin_bot"],
      challengeSearch: "  cookie  ",
      createdBefore: "2026-08-17T20:00:00.000Z",
    });

    const [url, init] = fetchMock.mock.calls[0];
    // Trimmed, and in the query string with the rest of the page controls.
    expect(String(url)).toContain("challengeSearch=cookie");
    expect(JSON.parse(init.body as string)).toEqual({
      team: { include: ["t7"] },
      result: { include: ["cheated"] },
      kind: { include: ["admin_bot"] },
      createdBefore: "2026-08-17T20:00:00.000Z",
    });
  });

  it("caps the page size at rCTF's limit rather than being refused one", async () => {
    // 101 is `400 badBody`, not a bigger page - the same trap the leaderboard
    // fell into when the home page asked for 500.
    const fetchMock = stubFetch({ data: { total: 0, submissions: [] } });

    await listTeamSubmissions("t7", { limit: 500 });

    expect(String(fetchMock.mock.calls[0][0])).toContain("limit=100");
  });

  it("keeps the submitted flag, which exists in no other rCTF response", async () => {
    stubFetch({
      kind: "goodAdminSubmissions",
      data: { total: 42, submissions: [submissionRow()] },
    });

    const page = await listTeamSubmissions("t7");

    expect(page.total).toBe(42);
    expect(page.submissions[0].details.submittedFlag).toBe("friday{guess}");
    expect(submittedFlag(page.submissions[0])).toBe("friday{guess}");
    expect(page.submissions[0].result).toBe("incorrect");
    expect(page.submissions[0].ip).toBe("203.0.113.7");
  });

  it("has no flag for a row that records none, rather than an empty string", async () => {
    // An admin-bot job and an admin-granted solve both carry no flag at all,
    // which is a different fact from a team having submitted "".
    stubFetch({
      data: { total: 1, submissions: [submissionRow({ kind: "admin_bot", details: { inputs: {} } })] },
    });

    expect(submittedFlag((await listTeamSubmissions("t7")).submissions[0])).toBeNull();
  });

  it("parses the timestamp rCTF sends, and keeps the raw one alongside", async () => {
    stubFetch({ data: { total: 1, submissions: [submissionRow()] } });

    const [row] = (await listTeamSubmissions("t7")).submissions;

    expect(row.createdAt).toBe(Date.parse("2026-08-17T20:54:09.493Z"));
    // Kept so an unparseable value can still be shown - see parseRctfTimestamp.
    expect(row.createdAtRaw).toBe("2026-08-17 20:54:09.493+00");
  });

  it("survives a timestamp it cannot read", async () => {
    stubFetch({ data: { total: 1, submissions: [submissionRow({ createdAt: "whenever" })] } });

    const [row] = (await listTeamSubmissions("t7")).submissions;

    expect(row.createdAt).toBeNull();
    expect(row.createdAtRaw).toBe("whenever");
  });

  it("refuses to ask without a team - the filter is what scopes the answer", async () => {
    // Without it the route answers with every team's submissions, which is not
    // a smaller version of this view: it is a different, much larger one.
    const fetchMock = stubFetch({ data: { total: 0, submissions: [] } });

    await expect(listTeamSubmissions("")).rejects.toThrow(/team id/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves the avatar against rCTF's origin, as every other reader does", async () => {
    vi.stubEnv("VITE_RCTF_ORIGIN", "https://ctf.example.com");
    vi.resetModules();
    const fresh = await import("./rctf");
    stubFetch({
      data: { total: 1, submissions: [submissionRow({ userAvatarUrl: "/uploads/a/avatar.png" })] },
    });

    const page = await fresh.listTeamSubmissions("t7");

    expect(page.submissions[0].userAvatarUrl).toBe(
      "https://ctf.example.com/uploads/a/avatar.png",
    );
  });
});

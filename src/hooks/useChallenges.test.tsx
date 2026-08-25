import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useChallenges } from "./useChallenges";
import type { RctfProfile } from "../types";

/**
 * The first-blood read path, which used to be a polygl0ts-extras endpoint
 * backed by a table and an SSE stream and is now derived from rCTF v2:
 * `/v2/leaderboard/challs` for *which team* drew each blood, the standings for
 * *its name*, and the caller's own `solves[].bloodIndex` for the one case the
 * standings can lag - the flag they just submitted.
 */

const listChallenges = vi.fn();
const getLeaderboardChallenges = vi.fn();
const getLeaderboard = vi.fn();
const getTeamName = vi.fn();

vi.mock("../api/rctf", () => ({
  LEADERBOARD_MAX_LIMIT: 100,
  listChallenges: () => listChallenges(),
  getLeaderboardChallenges: () => getLeaderboardChallenges(),
  getLeaderboard: (limit: number) => getLeaderboard(limit),
  getTeamName: (id: string) => getTeamName(id),
}));

let profile: RctfProfile | null = null;
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ profile, isLoggedIn: true }),
}));

function chall(id: string, tags: string[] = ["tier/bronze"]) {
  return { id, name: id, category: "crypto", description: "", points: 100, tags, solves: 1 };
}

function team(id: string, name: string) {
  return { id, name, score: 100, solves: [] };
}

function renderChallenges() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useChallenges(), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  profile = { id: "me", name: "polygl0ts", score: 0, solves: [] };
  listChallenges.mockResolvedValue([chall("c1")]);
  getLeaderboardChallenges.mockResolvedValue([]);
  getLeaderboard.mockResolvedValue({ total: 0, entries: [] });
  getTeamName.mockResolvedValue("");
});

describe("useChallenges first bloods", () => {
  it("names the blood by joining firstSolvers against the standings", async () => {
    getLeaderboardChallenges.mockResolvedValue([{ id: "c1", firstSolvers: ["t7", "t8"] }]);
    getLeaderboard.mockResolvedValue({ total: 2, entries: [team("t7", "n1ght0wl")] });

    const { result } = renderChallenges();
    await waitFor(() => expect(result.current.data).toBeDefined());

    // firstSolvers[0], not any later solver.
    expect(result.current.data?.[0].firstBlood).toBe("n1ght0wl");
    expect(getTeamName).not.toHaveBeenCalled();
  });

  it("looks up a solver the standings did not name", async () => {
    // A team that does not rank - banned, or below the page read - is the case
    // `firstSolvers` cannot resolve on its own, since it carries ids only.
    getLeaderboardChallenges.mockResolvedValue([{ id: "c1", firstSolvers: ["t99"] }]);
    getTeamName.mockResolvedValue("unranked_team");

    const { result } = renderChallenges();
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(getTeamName).toHaveBeenCalledWith("t99");
    expect(result.current.data?.[0].firstBlood).toBe("unranked_team");
  });

  it("asks for an unnamed solver once even when it holds several bloods", async () => {
    listChallenges.mockResolvedValue([chall("c1"), chall("c2")]);
    getLeaderboardChallenges.mockResolvedValue([
      { id: "c1", firstSolvers: ["t99"] },
      { id: "c2", firstSolvers: ["t99"] },
    ]);
    getTeamName.mockResolvedValue("serial_blooder");

    const { result } = renderChallenges();
    await waitFor(() => expect(result.current.data?.length).toBe(2));

    expect(getTeamName).toHaveBeenCalledTimes(1);
    expect(result.current.data?.map((c) => c.firstBlood)).toEqual([
      "serial_blooder",
      "serial_blooder",
    ]);
  });

  it("falls back to the team id rather than dropping the marker", async () => {
    getLeaderboardChallenges.mockResolvedValue([{ id: "c1", firstSolvers: ["t99"] }]);
    getTeamName.mockRejectedValue(new Error("boom"));

    const { result } = renderChallenges();
    await waitFor(() => expect(result.current.data).toBeDefined());

    // "someone blooded this" is the load-bearing half of the marker.
    expect(result.current.data?.[0].firstBlood).toBe("t99");
  });

  it("marks our own blood from the profile, with no leaderboard involved", async () => {
    // The replacement for the old POST /challs/refresh-bloods probe: rCTF's
    // leaderboard may not have recomputed yet, but our own v2 profile already
    // says bloodIndex 0.
    profile = {
      id: "me",
      name: "polygl0ts",
      score: 100,
      solves: [{ id: "c1", bloodIndex: 0 }],
    };

    const { result } = renderChallenges();
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.[0].firstBlood).toBe("polygl0ts");
    expect(result.current.data?.[0].solved).toBe(true);
  });

  it("does not claim a blood for a solve that was not one", async () => {
    profile = { id: "me", name: "polygl0ts", score: 100, solves: [{ id: "c1", bloodIndex: 2 }] };

    const { result } = renderChallenges();
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.[0].firstBlood).toBeNull();
  });

  it("still renders the grid when the blood lookup fails outright", async () => {
    getLeaderboardChallenges.mockRejectedValue(new Error("rCTF down"));

    const { result } = renderChallenges();
    await waitFor(() => expect(result.current.data).toBeDefined());

    // Losing the markers must not lose the challenges.
    expect(result.current.data?.length).toBe(1);
    expect(result.current.data?.[0].firstBlood).toBeNull();
  });
});

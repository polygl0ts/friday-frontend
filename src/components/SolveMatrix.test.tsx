import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SolveMatrix } from "./SolveMatrix";
import { getLeaderboardChallenges } from "../api/rctf";
import type { LeaderboardChallenge } from "../api/rctf";
import type { RctfLeaderboardEntry } from "../types";

vi.mock("../api/rctf", () => ({ getLeaderboardChallenges: vi.fn() }));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ profile: { id: "t2" } }),
}));

// Solve state rides in on the standings - v2 leaderboard entries carry the
// team's whole solve list, so the matrix issues no per-challenge request.
const TEAMS: RctfLeaderboardEntry[] = [
  {
    id: "t1",
    name: "n1ght0wl",
    score: 325,
    solves: [
      { id: "c1", solveTime: 2000 },
      { id: "p1", solveTime: 3000 },
    ],
  },
  { id: "t2", name: "polygl0ts", score: 150, solves: [{ id: "c1", solveTime: 1000 }] },
  { id: "t3", name: "lurker", score: 0, solves: [] },
];

// c1: t2 drew blood, then t1. c2: nobody. p1: t1 only.
const CHALLENGES: LeaderboardChallenge[] = [
  {
    id: "c1",
    name: "Baby XOR",
    category: "crypto",
    points: 100,
    solves: 2,
    firstSolvers: ["t2", "t1"],
  },
  { id: "c2", name: "Big RSA", category: "crypto", points: 300, solves: 0, firstSolvers: [] },
  {
    id: "p1",
    name: "Stack Smash",
    category: "pwn",
    points: 200,
    solves: 1,
    firstSolvers: ["t1"],
  },
];

function renderMatrix(teams = TEAMS) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SolveMatrix teams={teams} />
    </QueryClientProvider>,
  );
}

describe("SolveMatrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLeaderboardChallenges).mockResolvedValue(CHALLENGES);
  });

  it("renders a row per team and a column per challenge", async () => {
    renderMatrix();

    expect(await screen.findByText("Baby XOR")).toBeDefined();
    expect(screen.getByText("Big RSA")).toBeDefined();
    expect(screen.getByText("Stack Smash")).toBeDefined();
    expect(screen.getByText("n1ght0wl")).toBeDefined();
    expect(screen.getByText("lurker")).toBeDefined();
  });

  it("costs exactly one request, however many challenges there are", async () => {
    renderMatrix();
    await screen.findByText("Baby XOR");

    // The whole point of B1: this used to be one call per column.
    expect(getLeaderboardChallenges).toHaveBeenCalledTimes(1);
  });

  it("groups columns by category, highest-value challenge first", async () => {
    renderMatrix();
    await screen.findByText("Baby XOR");

    expect(screen.getByText("CRYPTO").closest("th")?.getAttribute("colspan")).toBe("2");
    expect(screen.getByText("PWN").closest("th")?.getAttribute("colspan")).toBe("1");
    // Within crypto, 300 before 100.
    const points = [...document.querySelectorAll(".matrix-points")].map((e) => e.textContent);
    expect(points).toEqual(["300", "100", "200"]);
  });

  it("marks solved and unsolved cells per team", async () => {
    renderMatrix();

    expect(await screen.findByTitle("n1ght0wl drew first blood on Stack Smash")).toBeDefined();
    expect(screen.getByTitle("polygl0ts has not solved Stack Smash")).toBeDefined();
    expect(screen.getByTitle("lurker has not solved Baby XOR")).toBeDefined();
  });

  it("takes bloods from rCTF's firstSolvers, not from the order teams are shown in", async () => {
    // t1 is ranked above t2 and appears first, but t2 solved c1 first. Reading
    // blood off the displayed order would decorate the wrong row.
    renderMatrix();

    expect(await screen.findByTitle("polygl0ts drew first blood on Baby XOR")).toBeDefined();
    expect(screen.getByTitle("n1ght0wl took second blood on Baby XOR")).toBeDefined();
  });

  it("still credits a blood to a team that is not on the leaderboard page", async () => {
    // A team whose only solves are worth zero points may not rank at all, but
    // it can absolutely have drawn first blood - and the teams that *are*
    // shown must not be promoted into its place.
    vi.mocked(getLeaderboardChallenges).mockResolvedValue([
      { ...CHALLENGES[0], firstSolvers: ["unranked-team", "t2", "t1"] },
    ]);
    renderMatrix();

    expect(await screen.findByTitle("polygl0ts took second blood on Baby XOR")).toBeDefined();
    expect(screen.getByTitle("n1ght0wl took third blood on Baby XOR")).toBeDefined();
    expect(document.querySelectorAll(".matrix-flag.first")).toHaveLength(0);
  });

  it("calls a solve past the third one just a solve", async () => {
    vi.mocked(getLeaderboardChallenges).mockResolvedValue([
      { ...CHALLENGES[0], firstSolvers: ["a", "b", "c"] },
    ]);
    renderMatrix();

    // rCTF publishes three solvers and no finer position, so don't invent one.
    expect(await screen.findByTitle("n1ght0wl solved Baby XOR")).toBeDefined();
  });

  it("flies a red flag for the first blood and a white one for later solves", async () => {
    renderMatrix();

    const firstBlood = await screen.findByTitle("polygl0ts drew first blood on Baby XOR");
    expect(firstBlood.querySelector(".matrix-flag.first")).not.toBeNull();

    const later = screen.getByTitle("n1ght0wl took second blood on Baby XOR");
    expect(later.querySelector(".matrix-flag")).not.toBeNull();
    expect(later.querySelector(".matrix-flag.first")).toBeNull();

    // Unsolved cells carry no flag at all.
    const unsolved = screen.getByTitle("lurker has not solved Baby XOR");
    expect(unsolved.querySelector(".matrix-flag")).toBeNull();
    expect(unsolved.querySelector(".matrix-dot")).not.toBeNull();
  });

  it("highlights the logged-in team's row", async () => {
    renderMatrix();
    await screen.findByText("Baby XOR");

    expect(screen.getByText("polygl0ts").closest("tr")?.className).toBe("me");
    expect(screen.getByText("n1ght0wl").closest("tr")?.className).toBe("");
  });

  it("treats a team with no solves field as having solved nothing", async () => {
    // v1-shaped entries have no `solves` at all - degrade, don't throw.
    renderMatrix([{ id: "t9", name: "legacy", score: 10 }]);

    expect(await screen.findByTitle("legacy has not solved Baby XOR")).toBeDefined();
  });

  it("explains itself when the challenge metadata is unavailable", async () => {
    vi.mocked(getLeaderboardChallenges).mockRejectedValue(new Error("not started"));
    renderMatrix();

    await waitFor(() =>
      expect(screen.getByText(/challenge list isn't available yet/)).toBeDefined(),
    );
  });
});

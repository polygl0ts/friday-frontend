import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminChallenges } from "./AdminChallenges";
import { getLeaderboard, listAdminChallenges } from "../api/rctf";
import type { RctfAdminChallenge } from "../types";

vi.mock("../api/rctf", () => ({
  listAdminChallenges: vi.fn(),
  getLeaderboard: vi.fn(),
  // The HIDDEN cell's own request. Never called from these tests, but the
  // factory has to carry it: a named import missing from a mocked module is an
  // error at import time, not at call time.
  setChallengeHidden: vi.fn(),
}));

// The HIDDEN cell asks who is looking before it offers the toggle. These tests
// are about the table, so they answer as a full admin and leave the permission
// split itself to HideChallButton.test.tsx.
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ isAdmin: true, canWriteChalls: true }),
}));

const mockList = vi.mocked(listAdminChallenges);
const mockLeaderboard = vi.mocked(getLeaderboard);

function chall(over: Partial<RctfAdminChallenge> = {}): RctfAdminChallenge {
  return {
    id: "baby-rev",
    name: "baby rev",
    category: "rev",
    description: "A gentle introduction.",
    author: "es3n1n",
    points: { min: 100, max: 500 },
    files: [],
    flags: [{ provider: "flags/static", config: { flag: "friday{baby_rev}" } }],
    tags: ["tier/bronze"],
    hidden: false,
    releaseTime: null,
    sortWeight: null,
    tiebreakEligible: true,
    solveCount: 0,
    ...over,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminChallenges />
    </QueryClientProvider>,
  );
}

/** The row a challenge's name sits in - every column assertion goes through
 *  this, so a value landing in the wrong row fails rather than passing on a
 *  page-wide text match. */
async function row(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name);
  const found = cell.closest(".table-row");
  if (!found) throw new Error(`no row for ${name}`);
  return found as HTMLElement;
}

/** The masked flag buttons in a row, in order. */
function flagButtons(line: HTMLElement): HTMLElement[] {
  return [...line.querySelectorAll<HTMLElement>(".admin-flag-secret")];
}

beforeEach(() => {
  mockList.mockReset();
  mockLeaderboard.mockReset();
  mockLeaderboard.mockResolvedValue({ total: 40, entries: [] });
});

describe("AdminChallenges", () => {
  it("shows every column the panel exists to show", async () => {
    mockList.mockResolvedValue([
      chall({
        tags: ["tier/bronze", "intro2"],
        hidden: true,
        releaseTime: new Date(2026, 0, 2, 3, 4).getTime(),
        solveCount: 12,
      }),
    ]);

    renderPage();
    const line = await row("baby rev");

    expect(within(line).getByText("rev")).toBeTruthy();
    expect(within(line).getByText("12")).toBeTruthy();
    expect(within(line).getByText("/40")).toBeTruthy();
    fireEvent.click(flagButtons(line)[0]);
    expect(within(line).getByText("friday{baby_rev}")).toBeTruthy();
    expect(within(line).getByText("tier/bronze")).toBeTruthy();
    expect(within(line).getByText("intro2")).toBeTruthy();
    expect(within(line).getByText("YES")).toBeTruthy();
    expect(within(line).getByText(/02-01-2026 03:04/)).toBeTruthy();
  });

  it("lists hidden and unreleased challenges - the ones no other view has", async () => {
    // The reason this panel reads /v2/admin/challs: both of these are absent
    // from the player-facing list entirely, so a challenge that never showed
    // up in the grid can only be found here.
    mockList.mockResolvedValue([
      chall({ id: "c1", name: "visible" }),
      chall({ id: "c2", name: "staged", hidden: true }),
      chall({ id: "c3", name: "scheduled", releaseTime: Date.now() + 86_400_000 }),
    ]);

    renderPage();

    expect(await row("staged")).toBeTruthy();
    expect(await row("scheduled")).toBeTruthy();
    expect(screen.getByText(/3 TOTAL/)).toBeTruthy();
    expect(screen.getByText(/1 HIDDEN/)).toBeTruthy();
  });

  it("offers the toggle in the HIDDEN cell, pointing the way the row can move", async () => {
    // The column reports state *and* changes it. Which direction each button
    // offers is the row's own business - a single wrong prop here would give
    // every row the same one.
    mockList.mockResolvedValue([
      chall({ id: "c1", name: "visible" }),
      chall({ id: "c2", name: "staged", hidden: true }),
    ]);

    renderPage();

    expect(
      within(await row("visible")).getByLabelText("Hide this challenge from players"),
    ).toBeTruthy();
    expect(
      within(await row("staged")).getByLabelText("Show this challenge to players"),
    ).toBeTruthy();
  });

  it("marks a future release time as still scheduled", async () => {
    mockList.mockResolvedValue([
      chall({ id: "c1", name: "later", releaseTime: Date.now() + 86_400_000 }),
      chall({ id: "c2", name: "already", releaseTime: Date.now() - 86_400_000 }),
    ]);

    renderPage();

    // A stored release time says nothing on its own about whether players can
    // see the challenge yet - only comparing it to now does.
    expect(within(await row("later")).getByText("SCHEDULED")).toBeTruthy();
    expect(within(await row("already")).queryByText("SCHEDULED")).toBeNull();
  });

  it("counts solves for a hidden challenge too", async () => {
    // rCTF counts these on every challenge, hidden included - hiding one does
    // not un-solve it, and a 0 here would say it was never solved.
    mockList.mockResolvedValue([
      chall({ id: "c1", name: "was open", hidden: true, solveCount: 7 }),
    ]);

    renderPage();

    expect(within(await row("was open")).getByText("7")).toBeTruthy();
  });

  it("shows the count alone until the team total arrives", async () => {
    // The numerator is the real content; it should not wait on a second
    // request, and an unanswered denominator must not render as "/0".
    mockLeaderboard.mockReturnValue(new Promise(() => {}));
    mockList.mockResolvedValue([chall({ id: "c1", name: "solo", solveCount: 3 })]);

    renderPage();
    const line = await row("solo");

    // Scoped to the cell: the row's own tags carry slashes of their own.
    expect(line.querySelector(".admin-solves")?.textContent).toBe("3");
  });

  it("names the provider for a flag it cannot print, with nothing to reveal", async () => {
    // A provider name is not a secret and there is no flag behind it, so
    // masking it would offer a reveal that reveals nothing.
    mockList.mockResolvedValue([
      chall({ id: "c1", name: "per team", flags: [{ provider: "flags/dynamic" }] }),
    ]);

    renderPage();
    const line = await row("per team");

    expect(within(line).getByText("flags/dynamic")).toBeTruthy();
    expect(flagButtons(line)).toHaveLength(0);
  });

  it("shows every flag, since any of them solves the challenge", async () => {
    mockList.mockResolvedValue([
      chall({
        id: "c1",
        name: "two flags",
        flags: [
          { provider: "flags/static", config: { flag: "friday{one}" } },
          { provider: "flags/static", config: { flag: "friday{two}" } },
        ],
      }),
    ]);

    renderPage();
    const line = await row("two flags");
    flagButtons(line).forEach((b) => fireEvent.click(b));

    expect(within(line).getByText("friday{one}")).toBeTruthy();
    expect(within(line).getByText("friday{two}")).toBeTruthy();
  });

  it("hides every flag until it is clicked", async () => {
    // The whole list is on screen at once and this panel gets opened on a
    // projector; a flag must not be readable just for having loaded the page.
    mockList.mockResolvedValue([chall({ id: "c1", name: "secret" })]);

    renderPage();
    const line = await row("secret");

    expect(within(line).queryByText("friday{baby_rev}")).toBeNull();
    expect(line.textContent).toContain("•");
  });

  it("reveals one flag without revealing the others", async () => {
    mockList.mockResolvedValue([
      chall({ id: "c1", name: "one", flags: [{ provider: "flags/static", config: { flag: "friday{one}" } }] }),
      chall({ id: "c2", name: "two", flags: [{ provider: "flags/static", config: { flag: "friday{two}" } }] }),
    ]);

    renderPage();
    fireEvent.click(flagButtons(await row("one"))[0]);

    expect(screen.getByText("friday{one}")).toBeTruthy();
    expect(screen.queryByText("friday{two}")).toBeNull();
  });

  it("hides a revealed flag again on a second click", async () => {
    mockList.mockResolvedValue([chall({ id: "c1", name: "toggle" })]);

    renderPage();
    const line = await row("toggle");
    const button = flagButtons(line)[0];

    fireEvent.click(button);
    expect(within(line).getByText("friday{baby_rev}")).toBeTruthy();
    fireEvent.click(button);
    expect(within(line).queryByText("friday{baby_rev}")).toBeNull();
  });

  it("masks a fixed width rather than one mark per character", async () => {
    // Same rule the profile page's team token follows: the length of a secret
    // is itself something not to put on screen.
    mockList.mockResolvedValue([
      chall({ id: "c1", name: "short", flags: [{ provider: "flags/static", config: { flag: "a" } }] }),
      chall({
        id: "c2",
        name: "long",
        flags: [{ provider: "flags/static", config: { flag: "friday{a_very_long_one}" } }],
      }),
    ]);

    renderPage();
    const shortMask = flagButtons(await row("short"))[0].textContent;
    const longMask = flagButtons(await row("long"))[0].textContent;

    expect(shortMask).toBe(longMask);
  });

  it("says so when a challenge has no flag configured at all", async () => {
    mockList.mockResolvedValue([chall({ id: "c1", name: "flagless", flags: [] })]);

    renderPage();

    expect(within(await row("flagless")).getByText("no flag")).toBeTruthy();
  });

  it("shows the rCTF id alongside a name that differs from it", async () => {
    // The id is what the challenge repo and the sync bot call this challenge;
    // acting on the wrong one is the mistake this column prevents.
    mockList.mockResolvedValue([chall({ id: "rev-baby_rev", name: "baby rev" })]);

    renderPage();

    expect(within(await row("baby rev")).getByText("rev-baby_rev")).toBeTruthy();
  });

  it("groups by category, then orders by name", async () => {
    mockList.mockResolvedValue([
      chall({ id: "c1", name: "zeta", category: "web" }),
      chall({ id: "c2", name: "beta", category: "crypto" }),
      chall({ id: "c3", name: "alpha", category: "web" }),
    ]);

    renderPage();
    await screen.findByText("beta");

    const names = [...document.querySelectorAll(".table-row:not(.table-head)")].map(
      (r) => r.querySelector("span > span")?.textContent,
    );
    expect(names).toEqual(["beta", "alpha", "zeta"]);
  });

  it("surfaces a failed read instead of showing an empty table", async () => {
    // A non-admin reaching this route gets 403 badPerms; silently rendering
    // "no challenges" would read as a correctly empty CTF.
    mockList.mockRejectedValue(new Error("This account is not permitted to read challenges."));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/not permitted to read challenges/)).toBeTruthy(),
    );
  });

  it("distinguishes an empty rCTF from a loading one", async () => {
    mockList.mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(screen.getByText(/no challenges configured/)).toBeTruthy());
  });
});

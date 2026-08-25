import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamSubmissionsModal } from "./TeamSubmissionsModal";
import { listTeamSubmissions } from "../api/rctf";
import type { AdminSubmissionsPage, TeamSubmissionsQuery } from "../api/rctf";
import type { RctfAdminUser, RctfSubmission } from "../types";

vi.mock("../api/rctf", async (importOriginal) => {
  // `submittedFlag` is a pure reader over a row, not a request - the component
  // is meant to use the real one, and mocking it would let a row that carries
  // no flag look identical to one that does.
  const actual = await importOriginal<typeof import("../api/rctf")>();
  return { ...actual, listTeamSubmissions: vi.fn() };
});

const mockList = vi.mocked(listTeamSubmissions);

function team(over: Partial<RctfAdminUser> = {}): RctfAdminUser {
  return {
    id: "t7",
    name: "n1ght0wl",
    email: "player@example.com",
    division: "epfl",
    perms: 0,
    banned: false,
    score: 325,
    solveCount: 4,
    avatarUrl: null,
    ...over,
  };
}

function submission(over: Partial<RctfSubmission> = {}): RctfSubmission {
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
    createdAt: new Date(2026, 0, 2, 3, 4, 56).getTime(),
    createdAtRaw: "2026-01-02 03:04:56+00",
    ...over,
  };
}

function page(submissions: RctfSubmission[], total = submissions.length): AdminSubmissionsPage {
  return { total, submissions };
}

function renderModal(over: Partial<RctfAdminUser> = {}, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TeamSubmissionsModal team={team(over)} onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

/**
 * The arguments of the most recent request *for a page* - which is what the
 * controls are asserted through: every filter here is applied by rCTF, not in
 * the browser.
 *
 * The header's submission count is a second, unfiltered request against the
 * same function, so the page requests are the ones asking for a page-sized
 * page. Reading the plain last call would sometimes assert against the count.
 */
function lastQuery(): TeamSubmissionsQuery {
  const pages = mockList.mock.calls.filter((call) => (call[1] as TeamSubmissionsQuery)?.limit !== 1);
  return pages[pages.length - 1][1] as TeamSubmissionsQuery;
}

/** The row a submitted flag sits in. */
async function row(text: string): Promise<HTMLElement> {
  const cell = await screen.findByText(text);
  const found = cell.closest(".table-row");
  if (!found) throw new Error(`no row for ${text}`);
  return found as HTMLElement;
}

beforeEach(() => {
  mockList.mockReset();
  mockList.mockResolvedValue(page([submission()]));
});

describe("TeamSubmissionsModal", () => {
  it("shows the two things a solve list cannot: when, and what was typed", async () => {
    mockList.mockResolvedValue(page([submission()]));

    renderModal();
    const line = await row("friday{guess}");

    expect(within(line).getByText("02-01-2026 03:04:56")).toBeTruthy();
    expect(within(line).getByText("cookie monster")).toBeTruthy();
    expect(within(line).getByText("INCORRECT")).toBeTruthy();
    expect(within(line).getByText("203.0.113.7")).toBeTruthy();
  });

  it("asks only for this team, newest first", async () => {
    renderModal();

    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(mockList.mock.calls[0][0]).toBe("t7");
    expect(lastQuery().sortBy).toBe("createdAt");
    expect(lastQuery().sortOrder).toBe("desc");
  });

  it("pins the pages to the moment it opened, so paging cannot double-count", async () => {
    // Rows arrive at the top of a newest-first listing, so without a ceiling a
    // submission landing between page one and page two pushes a row across the
    // boundary and it is read twice.
    mockList.mockResolvedValue(page([submission()], 200));
    renderModal();
    await row("friday{guess}");
    const pinned = lastQuery().createdBefore;
    expect(pinned).toBeTruthy();

    fireEvent.click(screen.getByText("NEXT"));

    await waitFor(() => expect(lastQuery().offset).toBe(50));
    expect(lastQuery().createdBefore).toBe(pinned);
  });

  it("moves the ceiling only when asked to refresh", async () => {
    renderModal();
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    const pinned = lastQuery().createdBefore;

    fireEvent.click(screen.getByText("REFRESH"));

    await waitFor(() => expect(lastQuery().createdBefore).not.toBe(pinned));
  });

  it("filters through rCTF rather than through the page on screen", async () => {
    // The point: a page holds 50 rows out of however many the team has, so a
    // filter applied in the browser would filter the wrong set.
    renderModal();
    await waitFor(() => expect(mockList).toHaveBeenCalled());

    fireEvent.click(screen.getByText("CHEATED"));

    await waitFor(() => expect(lastQuery().results).toEqual(["cheated"]));
    expect(lastQuery().offset).toBe(0);
  });

  it("sends no filter at all for ALL", async () => {
    renderModal();
    fireEvent.click(screen.getByText("CORRECT"));
    await waitFor(() => expect(lastQuery().results).toEqual(["correct"]));

    fireEvent.click(screen.getByText("ALL"));

    await waitFor(() => expect(lastQuery().results).toBeUndefined());
    expect(lastQuery().kinds).toBeUndefined();
  });

  it("sorts on the columns rCTF sorts on, and flips the one already chosen", async () => {
    renderModal();
    await row("friday{guess}");

    fireEvent.click(screen.getByText(/^CHALLENGE/));
    await waitFor(() => expect(lastQuery().sortBy).toBe("challenge"));
    expect(lastQuery().sortOrder).toBe("desc");

    fireEvent.click(screen.getByText(/^TIME/));
    await waitFor(() => expect(lastQuery().sortBy).toBe("createdAt"));
    fireEvent.click(screen.getByText(/^TIME/));
    await waitFor(() => expect(lastQuery().sortOrder).toBe("asc"));
  });

  it("searches challenges server-side, once typing stops", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderModal();
      await waitFor(() => expect(mockList).toHaveBeenCalled());

      fireEvent.change(screen.getByLabelText("Filter by challenge"), {
        target: { value: "cookie" },
      });
      vi.advanceTimersByTime(400);

      await waitFor(() => expect(lastQuery().challengeSearch).toBe("cookie"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks a rejected flag in a lighter red than a cheated one", async () => {
    // The label carries it and nothing else does: INCORRECT is the ordinary
    // case in this log, and `cheated` - the row that means trouble - keeps the
    // full red so the two are never read as the same severity.
    mockList.mockResolvedValue(
      page([
        submission({ id: "sub-1", result: "incorrect" }),
        submission({ id: "sub-2", result: "cheated", details: { submittedFlag: "friday{shared}" } }),
      ]),
    );

    renderModal();
    const wrong = await row("friday{guess}");
    const shared = await row("friday{shared}");

    expect(within(wrong).getByText("INCORRECT").className).toContain("sub-result-soft");
    expect(within(shared).getByText("CHEATED").className).toContain("sub-result-alarm");
  });

  it("names the team a cheated flag was issued to, in the row itself", async () => {
    // A `cheated` result without that name says nothing: the flag was valid,
    // and whose it was is the entire finding.
    mockList.mockResolvedValue(
      page([
        submission({
          result: "cheated",
          cheatedFromId: "t9",
          cheatedFromName: "flag_hoarder",
          details: { submittedFlag: "friday{shared}", cheatedFrom: "t9" },
        }),
      ]),
    );

    renderModal();
    const line = await row("friday{shared}");

    expect(within(line).getByText("CHEATED")).toBeTruthy();
    expect(within(line).getByText(/flag_hoarder/)).toBeTruthy();
  });

  it("falls back to the team id when rCTF has no name for the sharer", async () => {
    mockList.mockResolvedValue(
      page([submission({ result: "cheated", cheatedFromId: "t9", cheatedFromName: null })]),
    );

    renderModal();

    expect(await screen.findByText(/t9/)).toBeTruthy();
  });

  it("shows an admin-bot job's inputs where a flag row shows its flag", async () => {
    mockList.mockResolvedValue(
      page([
        submission({
          kind: "admin_bot",
          result: "invalid_input",
          details: { inputs: { url: "not-a-url" }, configRevision: 3 },
        }),
      ]),
    );

    renderModal();

    expect(await screen.findByText("url=not-a-url")).toBeTruthy();
    expect(screen.getByText("ADMIN BOT", { selector: ".sub-kind" })).toBeTruthy();
  });

  it("says so when a row records no payload at all", async () => {
    // An admin-granted solve. Nothing was typed, which is not the same as an
    // empty guess, and an empty cell would read as a rendering bug.
    mockList.mockResolvedValue(page([submission({ result: "correct", details: {} })]));

    renderModal();

    expect(await screen.findByText("no flag recorded")).toBeTruthy();
  });

  it("prints the raw timestamp when it is not one that could be parsed", async () => {
    mockList.mockResolvedValue(
      page([submission({ createdAt: null, createdAtRaw: "2026-13-45 99:99" })]),
    );

    renderModal();

    expect(await screen.findByText("2026-13-45 99:99")).toBeTruthy();
  });

  it("opens the whole record on a row, details object included", async () => {
    mockList.mockResolvedValue(
      page([
        submission({
          relatedId: "solve-9",
          details: { submittedFlag: "friday{guess}", matchedFlagProvider: "flags/static" },
        }),
      ]),
    );

    renderModal();
    fireEvent.click(await row("friday{guess}"));

    expect(screen.getByText("SUBMISSION ID")).toBeTruthy();
    expect(screen.getByText("sub-1")).toBeTruthy();
    expect(screen.getByText("solve-9")).toBeTruthy();
    expect(screen.getByText(/matchedFlagProvider/)).toBeTruthy();
  });

  it("states the team's own facts once, off the rows rCTF answered with", async () => {
    // `userCountryCode` and `userStatusText` reach this frontend through no
    // other call, so the header is the only place they can be shown at all.
    mockList.mockResolvedValue(
      page([submission({ userCountryCode: "CH", userStatusText: "Qualified", userBanned: true })]),
    );

    renderModal();

    expect(await screen.findByText("CH")).toBeTruthy();
    expect(screen.getByText("Qualified")).toBeTruthy();
    expect(screen.getByText("BANNED")).toBeTruthy();
    expect(screen.getByText(/4 SOLVES/)).toBeTruthy();
  });

  it("counts the team's submissions between its solves and its score", async () => {
    mockList.mockResolvedValue(page([submission()], 342));

    renderModal();

    expect(await screen.findByText(/4 SOLVES · 342 SUBMISSIONS · 325 PTS/)).toBeTruthy();
  });

  it("counts every submission the team made, not the ones a filter matched", async () => {
    // It sits between two facts about the team, so it has to be one: a number
    // that dropped when a pill was clicked would read as the solve count or the
    // score moving. The filtered count is the footer's job.
    mockList.mockImplementation(async (_teamId, options) =>
      options?.results ? page([], 0) : page([submission()], 342),
    );

    renderModal();
    await screen.findByText(/342 SUBMISSIONS/);
    fireEvent.click(screen.getByText("CHEATED"));

    // ...while the pager reports what the filter actually matched. Read off the
    // element rather than matched as text: it also carries the LOADING marker.
    await waitFor(() =>
      expect(document.querySelector(".sub-range")?.textContent).toContain("0 SUBMISSIONS"),
    );
    expect(lastQuery().results).toEqual(["cheated"]);
    expect(screen.getByText(/342 SUBMISSIONS/)).toBeTruthy();
  });

  it("says nothing rather than zero while the count is still being read", async () => {
    // "no submissions yet" and "not read yet" are different answers, and a 0
    // that later becomes 342 is the second one wearing the first one's face.
    mockList.mockReturnValue(new Promise(() => {}));

    renderModal();

    expect(await screen.findByText(/4 SOLVES · - SUBMISSIONS/)).toBeTruthy();
  });

  it("counts every matching submission, not the rows on screen", async () => {
    mockList.mockResolvedValue(page([submission()], 342));

    renderModal();

    expect(await screen.findByText("1-1 OF 342")).toBeTruthy();
  });

  it("distinguishes a team with no submissions from a filter that matched none", async () => {
    mockList.mockResolvedValue(page([]));
    renderModal();
    expect(await screen.findByText(/No submissions found for this team/)).toBeTruthy();

    fireEvent.click(screen.getByText("CHEATED"));

    expect(await screen.findByText(/No submissions match this filter/)).toBeTruthy();
  });

  it("surfaces a refused read rather than showing an empty log", async () => {
    // The route needs usersWrite *and* challsRead; an admin holding one of them
    // gets 403 badPerms, which is a real state and not an empty team.
    mockList.mockRejectedValue(new Error("The user does not have the required permissions."));

    renderModal();

    expect(await screen.findByText(/does not have the required permissions/)).toBeTruthy();
  });

  it("cannot page before the first page", async () => {
    mockList.mockResolvedValue(page([submission()], 200));
    renderModal();
    await row("friday{guess}");

    expect(screen.getByText("PREV").hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("NEXT").hasAttribute("disabled")).toBe(false);
  });

  it("closes on the backdrop and on Escape", async () => {
    const onClose = renderModal();
    await waitFor(() => expect(mockList).toHaveBeenCalled());

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setChallengeHidden } from "../api/rctf";
import { HideChallButton } from "./HideChallButton";

vi.mock("../api/rctf", () => ({ setChallengeHidden: vi.fn() }));

let canWriteChalls = true;
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ isAdmin: true, canWriteChalls }),
}));

let client: QueryClient;

function renderCell(hidden = false) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HideChallButton challengeId="baby-rev" hidden={hidden} />
    </QueryClientProvider>,
  );
}

const hideButton = () => screen.getByLabelText("Hide this challenge from players");
const showButton = () => screen.getByLabelText("Show this challenge to players");

beforeEach(() => {
  canWriteChalls = true;
  vi.mocked(setChallengeHidden).mockReset();
  vi.mocked(setChallengeHidden).mockResolvedValue(undefined);
});

describe("HideChallButton", () => {
  it("still answers the column's question for an admin who cannot write", () => {
    // `challsRead` without `challsWrite` is a real rCTF account, and the
    // panel is readable to it. Dropping the cell's contents along with the
    // control would blank out a column that account is allowed to read.
    canWriteChalls = false;
    renderCell(true);

    expect(screen.getByText("YES")).toBeTruthy();
    expect(screen.queryByLabelText("Show this challenge to players")).toBeNull();
  });

  it("shows the state on its face and the direction in its label", () => {
    renderCell(true);

    // The button's text is the column's answer, not the action: this challenge
    // *is* hidden, so it reads YES - the same value the read-only cell above
    // renders, which is what keeps the column legible for both kinds of admin.
    // Which way a click would move it lives on the accessible name instead,
    // and that is what `showButton()` matches on.
    expect(showButton().textContent).toBe("YES");
    expect(screen.queryByLabelText("Hide this challenge from players")).toBeNull();
  });

  it("asks before doing anything - the first click only opens the dialog", () => {
    renderCell(false);
    fireEvent.click(hideButton());

    expect(screen.getByText("Hide this challenge from players?")).toBeTruthy();
    expect(setChallengeHidden).not.toHaveBeenCalled();
  });

  it("cancelling leaves the challenge where it was", () => {
    renderCell(false);
    fireEvent.click(hideButton());
    fireEvent.click(screen.getByText("KEEP IT VISIBLE"));

    expect(screen.queryByText("Hide this challenge from players?")).toBeNull();
    expect(setChallengeHidden).not.toHaveBeenCalled();
  });

  it("confirming sends the opposite of the current state", async () => {
    renderCell(false);
    fireEvent.click(hideButton());
    fireEvent.click(screen.getByText("HIDE FROM PLAYERS"));

    await waitFor(() => expect(setChallengeHidden).toHaveBeenCalledTimes(1));
    expect(setChallengeHidden).toHaveBeenCalledWith("baby-rev", true);
  });

  it("unhides a hidden challenge rather than hiding it again", async () => {
    // The value is derived from the prop, so a component rendered for a hidden
    // challenge has to send `false` - the bug this guards is a toggle that
    // only ever writes `true`.
    renderCell(true);
    fireEvent.click(showButton());
    fireEvent.click(screen.getByText("SHOW TO PLAYERS"));

    await waitFor(() => expect(setChallengeHidden).toHaveBeenCalledWith("baby-rev", false));
  });

  it("refetches both challenge lists, so the row and the grid agree", async () => {
    // Neither key takes the challenge id. `["challengeList", id]` - which is
    // what a first pass wrote - matches no query in the app, so the player
    // grid would keep serving a challenge that is no longer visible.
    const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    renderCell(false);
    fireEvent.click(hideButton());
    fireEvent.click(screen.getByText("HIDE FROM PLAYERS"));

    await waitFor(() => expect(setChallengeHidden).toHaveBeenCalled());
    await waitFor(() => {
      const keys = invalidate.mock.calls.map(([arg]) => JSON.stringify(arg?.queryKey));
      expect(keys).toContain(JSON.stringify(["adminChallenges"]));
      expect(keys).toContain(JSON.stringify(["challengeList"]));
    });
    invalidate.mockRestore();
  });

  it("keeps the dialog open and shows why when the request fails", async () => {
    // The preflight read is what answers this way for a challenge that has
    // been deleted since the panel loaded.
    vi.mocked(setChallengeHidden).mockRejectedValue(
      new Error("The challenge could not be found."),
    );
    renderCell(false);
    fireEvent.click(hideButton());
    fireEvent.click(screen.getByText("HIDE FROM PLAYERS"));

    await waitFor(() => expect(screen.getByText("The challenge could not be found.")).toBeTruthy());
    // Still open: closing on failure would look exactly like success.
    expect(screen.getByText("Hide this challenge from players?")).toBeTruthy();
  });

  it("a second confirm click while in flight does not send a second request", async () => {
    let release: (v: unknown) => void = () => {};
    vi.mocked(setChallengeHidden).mockReturnValue(new Promise((r) => (release = r)) as never);
    renderCell(false);
    fireEvent.click(hideButton());

    fireEvent.click(screen.getByText("HIDE FROM PLAYERS"));
    await waitFor(() => expect(screen.getByText("HIDING...")).toBeTruthy());
    fireEvent.click(screen.getByText("HIDING..."));

    expect(setChallengeHidden).toHaveBeenCalledTimes(1);

    // Settled inside the test, not left dangling: resolving after it returns
    // updates state on a torn-down tree and trips React's act() warning.
    release(undefined);
    await waitFor(() => expect(screen.queryByText("Hide this challenge from players?")).toBeNull());
  });
});

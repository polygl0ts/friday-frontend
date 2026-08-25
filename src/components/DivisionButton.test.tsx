import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listDivisions, setDivisionTeam } from "../api/rctf";
import { DivisionTeamButton } from "./DivisionButton";

vi.mock("../api/rctf", () => ({ listDivisions: vi.fn(), setDivisionTeam: vi.fn() }));

let canWriteUsers = true;
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ isAdmin: true, canWriteUsers }),
}));

const DIVISIONS = [
  { id: "open", name: "Open" },
  { id: "epfl", name: "EPFL students" },
];

function renderCell(division = "open") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DivisionTeamButton teamId="team-1" teamName="n1ght0wl" division={division} />
    </QueryClientProvider>,
  );
}

const cellButton = () => screen.getByRole("button", { name: /change the division of n1ght0wl/i });
const option = (name: RegExp) => screen.getByRole("button", { name });

/** Open the picker and wait for the divisions to land in it. */
async function openPicker(division = "open") {
  renderCell(division);
  fireEvent.click(cellButton());
  await screen.findByText("EPFL students");
}

beforeEach(() => {
  canWriteUsers = true;
  vi.mocked(setDivisionTeam).mockReset();
  vi.mocked(setDivisionTeam).mockResolvedValue(undefined);
  vi.mocked(listDivisions).mockReset();
  vi.mocked(listDivisions).mockResolvedValue(DIVISIONS);
});

describe("DivisionTeamButton", () => {
  it("still answers the column's question for an admin who cannot write", () => {
    // `challsRead` without `usersWrite` is a real rCTF account: it reads the
    // panel, so it reads this cell - it just gets no control.
    canWriteUsers = false;
    renderCell("epfl");

    expect(screen.getByText("epfl")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers the configured divisions rather than a field to type one into", async () => {
    // The whole reason this is a list: rCTF stores whatever string it is sent,
    // so a typo would be a silent 200 that drops the team off its leaderboard.
    await openPicker();

    expect(listDivisions).toHaveBeenCalled();
    expect(screen.getByText("EPFL students")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("shows the stored key beside the display name", async () => {
    // The column prints the key, the picker leads with the label, and the two
    // need not resemble each other - so a row has to carry both.
    await openPicker();

    expect(option(/EPFL students/).textContent).toContain("epfl");
  });

  it("does not offer the division the team is already in", async () => {
    await openPicker("open");

    expect((option(/Open/) as HTMLButtonElement).disabled).toBe(true);
    expect((option(/EPFL students/) as HTMLButtonElement).disabled).toBe(false);
  });

  it("says so when the team sits in a division that is not configured", async () => {
    // rCTF lets an admin write any string and never repairs it; the team is off
    // every division board until someone moves it, and this is where it shows.
    await openPicker("epfl-2024");

    expect(screen.getByText(/no division for/i)).toBeTruthy();
    // Nothing is current, so every configured division stays selectable.
    expect((option(/Open/) as HTMLButtonElement).disabled).toBe(false);
  });

  it("picking a division asks before sending anything", async () => {
    await openPicker();
    fireEvent.click(option(/EPFL students/));

    expect(screen.getByText("Move this team?")).toBeTruthy();
    expect(setDivisionTeam).not.toHaveBeenCalled();
  });

  it("names both ends of the move in the confirmation", async () => {
    await openPicker("open");
    fireEvent.click(option(/EPFL students/));

    // Scoped to the dialog: the cell behind it still prints the old division,
    // and a bare text query would match that instead and pass either way.
    const dialog = screen.getByText("Move this team?").closest(".modal") as HTMLElement;
    // Keys, not labels: the key is what gets stored and what the column prints
    // afterwards, so it is the string an admin can check the result against.
    expect(dialog.textContent).toContain("moves from open to epfl");
  });

  it("confirming sends the division that was picked", async () => {
    await openPicker("open");
    fireEvent.click(option(/EPFL students/));
    fireEvent.click(screen.getByText("CONFIRMING"));

    await waitFor(() => expect(setDivisionTeam).toHaveBeenCalledWith("team-1", "epfl"));
  });

  it("BACK returns to the list rather than closing the whole flow", async () => {
    await openPicker("open");
    fireEvent.click(option(/EPFL students/));
    fireEvent.click(screen.getByText("BACK"));

    // Back in the picker, with nothing sent.
    await screen.findByText("EPFL students");
    expect(screen.queryByText("Move this team?")).toBeNull();
    expect(setDivisionTeam).not.toHaveBeenCalled();
  });

  it("refetches the team list, so the row and the panel agree", async () => {
    const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    await openPicker("open");
    fireEvent.click(option(/EPFL students/));
    fireEvent.click(screen.getByText("CONFIRMING"));

    await waitFor(() => expect(setDivisionTeam).toHaveBeenCalled());
    await waitFor(() => {
      const keys = invalidate.mock.calls.map(([arg]) => JSON.stringify(arg?.queryKey));
      expect(keys).toContain(JSON.stringify(["adminUsers"]));
    });
    invalidate.mockRestore();
  });

  it("keeps the dialog open and shows why when the request fails", async () => {
    vi.mocked(setDivisionTeam).mockRejectedValue(new Error("The user does not exist."));
    await openPicker("open");
    fireEvent.click(option(/EPFL students/));
    fireEvent.click(screen.getByText("CONFIRMING"));

    await waitFor(() => expect(screen.getByText("The user does not exist.")).toBeTruthy());
    // Still open: closing on failure would look exactly like success.
    expect(screen.getByText("Move this team?")).toBeTruthy();
  });

  it("surfaces a divisions request that failed instead of an empty list", async () => {
    // An empty picker and a broken one look identical otherwise, and the
    // difference decides whether the admin retries or edits the rCTF config.
    vi.mocked(listDivisions).mockRejectedValue(new Error("The token provided is invalid."));
    renderCell("open");
    fireEvent.click(cellButton());

    await waitFor(() => expect(screen.getByText("The token provided is invalid.")).toBeTruthy());
  });
});

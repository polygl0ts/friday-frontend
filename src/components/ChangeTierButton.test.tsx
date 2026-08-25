import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { changeChallengeTag } from "../api/rctf";
import { ChangeTierButton } from "./ChangeTierButton";

vi.mock("../api/rctf", () => ({ changeChallengeTag: vi.fn() }));

let canWriteChalls = true;
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ isAdmin: true, canWriteChalls }),
}));

function renderCell(tags: string[] | null = ["tier/bronze"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChangeTierButton challengeId="c1" challengeName="rop-me" tags={tags} />
    </QueryClientProvider>,
  );
}

const cellButton = () => screen.getByRole("button", { name: /change the tag of rop-me/i });
const option = (name: RegExp) => screen.getByRole("button", { name });

/** Open the picker on a challenge that already carries `tags`. */
function openPicker(tags: string[] | null = ["tier/bronze"]) {
  renderCell(tags);
  fireEvent.click(cellButton());
}

beforeEach(() => {
  canWriteChalls = true;
  vi.mocked(changeChallengeTag).mockReset();
  vi.mocked(changeChallengeTag).mockResolvedValue(["tier/gold"]);
});

describe("ChangeTierButton", () => {
  it("still answers the column's question for an admin who cannot write", () => {
    // `challsRead` without `challsWrite` is a real rCTF account: it reads the
    // panel, so it reads this cell - it just gets no control.
    canWriteChalls = false;
    renderCell(["tier/silver"]);

    expect(screen.getByText("tier/silver")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows every tag the challenge carries, as the cell always did", () => {
    renderCell(["tier/bronze", "intro2"]);

    expect(screen.getByText("tier/bronze")).toBeTruthy();
    expect(screen.getByText("intro2")).toBeTruthy();
  });

  it("offers the four known tags rather than a field to type one into", () => {
    // The whole reason this is a list: rCTF stores whatever string it is sent,
    // so a typo would be a silent 200 that sorts the challenge into no tier.
    openPicker();

    expect(option(/^intro2$/)).toBeTruthy();
    expect(option(/^tier\/silver$/)).toBeTruthy();
    expect(option(/^tier\/gold$/)).toBeTruthy();
  });

  it("marks the tag the challenge already has, and refuses to re-pick it", () => {
    openPicker(["tier/bronze"]);

    expect(option(/tier\/bronze/).hasAttribute("disabled")).toBe(true);
  });

  it("sends nothing until the change is confirmed", () => {
    // Picking is the reversible half - the request belongs to the second step.
    openPicker();
    fireEvent.click(option(/^tier\/gold$/));

    expect(screen.getByText(/goes from/i)).toBeTruthy();
    expect(changeChallengeTag).not.toHaveBeenCalled();
  });

  it("sends the chosen tag once confirmed", async () => {
    openPicker();
    fireEvent.click(option(/^tier\/gold$/));
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(changeChallengeTag).toHaveBeenCalledWith("c1", "tier/gold"));
  });

  it("goes back to the picker rather than closing, so a misclick costs one click", () => {
    openPicker();
    fireEvent.click(option(/^tier\/gold$/));
    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));

    expect(option(/^tier\/silver$/)).toBeTruthy();
    expect(changeChallengeTag).not.toHaveBeenCalled();
  });

  it("keeps the dialog open on failure, with the reason", async () => {
    vi.mocked(changeChallengeTag).mockRejectedValue(new Error("bad perms"));
    openPicker();
    fireEvent.click(option(/^tier\/gold$/));
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

    expect(await screen.findByText("bad perms")).toBeTruthy();
  });

  it("offers every tag to a challenge that has none, and says so when confirming", () => {
    openPicker(null);

    // Nothing is the current tag, so nothing is disabled.
    expect(option(/^intro2$/).hasAttribute("disabled")).toBe(false);

    fireEvent.click(option(/^intro2$/));
    expect(screen.getByText(/no tag/i)).toBeTruthy();
  });
});

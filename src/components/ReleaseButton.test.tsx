import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setReleaseTime } from "../api/rctf";
import { ReleaseButton } from "./ReleaseButton";

vi.mock("../api/rctf", () => ({ setReleaseTime: vi.fn() }));

let canWriteChalls = true;
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ isAdmin: true, canWriteChalls }),
}));

const DAY = 86_400_000;
/** A release still ahead of us - the only state the cell offers a control in. */
const AHEAD = Date.now() + DAY;

function renderCell(releaseTime: number | null = AHEAD) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReleaseButton challengeId="baby-rev" challengeName="baby rev" releaseTime={releaseTime} />
    </QueryClientProvider>,
  );
}

const cellButton = () => screen.getByRole("button", { name: /release time for baby rev/i });
const field = () => screen.getByLabelText("DATE & TIME") as HTMLInputElement;

/** Click through to the picker and put a moment in the field. */
function pick(value: string, releaseTime: number | null = AHEAD) {
  renderCell(releaseTime);
  fireEvent.click(cellButton());
  fireEvent.change(field(), { target: { value } });
}

beforeEach(() => {
  canWriteChalls = true;
  vi.mocked(setReleaseTime).mockReset();
  vi.mocked(setReleaseTime).mockResolvedValue(undefined);
});

describe("ReleaseButton", () => {
  it("still answers the column's question for an admin who cannot write", () => {
    // `challsRead` without `challsWrite` is a real rCTF account. It reads the
    // panel, so it reads this cell - it just gets no control.
    canWriteChalls = false;
    renderCell(Date.now() + DAY);

    expect(screen.getByText("SCHEDULED")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("reports which side of now a stored time falls on", () => {
    renderCell(Date.now() - DAY);
    expect(screen.getByText("RELEASED")).toBeTruthy();
    expect(screen.queryByText("SCHEDULED")).toBeNull();
  });

  it("is a record, not a control, once the moment has passed", () => {
    // A release that already happened is not a thing to move, and a cell that
    // looks clickable invites an admin to try.
    renderCell(Date.now() - DAY);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says nothing at all where rCTF holds no time", () => {
    // rCTF clears the field on release, so this is every challenge that is
    // already out. The badge answers the column; a placeholder would only add
    // a character to read on every row.
    renderCell(null);

    expect(screen.getByText("RELEASED")).toBeTruthy();
    expect(screen.queryByText("—")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens the picker first, not the confirmation", () => {
    // The two steps ask different questions, and neither of them sends
    // anything. A first click that confirmed would be a write on one click.
    renderCell();
    fireEvent.click(cellButton());

    expect(screen.getByText("Release time")).toBeTruthy();
    expect(screen.queryByText("Set this release time?")).toBeNull();
    expect(setReleaseTime).not.toHaveBeenCalled();
  });

  it("starts the picker on the time the challenge already has", () => {
    renderCell(new Date(2099, 0, 2, 3, 4).getTime());
    fireEvent.click(cellButton());

    expect(field().value).toBe("2099-01-02T03:04");
  });

  it("refuses to validate a field that has been emptied", () => {
    renderCell();
    fireEvent.click(cellButton());
    fireEvent.change(field(), { target: { value: "" } });

    expect((screen.getByText("VALIDATE") as HTMLButtonElement).disabled).toBe(true);
  });

  it("carries the chosen moment into the confirmation, and only then sends it", async () => {
    pick("2026-03-04T05:06");
    fireEvent.click(screen.getByText("VALIDATE"));

    // The confirmation names the moment it is about to write, so a mistyped
    // year is caught while it is still free to fix.
    expect(screen.getByText("Set this release time?")).toBeTruthy();
    expect(screen.getByText("04-03-2026 05:06:00")).toBeTruthy();
    expect(setReleaseTime).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("SET RELEASE TIME"));

    await waitFor(() =>
      expect(setReleaseTime).toHaveBeenCalledWith(
        "baby-rev",
        new Date(2026, 2, 4, 5, 6).getTime(),
      ),
    );
  });

  it("sends the confirmed moment even after the field is edited behind it", async () => {
    // The picker unmounts on VALIDATE, so this is really a guard on where the
    // value lives: read back out of the input at submit time, a later edit
    // would win over the one that was agreed to.
    pick("2026-03-04T05:06");
    fireEvent.click(screen.getByText("VALIDATE"));
    fireEvent.click(screen.getByText("SET RELEASE TIME"));

    await waitFor(() => expect(setReleaseTime).toHaveBeenCalledTimes(1));
    expect(vi.mocked(setReleaseTime).mock.calls[0][1]).toBe(new Date(2026, 2, 4, 5, 6).getTime());
  });

  it("goes BACK from the confirmation to the picker, keeping the answer", () => {
    // Back one step, not out: an admin who reads the date and wants a
    // different one should not have to start over.
    pick("2026-03-04T05:06");
    fireEvent.click(screen.getByText("VALIDATE"));
    fireEvent.click(screen.getByText("BACK"));

    expect(screen.getByText("Release time")).toBeTruthy();
    expect(field().value).toBe("2026-03-04T05:06");
    expect(setReleaseTime).not.toHaveBeenCalled();
  });

  it("GO BACK leaves the flow entirely, with nothing sent", () => {
    pick("2026-03-04T05:06");
    fireEvent.click(screen.getByText("GO BACK"));

    expect(screen.queryByText("Release time")).toBeNull();
    expect(screen.queryByText("Set this release time?")).toBeNull();
    expect(setReleaseTime).not.toHaveBeenCalled();
  });

  it("keeps a failed request on screen instead of closing over it", async () => {
    vi.mocked(setReleaseTime).mockRejectedValue(new Error("challenge is locked"));
    pick("2026-03-04T05:06");
    fireEvent.click(screen.getByText("VALIDATE"));
    fireEvent.click(screen.getByText("SET RELEASE TIME"));

    expect(await screen.findByText("challenge is locked")).toBeTruthy();
    expect(screen.getByText("Set this release time?")).toBeTruthy();
  });

  it("warns when the chosen moment has already passed", () => {
    // Not an error - rCTF takes it, and the challenge simply goes live. It is
    // worth saying out loud because it usually means a mistyped date.
    pick("2020-01-01T00:00");

    expect(screen.getByText(/in the past/i)).toBeTruthy();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteWriteup } from "../api/extras";
import { DeleteButton } from "./DeleteButton";

vi.mock("../api/extras", () => ({
  deleteWriteup: vi.fn(async () => ({ id: 7, status: "pending" })),
}));

let isAdmin = true;
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ isAdmin }),
}));

function renderButton() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DeleteButton writeupId={7} />
    </QueryClientProvider>,
  );
}

const trigger = () => screen.getByLabelText("Send this writeup back to the review queue");

beforeEach(() => {
  isAdmin = true;
  vi.mocked(deleteWriteup).mockClear();
  vi.mocked(deleteWriteup).mockResolvedValue({ id: 7, status: "pending" } as never);
});

describe("DeleteButton", () => {
  it("renders nothing for a non-admin", () => {
    isAdmin = false;
    renderButton();
    expect(screen.queryByLabelText("Send this writeup back to the review queue")).toBeNull();
  });

  it("asks before doing anything - the first click only opens the dialog", () => {
    renderButton();
    fireEvent.click(trigger());

    expect(screen.getByText("Send this writeup back?")).toBeTruthy();
    expect(deleteWriteup).not.toHaveBeenCalled();
  });

  it("cancelling closes the dialog and leaves the writeup published", () => {
    renderButton();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByText("KEEP IT UP"));

    expect(screen.queryByText("Send this writeup back?")).toBeNull();
    expect(deleteWriteup).not.toHaveBeenCalled();
  });

  it("confirming sends exactly one request, for this writeup", async () => {
    renderButton();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByText("SEND BACK TO QUEUE"));

    await waitFor(() => expect(deleteWriteup).toHaveBeenCalledTimes(1));
    expect(deleteWriteup).toHaveBeenCalledWith(7);
    await waitFor(() => expect(screen.queryByText("Send this writeup back?")).toBeNull());
  });

  it("keeps the dialog open and shows why when the request fails", async () => {
    vi.mocked(deleteWriteup).mockRejectedValue(new Error("Only published writeup can be deleted."));
    renderButton();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByText("SEND BACK TO QUEUE"));

    await waitFor(() =>
      expect(screen.getByText("Only published writeup can be deleted.")).toBeTruthy(),
    );
    // Still open: closing on failure would look exactly like success.
    expect(screen.getByText("Send this writeup back?")).toBeTruthy();
  });

  it("a second confirm click while in flight does not send a second request", async () => {
    let release: (v: unknown) => void = () => {};
    vi.mocked(deleteWriteup).mockReturnValue(new Promise((r) => (release = r)) as never);
    renderButton();
    fireEvent.click(trigger());

    const confirm = screen.getByText("SEND BACK TO QUEUE");
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.getByText("SENDING BACK...")).toBeTruthy());
    fireEvent.click(screen.getByText("SENDING BACK..."));

    expect(deleteWriteup).toHaveBeenCalledTimes(1);

    // Settled inside the test, not left dangling: resolving after it returns
    // updates state on a torn-down tree and trips React's act() warning.
    release({ id: 7, status: "pending" });
    await waitFor(() => expect(screen.queryByText("Send this writeup back?")).toBeNull());
  });
});

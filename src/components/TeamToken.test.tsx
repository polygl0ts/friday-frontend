import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeamToken } from "./TeamToken";

const TOKEN = "teamtok_8205bd92-0545-52df-9631-a1edc4bd2f5e";

/** Replace just `navigator.clipboard` - jsdom's navigator is otherwise fine. */
function stubClipboard(clipboard: unknown) {
  vi.stubGlobal("navigator", { clipboard });
}

afterEach(() => vi.unstubAllGlobals());

describe("TeamToken", () => {
  it("keeps the token off the screen until it is asked for", () => {
    render(<TeamToken token={TOKEN} />);

    // A profile page can be open on a projector. Nothing should put a
    // non-expiring credential on screen just because the page rendered.
    expect(screen.queryByText(TOKEN)).toBeNull();
    expect(screen.getByRole("button", { name: "REVEAL" })).toBeDefined();
  });

  it("reveals and re-hides the token", () => {
    render(<TeamToken token={TOKEN} />);

    fireEvent.click(screen.getByRole("button", { name: "REVEAL" }));
    expect(screen.getByText(TOKEN)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "HIDE" }));
    expect(screen.queryByText(TOKEN)).toBeNull();
  });

  it("copies the real token, not the mask", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    render(<TeamToken token={TOKEN} />);

    fireEvent.click(screen.getByRole("button", { name: "COPY" }));

    expect(await screen.findByRole("button", { name: "COPIED ✓" })).toBeDefined();
    expect(writeText).toHaveBeenCalledWith(TOKEN);
  });

  it("says so when the clipboard is unavailable instead of looking successful", async () => {
    // No clipboard at all - what a browser does outside a secure context,
    // which includes plain-http dev on anything but localhost.
    stubClipboard(undefined);
    render(<TeamToken token={TOKEN} />);

    fireEvent.click(screen.getByRole("button", { name: "COPY" }));

    expect(await screen.findByText(/Couldn't reach the clipboard/)).toBeDefined();
    expect(screen.getByRole("button", { name: "COPY" })).toBeDefined();
  });
});

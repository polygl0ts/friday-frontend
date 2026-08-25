import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAvatar, setAvatar } from "../api/rctf";
import { AvatarPicker } from "./AvatarPicker";

vi.mock("../api/rctf", async () => {
  // Keep the real MAX_AVATAR_SIZE: a test that invents its own cap stops
  // covering the thing the cap is for.
  const actual = await vi.importActual<typeof import("../api/rctf")>("../api/rctf");
  return { ...actual, setAvatar: vi.fn(), deleteAvatar: vi.fn() };
});

function renderPicker(url: string | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <AvatarPicker url={url} teamName="n1ght0wl" />
    </QueryClientProvider>,
  );
  return { invalidate };
}

const button = () => screen.getByLabelText("Change the team picture for n1ght0wl");
const fileInput = () => document.querySelector("input[type=file]") as HTMLInputElement;

function choose(file: File) {
  // jsdom won't let `files` be assigned directly.
  Object.defineProperty(fileInput(), "files", { value: [file], configurable: true });
  fireEvent.change(fileInput());
}

const png = (bytes: number) =>
  new File([new Uint8Array(bytes)], "me.png", { type: "image/png" });

beforeEach(() => {
  vi.mocked(setAvatar).mockReset().mockResolvedValue("https://rctf.example/uploads/a.webp");
  vi.mocked(deleteAvatar).mockReset().mockResolvedValue("The avatar was successfully updated.");
});

describe("AvatarPicker", () => {
  it("opens the file dialog when the picture itself is clicked", () => {
    renderPicker();
    const click = vi.spyOn(fileInput(), "click");

    fireEvent.click(button());

    // The picture is the control - there is no separate upload button to find.
    expect(click).toHaveBeenCalled();
  });

  it("uploads the chosen file and refreshes the profile the header reads", async () => {
    const { invalidate } = renderPicker();

    choose(png(64));

    await waitFor(() => expect(setAvatar).toHaveBeenCalled());
    expect(vi.mocked(setAvatar).mock.calls[0][0].name).toBe("me.png");
    // Without the invalidation the new picture appears nowhere until a reload.
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["myProfile"] }),
    );
  });

  it("refuses an oversized image without spending a rate-limited attempt", async () => {
    renderPicker();

    choose(png(1024 * 1024 + 1));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(setAvatar).not.toHaveBeenCalled();
  });

  it("refuses a non-image without spending one either", async () => {
    renderPicker();

    choose(new File(["x"], "notes.txt", { type: "text/plain" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(setAvatar).not.toHaveBeenCalled();
  });

  it("surfaces a server rejection rather than failing silently", async () => {
    vi.mocked(setAvatar).mockRejectedValue(new Error("You are trying this too fast."));
    renderPicker();

    choose(png(64));

    expect((await screen.findByRole("alert")).textContent).toBe("You are trying this too fast.");
  });

  it("offers Remove only once there is a picture to remove", async () => {
    renderPicker(null);
    expect(screen.queryByText("Remove")).toBeNull();

    renderPicker("https://rctf.example/uploads/a.webp");
    fireEvent.click(screen.getByText("Remove"));

    await waitFor(() => expect(deleteAvatar).toHaveBeenCalled());
  });
});

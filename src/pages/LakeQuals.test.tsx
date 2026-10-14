import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LakeQuals } from "./LakeQuals";
import { ApiError } from "../api/client";
import { inviteWhoami, submitInvite } from "../api/extras";

vi.mock("../api/extras", () => ({
  inviteWhoami: vi.fn(),
  submitInvite: vi.fn(),
}));

function renderPage(search = "?token=tok_root") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/lake-quals${search}`]}>
        <LakeQuals />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function input(container: HTMLElement, name: string): HTMLInputElement {
  return container.querySelector(`input[name="${name}"]`) as HTMLInputElement;
}

describe("LakeQuals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(inviteWhoami).mockImplementation(async (token) => {
      if (token === "tok_root") return { team_name: "root" };
      throw new ApiError("Invalid or revoked token", 404);
    });
    vi.mocked(submitInvite).mockResolvedValue(undefined);
  });

  it("takes the token from the email link and names the inviter", async () => {
    const { container } = renderPage();

    expect(input(container, "invite-token").value).toBe("tok_root");
    expect(await screen.findByText("root")).toBeDefined();
    expect(inviteWhoami).toHaveBeenCalledWith("tok_root");
    expect(input(container, "team").disabled).toBe(false);
  });

  it("locks the form for an invalid token", async () => {
    const { container } = renderPage("?token=nope");

    expect(await screen.findByText("Invalid or revoked token.")).toBeDefined();
    expect(input(container, "team").disabled).toBe(true);
    expect(input(container, "email").disabled).toBe(true);
    expect(screen.getByRole("button", { name: "INVITE →" })).toHaveProperty("disabled", true);
  });

  it("locks the form with no token at all", () => {
    const { container } = renderPage("");

    expect(inviteWhoami).not.toHaveBeenCalled();
    expect(input(container, "team").disabled).toBe(true);
  });

  it("submits the invite and clears the form", async () => {
    const { container } = renderPage();
    await screen.findByText("root");

    fireEvent.change(input(container, "team"), { target: { value: "guest" } });
    fireEvent.change(input(container, "email"), { target: { value: "guest@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "INVITE →" }));

    expect(await screen.findByText(/waiting for organizer approval/)).toBeDefined();
    expect(submitInvite).toHaveBeenCalledWith("tok_root", "guest", "guest@example.com");
    expect(input(container, "team").value).toBe("");
    expect(input(container, "email").value).toBe("");
  });

  it("shows why a submission was refused", async () => {
    vi.mocked(submitInvite).mockRejectedValue(new ApiError("email: String should match pattern", 422));
    const { container } = renderPage();
    await screen.findByText("root");

    fireEvent.change(input(container, "team"), { target: { value: "guest" } });
    fireEvent.change(input(container, "email"), { target: { value: "guest@example" } });
    fireEvent.click(screen.getByRole("button", { name: "INVITE →" }));

    await waitFor(() => expect(screen.getByText(/should match pattern/)).toBeDefined());
  });
});

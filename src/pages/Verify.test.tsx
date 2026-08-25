import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Verify } from "./Verify";
import { getVerifyInfo, verify } from "../api/rctf";

vi.mock("../api/rctf", () => ({
  getVerifyInfo: vi.fn(),
  verify: vi.fn(),
}));

const login = vi.fn();
const navigate = vi.fn();

vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ login }) }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

function renderVerify(search = "?token=verifytok_abc") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    // StrictMode on purpose: double-invoked effects burning a single-use token
    // is the exact failure this page was rebuilt to remove.
    <StrictMode>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/verify${search}`]}>
          <Verify />
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

describe("Verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVerifyInfo).mockResolvedValue({
      kind: "register",
      email: "you@example.com",
      name: "n1ght0wl",
    });
    vi.mocked(verify).mockResolvedValue({ authToken: "auth_1", teamToken: "team_1" });
  });

  it("does not spend the token just because the page loaded", async () => {
    renderVerify();

    expect(await screen.findByText(/creates the team n1ght0wl/)).toBeDefined();
    expect(verify).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();
  });

  it("describes what the link will do before doing it", async () => {
    renderVerify();

    expect(await screen.findByText("Finish creating your team")).toBeDefined();
    expect(screen.getByText(/you@example.com/)).toBeDefined();
    expect(screen.getByRole("button", { name: "CREATE TEAM →" })).toBeDefined();
  });

  it("verifies on confirm and sends a new team to its profile", async () => {
    renderVerify();

    fireEvent.click(await screen.findByRole("button", { name: "CREATE TEAM →" }));

    await waitFor(() => expect(verify).toHaveBeenCalledWith("verifytok_abc"));
    expect(login).toHaveBeenCalledWith("auth_1");
    // The team token is on screen there, and this is the one moment it exists.
    expect(navigate).toHaveBeenCalledWith("/profile");
  });

  it("sends a returning team home instead, since it already has a token", async () => {
    vi.mocked(getVerifyInfo).mockResolvedValue({ kind: "team", email: null, name: "n1ght0wl" });
    vi.mocked(verify).mockResolvedValue({ authToken: "auth_1", teamToken: null });
    renderVerify();

    fireEvent.click(await screen.findByRole("button", { name: "LOG IN →" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  });

  it("still offers to submit when the preview fails", async () => {
    vi.mocked(getVerifyInfo).mockRejectedValue(new Error("badTokenVerification"));
    renderVerify();

    // The preview is help, not a gate - the POST is what decides.
    expect(await screen.findByText(/couldn't read this link ahead of time/i)).toBeDefined();
    expect(screen.getByRole("button", { name: "CONTINUE →" })).toBeDefined();
  });

  it("surfaces a rejected token instead of silently doing nothing", async () => {
    vi.mocked(verify).mockRejectedValue(new Error("The token could not be verified."));
    renderVerify();

    fireEvent.click(await screen.findByRole("button", { name: "CREATE TEAM →" }));

    expect(await screen.findByText("The token could not be verified.")).toBeDefined();
    expect(login).not.toHaveBeenCalled();
  });

  it("says so when there is no token in the URL", () => {
    renderVerify("");

    expect(screen.getByText("Missing verification token.")).toBeDefined();
    expect(getVerifyInfo).not.toHaveBeenCalled();
  });
});

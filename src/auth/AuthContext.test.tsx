import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { getMyProfile } from "../api/rctf";

/**
 * What the two permission flags resolve to for a real profile.
 *
 * `utils.test.ts` covers the bit arithmetic; this covers the wiring - that both
 * flags are read off `/users/me`'s `perms` and reach a consumer. The distinction
 * matters because rCTF gates the admin challenge *reads* on `challsRead` and
 * `PUT /v2/admin/challs/:id` on `challsWrite`: an account can legitimately open
 * the challenge panel and be unable to change anything in it.
 */

vi.mock("../api/rctf", () => ({ getMyProfile: vi.fn() }));

const mockProfile = vi.mocked(getMyProfile);

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
});

function Probe() {
  const { isAdmin, canWriteChalls } = useAuth();
  return (
    <div>
      <span data-testid="isAdmin">{String(isAdmin)}</span>
      <span data-testid="canWriteChalls">{String(canWriteChalls)}</span>
    </div>
  );
}

function renderWithPerms(perms: number | null) {
  mockProfile.mockResolvedValue({ id: "t1", name: "n1ght0wl", score: 0, solves: [], perms });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return render(<Probe />, { wrapper });
}

const flags = () => ({
  isAdmin: screen.getByTestId("isAdmin").textContent,
  canWriteChalls: screen.getByTestId("canWriteChalls").textContent,
});

beforeEach(() => {
  mockProfile.mockReset();
  // The provider only fetches when a token is stored - without one it stays
  // logged out and every flag is false regardless of what the mock would say.
  store.set("polygl0ts_auth_token", "authtok_1");
});

describe("AuthContext permissions", () => {
  it("gives a full admin both", async () => {
    renderWithPerms(63);

    await waitFor(() => expect(flags().isAdmin).toBe("true"));
    expect(flags().canWriteChalls).toBe("true");
  });

  it("lets a challsRead-only admin in without letting it write", async () => {
    // The case the challenge panel's toggle has to handle: the panel opens,
    // the control must not be offered, and rCTF would answer 403 anyway.
    renderWithPerms(1);

    await waitFor(() => expect(flags().isAdmin).toBe("true"));
    expect(flags().canWriteChalls).toBe("false");
  });

  it("gives a plain team neither", async () => {
    renderWithPerms(0);

    await waitFor(() => expect(mockProfile).toHaveBeenCalled());
    expect(flags()).toEqual({ isAdmin: "false", canWriteChalls: "false" });
  });

  it("treats an absent perms field as no permissions", async () => {
    // rCTF answers 0, but the dev mock and older responses can omit it.
    renderWithPerms(null);

    await waitFor(() => expect(mockProfile).toHaveBeenCalled());
    expect(flags()).toEqual({ isAdmin: "false", canWriteChalls: "false" });
  });
});

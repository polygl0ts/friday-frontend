import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminTeams } from "./AdminTeams";
import { listAdminUsers, listTeamSubmissions } from "../api/rctf";
import { useAuth } from "../auth/AuthContext";
import type { RctfAdminUser } from "../types";

vi.mock("../api/rctf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/rctf")>();
  return {
    ...actual,
    listAdminUsers: vi.fn(),
    listTeamSubmissions: vi.fn(),
    // The row's own write controls. Never called here, but a named import
    // missing from a mocked module is an error at import time.
    setBannedTeam: vi.fn(),
    setDivisionTeam: vi.fn(),
    listDivisions: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("../auth/AuthContext", () => ({ useAuth: vi.fn() }));

const mockUsers = vi.mocked(listAdminUsers);
const mockSubmissions = vi.mocked(listTeamSubmissions);
const mockAuth = vi.mocked(useAuth);

function team(over: Partial<RctfAdminUser> = {}): RctfAdminUser {
  return {
    id: "t7",
    name: "n1ght0wl",
    email: "player@example.com",
    division: "epfl",
    perms: 0,
    banned: false,
    score: 325,
    solveCount: 4,
    avatarUrl: null,
    ...over,
  };
}

/** The two bits `/v2/admin/submissions` needs, held or not. Everything else
 *  `useAuth` returns is irrelevant to this page. */
function auth(over: { isAdmin?: boolean; canWriteUsers?: boolean } = {}) {
  mockAuth.mockReturnValue({
    isAdmin: true,
    canWriteUsers: true,
    canWriteChalls: true,
    ...over,
  } as ReturnType<typeof useAuth>);
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AdminTeams />
    </QueryClientProvider>,
  );
}

function detailedButton(): HTMLElement {
  return screen.getAllByText("DETAILED")[0];
}

beforeEach(() => {
  mockUsers.mockReset();
  mockSubmissions.mockReset();
  mockAuth.mockReset();
  auth();
  mockUsers.mockResolvedValue({ total: 1, users: [team()] });
  mockSubmissions.mockResolvedValue({ total: 0, submissions: [] });
});

describe("AdminTeams DETAILED", () => {
  it("opens that team's submission log, and only that team's", async () => {
    mockUsers.mockResolvedValue({
      total: 2,
      users: [team(), team({ id: "t9", name: "flag_hoarder", score: 1 })],
    });

    renderPage();
    const line = (await screen.findByText("flag_hoarder")).closest(".table-row") as HTMLElement;
    fireEvent.click(within(line).getByText("DETAILED"));

    await waitFor(() => expect(mockSubmissions).toHaveBeenCalled());
    // The row that was clicked, not the first team on the page.
    expect(mockSubmissions.mock.calls[0][0]).toBe("t9");
  });

  it("is refused without both permissions the route needs, and says which", async () => {
    // `challsRead` opens the admin panel and `usersWrite` reads teams; this
    // route wants both, so an admin can legitimately be standing here and be
    // refused. The button states that rather than disappearing.
    auth({ canWriteUsers: false });
    renderPage();

    await waitFor(() => expect(detailedButton()).toBeTruthy());
    expect(detailedButton().hasAttribute("disabled")).toBe(true);
    expect(detailedButton().getAttribute("title")).toMatch(/usersWrite/);

    fireEvent.click(detailedButton());
    expect(mockSubmissions).not.toHaveBeenCalled();
  });

  it("names the other missing bit when that is the one lacking", async () => {
    auth({ isAdmin: false });
    renderPage();

    await waitFor(() => expect(detailedButton()).toBeTruthy());
    expect(detailedButton().getAttribute("title")).toMatch(/challsRead/);
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminInvites } from "./AdminInvites";
import {
  acceptInvite,
  createRootInvite,
  getInvites,
  rejectInvite,
  revokeInvite,
} from "../api/extras";
import type { Invite } from "../types";

vi.mock("../api/extras", () => ({
  acceptInvite: vi.fn(),
  createRootInvite: vi.fn(),
  getInvites: vi.fn(),
  rejectInvite: vi.fn(),
  revokeInvite: vi.fn(),
}));

function invite(over: Partial<Invite> = {}): Invite {
  return {
    id: 1,
    team_name: "root",
    email: "root@example.com",
    status: "accepted",
    token: "tok_root",
    revoked: false,
    invited_by_id: null,
    invited_by: "LakeOrga",
    created_at: "2026-10-14T10:00:00Z",
    decided_by: "admin",
    decided_at: "2026-10-14T10:00:00Z",
    ...over,
  };
}

const ROOT = invite();
const GUEST = invite({
  id: 2,
  team_name: "guest",
  email: "guest@example.com",
  status: "pending",
  token: null,
  invited_by_id: 1,
  invited_by: "root",
  decided_by: null,
  decided_at: null,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AdminInvites />
    </QueryClientProvider>,
  );
}

function row(teamName: string): HTMLElement {
  return screen.getByText(teamName, { selector: ".table-invites > span:first-child" })
    .parentElement as HTMLElement;
}

describe("AdminInvites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInvites).mockResolvedValue([GUEST, ROOT]);
  });

  it("lists every team with who invited it", async () => {
    renderPage();

    await screen.findByText("guest");
    expect(within(row("guest")).getByText("root")).toBeDefined();
    expect(within(row("root")).getByText("LakeOrga", { selector: ".admin-cell-empty" })).toBeDefined();
    expect(screen.getByText(/2 total · 1 pending/)).toBeDefined();
  });

  it("offers accept and reject only on pending rows", async () => {
    renderPage();
    await screen.findByText("guest");

    expect(within(row("guest")).getByRole("button", { name: "ACCEPT" })).toBeDefined();
    expect(within(row("guest")).queryByRole("button", { name: "REVOKE" })).toBeNull();
    expect(within(row("root")).queryByRole("button", { name: "ACCEPT" })).toBeNull();
    expect(within(row("root")).getByRole("button", { name: "REVOKE" })).toBeDefined();
  });

  it("accepts and rejects", async () => {
    vi.mocked(acceptInvite).mockResolvedValue({ ...GUEST, status: "accepted" });
    vi.mocked(rejectInvite).mockResolvedValue({ ...GUEST, status: "rejected" });
    renderPage();
    await screen.findByText("guest");

    fireEvent.click(within(row("guest")).getByRole("button", { name: "ACCEPT" }));
    await waitFor(() => expect(acceptInvite).toHaveBeenCalledWith(2));

    fireEvent.click(within(row("guest")).getByRole("button", { name: "REJECT" }));
    await waitFor(() => expect(rejectInvite).toHaveBeenCalledWith(2));
  });

  it("asks before revoking", async () => {
    vi.mocked(revokeInvite).mockResolvedValue({ ...ROOT, revoked: true });
    renderPage();
    await screen.findByText("guest");

    fireEvent.click(within(row("root")).getByRole("button", { name: "REVOKE" }));
    expect(revokeInvite).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "REVOKE THE TOKEN" }));
    await waitFor(() => expect(revokeInvite).toHaveBeenCalledWith(1));
  });

  it("copies an accepted team's invite link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderPage();
    await screen.findByText("guest");

    expect(within(row("guest")).queryByRole("button", { name: "COPY LINK" })).toBeNull();
    fireEvent.click(within(row("root")).getByRole("button", { name: "COPY LINK" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/lake-quals?token=tok_root`);
    expect(await within(row("root")).findByRole("button", { name: "COPIED" })).toBeDefined();
  });

  it("creates a root team", async () => {
    vi.mocked(createRootInvite).mockResolvedValue(ROOT);
    renderPage();
    await screen.findByText("guest");

    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "seed" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "seed@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "INVITE" }));

    await waitFor(() => expect(createRootInvite).toHaveBeenCalledWith("seed", "seed@example.com"));
  });
});

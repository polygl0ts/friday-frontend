/**
 * Client for the polygl0ts-extras companion API (writeups,
 * Discord config, admin stats, Lake Quals invitations).
 */
import { request } from "./client";
import { extrasOrigin as ORIGIN } from "../config";
import type {
  AdminStats,
  DiscordConfig,
  DiscordConfigUpdate,
  DiscordTestResult,
  GradeScores,
  GradingCriteria,
  Invite,
  Writeup,
  WriteupCard,
  WriteupSort,
} from "../types";

/** Every published writeup, as bodyless cards - one request for the whole
 *  grid rather than one per challenge. `sort` defaults to newest-first. */
export const getWriteupCards = (
  challengeId?: string,
  sort: WriteupSort = "new",
) => {
  const params = new URLSearchParams({ sort });
  if (challengeId) params.set("challenge_id", challengeId);
  return request<WriteupCard[]>(ORIGIN, `/api/writeups?${params}`);
};

/** Upvote, or take it back. Two verbs rather than a toggle, so a double-click
 *  can't flip the vote back off. */
export const upvoteWriteup = (id: number) =>
  request<Writeup>(ORIGIN, `/api/writeups/item/${id}/vote`, { method: "POST" });

export const unvoteWriteup = (id: number) =>
  request<Writeup>(ORIGIN, `/api/writeups/item/${id}/vote`, {
    method: "DELETE",
  });

/** One writeup. The server decides what comes back: `solution_md` is null
 *  unless this team solved the challenge (or wrote it, or is an admin). */
export const getWriteup = (id: number) =>
  request<Writeup>(ORIGIN, `/api/writeups/item/${id}`);

export const submitWriteup = (
  challengeId: string,
  bodyMd: string,
  summary: string,
) =>
  request<Writeup>(ORIGIN, `/api/writeups/${challengeId}/submit`, {
    method: "POST",
    body: { body_md: bodyMd, summary },
  });

/** Edit your own pending/rejected writeup; sends it back for review. */
export const updateWriteup = (id: number, bodyMd: string, summary: string) =>
  request<Writeup>(ORIGIN, `/api/writeups/item/${id}`, {
    method: "PUT",
    body: { body_md: bodyMd, summary },
  });

export const getMyWriteups = () =>
  request<Writeup[]>(ORIGIN, "/api/writeups/mine");

export const getWriteupQueue = () =>
  request<Writeup[]>(ORIGIN, "/api/writeups/queue");

export const approveWriteup = (id: number) =>
  request<Writeup>(ORIGIN, `/api/writeups/${id}/approve`, { method: "POST" });

export const rejectWriteup = (id: number, reason: string) =>
  request<Writeup>(ORIGIN, `/api/writeups/${id}/reject`, {
    method: "POST",
    body: { reason },
  });

export const deleteWriteup = (id: number) =>
  request<Writeup>(ORIGIN, `/api/writeups/${id}/delete`, { method: "POST" });

export const getGradingCriteria = () =>
  request<GradingCriteria>(ORIGIN, "/api/writeups/criteria");

export const gradeWriteup = (id: number, scores: GradeScores) =>
  request<Writeup>(ORIGIN, `/api/writeups/item/${id}/grade`, {
    method: "PUT",
    body: { scores },
  });

// First bloods are deliberately absent here: rCTF v2 serves them itself on
// /v2/leaderboard/challs, so the grid reads them from rCTF rather than from a
// cache this service used to poll into a table. See hooks/useChallenges.ts.

export const getAdminStats = () =>
  request<AdminStats>(ORIGIN, "/api/admin/stats");

export const getDiscordConfig = () =>
  request<DiscordConfig>(ORIGIN, "/api/admin/discord-config");

export const setDiscordConfig = (config: DiscordConfigUpdate) =>
  request<DiscordConfig>(ORIGIN, "/api/admin/discord-config", {
    method: "PUT",
    body: config,
  });

/** Forget the stored webhook, falling back to the vault-injected value. */
export const clearWebhook = () =>
  request<DiscordConfig>(ORIGIN, "/api/admin/discord-config/webhook", {
    method: "DELETE",
  });

/** Post a real message and report whether Discord accepted it - the only way
 *  to tell a working webhook from a mistyped one, since notifications
 *  themselves are fire-and-forget. */
export const testDiscordWebhook = () =>
  request<DiscordTestResult>(ORIGIN, "/api/admin/discord-config/test", {
    method: "POST",
  });

// Lake Quals invitations. Auth is done using the quals token, independant of rCTF.

export const inviteWhoami = (token: string) =>
  request<{ team_name: string }>(
    ORIGIN,
    `/api/invites/whoami?token=${encodeURIComponent(token)}`,
    { auth: false },
  );

export const submitInvite = (token: string, teamName: string, email: string) =>
  request<void>(ORIGIN, "/api/invites", {
    method: "POST",
    body: { token, team_name: teamName, email },
    auth: false,
  });

export const getInvites = () => request<Invite[]>(ORIGIN, "/api/admin/invites");

export const createRootInvite = (teamName: string, email: string) =>
  request<Invite>(ORIGIN, "/api/admin/invites", {
    method: "POST",
    body: { team_name: teamName, email },
  });

export const acceptInvite = (id: number) =>
  request<Invite>(ORIGIN, `/api/admin/invites/${id}/accept`, {
    method: "POST",
  });

export const rejectInvite = (id: number) =>
  request<Invite>(ORIGIN, `/api/admin/invites/${id}/reject`, {
    method: "POST",
  });

export const revokeInvite = (id: number) =>
  request<Invite>(ORIGIN, `/api/admin/invites/${id}/revoke`, {
    method: "POST",
  });

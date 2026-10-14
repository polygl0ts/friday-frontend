import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptInvite,
  createRootInvite,
  getInvites,
  rejectInvite,
  revokeInvite,
} from "../api/extras";
import { ConfirmDialog } from "../components/ConfirmDialog";
import type { Invite, InviteStatus } from "../types";
import { formatTimestamp } from "../utils";

/**
 * The Lake Quals invitation chain, flat: one row per team, with who invited
 * it. Accept / reject here is the fallback for the Discord buttons.
 */

const STATUS_COLOR: Record<InviteStatus, string> = {
  pending: "var(--amber)",
  accepted: "var(--green)",
  rejected: "var(--text-dimmer)",
};

function inviteLink(token: string): string {
  return `${window.location.origin}/lake-quals?token=${encodeURIComponent(token)}`;
}

function RootInviteForm() {
  const queryClient = useQueryClient();
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const mutation = useMutation({
    mutationFn: () => createRootInvite(teamName, email),
    onSuccess: () => {
      setTeamName("");
      setEmail("");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["invites"] }),
  });

  return (
    <form
      className="panel"
      style={{ padding: 22, marginBottom: 20 }}
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="field-label">CREATE ROOT TEAM</div>
      <div className="mono-dim" style={{ lineHeight: 1.5, marginBottom: 10 }}>
        First team invited by orga.
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
      >
        <div className="field" style={{ flex: "1 1 200px", margin: 0 }}>
          <input
            aria-label="Team name"
            maxLength={100}
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="team name"
          />
        </div>
        <div className="field" style={{ flex: "1 1 200px", margin: 0 }}>
          <input
            aria-label="Email"
            type="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="polygl0ts@epfl.ch"
          />
        </div>
        <button
          className="btn btn-small"
          type="submit"
          disabled={!teamName.trim() || !email.trim() || mutation.isPending}
        >
          {mutation.isPending ? "INVITING..." : "INVITE"}
        </button>
      </div>
      {mutation.error && (
        <div className="mono-dim" style={{ marginTop: 8, color: "var(--red)" }}>
          &#10005; {(mutation.error as Error).message}
        </div>
      )}
    </form>
  );
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-small btn-outline"
      title="Copy this team's invite link, to resend it by hand"
      onClick={() =>
        void navigator.clipboard.writeText(inviteLink(token)).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
    >
      {copied ? "COPIED" : "COPY LINK"}
    </button>
  );
}

function InviteActions({ invite }: { invite: Invite }) {
  const queryClient = useQueryClient();
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const mutation = useMutation({
    mutationFn: (action: "accept" | "reject" | "revoke") =>
      ({ accept: acceptInvite, reject: rejectInvite, revoke: revokeInvite })[
        action
      ](invite.id),
    onSuccess: () => setConfirmingRevoke(false),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["invites"] }),
  });

  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {invite.status === "pending" && (
        <>
          <button
            type="button"
            className="btn btn-small"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("accept")}
          >
            ACCEPT
          </button>
          <button
            type="button"
            className="btn btn-small btn-outline"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("reject")}
          >
            REJECT
          </button>
        </>
      )}
      {invite.status === "accepted" && invite.token && (
        <CopyLinkButton token={invite.token} />
      )}
      {invite.status === "accepted" && !invite.revoked && (
        <button
          type="button"
          className="btn btn-small btn-outline"
          disabled={mutation.isPending}
          onClick={() => setConfirmingRevoke(true)}
        >
          REVOKE
        </button>
      )}
      {mutation.error && !confirmingRevoke && (
        <span style={{ color: "var(--red)", fontSize: 11 }}>
          {(mutation.error as Error).message}
        </span>
      )}

      {confirmingRevoke && (
        <ConfirmDialog
          title="Revoke this token ?"
          confirmLabel={mutation.isPending ? "REVOKING..." : "REVOKE THE TOKEN"}
          cancelLabel="KEEP IT"
          pending={mutation.isPending}
          error={mutation.error ? (mutation.error as Error).message : null}
          onConfirm={() => mutation.mutate("revoke")}
          onCancel={() => {
            mutation.reset();
            setConfirmingRevoke(false);
          }}
        >
          {invite.team_name} will no longer be able to invite teams. Teams it
          already invited keep their own tokens. This can't be undone from the
          panel.
        </ConfirmDialog>
      )}
    </span>
  );
}

export function AdminInvites() {
  const invitesQuery = useQuery({ queryKey: ["invites"], queryFn: getInvites });
  const invites = invitesQuery.data ?? [];
  const pendingCount = invites.filter((i) => i.status === "pending").length;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          margin: "30px 0 16px",
        }}
      >
        <div className="page-subtitle" style={{ margin: 0 }}>
          LAKE QUALS INVITES
        </div>
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.15em",
            color: "var(--text-dimmer)",
          }}
        >
          {invites.length} total &middot; {pendingCount} pending
        </span>
      </div>

      <RootInviteForm />

      {invitesQuery.isLoading && <div className="loading">Loading...</div>}
      {invitesQuery.error && (
        <div className="error-text">
          {(invitesQuery.error as Error).message}
        </div>
      )}
      {invitesQuery.data?.length === 0 && (
        <div className="empty-text">
          No invites yet. Create a root team to start the chain.
        </div>
      )}

      {invites.length > 0 && (
        <div className="table">
          <div className="table-row table-invites table-head">
            <span>TEAM</span>
            <span>EMAIL</span>
            <span>STATUS</span>
            <span>INVITED BY</span>
            <span>DECIDED BY</span>
            <span>CREATED</span>
            <span>REVOKED</span>
            <span></span>
          </div>

          {invites.map((invite) => (
            <div className="table-row table-invites" key={invite.id}>
              <span
                style={{
                  color: "var(--text-bright)",
                  overflowWrap: "anywhere",
                }}
              >
                {invite.team_name}
              </span>
              <span className="admin-team-email">{invite.email}</span>
              <span style={{ color: STATUS_COLOR[invite.status] }}>
                {invite.status}
              </span>
              <span
                className={
                  invite.invited_by_id ? undefined : "admin-cell-empty"
                }
                style={{ overflowWrap: "anywhere" }}
              >
                {invite.invited_by}
              </span>
              {invite.decided_by ? (
                <span style={{ overflowWrap: "anywhere" }}>
                  {invite.decided_by}
                </span>
              ) : (
                <span className="admin-cell-empty">&mdash;</span>
              )}
              <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
                {formatTimestamp(Date.parse(invite.created_at), true)}
              </span>
              <span
                style={{
                  color: invite.revoked ? "var(--red)" : "var(--text-dimmer)",
                }}
              >
                {invite.revoked ? "YES" : "no"}
              </span>
              <InviteActions invite={invite} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

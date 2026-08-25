import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setBannedTeam } from "../api/rctf";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * The team panel's BANNED cell: what the team's state is, and - for an admin
 * who can write users - the control that flips it.
 *
 * State and control together on purpose. `challsRead` (what opens the admin
 * panel) and `usersWrite` (what bans a team) are separate rCTF permissions, so
 * an account can legitimately reach this panel and be refused the write;
 * rendering nothing for those admins would blank out a column they are allowed
 * to read. The button is what's conditional, not the answer.
 */
export function BanTeamButton({
  teamId,
  banned,
}: {
  teamId: string;
  banned: boolean;
}) {
  const queryClient = useQueryClient();
  const { canWriteUsers } = useAuth();
  const [ confirming, setConfirming ] = useState(false);
  const mutation = useMutation({
    mutationFn: () => setBannedTeam(teamId, !banned),
    onSuccess: () => setConfirming(false),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["adminUsers"] }),
  });

  const state = (
    <span style={{ color: banned ? "var(--red)" : "var(--text-dimmer)" }}>
      {banned ? "YES" : "no"}
    </span>
  );

  if (!canWriteUsers) return <span className="admin-ban">{state}</span>;

  const action = banned ? "Unban this team ?" : "Ban this team ?";

  return (
    <span className="admin-ban">
      <button
        className={`ban-team${banned ? " banned" : ""}`}
        disabled={mutation.isPending}
        title={action}
        aria-label={action}
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(true);
        }}
      >
        {banned ? "YES" : "NO"}
      </button>

      {confirming && (
        <ConfirmDialog
          title={banned ? "Unban this team ?" : "Ban this team ?"}
          confirmLabel={
            mutation.isPending
              ? banned
                ? "UNBANNING..."
                : "BANNING..."
              : banned
                ? "UNBAN THE TEAM"
                : "BAN THE TEAM"
          }
          cancelLabel={banned ? "KEEP IT BANNED" : "KEEP IT UNBANNED"}
          pending={mutation.isPending}
          error={mutation.error ? (mutation.error as Error).message : null}
          onConfirm={() => mutation.mutate()}
          onCancel={() => {
            mutation.reset();
            setConfirming(false);
          }}
        >
          {banned
            ? "The team will get unban. This action is reversible."
            : "The team will get ban. This action is reversible."}
        </ConfirmDialog>
      )}
    </span>
  );
}

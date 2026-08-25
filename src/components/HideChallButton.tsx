import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setChallengeHidden } from "../api/rctf";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * The admin panel's HIDDEN cell: what the challenge's state is, and - for an
 * admin who can write challenges - the control that flips it.
 *
 * State and control together on purpose. `challsRead` and `challsWrite` are
 * separate rCTF permissions, so an account can legitimately reach this panel
 * and be refused the write; rendering nothing for those admins would blank out
 * a column they are allowed to read. The button is what's conditional, not the
 * answer.
 */
export function HideChallButton({
  challengeId,
  hidden,
}: {
  challengeId: string;
  hidden: boolean;
}) {
  const queryClient = useQueryClient();
  const { canWriteChalls } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: () => setChallengeHidden(challengeId, !hidden),
    onSuccess: () => setConfirming(false),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["adminChallenges"] });
      queryClient.invalidateQueries({ queryKey: ["challengeList"] });
    },
  });

  const state = (
    <span style={{ color: hidden ? "var(--red)" : "var(--text-dimmer)" }}>
      {hidden ? "YES" : "no"}
    </span>
  );

  if (!canWriteChalls) return <span className="admin-hidden">{state}</span>;

  const action = hidden ? "Show this challenge to players" : "Hide this challenge from players";

  return (
    <span className="admin-hidden">
      <button
        className={`hide-challenge${hidden ? " hidden" : ""}`}
        disabled={mutation.isPending}
        title={action}
        aria-label={action}
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(true);
        }}
      >
        {hidden ? "YES" : "NO"}
      </button>

      {confirming && (
        <ConfirmDialog
          title={hidden ? "Show this challenge to players?" : "Hide this challenge from players?"}
          confirmLabel={
            mutation.isPending
              ? hidden
                ? "SHOWING..."
                : "HIDING..."
              : hidden
                ? "SHOW TO PLAYERS"
                : "HIDE FROM PLAYERS"
          }
          cancelLabel={hidden ? "KEEP IT HIDDEN" : "KEEP IT VISIBLE"}
          pending={mutation.isPending}
          error={mutation.error ? (mutation.error as Error).message : null}
          onConfirm={() => mutation.mutate()}
          onCancel={() => {
            mutation.reset();
            setConfirming(false);
          }}
        >
          {hidden
            ? "It goes back on the challenge grid for every player, with its points, solves and first bloods as they were."
            : "It comes off the challenge grid and can no longer be solved. Nothing is lost - points, solves and first bloods are all kept, and showing it again brings them back."}
        </ConfirmDialog>
      )}
    </span>
  );
}

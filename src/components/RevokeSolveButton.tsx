import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revokeSubmission } from "../api/rctf";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * Admin pannel submission revoke button. Revoking a solve for a
 * given team completely erase it from DB.
 */
export function RevokeSolveButton({
  challengeId,
  userId,
}: {
  challengeId: string;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const { challsSolveWrite } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: () => revokeSubmission(challengeId, userId),
    onSuccess: () => setConfirming(false),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["adminChallenges"] });
      queryClient.invalidateQueries({ queryKey: ["challengeList"] });
    },
  });

  if (!challsSolveWrite) return null;

  return (
    <span className="admin-hidden">
      <button
        className="revoke-solve"
        disabled={mutation.isPending}
        title="Revoke team submission for this flag."
        aria-label="Revoke team submission for this flag."
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(true);
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>

      {confirming && (
        <ConfirmDialog
          title="Revoke this team submission ?"
          confirmLabel={mutation.isPending ? "REVOKING..." : "REVOKE"}
          cancelLabel="DO NOT REVOKE"
          pending={mutation.isPending}
          error={mutation.error ? (mutation.error as Error).message : null}
          onConfirm={() => mutation.mutate()}
          onCancel={() => {
            mutation.reset();
            setConfirming(false);
          }}
        >
          Revoking this submission is unrecoverable. Removing the submission
          completely erase it from the DB.
        </ConfirmDialog>
      )}
    </span>
  );
}

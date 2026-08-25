import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteFlag } from "../api/rctf";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "./ConfirmDialog";
import type { RctfFlagEntry } from "../types";

/**
 * Drops one flag from a challenge, behind a confirm dialog.
 */
export function DeleteFlagButton({
  challengeId,
  flags,
  flag,
}: {
  challengeId: string;
  flags: RctfFlagEntry[];
  flag: RctfFlagEntry;
}) {
  const queryClient = useQueryClient();
  const { canWriteChalls } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: () => deleteFlag(challengeId, flags, flag),
    onSuccess: () => setConfirming(false),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["adminChallenges"] });
      queryClient.invalidateQueries({ queryKey: ["challengeList"] });
    },
  });

  if (!canWriteChalls) return null; 


  return (
    <span className="admin-hidden">
      <button
        className="hide-challenge"
        disabled={mutation.isPending}
        title="Delete this flag"
        aria-label="Delete this flag"
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(true);
        }}
      >
        DELETE
      </button>

      {confirming && (
        <ConfirmDialog
          title="Delete this flag ?"
          confirmLabel={mutation.isPending ? "DELETING.." : "DELETE FLAG"}
          cancelLabel="Keep this flag."
          pending={mutation.isPending}
          error={mutation.error ? (mutation.error as Error).message : null}
          onConfirm={() => mutation.mutate()}
          onCancel={() => {
            mutation.reset();
            setConfirming(false);
          }}
        >
        Deleting this flag will prevent it from validating the challenge, it will 
        affect all future flag submission. 
        </ConfirmDialog>
      )}
    </span>
  );
}

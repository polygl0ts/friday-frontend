import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteWriteup } from "../api/extras";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "./ConfirmDialog";
/**
 *  Delete button for writeup (sends back to pending)
 */
export function DeleteButton({
  writeupId,
}: {
  writeupId: number;
}) {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  // Asked first, unlike the upvote next to it: that one is one click to undo,
  // this one pulls a writeup off the site for everyone.
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: () => (deleteWriteup(writeupId)),
    onSuccess: () => setConfirming(false),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["writeupCards"] });
      queryClient.invalidateQueries({ queryKey: ["writeup", writeupId] });
    },
  });

  if (!isAdmin) return null;

  return (
    <>
      <button
        className="delete-writeup"
        disabled={mutation.isPending}
        title="Send this writeup back to the review queue"
        aria-label="Send this writeup back to the review queue"
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(true);
        }}
      >
        &#10005;
      </button>

      {confirming && (
        <ConfirmDialog
          title="Send this writeup back?"
          confirmLabel={mutation.isPending ? "SENDING BACK..." : "SEND BACK TO QUEUE"}
          cancelLabel="KEEP IT UP"
          pending={mutation.isPending}
          // Kept on screen rather than swallowed: without it a failed request
          // is indistinguishable from a writeup that refused to budge.
          error={mutation.error ? (mutation.error as Error).message : null}
          onConfirm={() => mutation.mutate()}
          onCancel={() => {
            mutation.reset();
            setConfirming(false);
          }}
        >
          It comes off the writeups grid and goes back to the review queue as
          pending. Nothing is deleted - the author keeps it, can edit it, and an
          admin can publish it again. Upvotes are kept.
        </ConfirmDialog>
      )}
    </>
  );
}

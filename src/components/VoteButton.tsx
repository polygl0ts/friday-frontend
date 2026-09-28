import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unvoteWriteup, upvoteWriteup } from "../api/extras";
import { useAuth } from "../auth/AuthContext";

/**
 * StackOverflow-style upvote for writeup.
 *
 */
export function VoteButton({
  writeupId,
  votes,
  voted,
  own,
}: {
  writeupId: number;
  votes: number;
  voted: boolean;
  own?: boolean;
}) {
  const queryClient = useQueryClient();
  const { isLoggedIn } = useAuth();

  const mutation = useMutation({
    mutationFn: () => (voted ? unvoteWriteup(writeupId) : upvoteWriteup(writeupId)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["writeupCards"] });
      queryClient.invalidateQueries({ queryKey: ["writeup", writeupId] });
    },
  });

  // While the request is in flight, show where it's heading.
  const optimistic = mutation.isPending ? !voted : voted;
  const shown = votes + (optimistic === voted ? 0 : optimistic ? 1 : -1);

  return (
    <button
      className={`vote${optimistic ? " voted" : ""}`}
      disabled={!isLoggedIn || own || mutation.isPending}
      title={
        !isLoggedIn
          ? "Log in to upvote"
          : own
            ? "You can't upvote your own writeup"
            : optimistic
              ? "Remove upvote"
              : "Upvote"
      }
      aria-pressed={optimistic}
      onClick={(e) => {
        e.stopPropagation();
        mutation.mutate();
      }}
    >
      <span className="vote-arrow">&#9650;</span>
      <span>{shown}</span>
    </button>
  );
}

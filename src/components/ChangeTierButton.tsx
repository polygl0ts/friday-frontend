import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { changeChallengeTag } from "../api/rctf";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "./ConfirmDialog";
import { TagDialog } from "./TagDialog";

type Step = "idle" | "choosing" | "confirming";

/**
 * The tag challenge display, equivalent to the tier of the challenge, 
 * alongside with capability to change it by an admin.
 */
export function ChangeTierButton({
  challengeId,
  challengeName,
  tags,
}: {
  challengeId: string;
  challengeName: string;
  // rCTF can support multiple tags but by convention we'll use only one.
  tags: string[] | null;
}) {
  const queryClient = useQueryClient();
  const { canWriteChalls } = useAuth();
  const [step, setStep] = useState<Step>("idle");
  const [chosen, setChosen] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (next: string) => changeChallengeTag(challengeId, next),
    onSuccess: () => setStep("idle"),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["adminChallenges"] });
      queryClient.invalidateQueries({ queryKey: ["challengeList"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboardChallenges"] });
    },
  });

  const current = tags?.[0] ?? "";

  const labels = tags && tags.length > 0 ? tags : ["NONE"];

  if (!canWriteChalls || current === "intro2")
    return (
      <span className="admin-tags">
        {labels.map((label) => (
          <span key={label} style={{ color: "var(--text-dimmer)" }}>
            {label}
          </span>
        ))}
      </span>
    );

  return (
    <span className="admin-tags">
      {labels.map((label) => (
        <button
          key={label}
          className="change-tag"
          disabled={mutation.isPending}
          title="Change this challenge's tag"
          aria-label={`Change the tag of ${challengeName}`}
          onClick={(e) => {
            e.stopPropagation();
            mutation.reset();
            setChosen(null);
            setStep("choosing");
          }}
        >
          {label}
        </button>
      ))}

      {step === "choosing" && (
        <TagDialog
          challengeName={challengeName}
          current={current}
          onPick={(next) => {
            setChosen(next);
            setStep("confirming");
          }}
          onCancel={() => setStep("idle")}
        />
      )}

      {step === "confirming" && chosen !== null && (
        <ConfirmDialog
          title="Change this tag?"
          confirmLabel={mutation.isPending ? "CHANGING..." : "CONFIRM"}
          cancelLabel="BACK"
          pending={mutation.isPending}
          error={mutation.error ? (mutation.error as Error).message : null}
          onConfirm={() => mutation.mutate(chosen)}
          onCancel={() => {
            mutation.reset();
            setStep("choosing");
          }}
        >
          <span style={{ color: "var(--text-bright)" }}>{challengeName}</span> goes from{" "}
          <span style={{ color: "var(--amber)" }}>{tags?.join(", ") || "no tag"}</span> to{" "}
          <span style={{ color: "var(--amber)" }}>{chosen}</span>. The tag is what sorts a
          challenge into its tier on the board, so players see it move; solves and score are
          untouched, and it can be changed again afterwards.
        </ConfirmDialog>
      )}
    </span>
  );
}

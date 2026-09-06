import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useState } from "react";
import { setChallengePoints } from "../api/rctf";
import { ConfirmDialog } from "./ConfirmDialog";
import { PointsDialog } from "./PointsDialog";

type Step = "idle" | "typing" | "confirming";

/**
 * The POINTS cell of the admin table: the challenge's score range, and for an
 * admin a button that opens the two boundaries for editing.
 */
export function ChangePointsButton({
  challengeId,
  challengeName,
  minChallPoints,
  maxChallPoints,
}: {
  challengeId: string;
  challengeName: string;
  minChallPoints: number;
  maxChallPoints: number;
}) {
  const queryClient = useQueryClient();
  const { canWriteChalls } = useAuth();
  const [step, setStep] = useState<Step>("idle");
  const [minPoints, setMinPoints] = useState<string>(String(minChallPoints));
  const [maxPoints, setMaxPoints] = useState<string>(String(maxChallPoints));

  const mutation = useMutation({
    mutationFn: () =>
      setChallengePoints(challengeId, {
        min: Number(minPoints),
        max: Number(maxPoints),
      }),
    onSuccess: () => setStep("idle"),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["adminChallenges"] });
      queryClient.invalidateQueries({ queryKey: ["challengeList"] });
    },
  });

  const range = `${minChallPoints} – ${maxChallPoints}`;

  if (!canWriteChalls)
    return <span className="admin-points admin-points-static">{range}</span>;

  return (
    <span className="admin-points">
      <button
        className="change-score"
        disabled={mutation.isPending}
        title="Change scoring for this challenge."
        aria-label={`Change the scoring of ${challengeName}`}
        onClick={(e) => {
          e.stopPropagation();
          mutation.reset();
          setMinPoints(String(minChallPoints));
          setMaxPoints(String(maxChallPoints));
          setStep("typing");
        }}
      >
        {range}
      </button>

      {step === "typing" && (
        <PointsDialog
          challengeName={challengeName}
          min={minPoints}
          max={maxPoints}
          currentMin={minChallPoints}
          currentMax={maxChallPoints}
          onMinChange={setMinPoints}
          onMaxChange={setMaxPoints}
          onSubmit={() => setStep("confirming")}
          onCancel={() => setStep("idle")}
        />
      )}

      {step === "confirming" && (
        <ConfirmDialog
          title="Change the score boundary for this challenge?"
          confirmLabel={mutation.isPending ? "SAVING..." : "SET NEW SCORE"}
          cancelLabel="BACK"
          pending={mutation.isPending}
          error={mutation.error ? (mutation.error as Error).message : null}
          onConfirm={() => mutation.mutate()}
          onCancel={() => {
            mutation.reset();
            setStep("typing");
          }}
        >
          <span style={{ color: "var(--text-bright)" }}>{challengeName}</span>{" "}
          goes from <span style={{ color: "var(--amber)" }}>{range}</span> to{" "}
          <span style={{ color: "var(--amber)" }}>
            {minPoints || "?"} &ndash; {maxPoints || "?"}
          </span>
          .
        </ConfirmDialog>
      )}
    </span>
  );
}

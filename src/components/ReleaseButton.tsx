import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setReleaseTime } from "../api/rctf";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "./ConfirmDialog";
import { ScheduleDialog } from "./ScheduleDialog";
import { formatTimestamp } from "../utils";

/** Idle, picking a moment, or agreeing to apply the one that was picked. */
type Step = "idle" | "picking" | "confirming";

/**
 * The admin panel's RELEASE cell: when the challenge opens to players, and -
 * for an admin who can write challenges - the control that changes it.
 */
export function ReleaseButton({
  challengeId,
  challengeName,
  releaseTime,
}: {
  challengeId: string;
  challengeName: string;
  releaseTime: number | null;
}) {
  const queryClient = useQueryClient();
  const { isAdmin, canWriteChalls } = useAuth();
  const [step, setStep] = useState<Step>("idle");
  const [chosen, setChosen] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: (ms: number) => setReleaseTime(challengeId, ms),
    onSuccess: () => setStep("idle"),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["adminChallenges"] });
      queryClient.invalidateQueries({ queryKey: ["challengeList"] });
    },
  });

  const formatted = formatTimestamp(releaseTime, true);
  const scheduled = releaseTime !== null && releaseTime > Date.now();

  const state = (
    <span className={`admin-release-state${scheduled ? " scheduled" : ""}`}>
      {formatted}
      <span className="admin-release-pending">{scheduled ? "SCHEDULED" : "RELEASED"}</span>
    </span>
  );

  if (!isAdmin || !canWriteChalls || !scheduled) return <span className="admin-release">{state}</span>;

  const action = "Change the release time";
  const target = formatTimestamp(chosen, true);

  return (
    <span className="admin-release">
      <button
        className="release-challenge"
        disabled={mutation.isPending}
        title={action}
        aria-label={`${action} for ${challengeName}`}
        onClick={(e) => {
          e.stopPropagation();
          mutation.reset();
          setChosen(null);
          setStep("picking");
        }}
      >
        {state}
      </button>

      {step === "picking" && (
        <ScheduleDialog
          challengeName={challengeName}
          initialTime={chosen ?? releaseTime}
          onValidate={(ms) => {
            setChosen(ms);
            setStep("confirming");
          }}
          onCancel={() => setStep("idle")}
        />
      )}

      {step === "confirming" && chosen !== null && (
        <ConfirmDialog
          title="Set this release time?"
          confirmLabel={mutation.isPending ? "SAVING..." : "SET RELEASE TIME"}
          cancelLabel="BACK"
          pending={mutation.isPending}
          error={mutation.error ? (mutation.error as Error).message : null}
          onConfirm={() => mutation.mutate(chosen)}
          onCancel={() => {
            mutation.reset();
            setStep("picking");
          }}
        >
          <span style={{ color: "var(--text-bright)" }}>{challengeName}</span> opens to players at{" "}
          <span style={{ color: "var(--amber)" }}>{target}</span>
          {chosen <= Date.now()
            ? " - that moment has passed, so it goes live as soon as this is saved. "
            : ", and stays off the challenge grid until then. "}
          Nothing else changes: points, solves and first bloods are all kept, and the time can be
          set again afterwards.
        </ConfirmDialog>
      )}
    </span>
  );
}

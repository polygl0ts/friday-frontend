import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setDivisionTeam } from "../api/rctf";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "./ConfirmDialog";
import { DivisionDialog } from "./DivisionDialog";

type Step = "idle" | "choosing" | "confirming";

/**
 * Team admin pannel division cell and button for control.
 */
export function DivisionTeamButton({
  teamId,
  teamName,
  division,
}: {
  teamId: string;
  teamName: string;
  division: string;
}) {
  const queryClient = useQueryClient();
  const { canWriteUsers } = useAuth();
  const [step, setStep] = useState<Step>("idle");
  const [chosen, setChosen] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (next: string) => setDivisionTeam(teamId, next),
    onSuccess: () => setStep("idle"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["adminUsers"] }),
  });

  const state = <span>{division || <span className="admin-cell-empty">&mdash;</span>}</span>;

  if (!canWriteUsers) return <span className="admin-division">{state}</span>;

  return (
    <span className="admin-division">
      <button
        className="change-division"
        disabled={mutation.isPending}
        title="Change this team's division"
        aria-label={`Change the division of ${teamName}`}
        onClick={(e) => {
          e.stopPropagation();
          mutation.reset();
          setChosen(null);
          setStep("choosing");
        }}
      >
        {state}
      </button>

      {step === "choosing" && (
        <DivisionDialog
          teamName={teamName}
          current={division}
          onPick={(next) => {
            setChosen(next);
            setStep("confirming");
          }}
          onCancel={() => setStep("idle")}
        />
      )}

      {step === "confirming" && chosen !== null && (
        <ConfirmDialog
          title="Move this team?"
          confirmLabel={mutation.isPending ? "MOVING..." : "CONFIRMING"}
          cancelLabel="BACK"
          pending={mutation.isPending}
          error={mutation.error ? (mutation.error as Error).message : null}
          onConfirm={() => mutation.mutate(chosen)}
          onCancel={() => {
            mutation.reset();
            setStep("choosing");
          }}
        >
          <span style={{ color: "var(--text-bright)" }}>{teamName}</span> moves from{" "}
          <span style={{ color: "var(--amber)" }}>{division || "no division"}</span> to{" "}
          <span style={{ color: "var(--amber)" }}>{chosen}</span>. It ranks on that division's
          leaderboard from then on; its score, solves and first bloods are untouched, and it can be
          moved again afterwards.
        </ConfirmDialog>
      )}
    </span>
  );
}

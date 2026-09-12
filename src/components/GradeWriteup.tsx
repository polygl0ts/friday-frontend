import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { gradeWriteup } from "../api/extras";
import { useAuth } from "../auth/AuthContext";
import { useGradingCriteria } from "../hooks/useGradingCriteria";
import { isCompleteSheet } from "../utils";
import type { GradeScores } from "../types";

/**
 * Admin grading sheet for a writeup: one row of pills per rated criterion
 * (min..max), a yes/no pair per check, and a submit. Renders nothing for
 * non-admins. Pre-filled from `myGrade` when this admin already graded it.
 */
export function GradeWriteup({
  writeupId,
  myGrade,
}: {
  writeupId: number;
  myGrade?: GradeScores | null;
}) {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const criteria = useGradingCriteria(isAdmin);
  const [scores, setScores] = useState<GradeScores>(myGrade ?? {});

  const mutation = useMutation({
    mutationFn: () => gradeWriteup(writeupId, scores),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["writeupCards"] });
      queryClient.invalidateQueries({ queryKey: ["writeup", writeupId] });
    },
  });

  if (!isAdmin) return null;
  if (!criteria.data) return null;

  const { rated, checks, min, max } = criteria.data;
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const complete = isCompleteSheet(scores, criteria.data);

  const set = (name: string, value: number | boolean) => {
    mutation.reset();
    setScores((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="grade-writeup" onClick={(e) => e.stopPropagation()}>
      {rated.map((name) => (
        <div className="grade-row" key={name}>
          <span className="grade-label">{name}</span>
          <div className="grade-options">
            {values.map((v) => (
              <button
                key={v}
                type="button"
                className={`pill${scores[name] === v ? " active" : ""}`}
                aria-pressed={scores[name] === v}
                onClick={() => set(name, v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      ))}

      {checks.map((name) => (
        <div className="grade-row" key={name}>
          <span className="grade-label">{name}</span>
          <div className="grade-options">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                className={`pill${scores[name] === v ? " active" : ""}`}
                aria-pressed={scores[name] === v}
                onClick={() => set(name, v)}
              >
                {v ? "yes" : "no"}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        className="pill grade-submit"
        disabled={!complete || mutation.isPending}
        title={complete ? "Save your grade" : "Fill in every criterion first"}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending
          ? "SAVING..."
          : mutation.isSuccess
            ? "SAVED"
            : myGrade
              ? "UPDATE GRADE"
              : "SUBMIT GRADE"}
      </button>

      {mutation.error && (
        <p className="grade-error">{(mutation.error as Error).message}</p>
      )}
    </div>
  );
}

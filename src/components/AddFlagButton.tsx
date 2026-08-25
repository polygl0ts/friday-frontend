
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addFlag } from "../api/rctf";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "./ConfirmDialog";
import type { RctfFlagEntry } from "../types"

type Step = "idle" | "typing" | "confirming";

/**
 * The admin panel's add-flag control: type one new flag onto a challenge, and
 * confirm it before it is written.
 */
export function AddFlagButton({
  challengeId,
  challengeName,
  flags,
}: {
  challengeId: string;
  challengeName: string;
  flags: RctfFlagEntry[];
}) {
  const queryClient = useQueryClient();
  const { canWriteChalls } = useAuth();
  const [ step, setStep ] = useState<Step>("idle");
  const [ flag, setFlag ] = useState<string>("");
  const mutation = useMutation({
    mutationFn: () => addFlag(challengeId, flags, flag), 
    onSuccess: () => setStep("idle"),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["adminChallenges"] });
      queryClient.invalidateQueries({ queryKey: ["challengeList"] });
    },
  });


  if (!canWriteChalls) return null;


  return (
    <>
      <span className="admin-hidden">
        <button
          className="hide-challenge"
          disabled={mutation.isPending}
          title="Add flag to challenge."
          aria-label="Add flag to challenge."
          onClick={(e) => {
            e.stopPropagation();
            mutation.reset();
            setStep("typing");
          }}
        >
        Add new flag.
        </button>

        { step === "typing" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep("confirming");
            }}
          >
            <input 
              type="text"
              placeholder="New flag..."
              value={flag}
              onChange={(e) => setFlag(e.currentTarget.value)}
            />
          </form>
        )}

        { step === "confirming" && flag !== "" && (
              
          <ConfirmDialog
            title="Add this new flag ?"
            confirmLabel={mutation.isPending ? "SAVING..." : "SET NEW FLAG"}
            cancelLabel="BACK"
            pending={mutation.isPending}
            error={mutation.error ? (mutation.error as Error).message : null}
            onConfirm={() => mutation.mutate()}
            onCancel={() => {
              mutation.reset();
              setStep("typing");
            }}
          >

          <span style={{ color: "var(--text-bright)" }}>{challengeName}</span> Add new flag {" "}
          <span style={{ color: "var(--amber)" }}>{flag}</span>
          
          </ConfirmDialog>
        )}
      </span>
    </>
  );
}

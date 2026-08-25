import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getIntro2Track } from "../api/extras";
import { useAuth } from "../auth/AuthContext";
import { ChallengeModal } from "../components/ChallengeModal";
import type { Intro2Step } from "../types";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  done: { label: "✓ DONE", color: "var(--green)" },
  in_progress: { label: "IN PROGRESS", color: "var(--amber)" },
  locked: { label: "LOCKED", color: "var(--text-dimmer)" },
};

/**
 * A locked step stays closed, which is the whole point of a guided track: the
 */
function isOpenable(step: Intro2Step): boolean {
  return step.status !== "locked";
}

export function Intro2() {
  const { isLoggedIn } = useAuth();
  const trackQuery = useQuery({ queryKey: ["intro2"], queryFn: getIntro2Track, enabled: isLoggedIn });
  const [openStep, setOpenStep] = useState<Intro2Step | null>(null);

  const total = trackQuery.data?.length ?? 0;
  const done = trackQuery.data?.filter((s) => s.status === "done").length ?? 0;
  const progressPct = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="page">
      <div className="page-title">
        INTRO2 <span style={{ color: "var(--red)" }}>&middot;</span> LEARNING TRACK
      </div>
      <div className="page-subtitle">GUIDED CHALLENGES &middot; NO SCORE PRESSURE &middot; UNLOCK THE ARENA</div>

      {!isLoggedIn && <div className="empty-text">Log in to track your INTRO2 progress.</div>}

      {isLoggedIn && (
        <>
          <div className="meter" style={{ margin: "34px 0 40px" }}>
            <div
              className="meter-fill"
              style={{
                width: `${progressPct}%`,
              }}
            />
          </div>

          {trackQuery.isLoading && <div className="loading">Loading...</div>}
          {trackQuery.error && <div className="error-text">{(trackQuery.error as Error).message}</div>}
          {trackQuery.data?.length === 0 && (
            <div className="empty-text">No INTRO2 challenges configured yet.</div>
          )}

          <div className="grid grid-3">
            {trackQuery.data?.map((step) => {
              const meta = STATUS_LABEL[step.status];
              const openable = isOpenable(step);
              return (
                <div
                  className="card"
                  key={step.challenge_id}
                  onClick={openable ? () => setOpenStep(step) : undefined}
                  onKeyDown={
                    openable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpenStep(step);
                          }
                        }
                      : undefined
                  }
                  role={openable ? "button" : undefined}
                  tabIndex={openable ? 0 : undefined}
                  aria-disabled={openable ? undefined : true}
                  style={{ cursor: openable ? "pointer" : "default" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--text-dim)" }}>
                      STEP {String(step.step).padStart(2, "0")}
                    </span>
                    <span style={{ fontSize: 11, color: meta.color }}>{meta.label}</span>
                  </div>
                  <div className="heading" style={{ fontSize: 20, fontWeight: 600, color: "var(--text-bright)", margin: "14px 0 8px" }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.7 }}>{step.description}</div>
                  <div style={{ marginTop: 14, fontSize: 11, color: "var(--text-dimmer)", letterSpacing: "0.14em" }}>
                    {openable
                      ? step.status === "done"
                        ? "REVIEW"
                        : "OPEN → SUBMIT FLAG"
                      : "FINISH THE PREVIOUS STEP FIRST"}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {openStep && (
        <ChallengeModal
          challengeId={openStep.challenge_id}
          challengeName={openStep.title}
          category={openStep.category || "intro2"}
          description={openStep.description}
          files={openStep.files}
          onClose={() => setOpenStep(null)}
        />
      )}
    </div>
  );
}

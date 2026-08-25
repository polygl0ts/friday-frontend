import { useState } from "react";
import { useChallengeNames } from "../hooks/useChallengeNames";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { Markdown } from "./Markdown";
import type { Writeup } from "../types";

/**
 * The moderation view: both halves of a pending writeup, rendered as the two
 * audiences will see them.
 */
export function WriteupReviewModal({
  writeup,
  onApprove,
  onReject,
  onClose,
  pending,
}: {
  writeup: Writeup;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const challengeName = useChallengeNames();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  useEscapeKey(onClose);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="heading" style={{ fontSize: 17, color: "var(--text-bright)", fontWeight: 600 }}>
              {challengeName(writeup.challenge_id)}
            </span>
            <div style={{ fontSize: 11, letterSpacing: "0.18em", color: "var(--red)", marginTop: 6 }}>
              REVIEW &middot; {writeup.team_name.toUpperCase()}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            &#10005;
          </button>
        </div>

        <div className="modal-body">
          <div className="field-label" style={{ marginBottom: 6 }}>
            SUMMARY &middot; PUBLIC
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.65, marginBottom: 20 }}>
            {writeup.summary}
          </div>

          <div className="md-preview-label">VISIBLE TO EVERYONE ONCE PUBLISHED</div>
          <Markdown>{writeup.intro_md}</Markdown>

          <div className="md-boundary">
            <span>SOLVERS ONLY</span>
          </div>
          <Markdown>{writeup.solution_md ?? ""}</Markdown>

          {rejecting ? (
            <div style={{ marginTop: 22 }}>
              <div className="field">
                <div className="field-label">WHY? &middot; SENT TO THE AUTHOR AND TO DISCORD</div>
                <textarea
                  value={reason}
                  autoFocus
                  maxLength={2000}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="The flag is in the public half - move it below the :::solution marker."
                />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-outline" onClick={() => setRejecting(false)}>
                  BACK
                </button>
                <button
                  className="btn btn-reject"
                  style={{ flex: 1 }}
                  disabled={!reason.trim() || pending}
                  onClick={() => onReject(reason.trim())}
                >
                  CONFIRM REJECTION
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button className="btn btn-reject" onClick={() => setRejecting(true)} disabled={pending}>
                REJECT
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={onApprove} disabled={pending}>
                APPROVE &rarr; PUBLISH
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

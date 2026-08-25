import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyWriteups } from "../api/extras";
import { useChallengeNames } from "../hooks/useChallengeNames";
import { formatTimestamp } from "../utils";
import { WriteupComposer } from "./WriteupDetailModal";
import type { Writeup } from "../types";

const STATUS_COLOR: Record<string, string> = {
  pending: "var(--amber)",
  published: "var(--green)",
  rejected: "var(--text-dim)",
};

const STATUS_NOTE: Record<string, string> = {
  pending: "Waiting on a reviewer.",
  published: "Live for everyone.",
  rejected: "Not published - see the reason below.",
};

/**
 * Your own writeups and where each one stands.
 */
export function MyWriteups({ compact }: { compact?: boolean }) {
  const [editing, setEditing] = useState<Writeup | null>(null);
  const challengeName = useChallengeNames();
  const query = useQuery({ queryKey: ["myWriteups"], queryFn: getMyWriteups });

  if (query.isLoading) return <div className="loading">Loading...</div>;
  if (query.error) return <div className="error-text">{(query.error as Error).message}</div>;
  if (query.data?.length === 0) {
    return (
      <div className={compact ? "mono-dim" : "empty-text"}>
        No writeups submitted yet. Solve something and post one.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 0 : 14 }}>
        {query.data?.map((w) => (
          <div key={w.id} className={compact ? "my-writeup compact" : "my-writeup"}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: compact ? 13 : 15, color: "var(--text)" }}>
                {challengeName(w.challenge_id)}
              </span>
              <span style={{ fontSize: 11, color: STATUS_COLOR[w.status], whiteSpace: "nowrap" }}>
                &#9679; {w.status.toUpperCase()}
              </span>
            </div>

            {!compact && (
              <>
                <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6, marginTop: 8 }}>
                  {w.summary}
                </div>
                <div className="mono-dim" style={{ marginTop: 10 }}>
                  {formatTimestamp(Date.parse(w.created_at)) ?? "-"} &middot; {STATUS_NOTE[w.status]}
                  {w.status === "published" && (
                    <>
                      {" "}
                      &middot; <span style={{ color: "var(--red)" }}>&#9650; {w.votes}</span>
                    </>
                  )}
                </div>
              </>
            )}

            {w.status === "rejected" && w.reject_reason && (
              <div className="notice notice-warn">{w.reject_reason}</div>
            )}

            {w.status !== "published" && (
              <button
                className="btn btn-small btn-outline"
                style={{ marginTop: 12 }}
                onClick={() => setEditing(w)}
              >
                EDIT &amp; RESUBMIT
              </button>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="heading" style={{ fontSize: 17, color: "var(--text-bright)", fontWeight: 600 }}>
                EDIT <span style={{ color: "var(--red)" }}>&middot; {challengeName(editing.challenge_id)}</span>
              </span>
              <button className="modal-close" onClick={() => setEditing(null)}>
                &#10005;
              </button>
            </div>
            <div className="modal-body">
              <WriteupComposer
                challengeId={editing.challenge_id}
                existing={editing}
                onDone={() => {
                  setEditing(null);
                  query.refetch();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

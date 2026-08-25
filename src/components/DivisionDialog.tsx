import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { listDivisions } from "../api/rctf";
import { useEscapeKey } from "../hooks/useEscapeKey";

/**
 * Pick a division, as the step before the confirm dialog.
 *
 * A list of the configured divisions rather than a text field, and the same
 * split `ScheduleDialog` makes for release times: this step is freely
 * reversible because nothing has been sent, and the confirmation that follows
 * states one fixed sentence about what is about to happen.
 */
export function DivisionDialog({
  teamName,
  current,
  onPick,
  onCancel,
}: {
  teamName: string;
  current: string;
  onPick: (division: string) => void;
  onCancel: () => void;
}) {
  const query = useQuery({
    queryKey: ["divisions"],
    queryFn: listDivisions,
    // Divisions come from a config file rCTF parses at startup, so they cannot
    // change while this page is open.
    staleTime: Infinity,
  });

  useEscapeKey(onCancel);

  const divisions = query.data ?? [];
  const orphaned = query.isSuccess && current !== "" && !divisions.some((d) => d.id === current);

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-confirm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span
            className="heading"
            style={{ fontSize: 15, color: "var(--text-bright)", fontWeight: 600 }}
          >
            Division
          </span>
          <button className="modal-close" onClick={onCancel} aria-label="Close">
            &#10005;
          </button>
        </div>

        <div className="modal-body">
          <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }}>
            Which division should <span style={{ color: "var(--text-bright)" }}>{teamName}</span>{" "}
            compete in?
          </div>

          {query.isLoading && <div className="loading">Loading...</div>}
          {query.error && <div className="error-text">{(query.error as Error).message}</div>}

          {orphaned && (
            <div className="division-orphan">
              This team is in <span className="division-key">{current}</span>, which this rCTF has
              no division for. It is off every division leaderboard until it is moved.
            </div>
          )}

          {query.isSuccess && divisions.length === 0 && (
            <div className="empty-text">rCTF reports no divisions.</div>
          )}

          <div className="division-options">
            {divisions.map((division) => {
              const isCurrent = division.id === current;
              return (
                <button
                  key={division.id}
                  type="button"
                  className={`division-option${isCurrent ? " current" : ""}`}
                  disabled={isCurrent}
                  aria-current={isCurrent || undefined}
                  onClick={() => onPick(division.id)}
                >
                  <span className="division-name">{division.name}</span>
                  <span className="division-key">{division.id}</span>
                  {isCurrent && <span className="division-current">CURRENT</span>}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={onCancel}>
              GO BACK
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

import { createPortal } from "react-dom";
import { useEscapeKey } from "../hooks/useEscapeKey";

/**
 * Type the two score boundaries, as the step before the confirm dialog.
 */
export function PointsDialog({
  challengeName,
  min,
  max,
  currentMin,
  currentMax,
  onMinChange,
  onMaxChange,
  onSubmit,
  onCancel,
}: {
  challengeName: string;
  min: string;
  max: string;
  currentMin: number;
  currentMax: number;
  onMinChange: (next: string) => void;
  onMaxChange: (next: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  useEscapeKey(onCancel);

  const unchanged = min === String(currentMin) && max === String(currentMax);

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-confirm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span
            className="heading"
            style={{
              fontSize: 15,
              color: "var(--text-bright)",
              fontWeight: 600,
            }}
          >
            Scoring
          </span>
          <button className="modal-close" onClick={onCancel} aria-label="Close">
            &#10005;
          </button>
        </div>

        <div className="modal-body">
          <div
            style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }}
          >
            New score boundaries for:{" "}
            <span style={{ color: "var(--text-bright)" }}>{challengeName}</span>
            {"."}
          </div>

          <form
            className="points-form"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <div className="points-fields">
              <label className="points-field">
                <span className="points-label">MINIMUM</span>
                <input
                  className="points-input"
                  type="number"
                  autoFocus
                  placeholder={String(currentMin)}
                  value={min}
                  onChange={(e) => onMinChange(e.currentTarget.value)}
                />
              </label>

              <span className="points-arrow" aria-hidden="true">
                &#8594;
              </span>

              <label className="points-field">
                <span className="points-label">MAXIMUM</span>
                <input
                  className="points-input"
                  type="number"
                  placeholder={String(currentMax)}
                  value={max}
                  onChange={(e) => onMaxChange(e.currentTarget.value)}
                />
              </label>
            </div>

            <div className="points-preview">
              Now{" "}
              <span className="points-key">
                {currentMin} &ndash; {currentMax}
              </span>
              {unchanged ? (
                <>, unchanged.</>
              ) : (
                <>
                  , becoming{" "}
                  <span className="points-key points-key-next">
                    {min || "?"} &ndash; {max || "?"}
                  </span>
                  .
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={onCancel}
              >
                GO BACK
              </button>
              <button
                type="submit"
                className="btn btn-outline"
                style={{ flex: 1 }}
                disabled={unchanged}
              >
                REVIEW
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}

import { createPortal } from "react-dom";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { TAG_OPTIONS } from "../types";
/**
 * Pick a tag, as the step before the confirm dialog.
 */
export function TagDialog({
  challengeName,
  current,
  onPick,
  onCancel,
}: {
  challengeName: string;
  current: string;
  onPick: (tag: string) => void;
  onCancel: () => void;
}) {
  useEscapeKey(onCancel);

  const unknown = current !== "" && !TAG_OPTIONS.some((tag) => tag === current);

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
            Tag
          </span>
          <button className="modal-close" onClick={onCancel} aria-label="Close">
            &#10005;
          </button>
        </div>

        <div className="modal-body">
          <div
            style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }}
          >
            Which tag should{" "}
            <span style={{ color: "var(--text-bright)" }}>{challengeName}</span>{" "}
            carry?
          </div>

          {unknown && (
            <div className="division-orphan">
              This challenge is tagged{" "}
              <span className="division-key">{current}</span>, which is not one
              of the tags below. Choosing one replaces it.
            </div>
          )}

          <div className="division-options">
            {TAG_OPTIONS.map((tag) => {
              const isCurrent = tag === current;
              return (
                <button
                  key={tag}
                  type="button"
                  className={`division-option${isCurrent ? " current" : ""}`}
                  disabled={isCurrent}
                  aria-current={isCurrent || undefined}
                  onClick={() => onPick(tag)}
                >
                  <span className="division-name">{tag}</span>
                  {isCurrent && (
                    <span className="division-current">CURRENT</span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <button
              className="btn btn-outline"
              style={{ flex: 1 }}
              onClick={onCancel}
            >
              GO BACK
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

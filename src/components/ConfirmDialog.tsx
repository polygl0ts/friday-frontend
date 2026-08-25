import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEscapeKey } from "../hooks/useEscapeKey";

/**
 * Yes/no dialog for an action that isn't trivially undoable.
 * Deliberately not `window.confirm`: a native dialog blocks the whole page,
 * can't show the request failing, and looks nothing like the rest of the site.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel = "CONFIRM",
  cancelLabel = "CANCEL",
  pending = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  /** What the action will actually do, in a sentence. */
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Request in flight: both buttons lock, and the backdrop stops dismissing. */
  pending?: boolean;
  /** Shown in place rather than closing the dialog, so the answer isn't lost. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dismiss = () => {
    if (!pending) onCancel();
  };

  useEscapeKey(dismiss);

  return createPortal(
    <div className="modal-backdrop" onClick={dismiss}>
      <div className="modal modal-confirm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="heading" style={{ fontSize: 15, color: "var(--text-bright)", fontWeight: 600 }}>
            {title}
          </span>
          <button className="modal-close" onClick={dismiss} disabled={pending}>
            &#10005;
          </button>
        </div>

        <div className="modal-body">
          <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }}>{children}</div>

          {error && (
            <div className="error-text" style={{ padding: "14px 0 0", textAlign: "left", fontSize: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <button className="btn btn-outline" onClick={onCancel} disabled={pending}>
              {cancelLabel}
            </button>
            <button
              className="btn btn-outline" 
              style={{ flex: 1 }}
              onClick={onConfirm}
              disabled={pending}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

import { useState } from "react";
import { createPortal } from "react-dom";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { formatTimestamp, fromDatetimeLocal, toDatetimeLocal } from "../utils";

/**
 * Pick a release date and time, as the step before the confirm dialog.
 *
 * Split from the confirmation on purpose: the two ask different questions.
 * This one is editable and freely reversible - nothing has been sent, so BACK
 * costs nothing - where the confirmation is the point of no return and states
 * what is about to happen in one fixed sentence. Folding the input into the
 * confirm dialog would mean an admin could still be typing in the field their
 * CONFIRM button is about to act on.
 *
 * One `datetime-local` rather than separate date/hour/minute fields: it is the
 * control browsers already give a calendar and a clock to, it validates itself,
 * and it keeps the whole answer in one tab stop.
 */
export function ScheduleDialog({
  challengeName,
  initialTime,
  onValidate,
  onCancel,
}: {
  /** Named in the heading so a mis-clicked row is obvious before anything is sent. */
  challengeName: string;
  /** What the field opens on: the answer already in flight if the admin has
   *  stepped back from the confirmation, otherwise the stored time. */
  initialTime: number | null;
  /** The chosen moment, in Unix milliseconds. */
  onValidate: (ms: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(() => toDatetimeLocal(initialTime));

  useEscapeKey(onCancel);

  const chosen = fromDatetimeLocal(value);
  const preview = formatTimestamp(chosen, true);

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-confirm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span
            className="heading"
            style={{ fontSize: 15, color: "var(--text-bright)", fontWeight: 600 }}
          >
            Release time
          </span>
          <button className="modal-close" onClick={onCancel} aria-label="Close">
            &#10005;
          </button>
        </div>

        <div className="modal-body">
          <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }}>
            When should <span style={{ color: "var(--text-bright)" }}>{challengeName}</span> open
            to players? Times are in your own timezone.
          </div>

          <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
            <label className="field-label" htmlFor="release-at">
              DATE &amp; TIME
            </label>
            <input
              id="release-at"
              type="datetime-local"
              className="schedule-input"
              value={value}
              autoFocus
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && chosen !== null) onValidate(chosen);
              }}
            />
          </div>

          <div className="schedule-preview">
            {preview === null ? (
              "Pick a date and a time to continue."
            ) : (
              <>
                Opens {preview}
                {chosen !== null && chosen <= Date.now() && (
                  <span className="schedule-note">
                    That is in the past - the challenge opens as soon as this is saved.
                  </span>
                )}
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <button className="btn btn-outline" onClick={onCancel}>
              GO BACK
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={chosen === null}
              onClick={() => {
                if (chosen !== null) onValidate(chosen);
              }}
            >
              VALIDATE
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

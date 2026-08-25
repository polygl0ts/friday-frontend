import { useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { SOLUTION_MARKER, looksLikeFlag, splitWriteup } from "../utils";

const PLACEHOLDER = `Describe the approach here - what you noticed, what the
bug is, which dead ends you hit. Everyone can read this part, so keep it
spoiler-shaped: hints, not the answer.

${SOLUTION_MARKER}

Everything below the marker is only shown to teams that already solved the
challenge. Put the full walkthrough, the exploit and the flag here.

\`\`\`python
print("solve script")
\`\`\``;

/**
 * The writeup composer: one document, one boundary marker.
 */
export function MarkdownEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { intro, solution } = splitWriteup(value);
  const flagInIntro = looksLikeFlag(intro);

  const insertMarker = () => {
    const area = textareaRef.current;
    const at = area ? area.selectionStart : value.length;
    onChange(`${value.slice(0, at).trimEnd()}\n\n${SOLUTION_MARKER}\n\n${value.slice(at).trimStart()}`);
    setTab("write");
  };

  // Reading the dropped file here 
  const readFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        {(["write", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`pill${tab === t ? " active" : ""}`}
            style={{ padding: "6px 16px", fontSize: 11 }}
            onClick={() => setTab(t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-small btn-outline"
          onClick={insertMarker}
          disabled={disabled || solution !== null}
          title={solution !== null ? "This writeup already has a boundary" : "Split the writeup here"}
        >
          + SOLUTION BOUNDARY
        </button>
      </div>

      {tab === "write" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            readFile(e.dataTransfer.files[0]);
          }}
          style={{ position: "relative" }}
        >
          <textarea
            ref={textareaRef}
            className="md-editor"
            value={value}
            disabled={disabled}
            spellCheck={false}
            placeholder={PLACEHOLDER}
            onChange={(e) => onChange(e.target.value)}
          />
          {dragging && (
            <div className="md-dropzone">Drop a .md file to load it</div>
          )}
        </div>
      ) : (
        <div className="md-preview">
          <div className="md-preview-label">VISIBLE TO EVERYONE</div>
          {intro ? <Markdown>{intro}</Markdown> : <div className="mono-dim">Nothing yet.</div>}

          <div className="md-boundary">
            <span>SOLVERS ONLY BELOW</span>
          </div>

          {solution === null ? (
            <div className="mono-dim">
              No <code>{SOLUTION_MARKER}</code> line yet - right now the whole writeup would be
              public, so this can't be submitted.
            </div>
          ) : solution ? (
            <Markdown>{solution}</Markdown>
          ) : (
            <div className="mono-dim">Nothing below the boundary yet.</div>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 8 }}>
        <span className="mono-dim">
          Markdown, or drop a <code>.md</code> file. Everything above{" "}
          <code>{SOLUTION_MARKER}</code> is public.
        </span>
        <span className="mono-dim">{value.length.toLocaleString()} / 100,000</span>
      </div>

      {flagInIntro && (
        <div className="notice notice-warn">
          That looks like a flag in the public half. Move it below{" "}
          <code>{SOLUTION_MARKER}</code> - it will be blanked out otherwise.
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { deckUrl, getDecks, recordingUrl } from "../api/slides";
import { formatFileSize } from "../utils";
import type { Deck } from "../types";

const CARD_STYLE = {
  border: "1px solid var(--border-dim)",
  borderRadius: 10,
  padding: 14,
  background: "var(--bg-card)",
} as const;

const ROW_STYLE = {
  display: "flex",
  gap: 14,
  alignItems: "center",
} as const;

const LINK_STYLE = {
  ...ROW_STYLE,
  flex: 1,
  minWidth: 0,
  textDecoration: "none",
} as const;

const VIDEO_BUTTON_STYLE = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  padding: 0,
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--red)",
  font: "inherit",
  fontSize: 10,
  letterSpacing: 1,
  textTransform: "uppercase",
} as const;

const THUMB_STYLE = {
  width: 64,
  height: 38,
  background: "var(--bg-sunken)",
  border: "3px solid var(--red)",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--red)",
  fontSize: 14,
} as const;

/**
 * One deck row.
 */
function DeckCard({ deck }: { deck: Deck }) {
  const meta = [
    deck.date,
    `${deck.pages} slides`,
    formatFileSize(deck.size_bytes),
  ]
    .filter(Boolean)
    .join(" · ");

  const recording = recordingUrl(deck);
  const [playing, setPlaying] = useState(false);

  return (
    <div style={CARD_STYLE}>
      <div style={ROW_STYLE}>
        <a href={deckUrl(deck)} target="_blank" rel="noreferrer" style={LINK_STYLE}>
          <div style={THUMB_STYLE}>&#9656;</div>
          <div style={{ minWidth: 0 }}>
            <div className="heading" style={{ fontSize: 13, color: "var(--text)" }}>
              {deck.title}
            </div>
            <div
              style={{ fontSize: 11, color: "var(--text-dimmer)", marginTop: 4 }}
            >
              {meta}
            </div>
          </div>
        </a>
        {recording && (
          <button
            type="button"
            style={VIDEO_BUTTON_STYLE}
            aria-expanded={playing}
            onClick={() => setPlaying((p) => !p)}
          >
            <div style={THUMB_STYLE}>{playing ? "\u25A0" : "\u25B8"}</div>
            video
          </button>
        )}
      </div>
      {recording && playing && (
        <video
          src={recording}
          controls
          autoPlay
          preload="metadata"
          style={{ display: "block", width: "100%", marginTop: 14 }}
        />
      )}
    </div>
  );
}

/** Public on purpose, the github is in public */
export function Slides() {
  const decksQuery = useQuery({ queryKey: ["decks"], queryFn: getDecks });

  return (
    <div className="page">
      <div className="page-title">
        SLIDES <span style={{ color: "var(--red)" }}>&middot;</span> DECKS
      </div>
      <div className="page-subtitle">WORKSHOP &amp; BRIEFING PRESENTATIONS</div>

      {decksQuery.isLoading && <div className="loading">Loading...</div>}
      {decksQuery.error && (
        <div className="error-text">{(decksQuery.error as Error).message}</div>
      )}
      {decksQuery.data?.length === 0 && (
        <div className="empty-text">No decks published yet.</div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginTop: 36,
          maxWidth: 640,
        }}
      >
        {decksQuery.data?.map((deck) => (
          <DeckCard key={deck.id} deck={deck} />
        ))}
      </div>
    </div>
  );
}

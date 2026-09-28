import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { deckUrl, getDecks, recordingUrl } from "../api/slides";
import { formatFileSize } from "../utils";
import { AsciiFrame } from "../components/AsciiFrame";
import type { Deck } from "../types";
import { PageNote } from "../components/PageNote";

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
    <AsciiFrame rank="deck" className="deck-card">
      <div className="deck-title">
        {"{ "}
        <a
          href={deckUrl(deck)}
          target="_blank"
          rel="noreferrer"
          className="deck-link"
        >
          {deck.title}
        </a>
        {" }"}
      </div>
      <div className="deck-row">
        <span className="deck-meta">{meta}</span>
        <span className="deck-actions">
          <a
            className="btn btn-small"
            href={deckUrl(deck)}
            target="_blank"
            rel="noreferrer"
          >
            pdf
          </a>
          {recording && (
            <button
              type="button"
              className="btn btn-small"
              aria-expanded={playing}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? "\u25A0" : "\u25B8"} video
            </button>
          )}
        </span>
      </div>
      {recording && playing && (
        <video
          src={recording}
          controls
          autoPlay
          preload="metadata"
          className="deck-video"
        />
      )}
    </AsciiFrame>
  );
}

/** Public on purpose, the github is in public */
export function Slides() {
  const decksQuery = useQuery({ queryKey: ["decks"], queryFn: getDecks });

  return (
    <div className="page">
      <PageNote page="slides" />

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
          gap: 18,
          marginTop: 30,
          maxWidth: 760,
        }}
      >
        {decksQuery.data?.map((deck) => (
          <DeckCard key={deck.id} deck={deck} />
        ))}
      </div>
    </div>
  );
}

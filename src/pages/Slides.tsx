import { useQuery } from "@tanstack/react-query";
import { getDecks } from "../api/extras";
import { isSafeUrl } from "../utils";
import type { Deck } from "../types";
import { useAuth } from "../auth/AuthContext";



const CARD_STYLE = {
  display: "flex",
  gap: 14,
  alignItems: "center",
  border: "1px solid var(--border-dim)",
  borderRadius: 10,
  padding: 14,
  background: "var(--bg-card)",
  textDecoration: "none",
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
 *
 * `file_url` is typed by whoever created the deck through the admin API, and it
 * goes straight into an `href` - so it gets the same scheme allowlist writeup
 * links get (`isSafeUrl`). An unsafe one renders as an inert card rather than a
 * link, which is the `Markdown` component's behaviour too: say the deck exists,
 * refuse to be the thing that navigates to it. Admin-authored content is
 * trusted less than the admin, not more - a `javascript:` URL pasted here would
 * otherwise run for every viewer of a page that needs no login.
 */
function DeckCard({ deck }: { deck: Deck }) {
  const body = (
    <>
      <div style={THUMB_STYLE}>&#9656;</div>
      <div style={{ minWidth: 0 }}>
        <div className="heading" style={{ fontSize: 13, color: "var(--text)" }}>
          {deck.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dimmer)", marginTop: 4 }}>{deck.meta}</div>
      </div>
    </>
  );

  if (!isSafeUrl(deck.file_url)) {
    return (
      <div style={{ ...CARD_STYLE, opacity: 0.6 }} title="This deck's link is not a usable URL">
        {body}
      </div>
    );
  }

  return (
    <a href={deck.file_url} target="_blank" rel="noreferrer" style={CARD_STYLE}>
      {body}
    </a>
  );
}

export function Slides() {
  const decksQuery = useQuery({ queryKey: ["decks"], queryFn: getDecks });
  const { isLoggedIn } = useAuth();

  return (
    <div className="page">
      <div className="page-title">
        SLIDES <span style={{ color: "var(--red)" }}>&middot;</span> DECKS
      </div>
      <div className="page-subtitle">WORKSHOP &amp; BRIEFING PRESENTATIONS</div>
      
      {!isLoggedIn && <div className="empty-text">Log in to view the slides decks.</div>}
      {isLoggedIn && (
        <>
          {decksQuery.isLoading && <div className="loading">Loading...</div>}
          {decksQuery.error && <div className="error-text">{(decksQuery.error as Error).message}</div>}
          {decksQuery.data?.length === 0 && <div className="empty-text">No decks published yet.</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 36, maxWidth: 640 }}>
            {decksQuery.data?.map((deck) => (
              <DeckCard key={deck.id} deck={deck} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

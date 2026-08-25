import type { ChallengeWithMeta, WriteupCard as Card } from "../types";

/**
 * One challenge's writeups, shaped like the challenge grid's card so the two
 * pages read as the same system - same slab frame, same offset shadow, same
 * boxed category label.
 */
export function WriteupCard({
  chall,
  cards,
  onOpen,
}: {
  chall: ChallengeWithMeta;
  cards: Card[];
  onOpen: () => void;
}) {
  const latest = cards[0];
  const empty = cards.length === 0;
  const votes = cards.reduce((sum, c) => sum + c.votes, 0);

  return (
    <div
      className={`card${chall.solved ? " solved" : ""}`}
      onClick={onOpen}
      style={{ cursor: "pointer", opacity: empty ? 0.72 : 1 }}
    >
      <div className="card-top">
        <span className={`tag-box${chall.solved ? " accent" : ""}`}>
          {chall.category.toUpperCase()}
        </span>
        {chall.solved ? (
          <span className="card-solved">[&#10003; SOLVED]</span>
        ) : (
          !empty && (
            <span className="card-note" title="Solve it to read the full solutions">
              PARTIALLY HIDDEN
            </span>
          )
        )}
      </div>

      <div className="card-name">{chall.name}</div>

      <div className="card-note">
        {latest ? `LATEST BY ${latest.team_name.toUpperCase()}` : "NO WRITEUPS YET"}
      </div>
      <div className="card-desc" style={{ marginTop: 8 }}>
        {latest ? latest.summary : chall.solved ? "Be the first to post one." : "Nothing published yet."}
      </div>

      <div className="card-foot">
        <span className="card-count" style={{ color: empty ? "var(--text-dim)" : "var(--red)" }}>
          {cards.length} WRITEUP{cards.length === 1 ? "" : "S"}
          {votes > 0 && <span style={{ color: "var(--text-dim)" }}> &middot; &#9650; {votes}</span>}
        </span>
        <span className="card-read">READ &rarr;</span>
      </div>
    </div>
  );
}

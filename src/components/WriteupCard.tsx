import type { ChallengeWithMeta, WriteupCard as Card } from "../types";
import { topicTags } from "../utils";
import { AsciiFrame, frameRank } from "./AsciiFrame";

/**
 * One challenge's writeups, framed like the challenge grid's card of the same
 * tier so the two pages read as one system, with braces around the title so
 * they are not mistaken for each other.
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
    <AsciiFrame
      rank={frameRank(chall)}
      variant="writeup"
      title={chall.name}
      figure={`${cards.length} WU`}
      solved={chall.solved}
      interactive
      className={`card chall-card writeup-card${empty ? " empty" : ""}`}
      onClick={onOpen}
    >
      <div className="card-stats">
        {topicTags(chall.tags, chall.category).map((tag) => (
          <span key={tag} className={`tag-box${chall.solved ? " accent" : ""}`}>
            {tag}
          </span>
        ))}
        <span className="card-stats-end">
          {votes > 0 && <span className="card-meta">&#9650; {votes}</span>}
          {chall.solved ? (
            <span className="card-solved">[&#10003; SOLVED]</span>
          ) : (
            !empty && (
              <span className="card-meta" title="Solve it to read the full solutions">
                [partially hidden]
              </span>
            )
          )}
        </span>
      </div>
      <div className="card-desc compact">
        {latest ? (
          <>
            <span className="wu-author">{latest.team_name}&gt;</span> {latest.summary}
          </>
        ) : chall.solved ? (
          "Be the first to post one."
        ) : (
          "Nothing published yet."
        )}
      </div>
    </AsciiFrame>
  );
}

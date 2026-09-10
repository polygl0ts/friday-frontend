import type { ChallengeWithMeta } from "../types";
import { Markdown } from "./Markdown";

export function ChallengeCard({
  chall,
  onOpenDetails,
}: {
  chall: ChallengeWithMeta;
  onOpenDetails: () => void;
}) {
  return (
    <div
      className={`card${chall.solved ? " solved" : ""}`}
      onClick={onOpenDetails}
      style={{ cursor: "pointer" }}
    >
      <div className="card-top">
        <span className={`tag-box${chall.solved ? " accent" : ""}`}>
          {chall.category.toUpperCase()}
        </span>
        {chall.solved && <span className="card-solved">[&#10003; SOLVED]</span>}
      </div>

      <div className="card-name">{chall.name}</div>
      <div className="card-desc">
        <Markdown className="card-desc-markdown">{chall.description}</Markdown>
      </div>

      <div className="card-foot">
        <span className={`card-points${chall.solved ? " solved" : ""}`}>
          {chall.points_current}
        </span>
        <div className="card-meta">
          <span>&#9670;{chall.solveCount}</span>
          {chall.firstBlood && (
            <span className="blood" title="first blood">
              &#129656; {chall.firstBlood}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

import type { ChallengeWithMeta } from "../types";
import { topicTags, withoutConnectionInfo } from "../utils";
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
      className={`card chall-card rank-${chall.juicer ? "juicer" : (chall.tier ?? "silver")}${chall.solved ? " solved" : ""}`}
      onClick={onOpenDetails}
      style={{ cursor: "pointer" }}
    >
      <div className="rule rule-top">
        <span className="card-name">{chall.name}</span>
        <span className="rule-fill" aria-hidden="true" />
        <span className={`card-points${chall.solved ? " solved" : ""}`}>
          {chall.points_current}
        </span>
      </div>
      <div className="card-stats">
        {topicTags(chall.tags, chall.category).map((tag) => (
          <span key={tag} className={`tag-box${chall.solved ? " accent" : ""}`}>
            {tag}
          </span>
        ))}
        <span className="card-stats-end">
          <span className="card-meta" title="solves">
            &#9670;{chall.solveCount}
          </span>
          {chall.firstBlood && (
            <span className="card-meta blood" title="first blood">
              &#129656; {chall.firstBlood}
            </span>
          )}
          {chall.solved && <span className="card-solved">[&#10003; SOLVED]</span>}
        </span>
      </div>

      <div className="card-desc compact">
        <Markdown className="card-desc-markdown">
          {withoutConnectionInfo(chall.description)}
        </Markdown>
      </div>
      <div className="rule rule-bottom" aria-hidden="true">
        <span className="rule-fill" />
      </div>
    </div>
  );
}

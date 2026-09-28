import type { ChallengeWithMeta } from "../types";
import { topicTags, withoutConnectionInfo } from "../utils";
import { AsciiFrame, frameRank } from "./AsciiFrame";
import { Markdown } from "./Markdown";

export function ChallengeCard({
  chall,
  onOpenDetails,
}: {
  chall: ChallengeWithMeta;
  onOpenDetails: () => void;
}) {
  return (
    <AsciiFrame
      rank={frameRank(chall)}
      title={chall.name}
      figure={chall.points_current}
      solved={chall.solved}
      interactive
      className="card chall-card"
      onClick={onOpenDetails}
    >
      <div className="card-stats">
        {topicTags(chall.tags, chall.category).map((tag) => (
          <span key={tag} className={`tag-box${chall.solved ? " accent" : ""}`}>
            {tag}
          </span>
        ))}
        <span className="card-stats-end">
          <span className="card-meta card-hover-meta" title="solves">
            &#9670;{chall.solveCount}
          </span>
          {chall.firstBlood && (
            <span className="card-meta blood" title="first blood">
              &#129656; {chall.firstBlood}
            </span>
          )}
          {chall.solved && (
            <span className="card-solved">[&#10003; SOLVED]</span>
          )}
        </span>
      </div>
      <div className="card-desc compact">
        <Markdown className="card-desc-markdown">
          {withoutConnectionInfo(chall.description)}
        </Markdown>
      </div>
    </AsciiFrame>
  );
}

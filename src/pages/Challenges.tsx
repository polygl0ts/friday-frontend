import { useState } from "react";
import { ChallengeCard } from "../components/ChallengeCard";
import { ChallengeModal } from "../components/ChallengeModal";
import { frameRank } from "../components/AsciiFrame";
import { useAuth } from "../auth/AuthContext";
import { useChallenges } from "../hooks/useChallenges";
import type { ChallengeWithMeta, Tier, Category } from "../types";
import { useStoredTier } from "../hooks/useStoredTier";
import { DropDownCategory } from "../components/DropDownCategory";
import { groupByCategory } from "../utils";
import { PageNote } from "../components/PageNote";

const TIERS: Tier[] = ["bronze", "silver", "gold"];
export function Challenges() {
  const { isLoggedIn } = useAuth();
  const [tier, setTier] = useStoredTier();
  const [category, setCategory] = useState<Category>("all");
  const [detailsChallenge, setDetailsChallenge] =
    useState<ChallengeWithMeta | null>(null);
  const challengesQuery = useChallenges();

  const groups = groupByCategory(
    (challengesQuery.data ?? []).filter(
      (c) =>
        c.tier === tier &&
        (category === "all" || c.category.toLowerCase() === category),
    ),
  );

  return (
    <div className="page">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 26,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <PageNote page="chall" />
        </div>
        {isLoggedIn && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <DropDownCategory value={category} onChange={setCategory} />
            <div className="tier-tabs">
              {TIERS.map((t) => (
                <button
                  key={t}
                  className={`pill${tier === t ? " active" : ""}`}
                  onClick={() => setTier(t)}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!isLoggedIn && (
        <div className="empty-text">Log in to view the challenges.</div>
      )}

      {isLoggedIn && challengesQuery.isLoading && (
        <div className="loading">Loading challenges...</div>
      )}
      {challengesQuery.error && (
        <div className="error-text">
          {(challengesQuery.error as Error).message}
        </div>
      )}
      {challengesQuery.data && groups.length === 0 && (
        <div className="empty-text">No challenges in here yet.</div>
      )}

      {groups.map((group, index) => (
        <div
          key={group.category}
          className={`category-section${index > 0 ? " category-section-split" : ""}`}
        >
          <div className="category-heading">
            <span className="category-heading-name">
              {group.category}
            </span>
          </div>
          <div className="grid grid-3">
            {group.challenges.map((chall) => (
              <ChallengeCard
                key={chall.id}
                chall={chall}
                onOpenDetails={() => setDetailsChallenge(chall)}
              />
            ))}
          </div>
        </div>
      ))}

      {detailsChallenge && (
        <ChallengeModal
          challengeId={detailsChallenge.id}
          challengeName={detailsChallenge.name}
          author={detailsChallenge.author}
          category={detailsChallenge.category}
          description={detailsChallenge.description}
          files={detailsChallenge.files}
          rank={frameRank(detailsChallenge)}
          points={detailsChallenge.points_current}
          solved={detailsChallenge.solved}
          onClose={() => setDetailsChallenge(null)}
        />
      )}
    </div>
  );
}

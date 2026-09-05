import { useState } from "react";
import { ChallengeCard } from "../components/ChallengeCard";
import { ChallengeModal } from "../components/ChallengeModal";
import { DropDownCategory } from "../components/DropDownCategory";
import { useAuth } from "../auth/AuthContext";
import { useChallenges } from "../hooks/useChallenges";
import type { ArchivedCat, Category, ChallengeWithMeta } from "../types";
import { groupByCategory } from "../utils";

const TIERS: ArchivedCat[] = ["general", "Lake25", "Lake26"];
const TIER_META: Record<ArchivedCat, string> = {
  general: "GENERAL",
  Lake25: "Lake 2025",
  Lake26: "Lake 2026",
};

/** Archived challenges display, using same logic as tier challenges.
 * Both of which are mutable.
 */
export function ArchivedChalls() {
  const { isLoggedIn } = useAuth();
  const [tier, setTier] = useState<ArchivedCat>("general");
  const [category, setCategory] = useState<Category>("all");
  const [detailsChallenge, setDetailsChallenge] =
    useState<ChallengeWithMeta | null>(null);
  const challengesQuery = useChallenges();

  const groups = groupByCategory(
    (challengesQuery.data ?? []).filter(
      (c) =>
        c.category === tier &&
        (category === "all" || c.category.toLowerCase() === category),
    ),
  );

  return (
    <div className="page">
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 26,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div className="page-title">CHALLENGES</div>
          <div className="page-subtitle">{TIER_META[tier]}</div>
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
        <div className="empty-text">No challenges in here yet. </div>
      )}
      {groups.map((group, index) => (
        <div
          key={group.category}
          className={`category-section${index > 0 ? " category-section-split" : ""}`}
        >
          <div className="category-heading">
            <span className="category-heading-name">
              {group.category.toUpperCase()}
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
          category={detailsChallenge.category}
          description={detailsChallenge.description}
          files={detailsChallenge.files}
          onClose={() => setDetailsChallenge(null)}
        />
      )}
    </div>
  );
}

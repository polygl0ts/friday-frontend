import { useState } from "react";
import { ChallengeCard } from "../components/ChallengeCard";
import { ChallengeModal } from "../components/ChallengeModal";
import { useAuth } from "../auth/AuthContext";
import { useChallenges } from "../hooks/useChallenges";
import type { ChallengeWithMeta, Category } from "../types";
import { groupByCategory } from "../utils";

/** Juicer tab, no sub category, only the regular */
export function Juicers() {
  const { isLoggedIn } = useAuth();
  const [detailsChallenge, setDetailsChallenge] =
    useState<ChallengeWithMeta | null>(null);
  const challengesQuery = useChallenges();

  const groups = groupByCategory(
    (challengesQuery.data ?? []).filter((c) => c.juicer),
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
          <div className="page-title">JUICERS</div>
        </div>
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
          author={detailsChallenge.author}
          category={detailsChallenge.category}
          description={detailsChallenge.description}
          files={detailsChallenge.files}
          onClose={() => setDetailsChallenge(null)}
        />
      )}
    </div>
  );
}

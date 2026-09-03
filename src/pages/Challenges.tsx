import { useState } from "react";
import { ChallengeCard } from "../components/ChallengeCard";
import { ChallengeModal } from "../components/ChallengeModal";
import { useAuth } from "../auth/AuthContext";
import { useChallenges } from "../hooks/useChallenges";
import type { ChallengeWithMeta, Tier, Category } from "../types";
import { DropDownCategory } from "../components/DropDownCategory";

const TIERS: Tier[] = ["bronze", "silver", "gold"];
const TIER_META: Record<Tier, string> = {
  bronze: "BRONZE TIER · START HERE",
  silver: "SILVER TIER · SOME EXPERIENCE ASSUMED",
  gold: "GOLD TIER · THE HARD ONES",
};

export function Challenges() {
  const { isLoggedIn } = useAuth();
  const [tier, setTier] = useState<Tier>("bronze");
  const [category, setCategory] = useState<Category>("all");
  const [detailsChallenge, setDetailsChallenge] =
    useState<ChallengeWithMeta | null>(null);
  const challengesQuery = useChallenges();

  const filtered = (challengesQuery.data ?? []).filter(
    (c) =>
      c.tier === tier &&
      (category === "all" || c.category.toLowerCase() === category),
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
      {challengesQuery.data && filtered.length === 0 && (
        <div className="empty-text">No challenges in here yet.</div>
      )}

      <div className="grid grid-3">
        {filtered.map((chall) => (
          <ChallengeCard
            key={chall.id}
            chall={chall}
            onOpenDetails={() => setDetailsChallenge(chall)}
          />
        ))}
      </div>

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

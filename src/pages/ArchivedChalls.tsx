import { useState } from "react";
import { ChallengeCard } from "../components/ChallengeCard";
import { ChallengeModal } from "../components/ChallengeModal";
import { useAuth } from "../auth/AuthContext";
import { useChallenges } from "../hooks/useChallenges";
import type { ChallengeWithMeta, ArchivedCat } from "../types";

const TIERS: ArchivedCat[] = ["general", "Lake25", "Lake26"];
const TIER_META: Record<ArchivedCat, string> = {
  general: "GENERAL",
  Lake25: "Lake 2025",
  Lake26: "Lake 2026",
};

export function ArchivedChalls() {
  const { isLoggedIn } = useAuth();
  const [tier, setTier] = useState<ArchivedCat>("general");
  const [detailsChallenge, setDetailsChallenge] =
    useState<ChallengeWithMeta | null>(null);
  const challengesQuery = useChallenges();

  const filtered = (challengesQuery.data ?? []).filter(
    (c) => c.archived === tier,
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
        <div className="empty-text">No challenges in here yet. </div>
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

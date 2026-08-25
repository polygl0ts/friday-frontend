import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getMyWriteups } from "../api/extras";
import { MyWriteups } from "../components/MyWriteups";
import { WriteupCard } from "../components/WriteupCard";
import { WriteupDetailModal } from "../components/WriteupDetailModal";
import { useAuth } from "../auth/AuthContext";
import { useChallenges } from "../hooks/useChallenges";
import { useWriteupCards } from "../hooks/useWriteups";
import type { ChallengeWithMeta, Tier } from "../types";

/** The three tiers browse *other people's* writeups; "mine" is a different
 *  axis entirely, which is why it sits in its own group in the tab bar. */
type Tab = Tier | "mine";

const TIERS: Tier[] = ["bronze", "silver", "gold"];

export function Writeups() {
  const { isLoggedIn } = useAuth();
  const [tier, setTier] = useState<Tab>("bronze");
  const [open, setOpen] = useState<ChallengeWithMeta | null>(null);
  const challengesQuery = useChallenges();
  const cardsQuery = useWriteupCards();

  const mineQuery = useQuery({
    queryKey: ["myWriteups"],
    queryFn: getMyWriteups,
    enabled: isLoggedIn,
  });
  const mineCount = mineQuery.data?.length ?? 0;
  const needsAttention = mineQuery.data?.some((w) => w.status === "rejected") ?? false;

  // Discord's "writeup published" notification deep-links here as
  // `/writeups?w=<id>`; jump straight to that challenge's writeups.
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinked = searchParams.get("w");
  useEffect(() => {
    if (!deepLinked || !challengesQuery.data || !cardsQuery.data) return;
    const id = Number(deepLinked);
    const card = Object.values(cardsQuery.data)
      .flat()
      .find((c) => c.id === id);
    const chall = challengesQuery.data.find((c) => c.id === card?.challenge_id);
    if (chall) {
      setTier(chall.tier);
      setOpen(chall);
    }
    setSearchParams({}, { replace: true });
  }, [deepLinked, challengesQuery.data, cardsQuery.data, setSearchParams]);

  const filtered = (challengesQuery.data ?? []).filter((c) => c.tier === tier);
  const cardsFor = (id: string) => cardsQuery.data?.[id] ?? [];
  const total = filtered.reduce((sum, c) => sum + cardsFor(c.id).length, 0);

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
          <div className="page-title">WRITEUPS</div>
          <div className="page-subtitle">
            {isLoggedIn && tier !== "mine" && `${total} PUBLISHED`}
            {isLoggedIn && tier === "mine" && "YOUR SUBMISSIONS AND THEIR REVIEW STATUS"}
          </div>
        </div>
        {isLoggedIn && (
          <div className="tab-bar">
            <div className="tab-group">
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

            <span className="tab-divider" />

            <button
              className={`pill pill-mine${tier === "mine" ? " active" : ""}`}
              onClick={() => setTier("mine")}
              title="Your own submissions and their review status"
            >
              <span className="pill-icon">&#9670;</span>
              MINE
              {mineCount > 0 && <span className="pill-count">{mineCount}</span>}
              {needsAttention && <span className="pill-alert" title="A writeup was rejected" />}
            </button>
          </div>
        )}
      </div>

      {!isLoggedIn && <div className="empty-text">Log in to read the writeups.</div>}

      {isLoggedIn && tier === "mine" ? (
        <MyWriteups />
      ) : (
        isLoggedIn && (
          <>
            {challengesQuery.isLoading && <div className="loading">Loading writeups...</div>}
            {challengesQuery.error && (
              <div className="error-text">{(challengesQuery.error as Error).message}</div>
            )}
            {challengesQuery.data && filtered.length === 0 && (
              <div className="empty-text">No challenges in this tier yet.</div>
            )}

            <div className="grid grid-3">
              {filtered.map((chall) => (
                <WriteupCard
                  key={chall.id}
                  chall={chall}
                  cards={cardsFor(chall.id)}
                  onOpen={() => setOpen(chall)}
                />
              ))}
            </div>
          </>
        )
      )}

      {open && (
        <WriteupDetailModal
          challengeId={open.id}
          challengeName={open.name}
          category={open.category}
          canSubmit={open.solved}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

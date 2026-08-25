import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approveWriteup, getAdminStats, getWriteupQueue, rejectWriteup } from "../api/extras";
import { getLeaderboard, listChallenges } from "../api/rctf";
import { DiscordSettings } from "../components/DiscordSettings";
import { useChallengeNames } from "../hooks/useChallengeNames";
import { WriteupReviewModal } from "../components/WriteupReviewModal";
import type { Writeup } from "../types";

/**
 * The admin overview subpanel: headline counts, the writeup review queue, and
 * the Discord webhook. The page title and the tab strip belong to
 * `AdminLayout`, which this renders inside.
 */
export function Admin() {
  const [reviewing, setReviewing] = useState<Writeup | null>(null);
  const queryClient = useQueryClient();
  // Writeup counts come from extras; players and challenges are rCTF's own
  // answers, read straight from it - the same two queries the home page runs,
  // so these tiles keep working even when extras doesn't.
  const statsQuery = useQuery({ queryKey: ["adminStats"], queryFn: getAdminStats });
  const playersQuery = useQuery({ queryKey: ["leaderboardTotal"], queryFn: () => getLeaderboard(1) });
  const challengesQuery = useQuery({ queryKey: ["challengeList"], queryFn: listChallenges });
  const queueQuery = useQuery({ queryKey: ["writeupQueue"], queryFn: getWriteupQueue });
  const challengeName = useChallengeNames();

  const invalidateWriteups = () => {
    queryClient.invalidateQueries({ queryKey: ["writeupQueue"] });
    queryClient.invalidateQueries({ queryKey: ["adminStats"] });
  };
  const approveMutation = useMutation({ mutationFn: approveWriteup, onSuccess: invalidateWriteups });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectWriteup(id, reason),
    onSuccess: invalidateWriteups,
  });


  return (
    <>
      <div className="grid grid-4" style={{ margin: "30px 0" }}>
        {[
          { k: "PLAYERS", v: playersQuery.data?.total },
          { k: "SUBMISSIONS", v: statsQuery.data?.submissions },
          { k: "PENDING WU", v: statsQuery.data?.pending_writeups },
          { k: "CHALLENGES", v: challengesQuery.data?.length },
        ].map((s) => (
          <div className="stat-tile" key={s.k}>
            <div className="label">{s.k}</div>
            <div className="value" style={{ marginTop: 10 }}>
              {s.v ?? "-"}
            </div>
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <div className="panel">
          <div className="panel-head">
            <span>WRITEUP QUEUE</span>
            <span>{queueQuery.data?.length ?? 0} PENDING</span>
          </div>

          {queueQuery.isLoading && <div className="loading">Loading...</div>}
          {queueQuery.data?.length === 0 && <div className="empty-text">Nothing pending.</div>}

          {queueQuery.data?.map((w) => (
            <div key={w.id} className="panel-row">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "var(--text)" }}>
                  {challengeName(w.challenge_id)} <span style={{ color: "var(--text-dimmer)" }}>&middot; {w.team_name}</span>
                </span>
                <span style={{ fontSize: 11, color: "var(--amber)" }}>{w.status.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", margin: "10px 0 14px", lineHeight: 1.6 }}>{w.summary}</div>
              <div style={{ display: "flex", gap: 8 }}>
                {/* Review first: approving publishes the public half to
                    everyone, so the default action opens the document rather
                    than acting on a one-line summary. */}
                <button className="btn btn-small btn-primary" onClick={() => setReviewing(w)}>
                  REVIEW
                </button>
                <button
                  className="btn btn-small btn-outline"
                  disabled={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(w.id)}
                >
                  APPROVE → PUBLISH
                </button>
              </div>
            </div>
          ))}
        </div>

        <DiscordSettings />
      </div>

      {reviewing && (
        <WriteupReviewModal
          writeup={reviewing}
          onClose={() => setReviewing(null)}
          onApprove={() => {
            approveMutation.mutate(reviewing.id);
            setReviewing(null);
          }}
          onReject={(reason) => {
            rejectMutation.mutate({ id: reviewing.id, reason });
            setReviewing(null);
          }}
          pending={approveMutation.isPending || rejectMutation.isPending}
        />
      )}
    </>
  );
}

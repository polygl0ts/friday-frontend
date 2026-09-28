import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { challengeFileUrl, getChallengeSolves, submitFlag } from "../api/rctf";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { formatTimestamp } from "../utils";
import type { RctfChallengeFile } from "../types";
import { AsciiFrame, type FrameRank } from "./AsciiFrame";
import { Markdown } from "./Markdown";

export function ChallengeModal({
  challengeId,
  challengeName,
  author,
  category,
  description,
  files = [],
  rank = "silver",
  points,
  solved: solvedBefore = false,
  onClose,
}: {
  challengeId: string;
  challengeName: string;
  /** rCTF's challenge author. Optional: a challenge without one simply omits
   *  the byline. */
  author?: string;
  category: string;
  description: string;
  files?: RctfChallengeFile[];
  rank?: FrameRank;
  points?: number;
  solved?: boolean;
  onClose: () => void;
}) {
  const [view, setView] = useState<"details" | "solvers">("details");
  useEscapeKey(onClose);

  const solvesQuery = useQuery({
    queryKey: ["challSolves", challengeId],
    queryFn: () => getChallengeSolves(challengeId),
    enabled: view === "solvers",
  });

  const [flag, setFlag] = useState("");
  const queryClient = useQueryClient();
  const flagMutation = useMutation({
    mutationFn: () => submitFlag(challengeId, flag),
    onSuccess: (res) => {
      if (res.correct) {
        queryClient.invalidateQueries({ queryKey: ["myProfile"] });
        queryClient.invalidateQueries({ queryKey: ["challenges"] });
        queryClient.invalidateQueries({
          queryKey: ["challSolves", challengeId],
        });
        queryClient.invalidateQueries({ queryKey: ["leaderboardChallenges"] });
      }
    },
  });
  const solved = flagMutation.data?.correct === true;

  return (
    <div className="modal-backdrop challenge-modal-backdrop" onClick={onClose}>
      <div
        className="modal-frame challenge-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <AsciiFrame
          rank={rank}
          title={challengeName}
          figure={points}
          solved={solvedBefore || solved}
          topRight={
            <button
              className="frame-close"
              onClick={onClose}
              aria-label="Close"
            >
              x
            </button>
          }
        >
          <div className="modal-meta">
            {category}
            {author && <> &middot; by {author}</>}
          </div>

          <div style={{ display: "flex", gap: 10, paddingTop: 12 }}>
            <button
              className={`pill${view === "details" ? " active" : ""}`}
              onClick={() => setView("details")}
            >
              DETAILS
            </button>
            <button
              className={`pill${view === "solvers" ? " active" : ""}`}
              onClick={() => setView("solvers")}
            >
              SOLVERS
            </button>
          </div>

          <div className="modal-body">
            <div className="modal-views">
              <div
                className={view === "details" ? undefined : "modal-view-hidden"}
                aria-hidden={view !== "details"}
              >
                {description ? (
                  <Markdown className="challenge-description">
                    {description}
                  </Markdown>
                ) : (
                  <div className="challenge-description">No description.</div>
                )}

                {files.length > 0 && (
                  <div
                    className="field"
                    style={{ marginTop: 24, marginBottom: 0 }}
                  >
                    <div className="field-label">
                      {files.length === 1
                        ? "ATTACHMENT"
                        : `ATTACHMENTS (${files.length})`}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {files.map((file) => {
                        const href = challengeFileUrl(file.url);
                        if (!href) return null;
                        return (
                          <a
                            key={`${file.url}:${file.name}`}
                            className="chip"
                            href={href}
                            download={file.name}
                            rel="noreferrer"
                            style={{ textDecoration: "none" }}
                          >
                            <span style={{ color: "var(--text)" }}>
                              {file.name}
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div
                  className="field"
                  style={{ marginTop: 24, marginBottom: 0 }}
                >
                  <div className="field-label">SUBMIT FLAG</div>
                  <form
                    style={{ display: "flex", gap: 8 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (flag && !solved && !flagMutation.isPending)
                        flagMutation.mutate();
                    }}
                  >
                    <input
                      value={flag}
                      onChange={(e) => setFlag(e.target.value)}
                      placeholder="friday{}"
                      disabled={solved}
                      style={{ flex: 1, width: "auto", minWidth: 0 }}
                    />
                    <button
                      className="btn btn-small btn-primary"
                      type="submit"
                      disabled={!flag || solved || flagMutation.isPending}
                    >
                      {flagMutation.isPending ? "..." : "SUBMIT"}
                    </button>
                  </form>
                </div>

                {solved && (
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      color: "var(--green)",
                    }}
                  >
                    &#129656; Correct flag &mdash; challenge solved.
                  </div>
                )}
                {flagMutation.data && !flagMutation.data.correct && (
                  <div
                    className={
                      flagMutation.data.alreadySolved ? undefined : "error-text"
                    }
                    style={{
                      padding: 0,
                      marginTop: 12,
                      textAlign: "left",
                      fontSize: 12,
                      color: flagMutation.data.alreadySolved
                        ? "var(--amber)"
                        : undefined,
                    }}
                  >
                    {flagMutation.data.message}
                  </div>
                )}
                {flagMutation.isError && (
                  <div
                    className="error-text"
                    style={{ padding: 0, marginTop: 12, textAlign: "left" }}
                  >
                    {(flagMutation.error as Error).message}
                  </div>
                )}
              </div>

              {view === "solvers" && (
                <div className="modal-view-overlay">
                  {solvesQuery.isLoading && (
                    <div className="loading">Loading solvers...</div>
                  )}
                  {solvesQuery.error && (
                    <div className="error-text">
                      {(solvesQuery.error as Error).message}
                    </div>
                  )}
                  {solvesQuery.data && solvesQuery.data.length === 0 && (
                    <div className="empty-text" style={{ padding: "16px 0" }}>
                      No solvers yet.
                    </div>
                  )}
                  {solvesQuery.data && solvesQuery.data.length > 0 && (
                    <>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-dimmer)",
                          letterSpacing: "0.14em",
                          marginBottom: 14,
                        }}
                      >
                        {solvesQuery.data.length} SOLVERS
                      </div>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: 12,
                        }}
                      >
                        <tbody>
                          {solvesQuery.data.map((solve, i) => {
                            const isBlood = solve.bloodIndex === 0;
                            return (
                              <tr
                                key={solve.solveId || i}
                                style={{
                                  borderBottom: "1px solid var(--border-hair)",
                                }}
                              >
                                <td
                                  style={{
                                    padding: "10px 8px",
                                    width: 32,
                                    color: "var(--text-dimmer)",
                                  }}
                                >
                                  {isBlood ? "\u{1FA78}" : `#${i + 1}`}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 8px",
                                    color: isBlood
                                      ? "var(--red)"
                                      : "var(--text)",
                                  }}
                                >
                                  {solve.name}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 8px",
                                    textAlign: "right",
                                    color: "var(--text-dimmer)",
                                  }}
                                >
                                  {formatTimestamp(solve.createdAt, true) ??
                                    "-"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </AsciiFrame>
      </div>
    </div>
  );
}

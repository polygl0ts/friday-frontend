import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboardWithGraph, listDivisions } from "../api/rctf";
import { useAuth } from "../auth/AuthContext";
import { ScoreGraph } from "../components/ScoreGraph";
import { SolveMatrix } from "../components/SolveMatrix";
import { AsciiFrame } from "../components/AsciiFrame";

/** The tab that asks for no division at all, rather than for one named "". */
const ALL = "";

const PLAYER_DIVISION = "open";
const CUTOFF_DATE = Date.UTC(2026, 8, 11, 10);

export function Scoreboard() {
  const { profile, canWriteUsers } = useAuth();
  const [adminDivision, setDivision] = useState(ALL);
  const division = canWriteUsers ? adminDivision : PLAYER_DIVISION;

  const divisionsQuery = useQuery({
    queryKey: ["divisions"],
    queryFn: listDivisions,
    staleTime: Infinity,
  });
  const divisions = divisionsQuery.data ?? [];

  const boardQuery = useQuery({
    queryKey: ["leaderboardWithGraph", 100, division],
    queryFn: () => getLeaderboardWithGraph(100, division || undefined),
  });

  const scope = divisions.find((d) => d.id === division);
  const showTabs = divisions.length > 1;

  const entries = useMemo(
    () =>
      (boardQuery.data?.entries ?? []).map((entry) => ({
        ...entry,
        solves: entry.solves?.filter((s) => s.solveTime >= CUTOFF_DATE),
      })),
    [boardQuery.data],
  );

  const series = entries
    .map((entry) =>
      boardQuery.data?.graph.find((series) => series.id === entry.id),
    )
    .filter((series) => series !== undefined)
    .map((series) => ({
      ...series,
      points: series.points.filter((p) => p.time >= CUTOFF_DATE),
    }))
    .filter((series) => series.points.length > 0);

  return (
    <div className="page">
      {!profile && (
        <div className="empty-text">Log in to view the scoreboard.</div>
      )}

      {profile && (
        <>
          {showTabs && canWriteUsers && (
            <div className="tab-bar" style={{ marginTop: 22 }}>
              <div className="tab-group">
                <button
                  className={`pill${division === ALL ? " active" : ""}`}
                  onClick={() => setDivision(ALL)}
                >
                  ALL
                </button>
                {divisions.map((d) => (
                  <button
                    key={d.id}
                    className={`pill pill-data${division === d.id ? " active" : ""}`}
                    onClick={() => setDivision(d.id)}
                    title={d.id}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AsciiFrame
            rank="silver"
            title="score graph"
            className="scoreboard-frame"
          >
            {boardQuery.isLoading && <div className="loading">Loading...</div>}
            {boardQuery.data && <ScoreGraph series={series} />}
          </AsciiFrame>

          {boardQuery.isLoading && <div className="loading">Loading...</div>}
          {boardQuery.error && (
            <div className="error-text">
              {(boardQuery.error as Error).message}
            </div>
          )}

          {boardQuery.data && entries.length === 0 && (
            <div className="empty-text">
              {scope
                ? `No team is in ${scope.name} yet.`
                : "No team has scored yet."}
            </div>
          )}

          {boardQuery.data && entries.length > 0 && (
            <AsciiFrame
              rank="silver"
              title="standings"
              className="scoreboard-frame"
            >
              <div className="table">
                <div className="table-row table-head">
                  <span>RANK</span>
                  <span>NAME</span>
                  <span>SOLVES</span>
                  <span style={{ textAlign: "right" }}>POINTS</span>
                </div>
                {entries.map((row, i) => (
                  <div
                    className={`table-row${row.id === profile?.id ? " me" : ""}`}
                    key={row.id}
                  >
                    <span className={`rank${i === 0 ? " lead" : ""}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        color: "var(--text)",
                      }}
                    >
                      <span className="row-avatar">
                        {row.avatarUrl && (
                          <img
                            className="avatar-img"
                            src={row.avatarUrl}
                            alt=""
                          />
                        )}
                      </span>
                      {row.name}
                    </span>
                    <span style={{ color: "var(--text-dim)" }}>
                      {row.solves?.length ?? "-"}
                    </span>
                    <span style={{ textAlign: "right", fontWeight: 700 }}>
                      {row.score}
                    </span>
                  </div>
                ))}
              </div>
            </AsciiFrame>
          )}

          {boardQuery.data && (
            <AsciiFrame
              rank="silver"
              title="solves by team"
              className="scoreboard-frame"
            >
              <SolveMatrix teams={entries} />
            </AsciiFrame>
          )}
        </>
      )}
    </div>
  );
}

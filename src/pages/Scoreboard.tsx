import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboardWithGraph, listDivisions } from "../api/rctf";
import { useAuth } from "../auth/AuthContext";
import { ScoreGraph } from "../components/ScoreGraph";
import { SolveMatrix } from "../components/SolveMatrix";

/** The tab that asks for no division at all, rather than for one named "". */
const ALL = "";

export function Scoreboard() {
  const { profile, canWriteUsers } = useAuth();
  const [division, setDivision] = useState(ALL);

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

  const series = (boardQuery.data?.entries ?? [])
    .map((entry) => boardQuery.data?.graph.find((series) => series.id === entry.id))
    .filter((series) => series !== undefined);

  return (
    <div className="page">

      
      <div className="page-title">SCOREBOARD</div>
      <div className="page-subtitle">
        TOP 100
        {scope && ` · ${scope.name.toUpperCase()}`}
        {boardQuery.data && ` · ${boardQuery.data.total} ${scope ? "IN DIVISION" : "TEAMS"}`}
      </div>
      {!profile && <div className="empty-text">Log in to view the scoreboard.</div>}

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
                    className={`pill${division === d.id ? " active" : ""}`}
                    onClick={() => setDivision(d.id)}
                    title={d.id}
                  >
                    {d.name.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}


          <div style={{ border: "1px solid var(--border-dim)", borderRadius: 12, margin: "30px 0", padding: 20, background: "var(--bg-card)" }}>
            {boardQuery.isLoading && <div className="loading">Loading...</div>}
            {boardQuery.data && <ScoreGraph series={series} />}
          </div>

          {boardQuery.isLoading && <div className="loading">Loading...</div>}
          {boardQuery.error && <div className="error-text">{(boardQuery.error as Error).message}</div>}

          {boardQuery.data?.entries.length === 0 && (
            <div className="empty-text">
              {scope ? `No team is in ${scope.name} yet.` : "No team has scored yet."}
            </div>
          )}

          {boardQuery.data && boardQuery.data.entries.length > 0 && (
            <div className="table">
              <div className="table-row table-head">
                <span>RANK</span>
                <span>NAME</span>
                <span>SOLVES</span>
                <span style={{ textAlign: "right" }}>POINTS</span>
              </div>
              {boardQuery.data.entries.map((row, i) => (
                <div className={`table-row${row.id === profile?.id ? " me" : ""}`} key={row.id}>
                  {/* Zero-padded so the column is the same width at every
                      rank, and red only for the podium - the medal palette it
                      used to carry was three colours the rest of the theme
                      does not have. */}
                  <span className={`rank${i === 0 ? " lead" : ""}`}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text)" }}>
                    <span className="row-avatar">
                      {row.avatarUrl && <img className="avatar-img" src={row.avatarUrl} alt="" />}
                    </span>
                    {row.name}
                  </span>
                  <span style={{ color: "var(--text-dim)" }}>{row.solves?.length ?? "-"}</span>
                  <span style={{ textAlign: "right", fontWeight: 700 }}>{row.score}</span>
                </div>
              ))}
            </div>
          )}

          {boardQuery.data && (
            <>
              <div className="page-subtitle" style={{ marginTop: 44, marginBottom: 16 }}>
                SOLVES BY TEAM
              </div>
              <SolveMatrix teams={boardQuery.data.entries} />
            </>
          )}
        </>
      )}
    </div>
  );
}

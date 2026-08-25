import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getLeaderboard, listChallenges } from "../api/rctf";

export function Home() {
  const challengesQuery = useQuery({ queryKey: ["challengeList"], queryFn: listChallenges });
  const leaderboardQuery = useQuery({
    queryKey: ["leaderboardTotal"],
    queryFn: () => getLeaderboard(1),
  });

  return (
    <div className="page center" style={{ paddingTop: 110, paddingBottom: 90 }}>
      <div style={{ fontSize: 12, letterSpacing: "0.4em", color: "var(--red)", marginBottom: 26 }}>
        {challengesQuery.data?.length ?? "-"} CHALLENGES
      </div>
      <div className="heading" style={{ fontSize: 82, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: "var(--text-bright)" }}>
        CAPTURE
        <br/>
        <span style={{ color: "var(--red)", textShadow: "0 0 40px rgba(255,43,62,.45)" }}>THE FLAG</span>
      </div>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 44 }}>
        <Link to="/intro2" className="btn btn-outline">
          START WITH INTRO2
        </Link>
        <Link to="/chall" className="btn btn-outline">
          ENTER ARENA &rarr;
        </Link>
      </div>

      <div className="grid grid-2" style={{ marginTop: 80, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
        <div className="stat-tile">
          <div className="value">{challengesQuery.data?.length ?? "-"}</div>
          <div className="label">{(challengesQuery.data?.length ?? 0) === 1 ? "CHALLENGE" : "CHALLENGES"}</div>
        </div>
        <div className="stat-tile">
          <div className="value">{leaderboardQuery.data?.total ?? "-"}</div>
          <div className="label">{(leaderboardQuery.data?.total ?? 0) === 1 ? "TEAM RANKED" : "TEAMS RANKED"}</div>
        </div>
      </div>
    </div>
  );
}

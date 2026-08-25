import { useAuth } from "../auth/AuthContext";
import { formatTimestamp } from "../utils"
import type { RctfLeaderboardPoint } from "../types";


const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#E100FF","#60C757", "#EDDD53"];
const ME_COLOR = "#ff2b3e";

const WIDTH = 720;
const HEIGHT = 250;
const PAD = 5;
const PAD_BOTTOM = 40;
const PAD_LEFT = 34;

export function ScoreGraph({ series }: { series: RctfLeaderboardPoint[] }) {
  const { profile } = useAuth();

  if (series.length === 0) {
    return <div className="empty-text">No score history yet.</div>;
  }

  const allScores = series.flatMap((s) => s.points.map((p) => p.score));
  const allTimes = series.flatMap((s) => s.points.map((p) => p.time));
  const minScore = Math.min(0, ...allScores);
  const maxScore = Math.max(1, ...allScores);
  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(minTime + 1, ...allTimes);

  const x = (t: number) => PAD_LEFT + ((t - minTime) / (maxTime - minTime)) * (WIDTH - PAD_LEFT - PAD);
  const y = (s: number) => HEIGHT - PAD_BOTTOM  - ((s - minScore) / (maxScore - minScore)) * (HEIGHT - PAD - PAD_BOTTOM);

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", height: 220 }}>

        {Array.from({ length: 5 }, (_, i) => {
            const score = minScore + ((maxScore - minScore) *i) / 4;
            return ( 
              <g key={`grid-${i}`}>
                <line
                  x1={PAD_LEFT}
                  y1={y(score)}
                  x2={WIDTH - PAD}
                  y2={y(score)}
                  stroke="var(--border-dim)"
                  strokeWidth={4}
                  opacity={0.8}
                />
                <text x={PAD_LEFT - 6} y={y(score) + 3} textAnchor="end" fontSize={9} fill="var(--text-dim)">
                  {Math.round(score)}
                </text>

              </g>

            );
        })}

        {Array.from({ length: 5 }, (_, i) => {
            const t = minTime + ((maxTime - minTime) *i) / 4;
            const time = formatTimestamp(t, true);
            const xLabel = time ? time.split(" ") : ["", ""];
            return ( 
              <text
                key={`xtick-${i}`}
                x={x(t)}
                y={y(0) + 10}
                textAnchor={i == 0 ? "start" : i === 4 ? "end" : "middle" }
                fontSize={9}
                fill="var(--text-dim)"
              >
                <tspan x={x(t)} dy="0">{xLabel[0]}</tspan>
                <tspan x={x(t)} dy="1.1em">{xLabel[1]}</tspan>
              </text>

            );
        })}



        {series.map((team, i) => {
          const isMe = team.id === profile?.id;
          const color = isMe ? ME_COLOR : SERIES_COLORS[i % SERIES_COLORS.length];
          const points = team.points;
          if (points.length === 0) return null;
          const path = points.map((p, idx) => `${idx === 0 ? "M" : "L"}${x(p.time)},${y(p.score)}`).join(" ");
          const last = points[points.length - 1];
          return (
            <g key={team.id}>
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={isMe ? 2.5 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isMe ? 1 : 0.85}
              />
              <circle cx={x(last.time)} cy={y(last.score)} r={isMe ? 4 : 3} fill={color}>
                <title>
                  {team.name}: {last.score} pts
                </title>
              </circle>
            </g>
          );
        })}
      </svg>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px", marginTop: 12, fontSize: 11, color: "var(--text-dim)" }}>
        {series.map((team, i) => {
          const isMe = team.id === profile?.id;
          const color = isMe ? ME_COLOR : SERIES_COLORS[i % SERIES_COLORS.length];
          return (
            <span key={team.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
              {team.name}
              {isMe && " (you)"}
            </span>
          );
        })}
      </div>
    </div>
  );
}

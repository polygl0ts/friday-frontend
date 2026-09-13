import { useEffect, useState } from "react";
import { ResponsiveLine } from "@nivo/line";
import { useAuth } from "../auth/AuthContext";
import { formatTimestamp } from "../utils";
import type { RctfLeaderboardPoint } from "../types";

const SERIES_COLORS = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#E100FF",
  "#60C757",
  "#EDDD53",
];
const ME_COLOR = "#ff2b3e";

const HEIGHT = 300;
const MAX_TICKS = 8;

type ScoreSeries = { id: string; data: { x: Date; y: number }[] };

/**
 * One tick per calendar day the graph covers.
 */
function dayTicks(minTime: number, maxTime: number): Date[] {
  const ticks = [new Date(minTime)];
  const midnight = new Date(minTime);
  midnight.setHours(24, 0, 0, 0);
  while (midnight.getTime() <= maxTime) {
    ticks.push(new Date(midnight));
    midnight.setHours(24, 0, 0, 0);
  }
  const stride = Math.ceil(ticks.length / MAX_TICKS);
  return stride > 1 ? ticks.filter((_, i) => i % stride === 0) : ticks;
}

/**
 * The card colours, read from the stylesheet rather than written twice.
 */
function useChartColors() {
  const read = () => {
    const style = getComputedStyle(document.documentElement);
    const value = (name: string, fallback: string) =>
      style.getPropertyValue(name).trim() || fallback;
    return {
      background: value("--bg-card", "#141011"),
      grid: value("--border-dim", "#2f2729"),
      text: value("--text-dim", "#9a8f90"),
      light: document.documentElement.dataset.theme === "light",
    };
  };

  const [colors, setColors] = useState(read);

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}

export function ScoreGraph({ series }: { series: RctfLeaderboardPoint[] }) {
  const { profile } = useAuth();
  const colors = useChartColors();

  if (series.length === 0) {
    return <div className="empty-text">No score history yet.</div>;
  }

  const allTimes = series.flatMap((s) => s.points.map((p) => p.time));
  const minTime = Math.min(...allTimes);
  const lastSolveTimes = series.flatMap((s) =>
    s.points
      .filter((p, i) => i > 0 && p.score !== s.points[i - 1].score)
      .map((p) => p.time),
  );
  const maxTime = Math.max(
    minTime + 1,
    ...(lastSolveTimes.length > 0 ? lastSolveTimes : allTimes),
  );
  const ticks = dayTicks(minTime, maxTime);

  const teams = series.map((team, i) => ({
    team,
    color:
      team.id === profile?.id
        ? ME_COLOR
        : SERIES_COLORS[i % SERIES_COLORS.length],
    isMe: team.id === profile?.id,
  }));

  const data: ScoreSeries[] = teams.map(({ team }) => ({
    id: team.name,
    data: team.points
      .filter((p) => p.time <= maxTime)
      .map((p) => ({ x: new Date(p.time), y: p.score })),
  }));

  return (
    <div>
      <div style={{ height: HEIGHT }}>
        <ResponsiveLine<ScoreSeries>
          data={data}
          colors={teams.map((t) => t.color)}
          margin={{ top: 20, right: 24, bottom: 44, left: 56 }}
          xScale={{
            type: "time",
            format: "native",
            useUTC: false,
            min: new Date(minTime),
            max: new Date(maxTime),
          }}
          yScale={{ type: "linear", min: 0, max: "auto", stacked: false }}
          curve="linear"
          lineWidth={2}
          axisBottom={{
            tickSize: 0,
            tickPadding: 10,
            tickValues: ticks,
            format: (value: Date) => formatTimestamp(value.getTime()) ?? "",
          }}
          gridXValues={ticks}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            tickValues: 5,
          }}
          enablePoints={false}
          enableCrosshair={false}
          useMesh={true}
          theme={{
            background: colors.background,
            text: { fontSize: 10, fill: colors.text },
            axis: {
              domain: { line: { stroke: "transparent" } },
              ticks: {
                line: { stroke: "transparent" },
                text: { fill: colors.text },
              },
              legend: { text: { fontSize: 11, fill: colors.text } },
            },
            grid: {
              line: {
                stroke: colors.grid,
                strokeWidth: 1,
                strokeOpacity: colors.light ? 0.18 : 0.8,
              },
            },
          }}
          tooltip={({ point }) => (
            <div
              style={{
                background: colors.background,
                border: `1px solid ${colors.grid}`,
                borderRadius: 6,
                padding: "6px 9px",
                fontSize: 11,
                color: "var(--text)",
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: point.seriesColor,
                  display: "inline-block",
                  marginRight: 6,
                }}
              />
              {point.seriesId}: {point.data.y} pts
              <div style={{ color: "var(--text-dim)", marginTop: 2 }}>
                {formatTimestamp(point.data.x.getTime(), true)}
              </div>
            </div>
          )}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px 18px",
          marginTop: 12,
          fontSize: 11,
          color: "var(--text-dim)",
        }}
      >
        {teams.map(({ team, color, isMe }) => (
          <span
            key={team.id}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: color,
                display: "inline-block",
              }}
            />
            {team.name}
            {isMe && " (you)"}
          </span>
        ))}
      </div>
    </div>
  );
}

import { Link, useNavigate } from "react-router-dom";
import { AsciiFrame } from "../components/AsciiFrame";
import { AvatarPicker } from "../components/AvatarPicker";
import { MyWriteups } from "../components/MyWriteups";
import { TeamToken } from "../components/TeamToken";
import { useAuth } from "../auth/AuthContext";
import { formatTimestamp } from "../utils";

const BAR_WIDTH = 20;

function bar(n: number, max: number): string {
  const filled = Math.max(1, Math.round((n / max) * BAR_WIDTH));
  return "#".repeat(filled) + ".".repeat(BAR_WIDTH - filled);
}

export function Profile() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const solves = profile?.solves ?? [];

  const categoryCounts = new Map<string, number>();
  for (const solve of solves) {
    const cat = solve.category ?? "other";
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }
  const maxCount = Math.max(1, ...categoryCounts.values());
  const labelWidth = Math.max(
    0,
    ...[...categoryCounts.keys()].map((c) => c.length),
  );
  const bloods = solves.filter((s) => s.bloodIndex === 0).length;
  const log = [...solves].sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  );

  return (
    <div className="page profile">
      <AsciiFrame
        rank="gold"
        title={profile?.name ?? "-"}
        figure={`${profile?.score ?? 0} PTS`}
        className="profile-id"
      >
        <div className="profile-id-body">
          <AvatarPicker
            url={profile?.avatarUrl ?? null}
            teamName={profile?.name ?? "your team"}
          />
          <dl className="profile-facts">
            <dt>rank</dt>
            <dd>#{profile?.globalPlace ?? "-"}</dd>
            <dt>solves</dt>
            <dd>{solves.length}</dd>
            <dt>first bloods</dt>
            <dd>{bloods}</dd>
          </dl>
          <button
            className="btn btn-small"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            log out
          </button>
        </div>
      </AsciiFrame>

      <div className="grid grid-2 profile-grid">
        <AsciiFrame rank="silver" title="solves by category">
          {categoryCounts.size === 0 ? (
            <div className="mono-dim profile-empty">No solves yet.</div>
          ) : (
            <pre className="profile-bars">
              {[...categoryCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(
                  ([cat, n]) =>
                    `${cat.padEnd(labelWidth)}  [${bar(n, maxCount)}]  ${n}`,
                )
                .join("\n")}
            </pre>
          )}
        </AsciiFrame>

        <AsciiFrame rank="silver" title="my writeups">
          <div className="profile-writeups">
            <MyWriteups compact />
            <Link className="mono-dim" to="/writeups">
              &#8599; manage them on the writeups page
            </Link>
          </div>
        </AsciiFrame>
      </div>

      <AsciiFrame rank="silver" title="solve log" className="profile-section">
        {log.length === 0 ? (
          <div className="mono-dim profile-empty">Nothing solved yet.</div>
        ) : (
          <table className="profile-log">
            <tbody>
              {log.map((solve) => (
                <tr key={solve.id}>
                  <td className="profile-log-date">
                    {formatTimestamp(solve.createdAt) ?? "-"}
                  </td>
                  <td className="profile-log-cat">
                    {solve.category ?? "other"}
                  </td>
                  <td className="profile-log-name">
                    {solve.name ?? solve.id}
                    {solve.bloodIndex === 0 && (
                      <span className="profile-log-blood" title="first blood">
                        {" "}
                        &#129656; first blood
                      </span>
                    )}
                  </td>
                  <td className="profile-log-points">+{solve.points ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AsciiFrame>

      {profile?.teamToken && (
        <AsciiFrame
          rank="bronze"
          title="team token"
          className="profile-section profile-token"
        >
          <TeamToken token={profile.teamToken} />
        </AsciiFrame>
      )}
    </div>
  );
}

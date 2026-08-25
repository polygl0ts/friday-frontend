import { Link, useNavigate } from "react-router-dom";
import { AvatarPicker } from "../components/AvatarPicker";
import { MyWriteups } from "../components/MyWriteups";
import { TeamToken } from "../components/TeamToken";
import { useAuth } from "../auth/AuthContext";

export function Profile() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const categoryCounts = new Map<string, number>();
  for (const solve of profile?.solves ?? []) {
    const cat = solve.category ?? "other";
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }
  const maxCount = Math.max(1, ...categoryCounts.values());

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 22, border: "1px solid var(--border)", borderRadius: 14, padding: 30, background: "var(--bg-card-alt)" }}>
        <AvatarPicker url={profile?.avatarUrl ?? null} teamName={profile?.name ?? "your team"} />
        <div style={{ flex: 1 }}>
          <div className="heading" style={{ fontSize: 28, color: "var(--text-bright)", fontWeight: 600 }}>
            {profile?.name ?? "-"}
          </div>
          <div className="mono-dim" style={{ marginTop: 6 }}>
            rank #{profile?.globalPlace ?? "-"} &middot; {profile?.solves.length ?? 0} solves
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: "var(--red)", textShadow: "0 0 16px rgba(255,43,62,.5)" }}>
            {profile?.score ?? 0}
          </div>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--text-dimmer)" }}>TOTAL POINTS</div>
          <button
            className="btn btn-outline btn-small"
            style={{ marginTop: 18 }}
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            LOG OUT
          </button>
        </div>
      </div>

      {profile?.teamToken && <TeamToken token={profile.teamToken} />}

      <div className="grid grid-2" style={{ marginTop: 24 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg-card-alt)", padding: 24 }}>
          <div className="heading" style={{ fontSize: 14, color: "var(--text-bright)", fontWeight: 600, marginBottom: 18 }}>
            SOLVED BY CATEGORY
          </div>
          {categoryCounts.size === 0 && <div className="mono-dim">No solves yet.</div>}
          {[...categoryCounts.entries()].map(([cat, n]) => (
            <div key={cat} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text)", marginBottom: 6 }}>
                <span>{cat}</span>
                <span style={{ color: "var(--text-dimmer)" }}>{n}</span>
              </div>
              <div className="meter">
                <div className="meter-fill" style={{ width: `${(n / maxCount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="panel" style={{ padding: 20 }}>
          <div className="heading" style={{ fontSize: 14, color: "var(--text-bright)", marginBottom: 18 }}>
            MY WRITEUPS
          </div>
          <MyWriteups compact />
          <Link className="mono-dim" to="/writeups" style={{ display: "block", marginTop: 14 }}>
            &#8599; Manage them on the writeups page
          </Link>
        </div>
      </div>
    </div>
  );
}

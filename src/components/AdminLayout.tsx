import { NavLink, Outlet } from "react-router-dom";

/**
 * The shared frame every admin subpanel renders inside: the page title, the
 * badge, and the tab strip that moves between panels.
 *
 * The panels are routes rather than local state, so a subpanel is linkable and
 * survives a reload - the admin panel is where you send someone a URL and say
 * "look at this row". Adding one is a `<Route>` in App.tsx plus an entry here.
 */
const ADMIN_TABS: { to: string; label: string; end?: boolean }[] = [
  { to: "/admin", label: "OVERVIEW", end: true },
  { to: "/admin/challs", label: "CHALLENGES" },
  { to: "/admin/teams", label: "TEAMS" },
];

export function AdminLayout() {
  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div className="page-title">ADMIN</div>
        <span className="admin-badge">rCTF &middot; CONTROL</span>
      </div>

      <nav className="admin-tabs">
        {ADMIN_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `pill${isActive ? " active" : ""}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}

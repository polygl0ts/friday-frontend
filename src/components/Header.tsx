import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import logoUrl from "../assets/logo.svg";

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: "/", label: "home" },
  { to: "/chall", label: "chall" },
  { to: "/juicers", label: "juicers" },
  { to: "/writeups", label: "writeups" },
  { to: "/archived", label: "archived" },
  { to: "/slides", label: "slides" },
  { to: "/calendar", label: "calendar" },
  { to: "/scoreboard", label: "scoreboard" },
];

const LOGO = String.raw`              __          _____  __
   ___  ___  / /_ _____ _/ / _ \/ /____
  / _ \/ _ \/ / // / _ ${"`"}/ / // / __(_-<
 / .__/\___/_/\_, /\_, /_/\___/\__/___/
/_/          /___//___/`;


export function Header() {
  const { isLoggedIn, profile, isAdmin } = useAuth();

  return (
    <header className="site-header">
      <div className="masthead">
        <NavLink to="/" className="brand" aria-label="polygl0ts friday - home">
          <img className="brand-mark" src={logoUrl} alt="" />
          <div>
            <pre className="brand-ascii" aria-hidden="true">
              {LOGO}
            </pre>
            <span className="brand-tag">~ friday ctf platform ~</span>
          </div>
        </NavLink>

        <NavLink
          to={isLoggedIn ? "/profile" : "/login"}
          className={({ isActive }) => `status-box${isActive ? " active" : ""}`}
        >
          <span className="status-prompt">
            [<b>{isLoggedIn ? (profile?.name ?? "...") : "guest"}</b>
            <span className="status-host">@polygl0ts ~</span>]
            <span className="status-dollar">$</span>{" "}
            <span className="status-cmd">
              {isLoggedIn ? "vi ~/.profile" : "./login"}
            </span>
          </span>
          {isLoggedIn && (
            <span className="status-line">
              <span className="points-pill">
                {profile?.score ?? 0} <span className="points-unit">pts</span>
              </span>
              <span className="avatar">
                {profile?.avatarUrl && (
                  <img className="avatar-img" src={profile.avatarUrl} alt="" />
                )}
              </span>
            </span>
          )}
        </NavLink>
      </div>

      <nav className="nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => `navlink${isActive ? " active" : ""}`}
          >
            {item.label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) => `navlink${isActive ? " active" : ""}`}
          >
            admin
          </NavLink>
        )}
      </nav>

    </header>
  );
}

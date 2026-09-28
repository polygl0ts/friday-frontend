import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import logoUrl from "../assets/logo.svg";
import { ThemeToggle } from "./ThemeButton";

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: "/", label: "home" },
  { to: "/chall", label: "chall" },
  { to: "/juicers", label: "juicers" },
  { to: "/writeups", label: "writeups" },
  { to: "/archived", label: "archived" },
  { to: "/slides", label: "slides" },
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

        <div className="status-box">
          <div className="status-prompt">
            [<b>{isLoggedIn ? (profile?.name ?? "...") : "guest"}</b>
            @polygl0ts ~]$ whoami
          </div>
          <div className="status-line">
            {isLoggedIn ? (
              <>
                <Link
                  className="avatar"
                  to="/profile"
                  title={profile?.name ?? "profile"}
                >
                  {profile?.avatarUrl && (
                    <img className="avatar-img" src={profile.avatarUrl} alt="" />
                  )}
                </Link>
                <span className="points-pill">{profile?.score ?? 0} pts</span>
                <NavLink
                  to="/profile"
                  className={({ isActive }) =>
                    `navlink${isActive ? " active" : ""}`
                  }
                >
                  profile
                </NavLink>
              </>
            ) : (
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `navlink login-link${isActive ? " active" : ""}`
                }
              >
                login
              </NavLink>
            )}
            <ThemeToggle />
          </div>
        </div>
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

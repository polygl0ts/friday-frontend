import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import logoUrl from "../assets/logo.svg";

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: "/", label: "HOME" },
  { to: "/intro2", label: "INTRO2" },
  { to: "/chall", label: "CHALL" },
  { to: "/writeups", label: "WRITEUPS" },
  { to: "/slides", label: "SLIDES" },
  { to: "/scoreboard", label: "SCOREBOARD" },
];

export function Header() {
  const { isLoggedIn, profile, isAdmin } = useAuth();

  return (
    <header className="site-header">
      <NavLink to="/" className="brand">
        <img className="brand-mark" src={logoUrl} alt="" />
        <span className="brand-name">
          POLYGL0TS<span className="slash">//</span>CTF
        </span>
      </NavLink>

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
          <NavLink to="/admin" className={({ isActive }) => `navlink${isActive ? " active" : ""}`}>
            ADMIN
          </NavLink>
        )}
      </nav>

      <div className="header-right">
        {isLoggedIn ? (
          <>
            <span className="points-pill">{profile?.score ?? 0} PTS</span>
            <Link className="avatar" to="/profile" title={profile?.name ?? "profile"}>
              {profile?.avatarUrl && <img className="avatar-img" src={profile.avatarUrl} alt="" />}
            </Link>
          </>
        ) : (
          <NavLink to="/login" className={({ isActive }) => `navlink${isActive ? " active" : ""}`}>
            LOGIN
          </NavLink>
        )}
      </div>
    </header>
  );
}

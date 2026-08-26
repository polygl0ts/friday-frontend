import { useTheme } from "../hooks/useTheme";

/*
 * Drawn with SVG because web fonts doesn't ship emojis
 * (and OS emojis are usually bad)
 */
function SunIcon() {
  return (
    <svg
      className="theme-glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.5" />
      <path
        d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.5 4.5l2 2M17.5 17.5l2 2M19.5 4.5l-2 2M6.5 17.5l-2 2"
        strokeLinecap="square"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="theme-glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" strokeLinejoin="round" />
    </svg>
  );
}

/* Actual theme button */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const light = theme === "light";

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      title={light ? "Switch to dark" : "Switch to light"}
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      aria-pressed={light}
    >
      {light ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

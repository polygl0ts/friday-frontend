import { useTheme } from "../hooks/useTheme";

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
      {light ? "lights off" : "lights on"}
    </button>
  );
}

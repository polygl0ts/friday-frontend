import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
const THEME_KEY = "polygl0ts_theme";

function stored(): Theme | null { 
  const value = localStorage.getItem(THEME_KEY);
  return(value === "dark" || value === "light")? value : null;
}

/*
 * Theming function, used to change the root color palette,
 * return the current theme as well as the toggle for it.
 */
export function useTheme() {

  const [theme, setTheme] = useState<Theme>(
    () => stored() ?? (window.matchMedia("(prefers-color-scheme: light)")
                      .matches ? "light" : "dark"),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const query = window.matchMedia(("(prefers-color-scheme: light)"));
    const onChange = (event: MediaQueryListEvent) => {
      if (!stored()) setTheme(event.matches ? "light" : "dark");
    };

    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light": "dark";
      localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  return { theme, toggle };
}

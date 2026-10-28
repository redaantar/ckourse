import { useState, useEffect } from "react";
import { getThemePreference, THEME_CHANGE_EVENT, type Theme, type ThemePreference } from "@/lib/theme";

function current(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

/** The theme on screen right now, plus the user's saved preference (which may be "system"). */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current);
  const [preference, setPreference] = useState<ThemePreference>(getThemePreference);

  useEffect(() => {
    const sync = () => {
      setTheme(current());
      setPreference(getThemePreference());
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    // Switching to "system" while the OS already matches leaves the DOM untouched
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    return () => {
      observer.disconnect();
      window.removeEventListener(THEME_CHANGE_EVENT, sync);
    };
  }, []);

  return { theme, preference } as const;
}

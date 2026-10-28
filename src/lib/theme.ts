export type ThemePreference = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const KEY = "ckourse-theme";
/** Fired on window whenever the preference is saved, even if the theme on screen stays the same. */
export const THEME_CHANGE_EVENT = "ckourse-theme-change";
const media = () => window.matchMedia("(prefers-color-scheme: light)");

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage unavailable */
  }
  // The app was dark-only before the preference existed and only stored a key once
  // toggled, so no key means "dark" — existing users keep the theme they had
  return "dark";
}

function resolve(pref: ThemePreference): Theme {
  if (pref === "system") return media().matches ? "light" : "dark";
  return pref;
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.style.colorScheme = theme;
}

/** Crossfades between themes where the platform supports it; switches instantly otherwise. */
export function setThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  const theme = resolve(pref);
  if (theme === (document.documentElement.classList.contains("light") ? "light" : "dark")) return;
  if ("startViewTransition" in document) document.startViewTransition(() => apply(theme));
  else apply(theme);
}

/** Apply the saved preference before first paint and follow the OS when set to System. */
export function initTheme() {
  apply(resolve(getThemePreference()));
  media().addEventListener("change", () => {
    if (getThemePreference() === "system") setThemePreference("system");
  });
}

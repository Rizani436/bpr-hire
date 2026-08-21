export const THEME_LIGHT = "light";
export const THEME_DARK = "dark";
export const THEME_STORAGE_KEY = "theme";
export const THEME_CHANGE_EVENT = "bpr-hire-theme-changed";

function normalizeTheme(theme) {
  const normalized = String(theme || "").toLowerCase();
  if (normalized === THEME_DARK) return THEME_DARK;
  return THEME_LIGHT;
}

export function getStoredThemeMode() {
  if (typeof window === "undefined") return "";

  try {
    const saved = String(window.localStorage.getItem(THEME_STORAGE_KEY) || "").toLowerCase();
    if (saved === THEME_DARK || saved === THEME_LIGHT) return saved;
    return "";
  } catch {
    return "";
  }
}

export function getSystemThemeMode() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return THEME_LIGHT;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? THEME_DARK
    : THEME_LIGHT;
}

export function resolveThemeMode() {
  return getStoredThemeMode() || getSystemThemeMode();
}

export function getActiveThemeMode() {
  if (typeof document === "undefined") return resolveThemeMode();

  const root = document.documentElement;
  const fromDataTheme = String(root.getAttribute("data-theme") || "").toLowerCase();
  if (fromDataTheme === THEME_DARK || fromDataTheme === THEME_LIGHT) {
    return fromDataTheme;
  }

  return resolveThemeMode();
}

export function applyThemeMode(theme, { persist = true } = {}) {
  const finalTheme = normalizeTheme(theme);

  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.setAttribute("data-theme", finalTheme);
    root.classList.remove(THEME_LIGHT, THEME_DARK);
    root.classList.add(finalTheme);
  }

  if (persist && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, finalTheme);
    } catch {
      // no-op: storage unavailable
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { mode: finalTheme } }));
  }

  return finalTheme;
}

export function applyResolvedThemeMode() {
  return applyThemeMode(resolveThemeMode(), { persist: false });
}

export function toggleThemeMode() {
  const nextTheme = getActiveThemeMode() === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  return applyThemeMode(nextTheme, { persist: true });
}

const THEME_LIGHT = "light";
const THEME_DARK = "dark";

const ALERT_THEME_CONFIG = {
  [THEME_LIGHT]: {
    loginSuccess: {
      background: "#f0fdf4",
      color: "#14532d",
      iconColor: "#15803d",
      boxShadow: "0 12px 24px rgba(21, 128, 61, 0.18)",
    },
    logoutConfirm: {
      background: "#fff7f7",
      color: "#7f1d1d",
      iconColor: "#dc2626",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    },
    logoutSuccess: {
      background: "#fef2f2",
      color: "#7f1d1d",
      iconColor: "#dc2626",
      boxShadow: "0 12px 24px rgba(220, 38, 38, 0.2)",
    },
    publishConfirm: {
      background: "#eff6ff",
      color: "#1e3a8a",
      iconColor: "#1d4ed8",
      confirmButtonColor: "#1d4ed8",
      cancelButtonColor: "#64748b",
    },
    publishLoading: {
      background: "#eff6ff",
      color: "#1e3a8a",
      iconColor: "#1d4ed8",
    },
    publishSuccess: {
      background: "#f0fdf4",
      color: "#14532d",
      iconColor: "#16a34a",
      confirmButtonColor: "#15803d",
      boxShadow: "0 12px 24px rgba(21, 128, 61, 0.18)",
    },
    publishWarning: {
      background: "#fffbeb",
      color: "#78350f",
      iconColor: "#d97706",
      confirmButtonColor: "#c2410c",
    },
  },
  [THEME_DARK]: {
    loginSuccess: {
      background: "#102218",
      color: "#d1fae5",
      iconColor: "#34d399",
      boxShadow: "0 12px 24px rgba(5, 150, 105, 0.35)",
    },
    logoutConfirm: {
      background: "#2b1313",
      color: "#fee2e2",
      iconColor: "#f87171",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
    },
    logoutSuccess: {
      background: "#2a1111",
      color: "#fecaca",
      iconColor: "#f87171",
      boxShadow: "0 12px 24px rgba(185, 28, 28, 0.45)",
    },
    publishConfirm: {
      background: "#0f1b38",
      color: "#dbeafe",
      iconColor: "#60a5fa",
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#64748b",
    },
    publishLoading: {
      background: "#0f1b38",
      color: "#dbeafe",
      iconColor: "#60a5fa",
    },
    publishSuccess: {
      background: "#102218",
      color: "#d1fae5",
      iconColor: "#34d399",
      confirmButtonColor: "#16a34a",
      boxShadow: "0 12px 24px rgba(5, 150, 105, 0.35)",
    },
    publishWarning: {
      background: "#2b1f10",
      color: "#fde68a",
      iconColor: "#fbbf24",
      confirmButtonColor: "#d97706",
    },
  },
};

function getThemeFromRootClassOrAttribute() {
  if (typeof document === "undefined") return "";

  const root = document.documentElement;
  const dataTheme = String(root.getAttribute("data-theme") || "").toLowerCase();
  if (dataTheme === THEME_DARK || dataTheme === THEME_LIGHT) return dataTheme;

  if (root.classList.contains(THEME_DARK)) return THEME_DARK;
  if (root.classList.contains(THEME_LIGHT)) return THEME_LIGHT;

  return "";
}

function getThemeFromStorage() {
  if (typeof window === "undefined") return "";

  const storageKeys = ["theme", "color-theme", "app-theme"];

  for (const key of storageKeys) {
    try {
      const value = String(window.localStorage.getItem(key) || "").toLowerCase();
      if (value === THEME_DARK || value === THEME_LIGHT) {
        return value;
      }
    } catch {
      return "";
    }
  }

  return "";
}

function getThemeFromSystemPreference() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return THEME_LIGHT;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? THEME_DARK
    : THEME_LIGHT;
}

export function resolveAlertThemeMode() {
  return (
    getThemeFromRootClassOrAttribute() ||
    getThemeFromStorage() ||
    getThemeFromSystemPreference()
  );
}

export function getAlertThemeConfig(variant) {
  const mode = resolveAlertThemeMode();
  const selectedTheme = ALERT_THEME_CONFIG[mode] || ALERT_THEME_CONFIG[THEME_LIGHT];
  return selectedTheme[variant] || selectedTheme.loginSuccess;
}

const LOGOUT_SUPPRESS_KEY = "logoutSuppressUntil";
const DEFAULT_SUPPRESS_MS = 15000;

export const markLogoutSuppressed = (durationMs = DEFAULT_SUPPRESS_MS) => {
  if (typeof window === "undefined") return;
  const until = Date.now() + Number(durationMs || DEFAULT_SUPPRESS_MS);
  sessionStorage.setItem(LOGOUT_SUPPRESS_KEY, String(until));
};

export const isLogoutSuppressed = () => {
  if (typeof window === "undefined") return false;
  const value = Number(sessionStorage.getItem(LOGOUT_SUPPRESS_KEY));
  if (!Number.isFinite(value) || value <= 0) {
    sessionStorage.removeItem(LOGOUT_SUPPRESS_KEY);
    return false;
  }
  if (Date.now() > value) {
    sessionStorage.removeItem(LOGOUT_SUPPRESS_KEY);
    return false;
  }
  return true;
};

export const clearLogoutSuppressed = () => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(LOGOUT_SUPPRESS_KEY);
};

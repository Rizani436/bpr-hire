import { clearDashboardUser } from "./authUser";

const LOGIN_PATH = "/login";

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeMessage(value) {
  return cleanText(value).toLowerCase();
}

export function isTokenVerificationError(status, message) {
  const safeStatus = Number(status);
  const safeMessage = normalizeMessage(message);

  if (![401, 403].includes(safeStatus)) return false;

  return (
    safeMessage.includes("failed to verify token") ||
    safeMessage.includes("verify token") ||
    safeMessage.includes("token not found") ||
    safeMessage.includes("session expired") ||
    safeMessage.includes("please login") ||
    safeMessage.includes("jwt expired") ||
    safeMessage.includes("invalid token")
  );
}

export function redirectToLoginPage(navigate) {
  clearDashboardUser();

  if (typeof window === "undefined") {
    if (typeof navigate === "function") {
      navigate(LOGIN_PATH, { replace: true });
    }
    return;
  }

  const currentPath = window.location.pathname;
  if (currentPath === LOGIN_PATH) return;

  if (typeof navigate === "function") {
    navigate(LOGIN_PATH, { replace: true });
    return;
  }

  window.location.replace(LOGIN_PATH);
}

export function handleAuthRedirect({ status, message, navigate } = {}) {
  if (!isTokenVerificationError(status, message)) return false;
  redirectToLoginPage(navigate);
  return true;
}

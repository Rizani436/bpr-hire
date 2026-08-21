export const BPR_HIRE_USER_STORAGE_KEY = "bpr-hire-auth-user";

export const DEFAULT_DASHBOARD_USER = {
  userUUID: "",
  username: "",
  email: "",
  statusUser: "Aktif",
  userName: "Peserta",
  role: "peserta",
  loginIdentity: "",
  profileComplete: false,
};

function toTitleCase(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function buildDashboardUser(identity, role = "peserta", meta = {}) {
  const cleanIdentity = String(identity || "").trim();
  const nameSource = cleanIdentity.includes("@") ? cleanIdentity.split("@")[0] : cleanIdentity;
  const userName = toTitleCase(nameSource.replace(/[._-]+/g, " ").trim()) || DEFAULT_DASHBOARD_USER.userName;
  const safeMeta = meta && typeof meta === "object" ? meta : {};

  return {
    userUUID: String(safeMeta.userUUID || "").trim(),
    username: String(safeMeta.username || "").trim(),
    email: String(safeMeta.email || "").trim(),
    statusUser: String(safeMeta.statusUser || "Aktif").trim() || "Aktif",
    userName,
    role: String(role || DEFAULT_DASHBOARD_USER.role).toLowerCase(),
    loginIdentity: String(safeMeta.loginIdentity || cleanIdentity).trim(),
    profileComplete:
      typeof safeMeta.profileComplete === "boolean"
        ? safeMeta.profileComplete
        : false,
  };
}

export function saveDashboardUser(user) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BPR_HIRE_USER_STORAGE_KEY, JSON.stringify(user));
}

export function updateDashboardUser(patch) {
  const updatedUser = {
    ...getDashboardUser(),
    ...patch,
  };

  saveDashboardUser(updatedUser);
  return updatedUser;
}

export function clearDashboardUser() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(BPR_HIRE_USER_STORAGE_KEY);
  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("refreshToken");
}

export function getDashboardUser() {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_USER;

  try {
    const savedUser = JSON.parse(window.localStorage.getItem(BPR_HIRE_USER_STORAGE_KEY));

    return {
      ...DEFAULT_DASHBOARD_USER,
      ...savedUser,
      role: String(savedUser?.role || DEFAULT_DASHBOARD_USER.role).toLowerCase(),
    };
  } catch {
    return DEFAULT_DASHBOARD_USER;
  }
}

export function getUserInitials(userName) {
  const words = String(userName || DEFAULT_DASHBOARD_USER.userName)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

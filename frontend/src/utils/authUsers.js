export const BPR_HIRE_AUTH_USERS_STORAGE_KEY = "bpr-hire-auth-users";

function normalizeIdentity(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function buildSafeUser(rawUser) {
  return {
    username: String(rawUser?.username || "").trim(),
    password: String(rawUser?.password || ""),
    role: String(rawUser?.role || "peserta").toLowerCase(),
    displayName: String(rawUser?.displayName || rawUser?.username || "").trim(),
    profileComplete: Boolean(rawUser?.profileComplete),
    email: String(rawUser?.email || "").trim(),
    phone: String(rawUser?.phone || "").trim(),
    address: String(rawUser?.address || "").trim(),
    registeredAt: String(rawUser?.registeredAt || ""),
  };
}

function getStoredAuthUsers() {
  if (typeof window === "undefined") return [];

  try {
    const savedUsers = JSON.parse(
      window.localStorage.getItem(BPR_HIRE_AUTH_USERS_STORAGE_KEY)
    );

    if (!Array.isArray(savedUsers)) return [];
    return savedUsers.map((user) => buildSafeUser(user));
  } catch {
    return [];
  }
}

function saveStoredAuthUsers(users) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    BPR_HIRE_AUTH_USERS_STORAGE_KEY,
    JSON.stringify(users)
  );
}

function upsertStoredAuthUser(user) {
  const storedUsers = getStoredAuthUsers();
  const normalizedUsername = normalizeIdentity(user.username);
  const existingIndex = storedUsers.findIndex(
    (item) => normalizeIdentity(item.username) === normalizedUsername
  );

  if (existingIndex >= 0) {
    storedUsers[existingIndex] = user;
  } else {
    storedUsers.push(user);
  }

  saveStoredAuthUsers(storedUsers);
}

export function getAuthUsers() {
  return getStoredAuthUsers();
}

export function isAuthUsernameTaken(username) {
  const normalized = normalizeIdentity(username);
  if (!normalized) return false;
  return getAuthUsers().some(
    (user) => normalizeIdentity(user.username) === normalized
  );
}

export function findAuthUserByIdentity(identity) {
  const normalizedIdentity = normalizeIdentity(identity);
  if (!normalizedIdentity) return null;

  return (
    getAuthUsers().find((user) => {
      const usernameMatched =
        normalizeIdentity(user.username) === normalizedIdentity;
      const emailMatched = normalizeIdentity(user.email) === normalizedIdentity;

      return usernameMatched || emailMatched;
    }) || null
  );
}

export function findAuthUserByEmail(email) {
  const normalizedEmail = normalizeIdentity(email);
  if (!normalizedEmail) return null;

  return (
    getAuthUsers().find(
      (user) => normalizeIdentity(user.email) === normalizedEmail
    ) || null
  );
}

export function registerPesertaAuthUser(payload) {
  const username = String(payload?.username || "").trim();
  const normalizedUsername = normalizeIdentity(username);

  if (!normalizedUsername) {
    throw new Error("Username wajib diisi.");
  }

  if (isAuthUsernameTaken(username)) {
    throw new Error("Username sudah digunakan. Gunakan username lain.");
  }

  const newUser = buildSafeUser({
    username,
    password: String(payload?.password || ""),
    role: "peserta",
    displayName: String(payload?.fullName || username).trim(),
    profileComplete: true,
    email: String(payload?.email || "").trim(),
    phone: String(payload?.phone || "").trim(),
    address: String(payload?.address || "").trim(),
    registeredAt: new Date().toISOString(),
  });

  upsertStoredAuthUser(newUser);

  return newUser;
}

export function updateAuthUserPasswordByIdentity(identity, nextPassword) {
  const safePassword = String(nextPassword || "");
  if (safePassword.length < 8) {
    throw new Error("Password baru minimal 8 karakter.");
  }

  const matchedUser = findAuthUserByIdentity(identity);
  if (!matchedUser) {
    throw new Error("Akun tidak ditemukan.");
  }

  const updatedUser = buildSafeUser({
    ...matchedUser,
    password: safePassword,
    registeredAt: matchedUser.registeredAt || new Date().toISOString(),
  });

  upsertStoredAuthUser(updatedUser);
  return updatedUser;
}

export function updateAuthUserProfileByUsername(username, profilePatch = {}) {
  const safeUsername = normalizeIdentity(username);
  if (!safeUsername) {
    throw new Error("Username user tidak valid.");
  }

  const matchedUser = getAuthUsers().find(
    (user) => normalizeIdentity(user.username) === safeUsername
  );

  if (!matchedUser) {
    throw new Error("User tidak ditemukan.");
  }

  const updatedUser = buildSafeUser({
    ...matchedUser,
    displayName:
      String(profilePatch?.displayName || "").trim() || matchedUser.displayName,
    email: String(profilePatch?.email || "").trim(),
    phone: String(profilePatch?.phone || "").trim(),
    address: String(profilePatch?.address || "").trim(),
    role: String(profilePatch?.role || matchedUser.role || "peserta").toLowerCase(),
    profileComplete:
      typeof profilePatch?.profileComplete === "boolean"
        ? profilePatch.profileComplete
        : matchedUser.profileComplete,
    registeredAt: matchedUser.registeredAt || new Date().toISOString(),
  });

  upsertStoredAuthUser(updatedUser);
  return updatedUser;
}

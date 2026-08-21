import jwt from "jsonwebtoken";

const cleanText = (value) => String(value ?? "").trim();

const isObject = (value) => value && typeof value === "object";

const normalizeSession = (input) => {
  if (!isObject(input)) return null;

  const sessionId = cleanText(input.sessionId);
  const refreshToken = cleanText(input.refreshToken);
  if (!sessionId || !refreshToken) return null;

  return {
    sessionId,
    refreshToken,
    createdAt: cleanText(input.createdAt) || new Date().toISOString(),
    lastSeenAt: cleanText(input.lastSeenAt) || cleanText(input.createdAt) || "",
    ip: cleanText(input.ip),
    userAgent: cleanText(input.userAgent),
  };
};

const parseRawTokenValue = (raw) => {
  const text = cleanText(raw);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeSession).filter(Boolean);
    }
    if (isObject(parsed)) {
      const single = normalizeSession(parsed);
      return single ? [single] : [];
    }
  } catch {
    // backward compatibility: previously stored plain refresh token
  }

  return [];
};

export const parseUserSessions = (user) => {
  if (!user) return [];

  const raw = user.jwt_token;
  const sessions = parseRawTokenValue(raw);
  if (sessions.length > 0) return sessions;

  const legacyRefreshToken = cleanText(raw);
  const legacySessionId = cleanText(user.sessionId);
  if (!legacyRefreshToken || !legacySessionId) return [];

  return [
    {
      sessionId: legacySessionId,
      refreshToken: legacyRefreshToken,
      createdAt: new Date().toISOString(),
      lastSeenAt: "",
      ip: "",
      userAgent: "",
    },
  ];
};

export const serializeUserSessions = (sessions) => {
  const normalized = (Array.isArray(sessions) ? sessions : [])
    .map(normalizeSession)
    .filter(Boolean);
  return normalized.length > 0 ? JSON.stringify(normalized) : null;
};

const isRefreshTokenValid = (refreshToken, refreshTokenSecret) => {
  try {
    jwt.verify(refreshToken, refreshTokenSecret);
    return true;
  } catch {
    return false;
  }
};

export const pruneExpiredSessions = (sessions, refreshTokenSecret) => {
  if (!refreshTokenSecret) {
    return (Array.isArray(sessions) ? sessions : [])
      .map(normalizeSession)
      .filter(Boolean);
  }

  return (Array.isArray(sessions) ? sessions : [])
    .map(normalizeSession)
    .filter(Boolean)
    .filter((session) =>
      isRefreshTokenValid(session.refreshToken, refreshTokenSecret)
    );
};

export const findSessionBySessionId = (sessions, sessionId) => {
  const safeSessionId = cleanText(sessionId);
  if (!safeSessionId) return null;
  return (
    (Array.isArray(sessions) ? sessions : []).find(
      (session) => cleanText(session?.sessionId) === safeSessionId
    ) || null
  );
};

export const findSessionByRefreshToken = (sessions, refreshToken) => {
  const safeRefreshToken = cleanText(refreshToken);
  if (!safeRefreshToken) return null;
  return (
    (Array.isArray(sessions) ? sessions : []).find(
      (session) => cleanText(session?.refreshToken) === safeRefreshToken
    ) || null
  );
};

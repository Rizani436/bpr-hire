import Users from "../../models/UserModel/UserModel.js";
import jwt from "jsonwebtoken";
import {
  parseUserSessions,
  serializeUserSessions,
  findSessionByRefreshToken,
} from "../../utils/sessionStore.js";

const cleanText = (value) => String(value ?? "").trim();

const normalizeUserStatus = (value) => {
  const raw = cleanText(value).toLowerCase();
  if (!raw) return "";
  if (raw === "aktif" || raw === "active") return "Aktif";
  if (raw === "tidak aktif" || raw === "nonaktif" || raw === "inactive") {
    return "Tidak Aktif";
  }
  return "";
};

const isUserActive = (value) => normalizeUserStatus(value) !== "Tidak Aktif";

const buildTokenPayload = (user, sessionId) => ({
  userUUID: user.userUUID,
  username: user.username,
  fullName: user.fullName,
  jabatan: user.jabatan,
  unitKerja: user.unitKerja,
  email: user.email,
  role: user.role,
  sessionId,
});

export const refreshToken = async (req, res) => {
  try {
    const refreshTokenValue = cleanText(req.cookies?.refreshToken);
    if (!refreshTokenValue) {
      return res.sendStatus(401);
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshTokenValue, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      return res.sendStatus(403);
    }

    const userUUID = cleanText(decoded?.userUUID);
    const tokenSessionId = cleanText(decoded?.sessionId);
    if (!userUUID || !tokenSessionId) {
      return res.sendStatus(403);
    }

    const user = await Users.findByPk(userUUID);
    if (!user) {
      return res.sendStatus(404);
    }
    if (!isUserActive(user.statusUser)) {
      return res.sendStatus(403);
    }

    const sessions = parseUserSessions(user);
    const activeSession = findSessionByRefreshToken(sessions, refreshTokenValue);
    if (!activeSession || cleanText(activeSession.sessionId) !== tokenSessionId) {
      return res.sendStatus(403);
    }

    const newAccessToken = jwt.sign(
      buildTokenPayload(user, activeSession.sessionId),
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "28000s" }
    );

    activeSession.lastSeenAt = new Date().toISOString();
    await user.update({
      jwt_token: serializeUserSessions(sessions),
      sessionId: activeSession.sessionId,
    });

    return res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error("refreshToken error:", error);
    return res.sendStatus(500);
  }
};

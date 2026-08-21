import Users from "../../models/UserModel/UserModel.js";
import jwt from "jsonwebtoken";
import argon2 from "argon2";
import crypto from "crypto";
import { Op } from "sequelize";
import {
  parseUserSessions,
  pruneExpiredSessions,
  serializeUserSessions,
  findSessionBySessionId,
} from "../../utils/sessionStore.js";
import {
  isLocalOtpModeEnabled,
  issueLocalOtp,
  verifyLocalOtp,
} from "../../utils/devOtpStore.js";
import {
  isEmailOtpConfigured,
  isValidEmailFormat,
  maskEmailAddress,
  resolveEmailOtpErrorMessage,
  sendOtpToEmail,
} from "../../utils/emailOtp.js";
import { isUserProfileComplete } from "../../utils/profileCompleteness.js";

const isProduction =
  String(process.env.NODE_ENV ?? "").toLowerCase() === "production";
const refreshCookieBaseOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "None" : "Lax",
};
const REFRESH_COOKIE_MAX_AGE_MS = 28000 * 1000;

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

const buildPublicUser = (user) => ({
  userUUID: user.userUUID,
  username: user.username,
  fullName: user.fullName,
  role: user.role,
  email: user.email,
  phone: user.phone,
  jabatan: user.jabatan,
  unitKerja: user.unitKerja,
  profileComplete: isUserProfileComplete(user),
});

const FORGOT_PASSWORD_PROOF_TTL_MS = 10 * 60 * 1000;
const forgotPasswordProofStore = new Map();

const pruneForgotPasswordProofStore = () => {
  const now = Date.now();
  for (const [token, item] of forgotPasswordProofStore.entries()) {
    if (!item || Number(item.expiresAt || 0) <= now) {
      forgotPasswordProofStore.delete(token);
    }
  }
};

const createForgotPasswordProofToken = (userUUID) => {
  pruneForgotPasswordProofStore();
  const safeUserUUID = cleanText(userUUID);
  if (!safeUserUUID) return "";
  const token = crypto.randomBytes(32).toString("hex");
  forgotPasswordProofStore.set(token, {
    userUUID: safeUserUUID,
    expiresAt: Date.now() + FORGOT_PASSWORD_PROOF_TTL_MS,
  });
  return token;
};

const consumeForgotPasswordProofToken = (token) => {
  pruneForgotPasswordProofStore();
  const safeToken = cleanText(token);
  if (!safeToken) return "";
  const session = forgotPasswordProofStore.get(safeToken);
  forgotPasswordProofStore.delete(safeToken);
  if (!session) return "";
  if (Number(session.expiresAt || 0) <= Date.now()) return "";
  return cleanText(session.userUUID);
};

const buildLocalOtpMessage = () =>
  "OTP mode lokal aktif (development). Isi EMAIL_USER dan EMAIL_PASS untuk kirim OTP Gmail real.";

const findUserByIdentity = async (identityValue) => {
  const identity = cleanText(identityValue).toLowerCase();
  if (!identity) return null;
  return Users.findOne({
    where: {
      [Op.or]: [{ username: identity }, { email: identity }],
    },
  });
};

export const sendRegisterEmailOtp = async (req, res) => {
  try {
    const email = cleanText(req.body?.email).toLowerCase();
    if (!email) {
      return res.status(400).json({ msg: "Email wajib diisi." });
    }
    if (!isValidEmailFormat(email)) {
      return res.status(400).json({
        msg: "Format email tidak valid.",
      });
    }

    const existingUser = await Users.findOne({
      where: {
        email,
      },
    });
    if (existingUser) {
      return res.status(400).json({ msg: "Email sudah terdaftar." });
    }

    const maskedEmail = maskEmailAddress(email);
    const localOtp = issueLocalOtp(`register:${email}`);
    if (isEmailOtpConfigured()) {
      await sendOtpToEmail({
        toEmail: email,
        otpCode: localOtp.code,
        purposeLabel: "Registrasi Akun",
        ttlMinutes: Math.ceil(localOtp.expiresInMs / 60000),
      });
      return res.json({
        msg: "OTP berhasil dikirim ke email.",
        maskedEmail,
        expiresInMs: localOtp.expiresInMs,
        provider: "gmail",
      });
    }

    if (!isLocalOtpModeEnabled()) {
      return res.status(503).json({
        msg: "Layanan OTP email belum dikonfigurasi di server.",
      });
    }

    return res.json({
      msg: buildLocalOtpMessage(),
      maskedEmail,
      expiresInMs: localOtp.expiresInMs,
      provider: "local-dev",
      debugCode: localOtp.code,
    });
  } catch (error) {
    const otpMessage = resolveEmailOtpErrorMessage(
      error,
      "Gagal mengirim OTP email."
    );
    return res.status(502).json({ msg: otpMessage });
  }
};

export const sendForgotPasswordEmailOtp = async (req, res) => {
  try {
    const identity = cleanText(req.body?.identity || req.body?.email).toLowerCase();
    if (!identity) {
      return res.status(400).json({ msg: "Email atau username wajib diisi." });
    }

    const user = await findUserByIdentity(identity);
    if (!user) {
      return res.status(404).json({ msg: "Akun pengguna tidak ditemukan." });
    }
    if (!isUserActive(user.statusUser)) {
      return res
        .status(403)
        .json({ msg: "Akun sedang berstatus tidak aktif. Hubungi tim IT." });
    }

    const targetEmail = cleanText(user.email).toLowerCase();
    if (!targetEmail) {
      return res.status(400).json({
        msg: "Email pada akun belum tersedia. Hubungi admin.",
      });
    }
    if (!isValidEmailFormat(targetEmail)) {
      return res.status(400).json({
        msg: "Email pada akun tidak valid. Hubungi admin.",
      });
    }

    const maskedEmail = maskEmailAddress(targetEmail);
    const localOtp = issueLocalOtp(`forgot:${targetEmail}`);
    if (isEmailOtpConfigured()) {
      await sendOtpToEmail({
        toEmail: targetEmail,
        otpCode: localOtp.code,
        purposeLabel: "Reset Password",
        ttlMinutes: Math.ceil(localOtp.expiresInMs / 60000),
      });
      return res.json({
        msg: "OTP berhasil dikirim ke email.",
        username: cleanText(user.username),
        maskedEmail,
        expiresInMs: localOtp.expiresInMs,
        provider: "gmail",
      });
    }

    if (!isLocalOtpModeEnabled()) {
      return res.status(503).json({
        msg: "Layanan OTP email belum dikonfigurasi di server.",
      });
    }

    return res.json({
      msg: buildLocalOtpMessage(),
      username: cleanText(user.username),
      maskedEmail,
      expiresInMs: localOtp.expiresInMs,
      provider: "local-dev",
      debugCode: localOtp.code,
    });
  } catch (error) {
    const otpMessage = resolveEmailOtpErrorMessage(
      error,
      "Gagal mengirim OTP email."
    );
    return res.status(502).json({ msg: otpMessage });
  }
};

export const verifyForgotPasswordEmailOtp = async (req, res) => {
  try {
    const identity = cleanText(req.body?.identity || req.body?.email).toLowerCase();
    const otpCode = cleanText(req.body?.otpCode || req.body?.code);

    if (!identity) {
      return res.status(400).json({ msg: "Email atau username wajib diisi." });
    }
    if (!otpCode) {
      return res.status(400).json({ msg: "Kode OTP wajib diisi." });
    }

    const user = await findUserByIdentity(identity);
    if (!user) {
      return res.status(404).json({ msg: "Akun pengguna tidak ditemukan." });
    }

    const targetEmail = cleanText(user.email).toLowerCase();
    if (!targetEmail) {
      return res.status(400).json({
        msg: "Email pada akun belum tersedia. Hubungi admin.",
      });
    }
    if (!isValidEmailFormat(targetEmail)) {
      return res.status(400).json({
        msg: "Email pada akun tidak valid. Hubungi admin.",
      });
    }

    const localVerification = verifyLocalOtp(`forgot:${targetEmail}`, otpCode);
    if (!localVerification.ok) {
      return res.status(400).json({
        msg: "Kode OTP tidak valid atau sudah kedaluwarsa.",
      });
    }

    const resetProofToken = createForgotPasswordProofToken(user.userUUID);
    if (!resetProofToken) {
      return res.status(500).json({ msg: "Gagal memproses verifikasi OTP." });
    }

    return res.json({
      msg: "OTP berhasil diverifikasi.",
      resetProofToken,
      username: cleanText(user.username),
    });
  } catch (error) {
    const otpMessage = resolveEmailOtpErrorMessage(
      error,
      "Verifikasi OTP email gagal."
    );
    return res.status(502).json({ msg: otpMessage });
  }
};

export const resetForgotPassword = async (req, res) => {
  try {
    const resetProofToken = cleanText(req.body?.resetProofToken);
    const newPassword = String(req.body?.newPassword || "");

    if (!resetProofToken) {
      return res.status(400).json({ msg: "Token reset password tidak valid." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ msg: "Password baru minimal 8 karakter." });
    }

    const userUUID = consumeForgotPasswordProofToken(resetProofToken);
    if (!userUUID) {
      return res.status(400).json({
        msg: "Sesi verifikasi OTP tidak valid atau sudah kedaluwarsa.",
      });
    }

    const user = await Users.findByPk(userUUID);
    if (!user) {
      return res.status(404).json({ msg: "Akun pengguna tidak ditemukan." });
    }

    const hashedPassword = await argon2.hash(newPassword);
    await user.update({
      password: hashedPassword,
      jwt_token: null,
      sessionId: null,
    });

    return res.json({
      msg: "Password berhasil diperbarui.",
      username: cleanText(user.username),
    });
  } catch (error) {
    console.error("resetForgotPassword error:", error);
    return res.status(500).json({ msg: "Gagal mereset password." });
  }
};

export const postLogin = async (req, res) => {
  try {
    const identity = cleanText(req.body?.identity || req.body?.username).toLowerCase();
    const password = String(req.body?.password || "");
    if (!identity || !password) {
      return res.status(400).json({ msg: "Username/email dan password wajib diisi." });
    }

    const user = await Users.findOne({
      where: {
        [Op.or]: [{ username: identity }, { email: identity }],
      },
    });

    if (!user) {
      return res.status(404).json({ msg: "Akun pengguna tidak terdaftar." });
    }
    if (!isUserActive(user.statusUser)) {
      return res
        .status(403)
        .json({ msg: "Akun sedang berstatus tidak aktif. Hubungi tim IT." });
    }

    const isPasswordMatched = await argon2.verify(user.password, password);
    if (!isPasswordMatched) {
      return res.status(400).json({ msg: "Password salah." });
    }

    const rawForwarded = cleanText(req.headers["x-forwarded-for"]);
    const attemptIp =
      rawForwarded.split(",")[0].trim() ||
      req.ip ||
      req.connection?.remoteAddress ||
      "";
    const attemptUa = cleanText(req.headers["user-agent"]).slice(0, 255);
    const existingSessions = pruneExpiredSessions(
      parseUserSessions(user),
      process.env.REFRESH_TOKEN_SECRET
    );
    const sessionId = crypto.randomBytes(32).toString("hex");
    const accessToken = jwt.sign(
      buildTokenPayload(user, sessionId),
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "28000s" }
    );
    const refreshToken = jwt.sign(
      buildTokenPayload(user, sessionId),
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "28000s" }
    );

    const nowIso = new Date().toISOString();
    const nextSessions = [
      ...existingSessions.filter(
        (session) => cleanText(session?.sessionId) !== sessionId
      ),
      {
        sessionId,
        refreshToken,
        createdAt: nowIso,
        lastSeenAt: nowIso,
        ip: attemptIp,
        userAgent: attemptUa,
      },
    ];

    await user.update({
      jwt_token: serializeUserSessions(nextSessions),
      sessionId,
      lastLoginAttemptAt: null,
      lastLoginAttemptIp: null,
      lastLoginAttemptUserAgent: null,
      lastLoginAttemptId: null,
    });

    res.cookie("refreshToken", refreshToken, {
      ...refreshCookieBaseOptions,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
    res.set("Authorization", `Bearer ${accessToken}`);

    return res.json({
      accessToken,
      refreshToken,
      user: buildPublicUser(user),
    });
  } catch (error) {
    console.error("postLogin error:", error);
    return res.status(500).json({ msg: "Terjadi kesalahan pada server." });
  }
};

export const deleteLogout = async (req, res) => {
  try {
    const refreshToken = cleanText(req.cookies?.refreshToken);

    const clearRefreshCookie = () => {
      res.clearCookie("refreshToken", refreshCookieBaseOptions);
    };

    const resolveAccessPayload = () => {
      const authHeader =
        req.headers.authorization || req.headers.Authorization || "";
      const token = String(authHeader).startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : "";
      if (!token) return null;
      try {
        return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
          ignoreExpiration: true,
        });
      } catch {
        return null;
      }
    };

    let refreshPayload = null;
    if (refreshToken) {
      try {
        refreshPayload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, {
          ignoreExpiration: true,
        });
      } catch {
        refreshPayload = null;
      }
    }

    const accessPayload = resolveAccessPayload();
    const targetUserUUID =
      cleanText(refreshPayload?.userUUID) || cleanText(accessPayload?.userUUID);
    if (!targetUserUUID) {
      clearRefreshCookie();
      return res.status(200).json({ msg: "Logout berhasil." });
    }

    const user = await Users.findByPk(targetUserUUID);
    if (!user) {
      clearRefreshCookie();
      return res.status(200).json({ msg: "Logout berhasil." });
    }

    const sessions = parseUserSessions(user);
    let nextSessions = sessions;
    let removed = false;

    if (refreshToken) {
      nextSessions = sessions.filter(
        (session) => cleanText(session?.refreshToken) !== refreshToken
      );
      removed = nextSessions.length !== sessions.length;
    }

    if (!removed && cleanText(refreshPayload?.sessionId)) {
      nextSessions = sessions.filter(
        (session) =>
          cleanText(session?.sessionId) !== cleanText(refreshPayload?.sessionId)
      );
      removed = nextSessions.length !== sessions.length;
    }

    if (!removed && cleanText(accessPayload?.sessionId)) {
      nextSessions = sessions.filter(
        (session) =>
          cleanText(session?.sessionId) !== cleanText(accessPayload?.sessionId)
      );
      removed = nextSessions.length !== sessions.length;
    }

    if (removed) {
      await user.update(
        nextSessions.length > 0
          ? {
              jwt_token: serializeUserSessions(nextSessions),
              sessionId: nextSessions[nextSessions.length - 1].sessionId,
            }
          : { jwt_token: null, sessionId: null }
      );
    }

    clearRefreshCookie();
    return res.status(200).json({ msg: "Logout berhasil." });
  } catch (error) {
    console.error("deleteLogout error:", error);
    return res.status(500).json({ msg: "Gagal logout." });
  }
};

export const getLoginAttemptStatus = async (req, res) => {
  try {
    if (!req.userUUID) {
      return res.status(401).json({ msg: "Silakan login terlebih dahulu." });
    }

    const user = await Users.findByPk(req.userUUID);
    if (!user) {
      return res.status(404).json({ msg: "User tidak ditemukan." });
    }

    if (!user.lastLoginAttemptId || !user.lastLoginAttemptAt) {
      return res.json({ attempt: null });
    }

    return res.json({
      attempt: {
        id: user.lastLoginAttemptId,
        at: user.lastLoginAttemptAt,
        ip: cleanText(user.lastLoginAttemptIp),
        userAgent: cleanText(user.lastLoginAttemptUserAgent),
        type: "ATTEMPT",
      },
    });
  } catch (error) {
    console.error("getLoginAttemptStatus error:", error);
    return res.status(500).json({ msg: "Terjadi kesalahan pada server." });
  }
};

const resolveAccessToken = (req) => {
  const authHeader =
    req.headers.authorization || req.headers.Authorization || "";
  if (String(authHeader).startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  const queryToken = req.query?.token;
  if (Array.isArray(queryToken)) return cleanText(queryToken[0]);
  return cleanText(queryToken);
};

export const sessionEvents = async (req, res) => {
  const token = resolveAccessToken(req);
  if (!token) {
    return res.status(401).json({ msg: "Token tidak ditemukan." });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch {
    return res.status(403).json({ msg: "Token tidak valid." });
  }

  const userUUID = cleanText(decoded?.userUUID);
  const sessionId = cleanText(decoded?.sessionId);
  if (!userUUID || !sessionId) {
    return res.status(403).json({ msg: "Token tidak valid." });
  }

  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  let closed = false;
  const sendEvent = (event, data) => {
    if (closed) return;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const closeStream = () => {
    if (closed) return;
    closed = true;
    clearInterval(timerId);
    try {
      res.end();
    } catch {
      // ignore
    }
  };

  const checkState = async () => {
    if (closed) return;
    try {
      const user = await Users.findByPk(userUUID);
      if (!user) {
        sendEvent("logout", { reason: "user_not_found" });
        closeStream();
        return;
      }

      const sessions = parseUserSessions(user);
      const activeSession = findSessionBySessionId(sessions, sessionId);
      if (!activeSession) {
        sendEvent("logout", { reason: "session_invalid" });
        closeStream();
        return;
      }
    } catch {
      // ignore transient error
    }
  };

  const timerId = setInterval(checkState, 3000);
  sendEvent("connected", { ok: true, at: new Date().toISOString() });
  checkState();

  req.on("close", () => {
    closed = true;
    clearInterval(timerId);
  });
};

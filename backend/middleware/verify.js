import Users from "../models/UserModel/UserModel.js";
import jwt from "jsonwebtoken";
import {
  parseUserSessions,
  findSessionBySessionId,
} from "../utils/sessionStore.js";

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const compact = raw.replace(/[\s_-]+/g, "");
  const aliasMap = {
    superadmin: "superadmin",
    superadministrator: "superadmin",
    pengawas: "pengawas",
    peserta: "peserta",
  };
  return aliasMap[compact] || raw;
};

const normalizeUnitKerja = (value) => String(value || "").trim();

const normalizeUserStatus = (value) => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "aktif" || raw === "active") return "Aktif";
  if (raw === "tidak aktif" || raw === "nonaktif" || raw === "inactive") {
    return "Tidak Aktif";
  }
  return "";
};

const isUserActive = (value) => normalizeUserStatus(value) !== "Tidak Aktif";

export const verifyUser = async (req, res, next) => {
  if (!req.userUUID) {
    return res.status(401).json({ msg: "Please login to your account!" });
  }

  try {
    let user = await Users.findOne({
      where: {
        userUUID: req.userUUID,
      },
    });

    if (!user && req.username) {
      user = await Users.findOne({
        where: {
          username: req.username,
        },
      });
      if (user) {
        req.userUUID = user.userUUID;
        req.userKdpegawai = user.userUUID;
        req.kdkantor = normalizeUnitKerja(user.unitKerja);
        req.role = normalizeRole(user.role);
      }
    }

    if (!user) {
      return res
        .status(404)
        .json({ msg: "User not found during verification" });
    }

    if (!isUserActive(user.statusUser)) {
      return res.status(403).json({ msg: "Akun tidak aktif." });
    }

    req.userUUID = user.userUUID;
    req.userKdpegawai = user.userUUID;
    req.kdkantor = normalizeUnitKerja(user.unitKerja);
    req.role = normalizeRole(user.role);
    req.username = user.username;

    const sessions = parseUserSessions(user);
    const activeSession = findSessionBySessionId(sessions, req.sessionId);
    if (!req.sessionId || !activeSession) {
      return res.status(401).json({ msg: "Session expired, please login again" });
    }

    req.userDbKdpegawai = user.userUUID;
    next();
  } catch (error) {
    console.error("Error finding user:", error);
    return res.status(500).json({ msg: "Internal server error" });
  }
};

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token not found" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Failed to verify token" });
    }

    req.userUUID = decoded.userUUID || decoded.kdpegawai;
    req.userKdpegawai = req.userUUID;
    req.username = decoded.username;
    req.kdkantor = normalizeUnitKerja(decoded.unitKerja || decoded.kdkantor);
    req.role = normalizeRole(decoded.role);
    req.sessionId = decoded.sessionId;
    
    next();
  });
};

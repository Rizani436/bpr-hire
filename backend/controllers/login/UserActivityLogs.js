import { Op } from "sequelize";
import UserActivityLog from "../../models/UserModel/UserActivityLogModel.js";
import {
  cleanupExpiredUserActivityLogs,
  writeUserActivityLog,
} from "../../utils/userActivityLog.js";

const cleanText = (value) => String(value ?? "").trim();

const normalizeRole = (value) => {
  const raw = cleanText(value).toLowerCase();
  if (!raw) return "";
  const compact = raw.replace(/[\s_-]+/g, "");
  if (compact === "superadmin" || compact === "superadministrator") {
    return "superadmin";
  }
  if (compact === "pengawas") return "pengawas";
  if (compact === "peserta") return "peserta";
  return raw;
};

const normalizeEventType = (value) => {
  const safe = cleanText(value).toLowerCase();
  if (safe === "access" || safe === "delete_user") return safe;
  return "access";
};

const toPublicLog = (item) => ({
  logUUID: item.logUUID,
  eventType: item.eventType,
  eventLabel: item.eventLabel,
  routePath: item.routePath,
  username: item.username,
  userRole: item.userRole,
  targetUserUUID: item.targetUserUUID,
  targetUsername: item.targetUsername,
  targetFullName: item.targetFullName,
  targetUserRole: item.targetUserRole,
  createdAt: item.createdAt,
  expiresAt: item.expiresAt,
});

export const createUserActivityLog = async (req, res) => {
  try {
    await cleanupExpiredUserActivityLogs();
    const eventType = normalizeEventType(req.body?.eventType);
    const routePath = cleanText(req.body?.routePath).slice(0, 255);
    const eventLabel =
      cleanText(req.body?.eventLabel).slice(0, 180) ||
      (eventType === "delete_user" ? "Hapus user" : "Akses halaman");

    await writeUserActivityLog({
      eventType,
      eventLabel,
      routePath,
      username: cleanText(req.username).toLowerCase(),
      userRole: normalizeRole(req.role),
    });

    return res.status(201).json({ msg: "Log aktivitas tersimpan." });
  } catch {
    return res.status(500).json({ msg: "Gagal menyimpan log aktivitas." });
  }
};

export const getUserActivityLogs = async (req, res) => {
  try {
    await cleanupExpiredUserActivityLogs();
    const eventTypeQuery = cleanText(req.query?.eventType).toLowerCase();
    const search = cleanText(req.query?.search).toLowerCase();
    const limitValue = Number(req.query?.limit);
    const limit = Number.isFinite(limitValue)
      ? Math.max(1, Math.min(500, Math.trunc(limitValue)))
      : 200;

    const where = {};
    if (eventTypeQuery === "access" || eventTypeQuery === "delete_user") {
      where.eventType = eventTypeQuery;
    }
    if (search) {
      where[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { targetUsername: { [Op.like]: `%${search}%` } },
        { targetFullName: { [Op.like]: `%${search}%` } },
        { routePath: { [Op.like]: `%${search}%` } },
        { eventLabel: { [Op.like]: `%${search}%` } },
      ];
    }

    const logs = await UserActivityLog.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
    });

    return res.json({
      total: logs.length,
      logs: logs.map((item) => toPublicLog(item)),
      retentionHours: Number(process.env.USER_ACTIVITY_LOG_RETENTION_HOURS) || 24,
    });
  } catch {
    return res.status(500).json({ msg: "Gagal mengambil logs aktivitas." });
  }
};

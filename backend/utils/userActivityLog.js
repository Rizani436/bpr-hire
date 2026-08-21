import { Op } from "sequelize";
import UserActivityLog from "../models/UserModel/UserActivityLogModel.js";

const cleanText = (value) => String(value ?? "").trim();

const resolveRetentionHours = () => {
  const raw = Number(process.env.USER_ACTIVITY_LOG_RETENTION_HOURS);
  if (!Number.isFinite(raw) || raw <= 0) return 24;
  return raw;
};

const getRetentionMs = () => resolveRetentionHours() * 60 * 60 * 1000;

export const buildUserActivityLogExpiryDate = () =>
  new Date(Date.now() + getRetentionMs());

export const cleanupExpiredUserActivityLogs = async () => {
  const now = new Date();
  const cutoff = new Date(Date.now() - getRetentionMs());
  await UserActivityLog.destroy({
    where: {
      [Op.or]: [
        { expiresAt: { [Op.lte]: now } },
        { createdAt: { [Op.lte]: cutoff } },
      ],
    },
  });
};

export const writeUserActivityLog = async (payload = {}) => {
  const eventType = cleanText(payload.eventType).toLowerCase() || "access";
  const expiresAt = payload.expiresAt instanceof Date
    ? payload.expiresAt
    : buildUserActivityLogExpiryDate();

  return UserActivityLog.create({
    eventType,
    eventLabel: cleanText(payload.eventLabel),
    routePath: cleanText(payload.routePath),
    username: cleanText(payload.username).toLowerCase(),
    userRole: cleanText(payload.userRole).toLowerCase(),
    targetUserUUID: cleanText(payload.targetUserUUID) || null,
    targetUsername: cleanText(payload.targetUsername).toLowerCase(),
    targetFullName: cleanText(payload.targetFullName),
    targetUserRole: cleanText(payload.targetUserRole).toLowerCase(),
    expiresAt,
  });
};

let cleanupTimer = null;

export const startUserActivityLogCleanupJob = () => {
  if (cleanupTimer) return;
  const intervalMs = 60 * 60 * 1000;

  cleanupTimer = setInterval(() => {
    cleanupExpiredUserActivityLogs().catch(() => {
      // Ignore cleanup errors; next interval will retry.
    });
  }, intervalMs);

  cleanupExpiredUserActivityLogs().catch(() => {
    // Ignore startup cleanup error.
  });
};

import crypto from "crypto";

const cleanText = (value) => String(value ?? "").trim();

const toBooleanFlag = (value) => {
  const normalized = cleanText(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const isProduction =
  cleanText(process.env.NODE_ENV).toLowerCase() === "production";

const defaultLocalOtpEnabled = !isProduction;
const configuredLocalOtpEnabled = cleanText(process.env.LOCAL_OTP_ENABLED);
const localOtpEnabled =
  configuredLocalOtpEnabled === ""
    ? defaultLocalOtpEnabled
    : toBooleanFlag(configuredLocalOtpEnabled);

const LOCAL_OTP_TTL_MS = Math.max(
  30 * 1000,
  Number(process.env.LOCAL_OTP_TTL_MS || 5 * 60 * 1000)
);

const otpStore = new Map();

const normalizeOtpKey = (value) => cleanText(value).toLowerCase();

const pruneOtpStore = () => {
  const now = Date.now();
  for (const [key, item] of otpStore.entries()) {
    if (!item || Number(item.expiresAt || 0) <= now) {
      otpStore.delete(key);
    }
  }
};

const generateOtpCode = () => {
  const random = crypto.randomInt(0, 1_000_000);
  return String(random).padStart(6, "0");
};

export const isLocalOtpModeEnabled = () => localOtpEnabled;

export const issueLocalOtp = (key) => {
  const safeKey = normalizeOtpKey(key);
  if (!safeKey) {
    throw new Error("Kunci OTP lokal tidak valid.");
  }

  pruneOtpStore();
  const code = generateOtpCode();
  const expiresAt = Date.now() + LOCAL_OTP_TTL_MS;

  otpStore.set(safeKey, {
    code,
    expiresAt,
    issuedAt: Date.now(),
  });

  return {
    code,
    expiresAt,
    expiresInMs: LOCAL_OTP_TTL_MS,
  };
};

export const verifyLocalOtp = (key, otpCode) => {
  const safeKey = normalizeOtpKey(key);
  const safeCode = cleanText(otpCode);
  if (!safeKey || !safeCode) {
    return { ok: false, reason: "invalid_input" };
  }

  pruneOtpStore();
  const record = otpStore.get(safeKey);
  if (!record) {
    return { ok: false, reason: "not_found" };
  }

  if (Number(record.expiresAt || 0) <= Date.now()) {
    otpStore.delete(safeKey);
    return { ok: false, reason: "expired" };
  }

  if (cleanText(record.code) !== safeCode) {
    return { ok: false, reason: "mismatch" };
  }

  otpStore.delete(safeKey);
  return { ok: true };
};

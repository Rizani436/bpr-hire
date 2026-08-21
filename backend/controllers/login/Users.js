import argon2 from "argon2";
import { Op } from "sequelize";
import Users from "../../models/UserModel/UserModel.js";
import { verifyLocalOtp } from "../../utils/devOtpStore.js";
import {
  isEmailOtpConfigured,
  isValidEmailFormat,
  resolveEmailOtpErrorMessage,
  sendAccountCreatedEmail,
  sendUserPasswordUpdatedEmail,
  sendUserProfileUpdatedEmail,
} from "../../utils/emailOtp.js";
import { getUserMissingProfileFields } from "../../utils/profileCompleteness.js";
import { writeUserActivityLog } from "../../utils/userActivityLog.js";

const cleanText = (value) => String(value ?? "").trim();

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;

  const safeValue = cleanText(value).toLowerCase();
  if (safeValue === "true" || safeValue === "yes") return true;
  if (safeValue === "false" || safeValue === "no") return false;
  return fallback;
};

const normalizePhoneToE164 = (value) => {
  const raw = cleanText(value).replace(/[^\d+]/g, "");
  if (!raw) return "";
  if (raw.startsWith("+")) {
    const digits = raw.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }
  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) return "";
  if (digitsOnly.startsWith("0")) return `+62${digitsOnly.slice(1)}`;
  if (digitsOnly.startsWith("62")) return `+${digitsOnly}`;
  return `+62${digitsOnly}`;
};

const normalizeRole = (value) => {
  const raw = cleanText(value).toLowerCase();
  if (!raw) return "peserta";
  const compact = raw.replace(/[\s_-]+/g, "");
  if (compact === "superadmin" || compact === "superadministrator") {
    return "superadmin";
  }
  if (compact === "pengawas") return "pengawas";
  if (compact === "peserta") return "peserta";
  return raw;
};

const isSuperadminRole = (roleValue) => normalizeRole(roleValue) === "superadmin";
const roleRequiresOfficeMeta = (roleValue) => {
  const role = normalizeRole(roleValue);
  return role === "superadmin" || role === "pengawas";
};

const PROFILE_FIELD_KEYS = [
  "fullName",
  "email",
  "phone",
  "address",
  "jabatan",
  "unitKerja",
  "nik",
  "birthPlace",
  "birthDate",
  "gender",
  "lastEducation",
  "major",
  "institution",
  "graduationYear",
  "gpa",
  "mainSkill",
  "computerSkill",
  "computerSkillLevel",
  "languageSkill",
  "workExperience",
  "cvFileName",
  "certificateFileName",
  "experienceLetterFileName",
  "ktpFileName",
  "ijazahFileName",
];

const PROFILE_FILE_FIELD_KEYS = [
  "cvFileName",
  "certificateFileName",
  "experienceLetterFileName",
  "ktpFileName",
  "ijazahFileName",
];

const toUploadRelativePath = (file = {}) => {
  const normalizedPath = cleanText(file.path).replace(/\\/g, "/");
  const marker = "uploads/";
  const markerIndex = normalizedPath.lastIndexOf(marker);
  if (markerIndex >= 0) {
    return normalizedPath.slice(markerIndex + marker.length);
  }
  return cleanText(file.filename);
};

const pickUploadedProfileFiles = (files = {}) => {
  const payload = {};

  PROFILE_FILE_FIELD_KEYS.forEach((key) => {
    const fileList = Array.isArray(files?.[key]) ? files[key] : [];
    const uploadedFile = fileList[0];
    const relativePath = toUploadRelativePath(uploadedFile);
    if (relativePath) {
      payload[key] = relativePath;
    }
  });

  return payload;
};

const pickProfilePayload = (rawPayload = {}) => {
  const payload = {};
  PROFILE_FIELD_KEYS.forEach((key) => {
    if (!(key in rawPayload)) return;
    payload[key] = cleanText(rawPayload[key]);
  });

  if ("documentReady" in rawPayload) {
    payload.documentReady = normalizeBoolean(rawPayload.documentReady);
  }

  return payload;
};

const toPublicUser = (user) => {
  if (!user) return null;
  const missingProfileFields = getUserMissingProfileFields(user);

  return {
    userUUID: user.userUUID,
    username: user.username,
    role: normalizeRole(user.role),
    statusUser: cleanText(user.statusUser) || "Aktif",
    fullName: cleanText(user.fullName),
    email: cleanText(user.email),
    phone: cleanText(user.phone),
    address: cleanText(user.address),
    jabatan: cleanText(user.jabatan),
    unitKerja: cleanText(user.unitKerja),
    nik: cleanText(user.nik),
    birthPlace: cleanText(user.birthPlace),
    birthDate: cleanText(user.birthDate),
    gender: cleanText(user.gender),
    lastEducation: cleanText(user.lastEducation),
    major: cleanText(user.major),
    institution: cleanText(user.institution),
    graduationYear: cleanText(user.graduationYear),
    gpa: cleanText(user.gpa),
    mainSkill: cleanText(user.mainSkill),
    computerSkill: cleanText(user.computerSkill),
    computerSkillLevel: cleanText(user.computerSkillLevel),
    languageSkill: cleanText(user.languageSkill),
    workExperience: cleanText(user.workExperience),
    cvFileName: cleanText(user.cvFileName),
    certificateFileName: cleanText(user.certificateFileName),
    experienceLetterFileName: cleanText(user.experienceLetterFileName),
    ktpFileName: cleanText(user.ktpFileName),
    ijazahFileName: cleanText(user.ijazahFileName),
    documentReady: Boolean(user.documentReady),
    profileComplete: missingProfileFields.length === 0,
    missingProfileFields,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const ensureUniqueUserIdentity = async ({
  username,
  email,
  excludeUserUUID = "",
}) => {
  const safeUsername = cleanText(username).toLowerCase();
  const safeEmail = cleanText(email).toLowerCase();
  const excludeId = cleanText(excludeUserUUID);

  if (safeUsername) {
    const existingByUsername = await Users.findOne({
      where: {
        username: safeUsername,
        ...(excludeId ? { userUUID: { [Op.ne]: excludeId } } : {}),
      },
    });
    if (existingByUsername) {
      throw new Error("Username sudah digunakan.");
    }
  }

  if (safeEmail) {
    const existingByEmail = await Users.findOne({
      where: {
        email: safeEmail,
        ...(excludeId ? { userUUID: { [Op.ne]: excludeId } } : {}),
      },
    });
    if (existingByEmail) {
      throw new Error("Email sudah digunakan.");
    }
  }
};

const getTargetUser = async (userUUID) => {
  const safeUserUUID = cleanText(userUUID);
  if (!safeUserUUID) return null;
  return Users.findByPk(safeUserUUID);
};

const canAccessTargetUser = (req, targetUserUUID) => {
  const safeTarget = cleanText(targetUserUUID);
  if (!safeTarget) return false;
  if (isSuperadminRole(req.role)) return true;
  return cleanText(req.userUUID) === safeTarget;
};

const sendAccountCreatedEmailNotification = async ({
  email,
  username,
  fullName,
  role,
  statusUser,
  sourceLabel,
  plainPassword,
  loginUrl,
}) => {
  const safeEmail = cleanText(email).toLowerCase();
  if (!safeEmail || !isValidEmailFormat(safeEmail)) {
    return {
      sent: false,
      code: "EMAIL_INVALID",
      message: "Email akun tidak valid sehingga notifikasi tidak dikirim.",
    };
  }

  if (!isEmailOtpConfigured()) {
    return {
      sent: false,
      code: "EMAIL_NOT_CONFIGURED",
      message: "Konfigurasi Gmail server belum aktif.",
    };
  }

  try {
    await sendAccountCreatedEmail({
      toEmail: safeEmail,
      username,
      fullName,
      role,
      statusUser,
      sourceLabel,
      plainPassword,
      loginUrl,
    });
    return {
      sent: true,
      code: "SENT",
      message: "Detail akun telah dikirim ke email pengguna.",
    };
  } catch (error) {
    return {
      sent: false,
      code: "SEND_FAILED",
      message: resolveEmailOtpErrorMessage(
        error,
        "Pengiriman email detail akun gagal."
      ),
    };
  }
};

const DEFAULT_LOGIN_URL =
  cleanText(process.env.FRONTEND_LOGIN_URL) ||
  cleanText(process.env.FRONTEND_BASE_URL) ||
  "http://localhost:5173";

const PROFILE_CHANGE_FIELD_LABELS = {
  username: "Username",
  fullName: "Nama Lengkap",
  email: "Email",
  phone: "Nomor HP",
  address: "Alamat",
  jabatan: "Jabatan",
  unitKerja: "Unit Kerja",
  role: "Role",
  statusUser: "Status User",
  nik: "NIK",
  birthPlace: "Tempat Lahir",
  birthDate: "Tanggal Lahir",
  gender: "Jenis Kelamin",
  lastEducation: "Pendidikan Terakhir",
  major: "Jurusan",
  institution: "Institusi",
  graduationYear: "Tahun Lulus",
  gpa: "IPK/Nilai Akhir",
  mainSkill: "Keahlian Utama",
  computerSkill: "Kemampuan Komputer",
  computerSkillLevel: "Level Kemampuan Komputer",
  languageSkill: "Bahasa",
  workExperience: "Pengalaman Kerja",
  cvFileName: "CV",
  certificateFileName: "Sertifikat",
  experienceLetterFileName: "Surat Pengalaman Kerja",
  ktpFileName: "KTP",
  ijazahFileName: "Ijazah",
  documentReady: "Status Berkas Lengkap",
};

const toComparableProfileValue = (key, value) => {
  if (key === "documentReady") {
    return value ? "Sudah Lengkap" : "Belum Lengkap";
  }
  return cleanText(value);
};

const toReadableProfileValue = (key, value) =>
  toComparableProfileValue(key, value) || "-";

const buildProfileChangeDetails = (
  beforeUser = {},
  afterUser = {},
  rawRequestBody = {}
) => {
  const changedFields = [];
  const requestKeys = Object.keys(rawRequestBody || {});
  if (requestKeys.length === 0) return changedFields;

  requestKeys.forEach((key) => {
    const label = PROFILE_CHANGE_FIELD_LABELS[key];
    if (!label) return;

    const beforeValue = toComparableProfileValue(key, beforeUser[key]);
    const afterValue = toComparableProfileValue(key, afterUser[key]);
    if (beforeValue === afterValue) return;

    changedFields.push({
      key,
      label,
      before: toReadableProfileValue(key, beforeUser[key]),
      after: toReadableProfileValue(key, afterUser[key]),
    });
  });

  return changedFields;
};

const buildUniqueValidEmails = (...values) => {
  const unique = new Set();
  values
    .flat()
    .map((value) => cleanText(value).toLowerCase())
    .filter(Boolean)
    .forEach((email) => {
      if (isValidEmailFormat(email)) {
        unique.add(email);
      }
    });
  return Array.from(unique);
};

const resolveActorDisplayName = (req = {}, fallbackUsername = "") => {
  const actorUsername = cleanText(req.username);
  const fallback = cleanText(fallbackUsername);
  return (
    actorUsername ||
    fallback ||
    "Sistem BPR HIRE - PT. BPR NTB (Perseroda)"
  );
};

const sendProfileUpdatedEmailNotification = async ({
  targetEmails = [],
  user = {},
  actorName = "",
  actorRole = "",
  sourceLabel = "Perubahan Profil Akun",
  changes = [],
}) => {
  const recipients = buildUniqueValidEmails(targetEmails);
  if (recipients.length === 0) {
    return {
      sent: false,
      code: "EMAIL_INVALID",
      message:
        "Email akun tidak valid sehingga notifikasi perubahan profil tidak dikirim.",
      details: [],
    };
  }

  if (!isEmailOtpConfigured()) {
    return {
      sent: false,
      code: "EMAIL_NOT_CONFIGURED",
      message: "Konfigurasi Gmail server belum aktif.",
      details: [],
    };
  }

  const details = [];
  for (const recipient of recipients) {
    try {
      await sendUserProfileUpdatedEmail({
        toEmail: recipient,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        statusUser: user.statusUser,
        sourceLabel,
        updatedBy: actorName,
        updatedByRole: actorRole,
        updatedAt: new Date().toISOString(),
        changes,
        loginUrl: DEFAULT_LOGIN_URL,
      });
      details.push({
        email: recipient,
        sent: true,
        message: "Email notifikasi perubahan profil berhasil dikirim.",
      });
    } catch (error) {
      details.push({
        email: recipient,
        sent: false,
        message: resolveEmailOtpErrorMessage(
          error,
          "Pengiriman email perubahan profil gagal."
        ),
      });
    }
  }

  const sentCount = details.filter((item) => item.sent).length;
  if (sentCount === 0) {
    return {
      sent: false,
      code: "SEND_FAILED",
      message:
        details[0]?.message ||
        "Pengiriman email perubahan profil tidak berhasil.",
      details,
    };
  }

  if (sentCount < details.length) {
    return {
      sent: true,
      code: "PARTIAL_SENT",
      message: `Sebagian email notifikasi perubahan profil terkirim (${sentCount}/${details.length}).`,
      details,
    };
  }

  return {
    sent: true,
    code: "SENT",
    message: "Detail perubahan profil telah dikirim ke email pengguna.",
    details,
  };
};

const sendPasswordUpdatedEmailNotification = async ({
  targetEmail = "",
  user = {},
  actorName = "",
  actorRole = "",
  sourceLabel = "Perubahan Password Akun",
}) => {
  const recipients = buildUniqueValidEmails(targetEmail);
  if (recipients.length === 0) {
    return {
      sent: false,
      code: "EMAIL_INVALID",
      message:
        "Email akun tidak valid sehingga notifikasi perubahan password tidak dikirim.",
      details: [],
    };
  }

  if (!isEmailOtpConfigured()) {
    return {
      sent: false,
      code: "EMAIL_NOT_CONFIGURED",
      message: "Konfigurasi Gmail server belum aktif.",
      details: [],
    };
  }

  const recipient = recipients[0];
  try {
    await sendUserPasswordUpdatedEmail({
      toEmail: recipient,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      statusUser: user.statusUser,
      sourceLabel,
      updatedBy: actorName,
      updatedByRole: actorRole,
      updatedAt: new Date().toISOString(),
      loginUrl: DEFAULT_LOGIN_URL,
    });
    return {
      sent: true,
      code: "SENT",
      message: "Notifikasi perubahan password telah dikirim ke email pengguna.",
      details: [
        {
          email: recipient,
          sent: true,
          message: "Email notifikasi perubahan password berhasil dikirim.",
        },
      ],
    };
  } catch (error) {
    return {
      sent: false,
      code: "SEND_FAILED",
      message: resolveEmailOtpErrorMessage(
        error,
        "Pengiriman email perubahan password gagal."
      ),
      details: [
        {
          email: recipient,
          sent: false,
          message: resolveEmailOtpErrorMessage(
            error,
            "Pengiriman email perubahan password gagal."
          ),
        },
      ],
    };
  }
};

export const registerPeserta = async (req, res) => {
  try {
    const username = cleanText(req.body?.username).toLowerCase();
    const password = String(req.body?.password || "");
    const fullName = cleanText(req.body?.fullName);
    const email = cleanText(req.body?.email).toLowerCase();
    const rawPhone = cleanText(req.body?.phone);
    const otpCode = cleanText(req.body?.otpCode);

    if (!username) {
      return res.status(400).json({ msg: "Username wajib diisi." });
    }
    if (password.length < 8) {
      return res.status(400).json({ msg: "Password minimal 8 karakter." });
    }
    if (!fullName) {
      return res.status(400).json({ msg: "Nama lengkap wajib diisi." });
    }
    if (!email) {
      return res.status(400).json({ msg: "Email wajib diisi." });
    }
    if (!isValidEmailFormat(email)) {
      return res.status(400).json({ msg: "Format email tidak valid." });
    }
    if (!otpCode) {
      return res.status(400).json({ msg: "Kode OTP wajib diisi." });
    }
    const otpVerification = verifyLocalOtp(`register:${email}`, otpCode);
    if (!otpVerification.ok) {
      return res
        .status(400)
        .json({ msg: "Kode OTP tidak valid atau sudah kedaluwarsa." });
    }

    await ensureUniqueUserIdentity({ username, email });
    const hashedPassword = await argon2.hash(password);

    const normalizedPhone = normalizePhoneToE164(rawPhone);
    const profilePayload = pickProfilePayload(req.body);
    const createdUser = await Users.create({
      username,
      password: hashedPassword,
      role: "peserta",
      statusUser: "Aktif",
      fullName,
      email,
      ...profilePayload,
      phone: normalizedPhone || cleanText(rawPhone),
    });

    const emailNotification = await sendAccountCreatedEmailNotification({
      email: createdUser.email,
      username: createdUser.username,
      fullName: createdUser.fullName,
      role: createdUser.role,
      statusUser: createdUser.statusUser,
      sourceLabel: "Registrasi Mandiri PT. BPR NTB (Perseroda)",
      plainPassword: password,
      loginUrl: "http://localhost:5173",
    });

    const responseMessage = emailNotification.sent
      ? "Registrasi peserta berhasil. Detail akun telah dikirim ke email."
      : `Registrasi peserta berhasil. ${emailNotification.message}`;

    return res.status(201).json({
      msg: responseMessage,
      user: toPublicUser(createdUser),
      emailNotification,
    });
  } catch (error) {
    const safeMessage =
      error instanceof Error ? error.message : "Gagal registrasi peserta.";
    return res.status(400).json({ msg: safeMessage });
  }
};

export const createUser = async (req, res) => {
  if (!isSuperadminRole(req.role)) {
    return res
      .status(403)
      .json({ msg: "Hanya superadmin yang dapat membuat user." });
  }

  try {
    const username = cleanText(req.body?.username).toLowerCase();
    const password = String(req.body?.password || "");
    const fullName = cleanText(req.body?.fullName);
    const email = cleanText(req.body?.email).toLowerCase();
    const role = normalizeRole(req.body?.role || "peserta");
    const statusUser = cleanText(req.body?.statusUser) || "Aktif";
    const jabatan = cleanText(req.body?.jabatan);
    const unitKerja = cleanText(req.body?.unitKerja);

    if (!username) {
      return res.status(400).json({ msg: "Username wajib diisi." });
    }
    if (password.length < 8) {
      return res.status(400).json({ msg: "Password minimal 8 karakter." });
    }
    if (!fullName) {
      return res.status(400).json({ msg: "Nama lengkap wajib diisi." });
    }
    if (!email) {
      return res.status(400).json({ msg: "Email wajib diisi." });
    }
    if (roleRequiresOfficeMeta(role) && !jabatan) {
      return res.status(400).json({
        msg: "Jabatan wajib diisi untuk role pengawas/superadmin.",
      });
    }
    if (roleRequiresOfficeMeta(role) && !unitKerja) {
      return res.status(400).json({
        msg: "Unit kerja wajib diisi untuk role pengawas/superadmin.",
      });
    }

    await ensureUniqueUserIdentity({ username, email });
    const hashedPassword = await argon2.hash(password);

    const profilePayload = pickProfilePayload(req.body);
    const createdUser = await Users.create({
      username,
      password: hashedPassword,
      role,
      statusUser,
      fullName,
      email,
      ...profilePayload,
    });

    const emailNotification = await sendAccountCreatedEmailNotification({
      email: createdUser.email,
      username: createdUser.username,
      fullName: createdUser.fullName,
      role: createdUser.role,
      statusUser: createdUser.statusUser,
      sourceLabel: "Pembuatan Akun oleh Superadmin",
      plainPassword: password,
      loginUrl: "http://localhost:5173",
    });

    const responseMessage = emailNotification.sent
      ? "User berhasil dibuat. Detail akun telah dikirim ke email."
      : `User berhasil dibuat. ${emailNotification.message}`;

    return res.status(201).json({
      msg: responseMessage,
      user: toPublicUser(createdUser),
      emailNotification,
    });
  } catch (error) {
    const safeMessage =
      error instanceof Error ? error.message : "Gagal membuat user.";
    return res.status(400).json({ msg: safeMessage });
  }
};

export const getUsers = async (req, res) => {
  if (!isSuperadminRole(req.role)) {
    return res
      .status(403)
      .json({ msg: "Hanya superadmin yang dapat melihat seluruh user." });
  }

  try {
    const search = cleanText(req.query?.search).toLowerCase();
    const rawRoleFilter = cleanText(req.query?.role);
    const roleFilter = rawRoleFilter ? normalizeRole(rawRoleFilter) : "";
    const where = {};

    if (search) {
      where[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { fullName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    if (roleFilter && ["peserta", "pengawas", "superadmin"].includes(roleFilter)) {
      where.role = roleFilter;
    }

    const users = await Users.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      total: users.length,
      users: users.map((user) => toPublicUser(user)),
    });
  } catch (error) {
    return res.status(500).json({ msg: "Gagal mengambil daftar user." });
  }
};

export const deleteUser = async (req, res) => {
  if (!isSuperadminRole(req.role)) {
    return res
      .status(403)
      .json({ msg: "Hanya superadmin yang dapat menghapus user." });
  }

  try {
    const targetUserUUID = cleanText(req.params?.userUUID);
    if (!targetUserUUID) {
      return res.status(400).json({ msg: "User UUID tidak valid." });
    }

    if (cleanText(req.userUUID) === targetUserUUID) {
      return res
        .status(400)
        .json({ msg: "Superadmin tidak dapat menghapus akun sendiri." });
    }

    const user = await getTargetUser(targetUserUUID);
    if (!user) {
      return res.status(404).json({ msg: "User tidak ditemukan." });
    }

    if (normalizeRole(user.role) === "superadmin") {
      const totalSuperadmin = await Users.count({
        where: { role: "superadmin" },
      });

      if (totalSuperadmin <= 1) {
        return res.status(400).json({
          msg: "Tidak dapat menghapus superadmin terakhir di sistem.",
        });
      }
    }

    const deletedUser = toPublicUser(user);
    await user.destroy();

    try {
      await writeUserActivityLog({
        eventType: "delete_user",
        eventLabel: "Data user dihapus",
        routePath: "/users/:userUUID",
        targetUserUUID: deletedUser.userUUID,
        targetUsername: deletedUser.username,
        targetFullName: deletedUser.fullName,
        targetUserRole: normalizeRole(deletedUser.role),
      });
    } catch {
      // Keep delete flow successful even when logging fails.
    }

    return res.json({
      msg: "User berhasil dihapus.",
      user: deletedUser,
    });
  } catch {
    return res.status(500).json({ msg: "Gagal menghapus user." });
  }
};

export const getUserByUUID = async (req, res) => {
  try {
    const targetUserUUID = cleanText(req.params?.userUUID);
    if (!canAccessTargetUser(req, targetUserUUID)) {
      return res.status(403).json({ msg: "Tidak diizinkan mengakses data user ini." });
    }

    const user = await getTargetUser(targetUserUUID);
    if (!user) {
      return res.status(404).json({ msg: "User tidak ditemukan." });
    }

    return res.json({ user: toPublicUser(user) });
  } catch {
    return res.status(500).json({ msg: "Gagal mengambil data user." });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const targetUserUUID = cleanText(req.params?.userUUID);
    if (!canAccessTargetUser(req, targetUserUUID)) {
      return res.status(403).json({ msg: "Tidak diizinkan mengubah data user ini." });
    }

    const user = await getTargetUser(targetUserUUID);
    if (!user) {
      return res.status(404).json({ msg: "User tidak ditemukan." });
    }
    const beforeUserSnapshot = toPublicUser(user);
    const previousEmail = cleanText(beforeUserSnapshot?.email).toLowerCase();

    const nextUsername =
      "username" in req.body
        ? cleanText(req.body?.username).toLowerCase()
        : cleanText(user.username).toLowerCase();
    const nextEmail =
      "email" in req.body
        ? cleanText(req.body?.email).toLowerCase()
        : cleanText(user.email).toLowerCase();
    const effectiveRole = "role" in req.body ? req.body.role : user.role;
    const effectiveJabatan =
      "jabatan" in req.body ? cleanText(req.body?.jabatan) : cleanText(user.jabatan);
    const effectiveUnitKerja =
      "unitKerja" in req.body
        ? cleanText(req.body?.unitKerja)
        : cleanText(user.unitKerja);

    if (!nextUsername) {
      return res.status(400).json({ msg: "Username wajib diisi." });
    }
    if (roleRequiresOfficeMeta(effectiveRole) && !effectiveJabatan) {
      return res.status(400).json({
        msg: "Jabatan wajib diisi untuk role pengawas/superadmin.",
      });
    }
    if (roleRequiresOfficeMeta(effectiveRole) && !effectiveUnitKerja) {
      return res.status(400).json({
        msg: "Unit kerja wajib diisi untuk role pengawas/superadmin.",
      });
    }

    await ensureUniqueUserIdentity({
      username: nextUsername,
      email: nextEmail,
      excludeUserUUID: user.userUUID,
    });

    const patchPayload = {
      ...pickProfilePayload(req.body),
      ...pickUploadedProfileFiles(req.files),
    };
    patchPayload.username = nextUsername;
    patchPayload.email = nextEmail || null;
    if ("fullName" in req.body && !cleanText(req.body.fullName)) {
      return res.status(400).json({ msg: "Nama lengkap wajib diisi." });
    }

    if (isSuperadminRole(req.role)) {
      if ("role" in req.body) {
        patchPayload.role = normalizeRole(req.body.role);
      }
      if ("statusUser" in req.body) {
        patchPayload.statusUser = cleanText(req.body.statusUser) || "Aktif";
      }
    }

    await user.update(patchPayload);
    const updatedUser = toPublicUser(user);
    const changedFields = buildProfileChangeDetails(
      beforeUserSnapshot,
      updatedUser,
      req.body
    );
    const sourceLabel = isSuperadminRole(req.role)
      ? "Perubahan profil oleh Superadmin"
      : "Perubahan profil mandiri pengguna";
    const emailNotification = await sendProfileUpdatedEmailNotification({
      targetEmails: [updatedUser?.email, previousEmail],
      user: updatedUser,
      actorName: resolveActorDisplayName(req, updatedUser?.username),
      actorRole: normalizeRole(req.role),
      sourceLabel,
      changes: changedFields,
    });

    try {
      await writeUserActivityLog({
        eventType: "update_user_profile",
        eventLabel: "Data user diperbarui",
        routePath: "/users/:userUUID",
        targetUserUUID: updatedUser?.userUUID,
        targetUsername: updatedUser?.username,
        targetFullName: updatedUser?.fullName,
        targetUserRole: normalizeRole(updatedUser?.role),
      });
    } catch {
      // Keep update flow successful even when logging fails.
    }

    const responseMessage = emailNotification.sent
      ? "Data user berhasil diperbarui. Detail perubahan telah dikirim ke email pengguna."
      : `Data user berhasil diperbarui. ${emailNotification.message}`;

    return res.json({
      msg: responseMessage,
      user: updatedUser,
      emailNotification,
      changedFields,
    });
  } catch (error) {
    const safeMessage =
      error instanceof Error ? error.message : "Gagal mengubah data user.";
    return res.status(400).json({ msg: safeMessage });
  }
};

export const updateUserPassword = async (req, res) => {
  try {
    const targetUserUUID = cleanText(req.params?.userUUID);
    if (!canAccessTargetUser(req, targetUserUUID)) {
      return res.status(403).json({ msg: "Tidak diizinkan mengubah password user ini." });
    }

    const user = await getTargetUser(targetUserUUID);
    if (!user) {
      return res.status(404).json({ msg: "User tidak ditemukan." });
    }
    const userSnapshot = toPublicUser(user);

    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (newPassword.length < 8) {
      return res.status(400).json({ msg: "Password baru minimal 8 karakter." });
    }

    const isSuperadminAction = isSuperadminRole(req.role);
    const isSelfAction = cleanText(req.userUUID) === cleanText(user.userUUID);
    if (!isSuperadminAction || isSelfAction) {
      if (!currentPassword) {
        return res
          .status(400)
          .json({ msg: "Password saat ini wajib diisi untuk verifikasi." });
      }
      const isMatched = await argon2.verify(user.password, currentPassword);
      if (!isMatched) {
        return res.status(400).json({ msg: "Password saat ini tidak sesuai." });
      }
    }

    const hashedPassword = await argon2.hash(newPassword);
    await user.update({
      password: hashedPassword,
      jwt_token: null,
      sessionId: null,
    });

    const sourceLabel =
      isSuperadminAction && !isSelfAction
        ? "Reset password oleh Superadmin"
        : "Perubahan password mandiri pengguna";
    const emailNotification = await sendPasswordUpdatedEmailNotification({
      targetEmail: userSnapshot?.email,
      user: userSnapshot,
      actorName: resolveActorDisplayName(req, userSnapshot?.username),
      actorRole: normalizeRole(req.role),
      sourceLabel,
    });

    try {
      await writeUserActivityLog({
        eventType: "update_user_password",
        eventLabel: "Password user diperbarui",
        routePath: "/users/:userUUID/password",
        targetUserUUID: userSnapshot?.userUUID,
        targetUsername: userSnapshot?.username,
        targetFullName: userSnapshot?.fullName,
        targetUserRole: normalizeRole(userSnapshot?.role),
      });
    } catch {
      // Keep password-update flow successful even when logging fails.
    }

    const responseMessage = emailNotification.sent
      ? "Password user berhasil diperbarui. Notifikasi telah dikirim ke email pengguna."
      : `Password user berhasil diperbarui. ${emailNotification.message}`;

    return res.json({
      msg: responseMessage,
      emailNotification,
    });
  } catch {
    return res.status(500).json({ msg: "Gagal mengubah password user." });
  }
};

export const getOwnProfile = async (req, res) => {
  try {
    const user = await getTargetUser(req.userUUID);
    if (!user) {
      return res.status(404).json({ msg: "User tidak ditemukan." });
    }
    return res.json({ user: toPublicUser(user) });
  } catch {
    return res.status(500).json({ msg: "Gagal mengambil profil akun." });
  }
};

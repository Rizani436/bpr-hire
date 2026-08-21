import { randomUUID } from "node:crypto";
import { Op, col, fn, where as sqlWhere } from "sequelize";
import Lamaran from "../../models/main/lamaranModel.js";
import LamaranApplication from "../../models/main/lamaranApplicationModel.js";
import Users from "../../models/UserModel/UserModel.js";
import {
  isValidEmailFormat,
  sendLamaranVerificationEmail,
} from "../../utils/emailOtp.js";
import { getUserMissingProfileFields } from "../../utils/profileCompleteness.js";

const JOB_TYPE_OPTIONS = ["Full Time", "Contract", "Part Time", "Internship"];
const APPLICATION_SUCCESS_STATUS = "Berhasil Mendaftar";
const APPLICATION_STAGE = "Seleksi Administrasi";

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

const normalizeEducation = (value) =>
  cleanText(value).toUpperCase().replace(/\s+/g, "");

const getEducationRank = (value) => {
  const normalized = normalizeEducation(value);

  if (normalized === "S3") return 7;
  if (normalized === "S2") return 6;
  if (normalized === "S1" || normalized === "D4") return 5;
  if (normalized === "D3") return 4;
  if (normalized === "D2") return 3;
  if (normalized === "D1") return 2;
  if (
    normalized === "SMA" ||
    normalized === "SMK" ||
    normalized === "MA" ||
    normalized === "SMA/SMK" ||
    normalized === "SMA-SMK"
  ) {
    return 1;
  }

  return 0;
};

const getEducationDisplay = (value) => cleanText(value).toUpperCase() || "-";

const parseGpa = (value) => {
  const parsed = Number.parseFloat(cleanText(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseYear = (value) => {
  const parsed = Number.parseInt(cleanText(value).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const CRITERIA_FIELD_LABELS = {
  major: "Jurusan",
  mainSkill: "Keahlian Utama",
  computerSkillLevel: "Level Kemampuan Komputer",
};

const normalizeCriteriaFieldValueRules = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.entries(value).reduce((result, [fieldKey, fieldValues]) => {
    const safeFieldKey = cleanText(fieldKey);
    if (!CRITERIA_FIELD_LABELS[safeFieldKey]) return result;

    const rawList = Array.isArray(fieldValues) ? fieldValues : [fieldValues];
    const normalizedList = Array.from(
      new Set(
        rawList
          .map((item) => cleanText(item))
          .filter((item) => item.length > 0)
      )
    );

    if (normalizedList.length > 0) {
      result[safeFieldKey] = normalizedList;
    }

    return result;
  }, {});
};

const normalizeCriteriaValueText = (value) => cleanText(value).toLowerCase();

const getApplicantCriteriaFieldValue = (user, fieldKey) => {
  const safeFieldKey = cleanText(fieldKey);
  if (!safeFieldKey) return "";
  return cleanText(user?.[safeFieldKey]);
};

const isApplicantCriteriaFieldValueMatched = (user, fieldKey, allowedValues) => {
  const safeAllowedValues = Array.isArray(allowedValues)
    ? allowedValues.map((item) => cleanText(item)).filter(Boolean)
    : [];
  if (safeAllowedValues.length === 0) return true;

  const applicantValue = getApplicantCriteriaFieldValue(user, fieldKey);
  const normalizedApplicantValue = normalizeCriteriaValueText(applicantValue);
  if (!normalizedApplicantValue) return false;

  return safeAllowedValues.some((allowedValue) => {
    const normalizedAllowedValue = normalizeCriteriaValueText(allowedValue);
    if (!normalizedAllowedValue) return false;

    return (
      normalizedApplicantValue === normalizedAllowedValue ||
      normalizedApplicantValue.includes(normalizedAllowedValue)
    );
  });
};

const getMinimumCriteriaFailureMessages = (lamaran, user) => {
  const criteria = lamaran?.biodataCriteria;
  if (!criteria || !criteria.isEnabled) return [];

  const failedMessages = [];

  const minimumEducation = getEducationDisplay(criteria.minimumEducation);
  const minimumEducationRank = getEducationRank(minimumEducation);
  if (minimumEducationRank > 0) {
    const applicantEducation = getEducationDisplay(user?.lastEducation);
    const applicantEducationRank = getEducationRank(applicantEducation);

    if (applicantEducationRank < minimumEducationRank) {
      failedMessages.push(
        `Pendidikan minimal untuk lamaran ini adalah ${minimumEducation}. Pendidikan Anda saat ini ${applicantEducation}.`
      );
    }
  }

  const minimumGraduationYear = parseYear(criteria.minimumGraduationYear);
  if (minimumGraduationYear > 0) {
    const applicantGraduationYear = parseYear(user?.graduationYear);

    if (applicantGraduationYear < minimumGraduationYear) {
      failedMessages.push(
        `Tahun lulus minimal untuk lamaran ini adalah ${minimumGraduationYear}. Tahun lulus Anda saat ini ${applicantGraduationYear || "-"}.`
      );
    }
  }

  const minimumGpa = Number(criteria.minimumGpa || 0);
  if (minimumGpa > 0) {
    const applicantGpa = parseGpa(user?.gpa);
    const applicantGpaLabel = cleanText(user?.gpa)
      ? applicantGpa.toFixed(2)
      : "-";

    if (applicantGpa < minimumGpa) {
      failedMessages.push(
        `IPK minimal untuk lamaran ini adalah ${minimumGpa.toFixed(2)}. IPK Anda saat ini ${applicantGpaLabel}.`
      );
    }
  }

  const fieldValueRules = normalizeCriteriaFieldValueRules(
    criteria.fieldValueRules
  );
  Object.entries(fieldValueRules).forEach(([fieldKey, allowedValues]) => {
    if (isApplicantCriteriaFieldValueMatched(user, fieldKey, allowedValues)) {
      return;
    }

    const applicantValue = getApplicantCriteriaFieldValue(user, fieldKey);
    const fieldLabel = CRITERIA_FIELD_LABELS[fieldKey] || fieldKey;
    failedMessages.push(
      `${fieldLabel} harus sesuai salah satu kriteria: ${allowedValues.join(", ")}${applicantValue ? ` (data Anda: ${applicantValue})` : " (data Anda belum diisi)"}.`
    );
  });

  return failedMessages;
};

const canManageLamaran = (req) =>
  ["pengawas", "superadmin"].includes(normalizeRole(req.role));

const normalizeDate = (value) => {
  const text = cleanText(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeTime = (value) => {
  const text = cleanText(value);
  if (!text) return "";

  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;

  const safe = cleanText(value).toLowerCase();
  if (safe === "true" || safe === "yes") return true;
  if (safe === "false" || safe === "no") return false;
  return fallback;
};

const parseList = (value) => {
  const rawList = Array.isArray(value)
    ? value
    : cleanText(value)
        .split(/\r?\n/)
        .map((item) => cleanText(item))
        .filter((item) => item.length > 0);

  return Array.from(
    new Set(
      rawList
        .map((item) => cleanText(item))
        .filter((item) => item.length > 0)
    )
  );
};

const normalizeSelectionFlow = (value) => {
  const safe = cleanText(value).toLowerCase();
  return safe === "langsung" ? "langsung" : "berurutan";
};

const isAdministrationStage = (stage = {}) => {
  const normalizedTitle = cleanText(stage?.title || stage)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return (
    normalizedTitle === "administrasi" ||
    normalizedTitle === "seleksiadministrasi" ||
    normalizedTitle === "tahapadministrasi"
  );
};

const parseSelectionStages = (value) => {
  const rawItems = Array.isArray(value)
    ? value
    : cleanText(value)
        .split(/\r?\n/)
        .map((item) => cleanText(item))
        .filter((item) => item.length > 0);

  return rawItems
    .map((item) => {
      if (item && typeof item === "object") {
        const title = cleanText(item.title);
        const description = cleanText(item.description);
        return title
          ? {
              title,
              description,
              startDate: normalizeDate(item.startDate ?? item.dateStart),
              endDate: normalizeDate(item.endDate ?? item.dateEnd),
              startTime: normalizeTime(item.startTime ?? item.timeStart),
              endTime: normalizeTime(item.endTime ?? item.timeEnd),
            }
          : null;
      }

      const rawText = cleanText(item);
      if (!rawText) return null;

      if (rawText.includes("|")) {
        const [titlePart, ...descriptionParts] = rawText.split("|");
        const title = cleanText(titlePart);
        const description = cleanText(descriptionParts.join("|"));
        return title
          ? {
              title,
              description,
              startDate: "",
              endDate: "",
              startTime: "",
              endTime: "",
            }
          : null;
      }

      return {
        title: rawText,
        description: "",
        startDate: "",
        endDate: "",
        startTime: "",
        endTime: "",
      };
    })
    .filter(Boolean);
};

const validateSelectionStageSchedules = (selectionStages = []) => {
  const safeStages = Array.isArray(selectionStages) ? selectionStages : [];

  for (let index = 0; index < safeStages.length; index += 1) {
    const stage = safeStages[index] || {};
    const stageLabel = `tahap seleksi lanjutan ${index + 1}`;
    const hasSchedule = [
      stage.startDate,
      stage.endDate,
      stage.startTime,
      stage.endTime,
    ].some((value) => cleanText(value).length > 0);

    if (!hasSchedule) continue;

    if (!stage.startDate || !stage.endDate || !stage.startTime || !stage.endTime) {
      return `Tanggal mulai, tanggal selesai, jam mulai, dan jam selesai wajib lengkap pada ${stageLabel}.`;
    }

    if (stage.endDate < stage.startDate) {
      return `Tanggal selesai tidak boleh sebelum tanggal mulai pada ${stageLabel}.`;
    }

    if (stage.startDate === stage.endDate && stage.endTime < stage.startTime) {
      return `Jam selesai tidak boleh sebelum jam mulai pada ${stageLabel}.`;
    }
  }

  return "";
};

const parseJsonArray = (value) => {
  try {
    const parsed = JSON.parse(cleanText(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseJsonObject = (value) => {
  try {
    const parsed = JSON.parse(cleanText(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
};

const resolveLamaranStatus = (lamaran, referenceDate = new Date()) => {
  if (!normalizeBoolean(lamaran?.isActive, true)) return "inactive";

  const openDate = normalizeDate(lamaran?.openDate);
  const closeDate = normalizeDate(lamaran?.closeDate);
  const now =
    referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  if (openDate) {
    const start = new Date(`${openDate}T00:00:00`);
    if (!Number.isNaN(start.getTime()) && now < start) return "scheduled";
  }

  if (closeDate) {
    const end = new Date(`${closeDate}T23:59:59`);
    if (!Number.isNaN(end.getTime()) && now > end) return "expired";
  }

  return "open";
};

const toPublicLamaran = (item) => {
  const kualifikasi = parseJsonArray(item.requirementsJson);
  const kompetensi = parseJsonArray(item.qualificationsJson);
  const pendidikan = parseJsonArray(item.pendidikanJson);
  const pengalaman = parseJsonArray(item.pengalamanJson);
  const karakterDibutuhkan = parseJsonArray(item.karakterDibutuhkanJson);
  const requiredDocuments = parseJsonArray(item.requiredDocumentsJson);
  const selectionStages = parseJsonArray(item.selectionStagesJson).filter(
    (stage) => !isAdministrationStage(stage)
  );
  const biodataCriteria = parseJsonObject(item.biodataCriteriaJson);
  const tenagaAhli = cleanText(item.department);
  const deskripsiLamaran = cleanText(item.description);
  const ruangLingkupPekerjaan =
    cleanText(item.summary) || cleanText(item.description);

  return {
    id: item.lamaranUUID,
    lamaranUUID: item.lamaranUUID,
    title: cleanText(item.title),
    department: tenagaAhli,
    tenagaAhli,
    location: cleanText(item.location),
    type: cleanText(item.type) || "Full Time",
    description: deskripsiLamaran,
    deskripsiLamaran,
    summary: ruangLingkupPekerjaan,
    ruangLingkupPekerjaan,
    requirements: kualifikasi,
    kualifikasi,
    qualifications: kompetensi,
    kompetensi,
    pendidikan,
    pengalaman,
    karakterDibutuhkan,
    requiredDocuments,
    selectionFlow: normalizeSelectionFlow(item.selectionFlow),
    selectionStages,
    biodataCriteria,
    isActive: Boolean(item.isActive),
    openDate: normalizeDate(item.openDate),
    closeDate: normalizeDate(item.closeDate),
    status: resolveLamaranStatus(item),
    createdBy: cleanText(item.createdBy),
    createdByRole: normalizeRole(item.createdByRole),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

const buildVerificationId = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `VRF-${date}-${randomPart}`;
};

const createUniqueVerificationId = async () => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const verificationId = buildVerificationId();
    const existing = await LamaranApplication.findOne({
      where: { verificationId },
    });
    if (!existing) return verificationId;
  }

  throw new Error("Gagal membuat ID verifikasi unik.");
};

const resolveDashboardUrl = () => {
  const baseUrl =
    cleanText(process.env.FRONTEND_URL) ||
    cleanText(process.env.CLIENT_URL) ||
    cleanText(process.env.APP_URL) ||
    "http://localhost:5173";
  return `${baseUrl.replace(/\/+$/g, "")}/dashboard`;
};

const toPublicApplication = (item) => ({
  applicationUUID: item.applicationUUID,
  lamaranUUID: item.lamaranUUID,
  userUUID: item.userUUID,
  verificationId: cleanText(item.verificationId),
  lamaranTitle: cleanText(item.lamaranTitle),
  title: cleanText(item.lamaranTitle),
  tenagaAhli: cleanText(item.tenagaAhli),
  applicantName: cleanText(item.applicantName),
  applicantUsername: cleanText(item.applicantUsername),
  applicantEmail: cleanText(item.applicantEmail),
  status: cleanText(item.status) || APPLICATION_SUCCESS_STATUS,
  stage: cleanText(item.stage) || APPLICATION_STAGE,
  appliedAt: item.appliedAt,
  verificationEmailSentAt: item.verificationEmailSentAt,
  verificationEmailStatus: cleanText(item.verificationEmailStatus),
});

const createAdministrationStage = () => ({
  id: "administrasi",
  title: APPLICATION_STAGE,
  description: "Verifikasi kelengkapan dokumen dan kesesuaian data peserta.",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
});

const normalizeStageId = (value, fallback) =>
  cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || fallback;

const buildApplicationStageDefinitions = (lamaran = {}) => {
  const selectionStages = Array.isArray(lamaran?.selectionStages)
    ? lamaran.selectionStages
    : [];

  return [
    createAdministrationStage(),
    ...selectionStages
      .map((stage, index) => {
        const title = cleanText(stage?.title);
        if (!title) return null;

        return {
          id: normalizeStageId(title, `tahap-${index + 2}`),
          title,
          description:
            cleanText(stage?.description) || "Tahap lanjutan proses seleksi.",
          startDate: normalizeDate(stage?.startDate),
          endDate: normalizeDate(stage?.endDate),
          startTime: cleanText(stage?.startTime),
          endTime: cleanText(stage?.endTime),
        };
      })
      .filter(Boolean),
  ];
};

const normalizeStageForComparison = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const resolveApplicationProgress = (application, stages = []) => {
  const status = cleanText(application?.status).toLowerCase();
  if (status.includes("diterima") || status.includes("lolos tahap akhir")) {
    return 100;
  }
  if (status.includes("ditolak") || status.includes("tidak lolos")) {
    return 0;
  }

  const safeStages = Array.isArray(stages) && stages.length > 0
    ? stages
    : [createAdministrationStage()];
  const currentStage = normalizeStageForComparison(application?.stage);
  const activeIndex = safeStages.findIndex((stage) => {
    const stageTitle = normalizeStageForComparison(stage?.title);
    return (
      currentStage &&
      stageTitle &&
      (currentStage === stageTitle ||
        currentStage.includes(stageTitle) ||
        stageTitle.includes(currentStage))
    );
  });
  const safeIndex = activeIndex >= 0 ? activeIndex : 0;

  if (safeStages.length <= 1) return 20;
  return Math.min(
    99,
    Math.max(10, Math.round(((safeIndex + 1) / safeStages.length) * 100))
  );
};

const toPublicApplicationWithLamaran = (item, lamaran = null) => {
  const publicApplication = toPublicApplication(item);
  const publicLamaran = lamaran && typeof lamaran === "object" ? lamaran : {};
  const stageDefinitions = buildApplicationStageDefinitions(publicLamaran);
  const lamaranTitle =
    publicApplication.lamaranTitle || cleanText(publicLamaran.title);
  const tenagaAhli =
    publicApplication.tenagaAhli || cleanText(publicLamaran.tenagaAhli);

  return {
    ...publicApplication,
    id: publicApplication.applicationUUID,
    vacancyId: publicApplication.lamaranUUID,
    role: lamaranTitle,
    branch: cleanText(publicLamaran.location) || "PT. BPR NTB (Perseroda)",
    title: lamaranTitle,
    lamaranTitle,
    tenagaAhli,
    department: tenagaAhli,
    selectionFlow: publicLamaran.selectionFlow || "berurutan",
    selectionStages: Array.isArray(publicLamaran.selectionStages)
      ? publicLamaran.selectionStages
      : [],
    stageDefinitions,
    progress: resolveApplicationProgress(publicApplication, stageDefinitions),
    lamaran: publicLamaran,
  };
};

const getLamaranMapForApplications = async (applications = []) => {
  const lamaranUUIDs = [
    ...new Set(
      (Array.isArray(applications) ? applications : [])
        .map((application) => cleanText(application.lamaranUUID))
        .filter(Boolean)
    ),
  ];

  if (lamaranUUIDs.length === 0) {
    return {
      lamaranMap: new Map(),
      orphanLamaranUUIDs: [],
    };
  }

  const lamaranRows = await Lamaran.findAll({
    where: {
      lamaranUUID: {
        [Op.in]: lamaranUUIDs,
      },
    },
  });
  const lamaranMap = new Map(
    lamaranRows.map((lamaran) => [
      cleanText(lamaran.lamaranUUID),
      toPublicLamaran(lamaran),
    ])
  );
  const orphanLamaranUUIDs = lamaranUUIDs.filter(
    (lamaranUUID) => !lamaranMap.has(lamaranUUID)
  );

  return {
    lamaranMap,
    orphanLamaranUUIDs,
  };
};

const sendApplicationVerificationEmail = async ({
  application,
  lamaran,
  user,
}) => {
  const publicLamaran = toPublicLamaran(lamaran);

  await sendLamaranVerificationEmail({
    toEmail: application.applicantEmail,
    fullName: application.applicantName,
    username: user.username,
    verificationId: application.verificationId,
    lamaranTitle: publicLamaran.title,
    tenagaAhli: publicLamaran.tenagaAhli,
    location: publicLamaran.location,
    type: publicLamaran.type,
    appliedAt: application.appliedAt,
    dashboardUrl: resolveDashboardUrl(),
  });

  await application.update({
    verificationEmailSentAt: new Date(),
    verificationEmailStatus: "sent",
    verificationEmailError: null,
  });
};

const buildCreatePayload = (reqBody = {}, req = {}, options = {}) => {
  const defaultIsActive = normalizeBoolean(options.defaultIsActive, true);
  const title = cleanText(reqBody.title);
  const tenagaAhli = cleanText(reqBody.tenagaAhli ?? reqBody.department);
  const location = cleanText(reqBody.location);
  const deskripsiLamaran = cleanText(
    reqBody.deskripsiLamaran ?? reqBody.description
  );
  const ruangLingkupPekerjaan =
    cleanText(reqBody.ruangLingkupPekerjaan ?? reqBody.summary) ||
    deskripsiLamaran;
  const type = cleanText(reqBody.type);
  const openDate = normalizeDate(reqBody.openDate);
  const closeDate = normalizeDate(reqBody.closeDate);
  const selectionFlow = normalizeSelectionFlow(reqBody.selectionFlow);
  const kualifikasi = parseList(
    reqBody.kualifikasi ?? reqBody.requirements ?? reqBody.requirementsText
  );
  const kompetensi = parseList(
    reqBody.kompetensi ?? reqBody.qualifications ?? reqBody.qualificationsText
  );
  const pendidikan = parseList(
    reqBody.pendidikan ?? reqBody.pendidikanText ?? reqBody.educationLevels
  );
  const pengalaman = parseList(
    reqBody.pengalaman ??
      reqBody.pengalamanText ??
      reqBody.experienceRequirements
  );
  const karakterDibutuhkan = parseList(
    reqBody.karakterDibutuhkan ??
      reqBody.karakterDibutuhkanText ??
      reqBody.characteristics
  );
  const requiredDocuments = parseList(
    reqBody.requiredDocuments ?? reqBody.requiredDocumentsText
  );
  const parsedStages = parseSelectionStages(
    reqBody.selectionStages ?? reqBody.selectionStagesText
  );
  const selectionStages =
    selectionFlow === "langsung"
      ? parsedStages.filter((stage) => !isAdministrationStage(stage)).slice(0, 1)
      : parsedStages.filter((stage) => !isAdministrationStage(stage));
  const biodataCriteria =
    reqBody.biodataCriteria &&
    typeof reqBody.biodataCriteria === "object" &&
    !Array.isArray(reqBody.biodataCriteria)
      ? reqBody.biodataCriteria
      : {};
  const isActive = normalizeBoolean(reqBody.isActive, defaultIsActive);
  const actorRole = normalizeRole(req.role);
  const createdBy = cleanText(reqBody.createdBy || req.username || "");
  const normalizedType = JOB_TYPE_OPTIONS.includes(type) ? type : "Full Time";

  return {
    title,
    tenagaAhli,
    location,
    type: normalizedType,
    deskripsiLamaran,
    ruangLingkupPekerjaan,
    kualifikasi,
    kompetensi,
    pendidikan,
    pengalaman,
    karakterDibutuhkan,
    requiredDocuments,
    selectionFlow,
    selectionStages,
    biodataCriteria,
    isActive,
    openDate,
    closeDate,
    createdBy,
    createdByRole: actorRole,
  };
};

const validateCreatePayload = (payload) => {
  if (!payload.title) return "Judul posisi wajib diisi.";
  if (!payload.tenagaAhli) return "Tenaga ahli wajib diisi.";
  if (!payload.location) return "Lokasi penempatan wajib diisi.";
  if (!payload.deskripsiLamaran) return "Deskripsi lamaran wajib diisi.";
  if (!payload.openDate || !payload.closeDate) {
    return "Tanggal mulai dan tanggal tutup lamaran wajib diisi.";
  }
  if (payload.closeDate < payload.openDate) {
    return "Tanggal tutup harus sama atau setelah tanggal mulai.";
  }
  if (!Array.isArray(payload.pendidikan) || payload.pendidikan.length === 0) {
    return "Minimal pilih satu pendidikan untuk lamaran.";
  }
  if (!Array.isArray(payload.kualifikasi) || payload.kualifikasi.length === 0) {
    return "Minimal isi satu kualifikasi (baris terpisah).";
  }
  if (
    !Array.isArray(payload.requiredDocuments) ||
    payload.requiredDocuments.length === 0
  ) {
    return "Minimal isi satu dokumen yang diperlukan.";
  }
  const selectionScheduleMessage = validateSelectionStageSchedules(
    payload.selectionStages
  );
  if (selectionScheduleMessage) return selectionScheduleMessage;
  return "";
};

const getStatusFilter = (value) => {
  const safe = cleanText(value).toLowerCase();
  if (["open", "scheduled", "expired", "inactive"].includes(safe)) return safe;
  return "";
};

export const createLamaran = async (req, res) => {
  if (!canManageLamaran(req)) {
    return res.status(403).json({
      msg: "Hanya pengawas atau superadmin yang dapat menambahkan lamaran.",
    });
  }

  try {
    const payload = buildCreatePayload(req.body, req, {
      defaultIsActive: false,
    });
    const validationMessage = validateCreatePayload(payload);
    if (validationMessage) {
      return res.status(400).json({ msg: validationMessage });
    }

    const duplicateByTitle = await Lamaran.findOne({
      where: sqlWhere(
        fn("LOWER", col("title")),
        payload.title.toLowerCase()
      ),
    });

    if (duplicateByTitle) {
      return res.status(400).json({
        msg: "Judul posisi sudah ada. Gunakan judul yang berbeda.",
      });
    }

    const created = await Lamaran.create({
      title: payload.title,
      department: payload.tenagaAhli,
      location: payload.location,
      type: payload.type,
      description: payload.deskripsiLamaran,
      summary: payload.ruangLingkupPekerjaan,
      requirementsJson: JSON.stringify(payload.kualifikasi),
      qualificationsJson: JSON.stringify(payload.kompetensi),
      pendidikanJson: JSON.stringify(payload.pendidikan),
      pengalamanJson: JSON.stringify(payload.pengalaman),
      karakterDibutuhkanJson: JSON.stringify(payload.karakterDibutuhkan),
      requiredDocumentsJson: JSON.stringify(payload.requiredDocuments),
      selectionFlow: payload.selectionFlow,
      selectionStagesJson: JSON.stringify(payload.selectionStages),
      biodataCriteriaJson: JSON.stringify(payload.biodataCriteria || {}),
      isActive: payload.isActive,
      openDate: payload.openDate,
      closeDate: payload.closeDate,
      createdBy: payload.createdBy,
      createdByRole: payload.createdByRole,
    });

    return res.status(201).json({
      msg: "Lamaran berhasil ditambahkan.",
      lamaran: toPublicLamaran(created),
    });
  } catch {
    return res.status(500).json({ msg: "Gagal menambahkan lamaran." });
  }
};

export const getLamaranList = async (req, res) => {
  try {
    const role = normalizeRole(req.role);
    const search = cleanText(req.query?.search).toLowerCase();
    const statusFilter = getStatusFilter(req.query?.status);
    const titleFilter = cleanText(req.query?.title).toLowerCase();
    const now = new Date();

    const where = {};
    if (titleFilter) {
      where.title = {
        [Op.like]: `%${titleFilter}%`,
      };
    }

    const rawLamaranList = await Lamaran.findAll({
      where,
      order: [
        ["updatedAt", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    let lamaranList = rawLamaranList.map((item) => toPublicLamaran(item));

    if (search) {
      lamaranList = lamaranList.filter((item) =>
        [item.title, item.department, item.location, item.type]
          .map((text) => cleanText(text).toLowerCase())
          .some((text) => text.includes(search))
      );
    }

    if (role === "peserta") {
      lamaranList = lamaranList.filter((item) => {
        const status = resolveLamaranStatus(item, now);
        return status === "open";
      });
    } else if (statusFilter) {
      lamaranList = lamaranList.filter((item) => {
        const status = resolveLamaranStatus(item, now);
        return status === statusFilter;
      });
    }

    return res.json({
      total: lamaranList.length,
      lamaran: lamaranList,
    });
  } catch {
    return res.status(500).json({ msg: "Gagal mengambil data lamaran." });
  }
};

export const getMyLamaranApplications = async (req, res) => {
  try {
    const userUUID = cleanText(req.userUUID);
    if (!userUUID) {
      return res.status(401).json({ msg: "Please login to your account!" });
    }

    const applications = await LamaranApplication.findAll({
      where: { userUUID },
      order: [
        ["appliedAt", "DESC"],
        ["updatedAt", "DESC"],
      ],
    });

    const { lamaranMap, orphanLamaranUUIDs } =
      await getLamaranMapForApplications(applications);
    if (orphanLamaranUUIDs.length > 0) {
      await LamaranApplication.destroy({
        where: {
          userUUID,
          lamaranUUID: {
            [Op.in]: orphanLamaranUUIDs,
          },
        },
      });
    }

    const publicApplications = applications
      .filter((application) => lamaranMap.has(cleanText(application.lamaranUUID)))
      .map((application) =>
        toPublicApplicationWithLamaran(
          application,
          lamaranMap.get(cleanText(application.lamaranUUID))
        )
      );

    return res.json({
      total: publicApplications.length,
      applications: publicApplications,
    });
  } catch (error) {
    console.error("GET MY LAMARAN APPLICATIONS ERROR:", error);
    return res.status(500).json({ msg: "Gagal mengambil data lamaran peserta." });
  }
};

export const getLamaranApplications = async (req, res) => {
  if (!canManageLamaran(req)) {
    return res.status(403).json({
      msg: "Hanya pengawas atau superadmin yang dapat melihat data peserta lamaran.",
    });
  }

  try {
    const applications = await LamaranApplication.findAll({
      order: [
        ["appliedAt", "DESC"],
        ["updatedAt", "DESC"],
      ],
    });
    const { lamaranMap, orphanLamaranUUIDs } =
      await getLamaranMapForApplications(applications);

    if (orphanLamaranUUIDs.length > 0) {
      await LamaranApplication.destroy({
        where: {
          lamaranUUID: {
            [Op.in]: orphanLamaranUUIDs,
          },
        },
      });
    }

    const publicApplications = applications
      .filter((application) => lamaranMap.has(cleanText(application.lamaranUUID)))
      .map((application) =>
        toPublicApplicationWithLamaran(
          application,
          lamaranMap.get(cleanText(application.lamaranUUID))
        )
      );

    return res.json({
      total: publicApplications.length,
      applications: publicApplications,
      cleanedOrphanApplications: orphanLamaranUUIDs.length,
    });
  } catch (error) {
    console.error("GET LAMARAN APPLICATIONS ERROR:", error);
    return res.status(500).json({ msg: "Gagal mengambil data peserta lamaran." });
  }
};

export const getLamaranByUUID = async (req, res) => {
  try {
    const lamaranUUID = cleanText(req.params?.lamaranUUID);
    if (!lamaranUUID) {
      return res.status(400).json({ msg: "Lamaran UUID tidak valid." });
    }

    const item = await Lamaran.findByPk(lamaranUUID);
    if (!item) {
      return res.status(404).json({ msg: "Lamaran tidak ditemukan." });
    }

    const publicItem = toPublicLamaran(item);
    const role = normalizeRole(req.role);
    if (role === "peserta" && resolveLamaranStatus(publicItem) !== "open") {
      return res.status(403).json({
        msg: "Lamaran ini tidak tersedia untuk peserta saat ini.",
      });
    }

    return res.json({ lamaran: publicItem });
  } catch {
    return res.status(500).json({ msg: "Gagal mengambil detail lamaran." });
  }
};

export const applyLamaran = async (req, res) => {
  const role = normalizeRole(req.role);
  if (role !== "peserta") {
    return res.status(403).json({
      msg: "Hanya peserta yang dapat melamar posisi ini.",
    });
  }

  try {
    const lamaranUUID = cleanText(req.params?.lamaranUUID);
    if (!lamaranUUID) {
      return res.status(400).json({ msg: "Lamaran UUID tidak valid." });
    }

    const lamaran = await Lamaran.findByPk(lamaranUUID);
    if (!lamaran) {
      return res.status(404).json({ msg: "Lamaran tidak ditemukan." });
    }

    const publicLamaran = toPublicLamaran(lamaran);
    if (resolveLamaranStatus(publicLamaran) !== "open") {
      return res.status(403).json({
        msg: "Lamaran ini tidak tersedia untuk peserta saat ini.",
      });
    }

    const user = await Users.findByPk(req.userUUID);
    if (!user) {
      return res.status(404).json({ msg: "Data peserta tidak ditemukan." });
    }

    const missingProfileFields = getUserMissingProfileFields(user, {
      role: "peserta",
    });
    if (missingProfileFields.length > 0) {
      return res.status(403).json({
        msg: "Profile Belum Lengkap, Tidak bisa melamar.",
        errors: missingProfileFields.map(
          (field) => `${field.label} wajib diisi pada profile peserta.`
        ),
        missingProfileFields,
      });
    }

    const applicantEmail = cleanText(user.email).toLowerCase();
    if (!isValidEmailFormat(applicantEmail)) {
      return res.status(400).json({
        msg: "Email peserta belum valid. Lengkapi email profil sebelum melamar.",
      });
    }

    const minimumCriteriaFailureMessages = getMinimumCriteriaFailureMessages(
      publicLamaran,
      user
    );
    if (minimumCriteriaFailureMessages.length > 0) {
      return res.status(403).json({
        msg: minimumCriteriaFailureMessages.join(" "),
        errors: minimumCriteriaFailureMessages,
      });
    }

    let application = await LamaranApplication.findOne({
      where: {
        lamaranUUID,
        userUUID: user.userUUID,
      },
    });
    const alreadyApplied = Boolean(application);
    const applicantName =
      cleanText(user.fullName) || cleanText(user.username) || "Peserta";

    if (application) {
      await application.update({
        lamaranTitle: publicLamaran.title,
        tenagaAhli: publicLamaran.tenagaAhli,
        applicantName,
        applicantUsername: user.username,
        applicantEmail,
        verificationEmailStatus: "pending",
        verificationEmailError: null,
      });
    } else {
      application = await LamaranApplication.create({
        lamaranUUID,
        userUUID: user.userUUID,
        verificationId: await createUniqueVerificationId(),
        lamaranTitle: publicLamaran.title,
        tenagaAhli: publicLamaran.tenagaAhli,
        applicantName,
        applicantUsername: user.username,
        applicantEmail,
        status: APPLICATION_SUCCESS_STATUS,
        stage: APPLICATION_STAGE,
        appliedAt: new Date(),
        verificationEmailStatus: "pending",
      });
    }

    try {
      await sendApplicationVerificationEmail({
        application,
        lamaran,
        user,
      });
    } catch (emailError) {
      await application.update({
        verificationEmailStatus: "failed",
        verificationEmailError: cleanText(emailError?.message),
      });

      return res.status(500).json({
        msg: "Lamaran tersimpan, tetapi email verifikasi gagal dikirim.",
        application: toPublicApplication(application),
        emailSent: false,
      });
    }

    return res.status(alreadyApplied ? 200 : 201).json({
      msg: alreadyApplied
        ? "Anda sudah melamar posisi ini. ID verifikasi dikirim ulang ke email."
        : "Lamaran berhasil dikirim. ID verifikasi telah dikirim ke email.",
      application: toPublicApplication(application),
      emailSent: true,
      alreadyApplied,
    });
  } catch (error) {
    console.error("APPLY LAMARAN ERROR:", error);
    return res.status(500).json({ msg: "Gagal memproses lamaran." });
  }
};

export const updateLamaranStatus = async (req, res) => {
  if (!canManageLamaran(req)) {
    return res.status(403).json({
      msg: "Hanya pengawas atau superadmin yang dapat mengubah status lamaran.",
    });
  }

  try {
    const lamaranUUID = cleanText(req.params?.lamaranUUID);
    if (!lamaranUUID) {
      return res.status(400).json({ msg: "Lamaran UUID tidak valid." });
    }

    const item = await Lamaran.findByPk(lamaranUUID);
    if (!item) {
      return res.status(404).json({ msg: "Lamaran tidak ditemukan." });
    }

    const hasIsActiveKey = Object.prototype.hasOwnProperty.call(
      req.body || {},
      "isActive"
    );
    if (!hasIsActiveKey) {
      return res.status(400).json({ msg: "Field isActive wajib diisi." });
    }

    const isActive = normalizeBoolean(req.body?.isActive, Boolean(item.isActive));
    await item.update({ isActive });

    return res.json({
      msg: "Status lamaran berhasil diperbarui.",
      lamaran: toPublicLamaran(item),
    });
  } catch {
    return res.status(500).json({ msg: "Gagal memperbarui status lamaran." });
  }
};

export const deleteLamaranApplication = async (req, res) => {
  try {
    const applicationUUID = cleanText(req.params?.applicationUUID);
    if (!applicationUUID) {
      return res.status(400).json({ msg: "Application UUID tidak valid." });
    }

    const application = await LamaranApplication.findByPk(applicationUUID);
    if (!application) {
      return res.status(404).json({ msg: "Data peserta lamaran tidak ditemukan." });
    }

    const role = normalizeRole(req.role);
    const isOwner = cleanText(application.userUUID) === cleanText(req.userUUID);
    if (!canManageLamaran(req) && !(role === "peserta" && isOwner)) {
      return res.status(403).json({
        msg: "Anda tidak memiliki akses untuk menghapus data peserta lamaran ini.",
      });
    }

    const deleted = toPublicApplication(application);
    await application.destroy();

    return res.json({
      msg: "Data peserta lamaran berhasil dihapus.",
      application: deleted,
    });
  } catch (error) {
    console.error("DELETE LAMARAN APPLICATION ERROR:", error);
    return res.status(500).json({ msg: "Gagal menghapus data peserta lamaran." });
  }
};

export const updateLamaran = async (req, res) => {
  if (!canManageLamaran(req)) {
    return res.status(403).json({
      msg: "Hanya pengawas atau superadmin yang dapat mengedit lamaran.",
    });
  }

  try {
    const lamaranUUID = cleanText(req.params?.lamaranUUID);
    if (!lamaranUUID) {
      return res.status(400).json({ msg: "Lamaran UUID tidak valid." });
    }

    const item = await Lamaran.findByPk(lamaranUUID);
    if (!item) {
      return res.status(404).json({ msg: "Lamaran tidak ditemukan." });
    }

    const payload = buildCreatePayload(req.body, req, {
      defaultIsActive: Boolean(item.isActive),
    });
    const validationMessage = validateCreatePayload(payload);
    if (validationMessage) {
      return res.status(400).json({ msg: validationMessage });
    }

    const duplicateByTitle = await Lamaran.findOne({
      where: {
        lamaranUUID: {
          [Op.ne]: lamaranUUID,
        },
        [Op.and]: sqlWhere(
          fn("LOWER", col("title")),
          payload.title.toLowerCase()
        ),
      },
    });

    if (duplicateByTitle) {
      return res.status(400).json({
        msg: "Judul posisi sudah ada. Gunakan judul yang berbeda.",
      });
    }

    await item.update({
      title: payload.title,
      department: payload.tenagaAhli,
      location: payload.location,
      type: payload.type,
      description: payload.deskripsiLamaran,
      summary: payload.ruangLingkupPekerjaan,
      requirementsJson: JSON.stringify(payload.kualifikasi),
      qualificationsJson: JSON.stringify(payload.kompetensi),
      pendidikanJson: JSON.stringify(payload.pendidikan),
      pengalamanJson: JSON.stringify(payload.pengalaman),
      karakterDibutuhkanJson: JSON.stringify(payload.karakterDibutuhkan),
      requiredDocumentsJson: JSON.stringify(payload.requiredDocuments),
      selectionFlow: payload.selectionFlow,
      selectionStagesJson: JSON.stringify(payload.selectionStages),
      biodataCriteriaJson: JSON.stringify(payload.biodataCriteria || {}),
      isActive: payload.isActive,
      openDate: payload.openDate,
      closeDate: payload.closeDate,
    });

    return res.json({
      msg: "Lamaran berhasil diperbarui.",
      lamaran: toPublicLamaran(item),
    });
  } catch {
    return res.status(500).json({ msg: "Gagal memperbarui lamaran." });
  }
};

export const deleteLamaran = async (req, res) => {
  if (!canManageLamaran(req)) {
    return res.status(403).json({
      msg: "Hanya pengawas atau superadmin yang dapat menghapus lamaran.",
    });
  }

  try {
    const lamaranUUID = cleanText(req.params?.lamaranUUID);
    if (!lamaranUUID) {
      return res.status(400).json({ msg: "Lamaran UUID tidak valid." });
    }

    const item = await Lamaran.findByPk(lamaranUUID);
    if (!item) {
      return res.status(404).json({ msg: "Lamaran tidak ditemukan." });
    }

    const deleted = toPublicLamaran(item);
    const transaction = await Lamaran.sequelize.transaction();
    let deletedApplicationsCount = 0;

    try {
      deletedApplicationsCount = await LamaranApplication.destroy({
        where: { lamaranUUID },
        transaction,
      });
      await item.destroy({ transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    return res.json({
      msg:
        deletedApplicationsCount > 0
          ? `Lamaran berhasil dihapus. ${deletedApplicationsCount} data peserta terdaftar ikut dihapus.`
          : "Lamaran berhasil dihapus.",
      lamaran: deleted,
      deletedApplicationsCount,
    });
  } catch (error) {
    console.error("DELETE LAMARAN ERROR:", error);
    return res.status(500).json({ msg: "Gagal menghapus lamaran." });
  }
};

import { getDashboardUser } from "./authUser";
import {
  getLamaranApplicationsApi,
  getMyLamaranApplicationsApi,
} from "./authApi";
import { getMasterVacancies } from "./masterVacancies";
import {
  PROFILE_LAYER_FIELDS,
  getApplicantProfileFieldValue,
  getProfileFieldLabel,
  isApplicantProfileFieldValueMatched,
  isApplicantProfileFieldFilled,
  normalizeFieldValueRules,
  normalizeRequiredProfileFields,
} from "./profileCriteria";

export const BPR_HIRE_APPLICATIONS_STORAGE_KEY = "bpr-hire-applications";
export const APPLICATION_SUCCESS_STATUS = "Berhasil Mendaftar";
export const APPLICATION_REVIEW_STATUS = "Sedang Diverifikasi";
export const APPLICATION_ADMIN_FAIL_STATUS = "Tidak Lolos Administrasi";
const BPR_HIRE_PROFILE_STORAGE_KEY = "bpr-hire-profile-data";
const DEFAULT_APPLICATION_BRANCH = "PT. BPR NTB (Perseroda)";
const ADMINISTRATION_STAGE = {
  id: "administrasi",
  title: "Seleksi Administrasi",
  description: "Verifikasi kelengkapan dokumen dan kesesuaian data peserta.",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
};
const FIXED_REQUIRED_LAYER_IDS = new Set(["biodata", "berkas"]);
const FIXED_REQUIRED_PROFILE_FIELDS = [
  ...PROFILE_LAYER_FIELDS
    .filter((layer) => FIXED_REQUIRED_LAYER_IDS.has(layer.id))
    .flatMap((layer) => layer.fields.map((field) => cleanText(field.key)))
    .filter(Boolean),
  "workExperience",
];

export function createApplicationId(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeDateText(value) {
  const text = cleanText(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTimeText(value) {
  const text = cleanText(value);
  if (!text) return "";

  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeStageKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeStageId(value, fallback) {
  return (
    cleanText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || fallback
  );
}

function isAdministrationStage(stage = {}) {
  const normalizedTitle = normalizeStageKey(stage?.title || stage?.label || stage);
  return (
    normalizedTitle === "administrasi" ||
    normalizedTitle === "seleksiadministrasi" ||
    normalizedTitle === "tahapadministrasi"
  );
}

function normalizeStageDefinition(stage, index = 0) {
  const title = cleanText(stage?.title || stage?.label);
  if (!title) return null;

  return {
    id: cleanText(stage?.id) || normalizeStageId(title, `tahap-${index + 1}`),
    title,
    label: title,
    description:
      cleanText(stage?.description || stage?.detail || stage?.agenda) ||
      (isAdministrationStage(stage)
        ? ADMINISTRATION_STAGE.description
        : "Tahap lanjutan proses seleksi."),
    startDate: normalizeDateText(stage?.startDate ?? stage?.dateStart ?? stage?.date),
    endDate: normalizeDateText(stage?.endDate ?? stage?.dateEnd ?? stage?.date),
    startTime: normalizeTimeText(stage?.startTime ?? stage?.timeStart),
    endTime: normalizeTimeText(stage?.endTime ?? stage?.timeEnd),
    location:
      cleanText(stage?.location) ||
      (isAdministrationStage(stage) ? "Portal BPR HIRE" : ""),
    duration: cleanText(stage?.duration),
  };
}

function normalizeApplicationSelectionStages(stages = []) {
  return (Array.isArray(stages) ? stages : [])
    .map((stage, index) => normalizeStageDefinition(stage, index + 1))
    .filter((stage) => stage && !isAdministrationStage(stage));
}

export function getApplicationStageDefinitions(application = {}) {
  const rawDefinitions = Array.isArray(application?.stageDefinitions)
    ? application.stageDefinitions
    : [];
  const normalizedDefinitions = rawDefinitions
    .map((stage, index) => normalizeStageDefinition(stage, index))
    .filter(Boolean);

  if (normalizedDefinitions.length > 0) {
    const hasAdministrationStage = normalizedDefinitions.some((stage) =>
      isAdministrationStage(stage)
    );
    return hasAdministrationStage
      ? normalizedDefinitions
      : [ADMINISTRATION_STAGE, ...normalizedDefinitions];
  }

  return [
    ADMINISTRATION_STAGE,
    ...normalizeApplicationSelectionStages(application?.selectionStages),
  ];
}

export function resolveApplicationStageIndex(application = {}, stageDefinitions) {
  const stages = Array.isArray(stageDefinitions) && stageDefinitions.length > 0
    ? stageDefinitions
    : getApplicationStageDefinitions(application);
  const currentStage = normalizeStageKey(application?.stage);
  const matchedIndex = stages.findIndex((stage) => {
    const stageKey = normalizeStageKey(stage?.title || stage?.label);
    return (
      currentStage &&
      stageKey &&
      (currentStage === stageKey ||
        currentStage.includes(stageKey) ||
        stageKey.includes(currentStage))
    );
  });

  if (matchedIndex >= 0) return matchedIndex;
  return 0;
}

export function resolveApplicationProgress(application = {}, stageDefinitions) {
  const explicitProgress = Number(application?.progress);
  if (Number.isFinite(explicitProgress)) {
    return Math.max(0, Math.min(100, Math.round(explicitProgress)));
  }

  const normalizedStatus = cleanText(application?.status).toLowerCase();
  if (normalizedStatus.includes("diterima") || normalizedStatus.includes("lolos tahap akhir")) {
    return 100;
  }
  if (normalizedStatus.includes("ditolak") || normalizedStatus.includes("tidak lolos")) {
    return 0;
  }

  const stages = Array.isArray(stageDefinitions) && stageDefinitions.length > 0
    ? stageDefinitions
    : getApplicationStageDefinitions(application);
  const activeIndex = resolveApplicationStageIndex(application, stages);

  if (stages.length <= 1) return 20;
  return Math.min(
    99,
    Math.max(10, Math.round(((activeIndex + 1) / stages.length) * 100))
  );
}

export function normalizeDashboardApplication(application = {}, index = 0) {
  const lamaran = application?.lamaran && typeof application.lamaran === "object"
    ? application.lamaran
    : {};
  const applicationUUID = cleanText(application?.applicationUUID);
  const vacancyId = cleanText(
    application?.vacancyId || application?.lamaranUUID || lamaran?.lamaranUUID || lamaran?.id
  );
  const role =
    cleanText(application?.role) ||
    cleanText(application?.lamaranTitle) ||
    cleanText(application?.title) ||
    cleanText(lamaran?.title) ||
    "Lamaran";
  const status = cleanText(application?.status) || APPLICATION_SUCCESS_STATUS;
  const stage = cleanText(application?.stage) || "Seleksi Administrasi";
  const selectionStages = normalizeApplicationSelectionStages(
    application?.selectionStages || lamaran?.selectionStages
  );
  const stageDefinitions = getApplicationStageDefinitions({
    ...application,
    selectionStages,
  });
  const applicant = application?.applicant && typeof application.applicant === "object"
    ? application.applicant
    : {};
  const candidate =
    cleanText(application?.candidate) ||
    cleanText(application?.applicantName) ||
    cleanText(applicant?.fullName) ||
    "Peserta";
  const candidateUsername =
    cleanText(application?.candidateUsername) ||
    cleanText(application?.applicantUsername) ||
    cleanText(applicant?.username) ||
    "peserta";

  return {
    ...application,
    id:
      cleanText(application?.id) ||
      applicationUUID ||
      vacancyId ||
      createApplicationId(role) ||
      `application-${index + 1}`,
    applicationUUID,
    vacancyId,
    lamaranUUID: vacancyId,
    role,
    title: role,
    branch:
      cleanText(application?.branch) ||
      cleanText(application?.location) ||
      cleanText(lamaran?.location) ||
      DEFAULT_APPLICATION_BRANCH,
    progress: resolveApplicationProgress(
      {
        ...application,
        status,
        stage,
        progress: application?.progress,
      },
      stageDefinitions
    ),
    status,
    stage,
    tone: application?.tone || "green",
    selectionFlow:
      application?.selectionFlow === "langsung" || lamaran?.selectionFlow === "langsung"
        ? "langsung"
        : "berurutan",
    selectionStages,
    stageDefinitions,
    appliedAt: cleanText(application?.appliedAt) || "",
    verificationId: cleanText(application?.verificationId),
    candidate,
    candidateUsername,
    applicant: {
      ...applicant,
      fullName: candidate,
      username: candidateUsername,
    },
  };
}

function makeNumericSeed(value) {
  return cleanText(value)
    .split("")
    .reduce((total, char, index) => total + char.charCodeAt(0) * (index + 1), 0);
}

function getProfileSnapshot() {
  if (typeof window === "undefined") return {};

  try {
    const profile = JSON.parse(window.localStorage.getItem(BPR_HIRE_PROFILE_STORAGE_KEY));
    return profile && typeof profile === "object" ? profile : {};
  } catch {
    return {};
  }
}

function buildVerificationId(username, seedValue = Date.now()) {
  const normalizedUsername = cleanText(username)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const prefix = (normalizedUsername || "peserta").slice(0, 3).toUpperCase().padEnd(3, "X");
  const numericSeed = Number(seedValue);
  const normalizedSeed = Number.isFinite(numericSeed)
    ? numericSeed
    : makeNumericSeed(String(seedValue));
  const suffix = String(Math.abs(normalizedSeed)).slice(-4).padStart(4, "0");
  return `VRF-${prefix}-${suffix}`;
}

function buildApplicantSnapshot() {
  const currentUser = getDashboardUser();
  const profile = getProfileSnapshot();
  const fullName = cleanText(profile.fullName) || cleanText(currentUser.userName) || "Peserta";
  const username = cleanText(currentUser.loginIdentity) || fullName.toLowerCase().replace(/\s+/g, ".");

  return {
    fullName,
    username,
    nik: cleanText(profile.nik),
    birthPlace: cleanText(profile.birthPlace),
    birthDate: cleanText(profile.birthDate),
    gender: cleanText(profile.gender),
    email: cleanText(profile.email),
    phone: cleanText(profile.phone),
    address: cleanText(profile.address),
    lastEducation: cleanText(profile.lastEducation),
    major: cleanText(profile.major),
    institution: cleanText(profile.institution),
    graduationYear: cleanText(profile.graduationYear),
    gpa: cleanText(profile.gpa),
    mainSkill: cleanText(profile.mainSkill),
    computerSkill: cleanText(profile.computerSkill),
    computerSkillLevel: cleanText(profile.computerSkillLevel),
    languageSkill: cleanText(profile.languageSkill),
    workExperience: cleanText(profile.workExperience),
    documentReady: Boolean(profile.documentReady),
    cvFileName: cleanText(profile.cvFileName),
    certificateFileName: cleanText(profile.certificateFileName),
    experienceLetterFileName: cleanText(profile.experienceLetterFileName),
    ktpFileName: cleanText(profile.ktpFileName),
    ijazahFileName: cleanText(profile.ijazahFileName),
  };
}

function normalizeEducation(value) {
  return cleanText(value).toUpperCase().replace(/\s+/g, "");
}

function getEducationRank(value) {
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
}

function getEducationDisplay(value) {
  return cleanText(value).toUpperCase() || "-";
}

export function getApplicantMinimumCriteriaEligibility(job, applicantOverride = null) {
  const matchedVacancy = getMatchedVacancy(job);
  const vacancy = matchedVacancy || job || {};
  const criteria = vacancy?.biodataCriteria;

  if (!criteria || !criteria.isEnabled) {
    return {
      isChecked: false,
      isEligible: true,
      messages: [],
      message: "",
    };
  }

  const applicant =
    applicantOverride && typeof applicantOverride === "object"
      ? applicantOverride
      : buildApplicantSnapshot();
  const failedMessages = [];
  let isChecked = false;

  const minimumEducation = getEducationDisplay(criteria.minimumEducation);
  const minimumEducationRank = getEducationRank(minimumEducation);
  if (minimumEducationRank > 0) {
    isChecked = true;
    const applicantEducation = getEducationDisplay(applicant.lastEducation);
    const applicantEducationRank = getEducationRank(applicantEducation);

    if (applicantEducationRank < minimumEducationRank) {
      failedMessages.push(
        `Pendidikan minimal untuk lamaran ini adalah ${minimumEducation}. Pendidikan Anda saat ini ${applicantEducation}.`
      );
    }
  }

  const minimumGraduationYear = parseYear(criteria.minimumGraduationYear);
  if (minimumGraduationYear > 0) {
    isChecked = true;
    const applicantGraduationYear = parseYear(applicant.graduationYear);

    if (applicantGraduationYear < minimumGraduationYear) {
      failedMessages.push(
        `Tahun lulus minimal untuk lamaran ini adalah ${minimumGraduationYear}. Tahun lulus Anda saat ini ${applicantGraduationYear || "-"}.`
      );
    }
  }

  const minimumGpa = Number(criteria.minimumGpa || 0);
  if (minimumGpa > 0) {
    isChecked = true;
    const applicantGpa = parseGpa(applicant.gpa);
    const applicantGpaLabel = cleanText(applicant.gpa)
      ? applicantGpa.toFixed(2)
      : "-";

    if (applicantGpa < minimumGpa) {
      failedMessages.push(
        `IPK minimal untuk lamaran ini adalah ${minimumGpa.toFixed(2)}. IPK Anda saat ini ${applicantGpaLabel}.`
      );
    }
  }

  const fieldValueRules = normalizeFieldValueRules(criteria.fieldValueRules);
  Object.entries(fieldValueRules).forEach(([fieldKey, allowedValues]) => {
    if (!Array.isArray(allowedValues) || allowedValues.length === 0) return;
    isChecked = true;

    if (!isApplicantProfileFieldValueMatched(applicant, fieldKey, allowedValues)) {
      const applicantValue = getApplicantProfileFieldValue(applicant, fieldKey);
      failedMessages.push(
        `${getProfileFieldLabel(fieldKey)} harus sesuai salah satu kriteria: ${allowedValues.join(", ")}${applicantValue ? ` (data Anda: ${applicantValue})` : " (data Anda belum diisi)"}.`
      );
    }
  });

  if (!isChecked) {
    return {
      isChecked: false,
      isEligible: true,
      messages: [],
      message: "",
    };
  }

  return {
    isChecked: true,
    isEligible: failedMessages.length === 0,
    minimumEducation,
    messages: failedMessages,
    message: failedMessages.join(" "),
  };
}

export const getApplicantMinimumEducationEligibility =
  getApplicantMinimumCriteriaEligibility;

function parseGpa(value) {
  const parsedValue = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function parseYear(value) {
  const parsedValue = Number.parseInt(String(value || "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function includesAnyKeyword(text, keywords) {
  const source = cleanText(text).toLowerCase();
  if (!source) return false;

  const safeKeywords = Array.isArray(keywords)
    ? keywords.map((keyword) => cleanText(keyword).toLowerCase()).filter(Boolean)
    : [];

  if (safeKeywords.length === 0) return true;
  return safeKeywords.some((keyword) => source.includes(keyword));
}

function toGenderText(value) {
  const normalized = cleanText(value).toLowerCase();
  if (normalized.includes("laki")) return "Laki-laki";
  if (normalized.includes("perempuan")) return "Perempuan";
  return "";
}

function getMatchedVacancy(job) {
  const vacancies = getMasterVacancies();
  const vacancyId = cleanText(job?.id || job?.vacancyId);
  const title = cleanText(job?.title).toLowerCase();

  if (vacancyId) {
    const byId = vacancies.find((vacancy) => cleanText(vacancy.id) === vacancyId);
    if (byId) return byId;
  }

  if (!title) return null;
  return (
    vacancies.find(
      (vacancy) => cleanText(vacancy.title).toLowerCase() === title
    ) || null
  );
}

function evaluateApplicantBiodata(applicant, criteria) {
  const safeCriteria = criteria && typeof criteria === "object" ? criteria : {};
  const isEnabled = Boolean(safeCriteria.isEnabled);
  if (!isEnabled) {
    return {
      isEnabled: false,
      isQualified: true,
      failedReasons: [],
    };
  }

  const failedReasons = [];
  const minimumEducation = normalizeEducation(safeCriteria.minimumEducation);
  const minimumEducationRank = getEducationRank(minimumEducation);
  const applicantEducation = normalizeEducation(applicant?.lastEducation);
  const applicantEducationRank = getEducationRank(applicantEducation);

  if (minimumEducationRank > 0 && applicantEducationRank < minimumEducationRank) {
    failedReasons.push(
      `Pendidikan minimal ${minimumEducation || "-"}, tetapi peserta ${applicantEducation || "-"}`
    );
  }

  const minimumGpa = Number(safeCriteria.minimumGpa || 0);
  const applicantGpa = parseGpa(applicant?.gpa);
  if (minimumGpa > 0 && applicantGpa < minimumGpa) {
    failedReasons.push(
      `IPK minimal ${minimumGpa.toFixed(2)}, tetapi peserta ${applicantGpa.toFixed(2)}`
    );
  }

  const minimumGraduationYear = parseYear(safeCriteria.minimumGraduationYear);
  const applicantGraduationYear = parseYear(applicant?.graduationYear);
  if (minimumGraduationYear > 0 && applicantGraduationYear < minimumGraduationYear) {
    failedReasons.push(
      `Tahun lulus minimal ${minimumGraduationYear}, tetapi peserta ${applicantGraduationYear || "-"}`
    );
  }

  const allowedGenders = Array.isArray(safeCriteria.allowedGenders)
    ? safeCriteria.allowedGenders.map((item) => toGenderText(item)).filter(Boolean)
    : [];
  const applicantGender = toGenderText(applicant?.gender);
  if (allowedGenders.length > 0 && !allowedGenders.includes(applicantGender)) {
    failedReasons.push(
      `Jenis kelamin yang diperbolehkan: ${allowedGenders.join(" / ")}`
    );
  }

  const majorKeywords = Array.isArray(safeCriteria.majorKeywords)
    ? safeCriteria.majorKeywords
    : [];
  if (majorKeywords.length > 0 && !includesAnyKeyword(applicant?.major, majorKeywords)) {
    failedReasons.push(
      `Jurusan harus memuat salah satu kata kunci: ${majorKeywords.join(", ")}`
    );
  }

  const requiredProfileFields = normalizeRequiredProfileFields([
    ...FIXED_REQUIRED_PROFILE_FIELDS,
    ...normalizeRequiredProfileFields(safeCriteria.requiredProfileFields),
  ]);
  requiredProfileFields.forEach((fieldKey) => {
    if (fieldKey === "documentReady" && safeCriteria.requireDocumentReady) {
      return;
    }

    if (!isApplicantProfileFieldFilled(applicant, fieldKey)) {
      failedReasons.push(
        `${getProfileFieldLabel(fieldKey)} wajib diisi pada profil peserta`
      );
    }
  });

  if (safeCriteria.requireDocumentReady && !applicant?.documentReady) {
    failedReasons.push("Berkas wajib lengkap dan siap diverifikasi");
  }

  const fieldValueRules = normalizeFieldValueRules(safeCriteria.fieldValueRules);
  Object.entries(fieldValueRules).forEach(([fieldKey, allowedValues]) => {
    if (!Array.isArray(allowedValues) || allowedValues.length === 0) return;

    if (!isApplicantProfileFieldValueMatched(applicant, fieldKey, allowedValues)) {
      const applicantValue = getApplicantProfileFieldValue(applicant, fieldKey);
      failedReasons.push(
        `${getProfileFieldLabel(fieldKey)} tidak sesuai kriteria. Pilihan lolos: ${allowedValues.join(", ")}${applicantValue ? ` (nilai peserta: ${applicantValue})` : ""}`
      );
    }
  });

  return {
    isEnabled: true,
    isQualified: failedReasons.length === 0,
    failedReasons,
  };
}

function isManualFinalStatus(statusText) {
  const normalizedStatus = cleanText(statusText).toLowerCase();
  if (!normalizedStatus) return false;
  return (
    (normalizedStatus.includes("ditolak") &&
      !normalizedStatus.includes("administrasi")) ||
    normalizedStatus.includes("diterima") ||
    normalizedStatus.includes("lolos tahap akhir")
  );
}

function buildAutomaticAdministrationState(application, vacancy, applicant) {
  const criteria = vacancy?.biodataCriteria;
  const evaluation = evaluateApplicantBiodata(applicant, criteria);
  if (!evaluation.isEnabled) {
    return {
      ...application,
      vacancyId: cleanText(vacancy?.id || application?.vacancyId),
      administrationCheck: {
        mode: "manual",
        result: "not-enabled",
        checkedAt: new Date().toISOString(),
        failedReasons: [],
      },
    };
  }

  if (!evaluation.isQualified) {
    return {
      ...application,
      vacancyId: cleanText(vacancy?.id || application?.vacancyId),
      status: APPLICATION_ADMIN_FAIL_STATUS,
      progress: 0,
      stage: "Seleksi Administrasi",
      tone: "red",
      selectionNote: `Tidak lolos administrasi otomatis: ${evaluation.failedReasons.join("; ")}`,
      administrationCheck: {
        mode: "automatic",
        result: "failed",
        checkedAt: new Date().toISOString(),
        failedReasons: evaluation.failedReasons,
      },
    };
  }

  const nextStatus = cleanText(application?.status);
  const normalizedStatus = nextStatus.toLowerCase();
  const shouldMoveToReview =
    !nextStatus ||
    normalizedStatus.includes("berhasil mendaftar") ||
    normalizedStatus.includes("tidak lolos administrasi");

  return {
    ...application,
    vacancyId: cleanText(vacancy?.id || application?.vacancyId),
    status: shouldMoveToReview ? APPLICATION_REVIEW_STATUS : application.status,
    progress: shouldMoveToReview ? Math.max(Number(application?.progress || 0), 20) : application.progress,
    stage: "Seleksi Administrasi",
    tone: shouldMoveToReview ? "green" : application.tone,
    selectionNote: shouldMoveToReview
      ? "Lolos cek administrasi otomatis. Menunggu verifikasi pengawas."
      : application.selectionNote,
    administrationCheck: {
      mode: "automatic",
      result: "passed",
      checkedAt: new Date().toISOString(),
      failedReasons: [],
    },
  };
}

export function getDashboardApplications() {
  if (typeof window === "undefined") return [];

  try {
    const savedApplications = JSON.parse(window.localStorage.getItem(BPR_HIRE_APPLICATIONS_STORAGE_KEY));
    if (!Array.isArray(savedApplications)) return [];

    return savedApplications.map((application, index) => {
      const applicant = application?.applicant && typeof application.applicant === "object"
        ? application.applicant
        : {};
      const candidateName = cleanText(application?.candidate) || cleanText(applicant.fullName) || "Peserta";
      const candidateUsername =
        cleanText(application?.candidateUsername) ||
        cleanText(applicant.username) ||
        "peserta";

      return normalizeDashboardApplication({
        ...application,
        vacancyId: cleanText(application?.vacancyId),
        verificationId:
          cleanText(application?.verificationId) ||
          buildVerificationId(
            candidateUsername,
            makeNumericSeed(`${application?.id || "app"}-${index + 1}`)
          ),
        candidate: candidateName,
        candidateUsername,
        applicant: {
          ...applicant,
          fullName: candidateName,
          username: candidateUsername,
        },
        status: application.status || APPLICATION_SUCCESS_STATUS,
        progress: Number(application.progress ?? 0),
      }, index);
    });
  } catch {
    return [];
  }
}

export async function fetchDashboardApplicationsFromBackend() {
  const response = await getMyLamaranApplicationsApi();
  const rawApplications = Array.isArray(response?.applications)
    ? response.applications
    : Array.isArray(response?.data)
      ? response.data
      : [];

  return rawApplications.map((application, index) =>
    normalizeDashboardApplication(application, index)
  );
}

export async function fetchLamaranApplicationsFromBackend() {
  const response = await getLamaranApplicationsApi();
  const rawApplications = Array.isArray(response?.applications)
    ? response.applications
    : Array.isArray(response?.data)
      ? response.data
      : [];

  return rawApplications.map((application, index) =>
    normalizeDashboardApplication(application, index)
  );
}

export function removeDashboardApplicationByApplicationUUID(applicationUUID) {
  if (typeof window === "undefined") return [];

  const safeApplicationUUID = cleanText(applicationUUID);
  if (!safeApplicationUUID) return getDashboardApplications();

  const remainingApplications = getDashboardApplications().filter(
    (application) =>
      ![
        application.applicationUUID,
        application.id,
        application.verificationId,
      ]
        .map((value) => cleanText(value))
        .filter(Boolean)
        .includes(safeApplicationUUID)
  );

  window.localStorage.setItem(
    BPR_HIRE_APPLICATIONS_STORAGE_KEY,
    JSON.stringify(remainingApplications)
  );

  return remainingApplications;
}

export function removeDashboardApplicationsByVacancy(vacancyId) {
  if (typeof window === "undefined") return [];

  const safeVacancyId = cleanText(vacancyId);
  if (!safeVacancyId) return getDashboardApplications();

  const remainingApplications = getDashboardApplications().filter((application) => {
    const candidateIds = [
      application.id,
      application.vacancyId,
      application.lamaranUUID,
      createApplicationId(application.role || application.title),
    ]
      .map((value) => cleanText(value))
      .filter(Boolean);

    return !candidateIds.includes(safeVacancyId);
  });

  window.localStorage.setItem(
    BPR_HIRE_APPLICATIONS_STORAGE_KEY,
    JSON.stringify(remainingApplications)
  );

  return remainingApplications;
}

export function saveDashboardApplication(job, options = {}) {
  if (typeof window === "undefined") return [];

  const applicant = buildApplicantSnapshot();
  const applicationOptions = options && typeof options === "object" ? options : {};
  const appliedAt = cleanText(applicationOptions.appliedAt) || new Date().toISOString();
  const verificationId =
    cleanText(applicationOptions.verificationId) ||
    buildVerificationId(applicant.username, Date.now());
  const application = {
    id: createApplicationId(job.title),
    vacancyId: cleanText(job.id || job.vacancyId),
    role: job.title,
    branch: "PT. BPR NTB (Perseroda)",
    progress: 10,
    status: cleanText(applicationOptions.status) || APPLICATION_SUCCESS_STATUS,
    stage: cleanText(applicationOptions.stage) || "Seleksi Administrasi",
    tone: job.tone || "green",
    appliedAt,
    verificationId,
    candidate: applicant.fullName,
    candidateUsername: applicant.username,
    applicant,
  };

  const matchedVacancy = getMatchedVacancy(job);
  const stageSource =
    matchedVacancy &&
    Array.isArray(matchedVacancy.selectionStages) &&
    matchedVacancy.selectionStages.length > 0
      ? matchedVacancy
      : job;
  const applicationWithSelectionStages = {
    ...application,
    selectionFlow: cleanText(stageSource?.selectionFlow) || "berurutan",
    selectionStages: Array.isArray(stageSource?.selectionStages)
      ? stageSource.selectionStages
      : [],
  };
  const processedApplication = matchedVacancy
    ? buildAutomaticAdministrationState(
        applicationWithSelectionStages,
        matchedVacancy,
        applicant
      )
    : applicationWithSelectionStages;

  const applications = getDashboardApplications();
  const existingIndex = applications.findIndex((item) => item.id === processedApplication.id);

  const nextApplications =
    existingIndex >= 0
      ? applications.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                ...processedApplication,
                appliedAt: item.appliedAt || processedApplication.appliedAt,
                verificationId: item.verificationId || processedApplication.verificationId,
              }
            : item
        )
      : [processedApplication, ...applications];

  window.localStorage.setItem(BPR_HIRE_APPLICATIONS_STORAGE_KEY, JSON.stringify(nextApplications));
  return nextApplications;
}

export function reevaluateApplicationsByVacancy(vacancyId) {
  const safeVacancyId = cleanText(vacancyId);
  if (!safeVacancyId || typeof window === "undefined") {
    return {
      totalChecked: 0,
      autoFailed: 0,
      movedToReview: 0,
      unchanged: 0,
      applications: getDashboardApplications(),
    };
  }

  const vacancies = getMasterVacancies();
  const matchedVacancy = vacancies.find((vacancy) => cleanText(vacancy.id) === safeVacancyId);
  if (!matchedVacancy) {
    return {
      totalChecked: 0,
      autoFailed: 0,
      movedToReview: 0,
      unchanged: 0,
      applications: getDashboardApplications(),
    };
  }

  const currentApplications = getDashboardApplications();
  let totalChecked = 0;
  let autoFailed = 0;
  let movedToReview = 0;
  let unchanged = 0;

  const nextApplications = currentApplications.map((application) => {
    const sameVacancy =
      cleanText(application?.vacancyId) === safeVacancyId ||
      cleanText(application?.role).toLowerCase() ===
        cleanText(matchedVacancy?.title).toLowerCase();

    if (!sameVacancy) return application;
    if (isManualFinalStatus(application?.status)) {
      unchanged += 1;
      return application;
    }

    totalChecked += 1;
    const nextApplication = buildAutomaticAdministrationState(
      application,
      matchedVacancy,
      application?.applicant || {}
    );

    const previousStatus = cleanText(application?.status).toLowerCase();
    const nextStatus = cleanText(nextApplication?.status).toLowerCase();
    if (nextStatus.includes("tidak lolos administrasi")) {
      autoFailed += 1;
    } else if (
      nextStatus.includes("sedang diverifikasi") &&
      previousStatus.includes("tidak lolos administrasi")
    ) {
      movedToReview += 1;
    } else {
      unchanged += 1;
    }

    return nextApplication;
  });

  window.localStorage.setItem(
    BPR_HIRE_APPLICATIONS_STORAGE_KEY,
    JSON.stringify(nextApplications)
  );

  return {
    totalChecked,
    autoFailed,
    movedToReview,
    unchanged,
    applications: nextApplications,
  };
}

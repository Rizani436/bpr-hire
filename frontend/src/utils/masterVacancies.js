import {
  PROFILE_LAYER_FIELDS,
  normalizeFieldValueRules,
  normalizeRequiredProfileFields,
} from "./profileCriteria";
export const BPR_HIRE_MASTER_VACANCIES_KEY = "bpr-hire-master-vacancies";

function normalizeText(value) {
  return String(value || "").trim();
}

const AUTO_REQUIRED_PROFILE_FIELD_KEYS = (
  PROFILE_LAYER_FIELDS.find((layer) => layer.id === "biodata")?.fields || []
)
  .map((field) => normalizeText(field?.key))
  .filter(Boolean);

function includeAutoRequiredProfileFields(values) {
  return normalizeRequiredProfileFields([
    ...AUTO_REQUIRED_PROFILE_FIELD_KEYS,
    ...normalizeRequiredProfileFields(values),
  ]);
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsedDate = new Date(text);
  if (Number.isNaN(parsedDate.getTime())) return "";

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTime(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseDateStartOfDay(value) {
  const text = normalizeDate(value);
  if (!text) return null;

  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateEndOfDay(value) {
  const text = normalizeDate(value);
  if (!text) return null;

  const date = new Date(`${text}T23:59:59`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item))
      .filter((item) => item.length > 0);
  }

  return normalizeText(value)
    .split(/\r?\n/)
    .map((item) => normalizeText(item))
    .filter((item) => item.length > 0);
}

function normalizeEducation(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeGender(value) {
  const text = normalizeText(value).toLowerCase();
  if (!text) return "";
  if (text.includes("laki")) return "Laki-laki";
  if (text.includes("perempuan")) return "Perempuan";
  return "";
}

function normalizeBiodataCriteria(value) {
  const source = value && typeof value === "object" ? value : {};
  const minGpa = Number.parseFloat(String(source.minimumGpa ?? "").replace(",", "."));
  const minimumGraduationYear = Number.parseInt(
    String(source.minimumGraduationYear ?? "").replace(/[^\d-]/g, ""),
    10
  );
  const allowedGenders = toList(source.allowedGenders)
    .map((item) => normalizeGender(item))
    .filter(Boolean);

  return {
    isEnabled: normalizeBoolean(source.isEnabled, false),
    minimumEducation: normalizeEducation(source.minimumEducation),
    minimumGraduationYear:
      Number.isFinite(minimumGraduationYear) && minimumGraduationYear > 0
        ? minimumGraduationYear
        : 0,
    minimumGpa: Number.isFinite(minGpa) ? minGpa : 0,
    majorKeywords: toList(source.majorKeywords),
    allowedGenders: Array.from(new Set(allowedGenders)),
    requireDocumentReady: normalizeBoolean(source.requireDocumentReady, false),
    requiredProfileFields: includeAutoRequiredProfileFields(
      source.requiredProfileFields
    ),
    fieldValueRules: normalizeFieldValueRules(source.fieldValueRules),
    updatedAt: normalizeText(source.updatedAt),
    updatedBy: normalizeText(source.updatedBy || "pengawas"),
  };
}

function normalizeSelectionStages(value) {
  const rawItems = Array.isArray(value)
    ? value
    : normalizeText(value)
        .split(/\r?\n/)
        .map((item) => normalizeText(item))
        .filter((item) => item.length > 0);

  return rawItems
    .map((item) => {
      if (item && typeof item === "object") {
        const title = normalizeText(item.title);
        const description = normalizeText(item.description);
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

      const text = normalizeText(item);
      if (!text) return null;

      if (text.includes("|")) {
        const [titlePart, ...descriptionParts] = text.split("|");
        const title = normalizeText(titlePart);
        const description = normalizeText(descriptionParts.join("|"));
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
        title: text,
        description: "",
        startDate: "",
        endDate: "",
        startTime: "",
        endTime: "",
      };
    })
    .filter((stage) => stage && !isAdministrationStage(stage));
}

function normalizeStageTitleForComparison(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isAdministrationStage(stage = {}) {
  const normalizedTitle = normalizeStageTitleForComparison(stage?.title || stage);
  return (
    normalizedTitle === "administrasi" ||
    normalizedTitle === "seleksiadministrasi" ||
    normalizedTitle === "tahapadministrasi"
  );
}

function normalizeSelectionFlow(value) {
  const text = normalizeText(value).toLowerCase();
  return text === "langsung" ? "langsung" : "berurutan";
}

function normalizeVacancy(vacancy) {
  const tenagaAhli = normalizeText(vacancy?.tenagaAhli || vacancy?.department);
  const deskripsiLamaran = normalizeText(
    vacancy?.deskripsiLamaran || vacancy?.description
  );
  const ruangLingkupPekerjaan = normalizeText(
    vacancy?.ruangLingkupPekerjaan || vacancy?.summary || vacancy?.description
  );
  const kualifikasi = toList(vacancy?.kualifikasi ?? vacancy?.requirements);
  const kompetensi = toList(vacancy?.kompetensi ?? vacancy?.qualifications);

  return {
    id: normalizeText(vacancy?.id),
    title: normalizeText(vacancy?.title),
    department: tenagaAhli,
    tenagaAhli,
    location: normalizeText(vacancy?.location),
    type: normalizeText(vacancy?.type || "Full Time"),
    description: deskripsiLamaran,
    deskripsiLamaran,
    summary: ruangLingkupPekerjaan,
    ruangLingkupPekerjaan,
    requirements: kualifikasi,
    kualifikasi,
    qualifications: kompetensi,
    kompetensi,
    pendidikan: toList(vacancy?.pendidikan),
    pengalaman: toList(vacancy?.pengalaman),
    karakterDibutuhkan: toList(vacancy?.karakterDibutuhkan),
    requiredDocuments: toList(vacancy?.requiredDocuments),
    selectionFlow: normalizeSelectionFlow(vacancy?.selectionFlow),
    selectionStages: normalizeSelectionStages(vacancy?.selectionStages),
    biodataCriteria: normalizeBiodataCriteria(vacancy?.biodataCriteria),
    isActive: normalizeBoolean(vacancy?.isActive, true),
    openDate: normalizeDate(vacancy?.openDate),
    closeDate: normalizeDate(vacancy?.closeDate),
    createdAt: normalizeText(vacancy?.createdAt),
    updatedAt: normalizeText(vacancy?.updatedAt),
    createdBy: normalizeText(vacancy?.createdBy || "pengawas"),
  };
}

export function getVacancyOpenStatus(vacancy, referenceDate = new Date()) {
  if (!vacancy || !normalizeBoolean(vacancy.isActive, true)) {
    return "inactive";
  }

  const startDate = parseDateStartOfDay(vacancy.openDate);
  const endDate = parseDateEndOfDay(vacancy.closeDate);
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  if (startDate && now < startDate) return "scheduled";
  if (endDate && now > endDate) return "expired";
  return "open";
}

export function isVacancyOpenNow(vacancy, referenceDate = new Date()) {
  return getVacancyOpenStatus(vacancy, referenceDate) === "open";
}

export function getMasterVacancies() {
  if (typeof window === "undefined") return [];

  try {
    const rawData = JSON.parse(
      window.localStorage.getItem(BPR_HIRE_MASTER_VACANCIES_KEY)
    );
    if (!Array.isArray(rawData)) return [];

    return rawData
      .map((item) => normalizeVacancy(item))
      .filter((item) => item.id && item.title)
      .sort((left, right) => {
        const leftTime = Date.parse(left.updatedAt || left.createdAt || "") || 0;
        const rightTime = Date.parse(right.updatedAt || right.createdAt || "") || 0;
        return rightTime - leftTime;
      });
  } catch {
    return [];
  }
}

export function saveMasterVacancies(vacancies) {
  if (typeof window === "undefined") return [];

  const normalizedList = Array.isArray(vacancies)
    ? vacancies.map((item) => normalizeVacancy(item)).filter((item) => item.id && item.title)
    : [];

  window.localStorage.setItem(
    BPR_HIRE_MASTER_VACANCIES_KEY,
    JSON.stringify(normalizedList)
  );

  return normalizedList;
}

export function addMasterVacancy(payload) {
  const currentVacancies = getMasterVacancies();
  const nowIso = new Date().toISOString();
  const title = normalizeText(payload?.title);

  const newVacancy = normalizeVacancy({
    id: payload?.id || `vac-${slugify(title) || "lamaran"}-${Date.now()}`,
    title,
    tenagaAhli: payload?.tenagaAhli ?? payload?.department,
    department: payload?.tenagaAhli ?? payload?.department,
    location: payload?.location,
    type: payload?.type || "Full Time",
    deskripsiLamaran: payload?.deskripsiLamaran ?? payload?.description,
    description: payload?.deskripsiLamaran ?? payload?.description,
    ruangLingkupPekerjaan: payload?.ruangLingkupPekerjaan ?? payload?.summary,
    summary: payload?.ruangLingkupPekerjaan ?? payload?.summary,
    pendidikan: payload?.pendidikan,
    pengalaman: payload?.pengalaman,
    karakterDibutuhkan: payload?.karakterDibutuhkan,
    kualifikasi: payload?.kualifikasi ?? payload?.requirements,
    requirements: payload?.kualifikasi ?? payload?.requirements,
    kompetensi: payload?.kompetensi ?? payload?.qualifications,
    qualifications: payload?.kompetensi ?? payload?.qualifications,
    requiredDocuments: payload?.requiredDocuments,
    selectionFlow: payload?.selectionFlow,
    selectionStages: payload?.selectionStages,
    biodataCriteria: payload?.biodataCriteria,
    isActive: normalizeBoolean(payload?.isActive, true),
    openDate: payload?.openDate,
    closeDate: payload?.closeDate,
    createdBy: payload?.createdBy || "pengawas",
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  const nextVacancies = [newVacancy, ...currentVacancies];
  return saveMasterVacancies(nextVacancies);
}

export function updateMasterVacancyBiodataCriteria(
  id,
  criteria,
  updatedBy = "pengawas"
) {
  const targetId = normalizeText(id);
  if (!targetId) return getMasterVacancies();

  const nowIso = new Date().toISOString();
  const nextVacancies = getMasterVacancies().map((vacancy) => {
    if (vacancy.id !== targetId) return vacancy;

    return {
      ...vacancy,
      biodataCriteria: normalizeBiodataCriteria({
        ...(vacancy?.biodataCriteria || {}),
        ...(criteria && typeof criteria === "object" ? criteria : {}),
        updatedAt: nowIso,
        updatedBy: normalizeText(updatedBy || "pengawas"),
      }),
      updatedAt: nowIso,
    };
  });

  return saveMasterVacancies(nextVacancies);
}

export function getVacancyById(vacancyId) {
  const safeVacancyId = normalizeText(vacancyId);
  if (!safeVacancyId) return null;

  const vacancy = getMasterVacancies().find((item) => item.id === safeVacancyId);
  return vacancy || null;
}

export function getDefaultBiodataCriteria() {
  return normalizeBiodataCriteria({
    isEnabled: false,
    minimumEducation: "",
    minimumGraduationYear: 0,
    minimumGpa: 0,
    majorKeywords: [],
    allowedGenders: [],
    requireDocumentReady: false,
    requiredProfileFields: [],
    fieldValueRules: {},
  });
}

export function updateMasterVacancyStatus(id, isActive) {
  const targetId = normalizeText(id);
  if (!targetId) return getMasterVacancies();

  const nextVacancies = getMasterVacancies().map((vacancy) =>
    vacancy.id === targetId
      ? {
          ...vacancy,
          isActive: Boolean(isActive),
          updatedAt: new Date().toISOString(),
        }
      : vacancy
  );

  return saveMasterVacancies(nextVacancies);
}

export function removeMasterVacancy(id) {
  const targetId = normalizeText(id);
  if (!targetId) return getMasterVacancies();

  const nextVacancies = getMasterVacancies().filter(
    (vacancy) => vacancy.id !== targetId
  );

  return saveMasterVacancies(nextVacancies);
}

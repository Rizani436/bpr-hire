function cleanText(value) {
  return String(value || "").trim();
}

export const PROFILE_LAYER_FIELDS = [
  {
    id: "biodata",
    label: "Layer Biodata",
    fields: [
      { key: "fullName", label: "Nama Lengkap" },
      { key: "nik", label: "NIK" },
      { key: "birthPlace", label: "Tempat Lahir" },
      { key: "birthDate", label: "Tanggal Lahir" },
      { key: "gender", label: "Jenis Kelamin" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Nomor HP" },
      { key: "address", label: "Alamat Domisili" },
    ],
  },
  {
    id: "pendidikan",
    label: "Layer Pendidikan",
    fields: [
      { key: "lastEducation", label: "Pendidikan Terakhir" },
      { key: "major", label: "Jurusan" },
      { key: "institution", label: "Nama Sekolah/Kampus" },
      { key: "graduationYear", label: "Tahun Lulus" },
      { key: "gpa", label: "IPK/Nilai Akhir" },
    ],
  },
  {
    id: "keahlian",
    label: "Layer Keahlian",
    fields: [
      { key: "mainSkill", label: "Keahlian Utama" },
      { key: "computerSkill", label: "Kemampuan Komputer" },
      { key: "computerSkillLevel", label: "Level Kemampuan Komputer" },
      { key: "languageSkill", label: "Bahasa" },
      { key: "workExperience", label: "Pengalaman Kerja" },
    ],
  },
  {
    id: "berkas",
    label: "Layer Berkas",
    fields: [
      { key: "cvFileName", label: "CV" },
      { key: "certificateFileName", label: "Sertifikat" },
      { key: "experienceLetterFileName", label: "Surat Pengalaman Kerja" },
      { key: "ktpFileName", label: "KTP" },
      { key: "ijazahFileName", label: "Ijazah" },
      { key: "documentReady", label: "Konfirmasi Berkas Lengkap" },
    ],
  },
];

export const PROFILE_FIELDS = PROFILE_LAYER_FIELDS.flatMap((layer) => layer.fields);

export const PROFILE_FIELD_KEYS = PROFILE_FIELDS.map((field) => field.key);

export const PROFILE_FIELD_LABELS = Object.fromEntries(
  PROFILE_FIELDS.map((field) => [field.key, field.label])
);

export const PROFILE_FIELD_STATIC_OPTIONS = {
  gender: ["Laki-laki", "Perempuan"],
  lastEducation: ["SMA/SMK", "D3", "D4", "S1", "S2", "S3"],
  major: [
    "Akuntansi",
    "Manajemen",
    "Ekonomi",
    "Sistem Informasi",
    "Teknik Informatika",
    "Hukum",
    "Administrasi Bisnis",
    "Perbankan Syariah",
  ],
  mainSkill: [
    "Administrasi",
    "Analisis Data",
    "Analisis Kredit",
    "Customer Service",
    "Digital Marketing",
    "Komunikasi",
    "Negosiasi",
    "Pelayanan Nasabah",
    "Sales",
  ],
  computerSkillLevel: ["Pemula", "Rendah", "Baik", "Sangat Baik"],
  documentReady: ["Sudah Lengkap", "Belum Lengkap"],
};

export function isKnownProfileField(fieldKey) {
  return PROFILE_FIELD_KEYS.includes(cleanText(fieldKey));
}

export function normalizeRequiredProfileFields(values) {
  const rawValues = Array.isArray(values) ? values : [values];
  const knownKeySet = new Set(PROFILE_FIELD_KEYS);
  const normalized = rawValues
    .map((value) => cleanText(value))
    .filter((value) => knownKeySet.has(value));

  return Array.from(new Set(normalized));
}

function normalizeValueText(value) {
  return cleanText(value).toLowerCase();
}

function addUniqueValue(list, rawValue, lookupSet) {
  const value = cleanText(rawValue);
  if (!value) return;

  const normalized = normalizeValueText(value);
  if (lookupSet.has(normalized)) return;

  lookupSet.add(normalized);
  list.push(value);
}

export function normalizeFieldValueRules(value) {
  if (!value || typeof value !== "object") return {};

  const knownKeySet = new Set(PROFILE_FIELD_KEYS);
  const result = {};

  Object.entries(value).forEach(([fieldKey, fieldValues]) => {
    const safeFieldKey = cleanText(fieldKey);
    if (!knownKeySet.has(safeFieldKey)) return;

    const rawList = Array.isArray(fieldValues) ? fieldValues : [fieldValues];
    const lookupSet = new Set();
    const normalizedList = [];

    rawList.forEach((rawValue) => {
      addUniqueValue(normalizedList, rawValue, lookupSet);
    });

    if (normalizedList.length > 0) {
      result[safeFieldKey] = normalizedList;
    }
  });

  return result;
}

export function getProfileFieldLabel(fieldKey) {
  const safeFieldKey = cleanText(fieldKey);
  return PROFILE_FIELD_LABELS[safeFieldKey] || safeFieldKey;
}

export function getMissingProfileFields(profile = {}, fields = PROFILE_FIELD_KEYS) {
  const requiredFields = normalizeRequiredProfileFields(fields);

  return requiredFields
    .filter((fieldKey) => !isApplicantProfileFieldFilled(profile, fieldKey))
    .map((fieldKey) => ({
      key: fieldKey,
      label: getProfileFieldLabel(fieldKey),
    }));
}

export function isProfileComplete(profile = {}, fields = PROFILE_FIELD_KEYS) {
  return getMissingProfileFields(profile, fields).length === 0;
}

export function isApplicantProfileFieldFilled(applicant, fieldKey) {
  const safeFieldKey = cleanText(fieldKey);
  if (!safeFieldKey) return false;

  if (safeFieldKey === "documentReady") {
    return Boolean(applicant?.documentReady);
  }

  return cleanText(applicant?.[safeFieldKey]).length > 0;
}

export function getApplicantProfileFieldValue(applicant, fieldKey) {
  const safeFieldKey = cleanText(fieldKey);
  if (!safeFieldKey) return "";

  if (safeFieldKey === "documentReady") {
    return applicant?.documentReady ? "Sudah Lengkap" : "Belum Lengkap";
  }

  return cleanText(applicant?.[safeFieldKey]);
}

export function isApplicantProfileFieldValueMatched(
  applicant,
  fieldKey,
  allowedValues
) {
  const safeAllowedValues = Array.isArray(allowedValues)
    ? allowedValues.map((value) => cleanText(value)).filter(Boolean)
    : [];

  if (safeAllowedValues.length === 0) return true;

  const applicantValue = getApplicantProfileFieldValue(applicant, fieldKey);
  const normalizedApplicantValue = normalizeValueText(applicantValue);
  if (!normalizedApplicantValue) return false;

  return safeAllowedValues.some((allowedValue) => {
    const normalizedAllowedValue = normalizeValueText(allowedValue);
    if (!normalizedAllowedValue) return false;

    return (
      normalizedApplicantValue === normalizedAllowedValue ||
      normalizedApplicantValue.includes(normalizedAllowedValue)
    );
  });
}

export function getProfileFieldDropdownOptions(fieldKey, applicants = []) {
  const safeFieldKey = cleanText(fieldKey);
  if (!safeFieldKey) return [];

  const staticValues = Array.isArray(PROFILE_FIELD_STATIC_OPTIONS[safeFieldKey])
    ? PROFILE_FIELD_STATIC_OPTIONS[safeFieldKey]
    : [];

  const lookupSet = new Set();
  const mergedValues = [];

  staticValues.forEach((value) => addUniqueValue(mergedValues, value, lookupSet));

  if (Array.isArray(applicants)) {
    applicants.forEach((applicant) => {
      const rawValue = getApplicantProfileFieldValue(applicant, safeFieldKey);
      if (!rawValue) return;

      if (safeFieldKey === "mainSkill" || safeFieldKey === "computerSkill" || safeFieldKey === "languageSkill") {
        rawValue
          .split(/[,/;]+/)
          .map((item) => cleanText(item))
          .filter(Boolean)
          .forEach((item) => addUniqueValue(mergedValues, item, lookupSet));
        return;
      }

      addUniqueValue(mergedValues, rawValue, lookupSet);
    });
  }

  return mergedValues.map((value) => ({
    value,
    label: value,
  }));
}

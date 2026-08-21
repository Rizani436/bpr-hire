const cleanText = (value) => String(value ?? "").trim();

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

export const PARTICIPANT_PROFILE_FIELD_KEYS = [
  "fullName",
  "nik",
  "birthPlace",
  "birthDate",
  "gender",
  "email",
  "phone",
  "address",
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
  "documentReady",
];

export const OFFICE_PROFILE_FIELD_KEYS = [
  "fullName",
  "email",
  "phone",
  "jabatan",
  "unitKerja",
  "address",
];

export const PROFILE_FIELD_LABELS = {
  fullName: "Nama Lengkap",
  nik: "NIK",
  birthPlace: "Tempat Lahir",
  birthDate: "Tanggal Lahir",
  gender: "Jenis Kelamin",
  email: "Email",
  phone: "Nomor HP",
  address: "Alamat Domisili",
  lastEducation: "Pendidikan Terakhir",
  major: "Jurusan",
  institution: "Nama Sekolah/Kampus",
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
  documentReady: "Konfirmasi Berkas Lengkap",
  jabatan: "Jabatan",
  unitKerja: "Unit Kerja",
};

export const getRequiredProfileFieldsForRole = (roleValue) => {
  const role = normalizeRole(roleValue);
  if (role === "peserta") return PARTICIPANT_PROFILE_FIELD_KEYS;
  if (role === "pengawas" || role === "superadmin") return OFFICE_PROFILE_FIELD_KEYS;
  return ["fullName", "email", "phone", "address"];
};

export const getUserMissingProfileFields = (user = {}, options = {}) => {
  const role = normalizeRole(options.role || user?.role);
  const requiredFields = Array.isArray(options.requiredFields)
    ? options.requiredFields
    : getRequiredProfileFieldsForRole(role);

  return requiredFields
    .map((fieldKey) => cleanText(fieldKey))
    .filter(Boolean)
    .filter((fieldKey) => {
      if (fieldKey === "documentReady") return !Boolean(user?.documentReady);
      return cleanText(user?.[fieldKey]).length === 0;
    })
    .map((fieldKey) => ({
      key: fieldKey,
      label: PROFILE_FIELD_LABELS[fieldKey] || fieldKey,
    }));
};

export const isUserProfileComplete = (user = {}, options = {}) =>
  getUserMissingProfileFields(user, options).length === 0;

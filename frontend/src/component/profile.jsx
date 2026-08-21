import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiBookOpen,
  FiBriefcase,
  FiCheckCircle,
  FiFileText,
  FiSave,
  FiUploadCloud,
  FiUser,
} from "react-icons/fi";
import Header from "./header";
import Sidebar from "./sidebar";
import { getDashboardUser, updateDashboardUser } from "../utils/authUser";
import { updateUserProfileApi } from "../utils/authApi";

const BPR_HIRE_PROFILE_STORAGE_KEY = "bpr-hire-profile-data";
const EDUCATION_OPTIONS = ["SMA/SMK", "D3", "D4", "S1", "S2", "S3"];

const PROFILE_SECTIONS = [
  {
    id: "biodata",
    label: "Biodata",
    icon: FiUser,
    fields: ["fullName", "nik", "birthPlace", "birthDate", "gender", "email", "phone", "address"],
  },
  {
    id: "pendidikan",
    label: "Pendidikan",
    icon: FiBookOpen,
    fields: ["lastEducation", "major", "institution", "graduationYear", "gpa"],
  },
  {
    id: "keahlian",
    label: "Keahlian",
    icon: FiBriefcase,
    fields: ["mainSkill", "computerSkill", "computerSkillLevel", "languageSkill", "workExperience"],
  },
  {
    id: "berkas",
    label: "Berkas",
    icon: FiFileText,
    fields: ["cvFileName", "certificateFileName", "experienceLetterFileName", "ktpFileName", "ijazahFileName", "documentReady"],
  },
];

const FIELD_LABELS = {
  fullName: "Nama lengkap",
  nik: "NIK",
  birthPlace: "Tempat lahir",
  birthDate: "Tanggal lahir",
  gender: "Jenis kelamin",
  email: "Email",
  phone: "Nomor HP",
  address: "Alamat domisili",
  lastEducation: "Pendidikan terakhir",
  major: "Jurusan",
  institution: "Nama sekolah/kampus",
  graduationYear: "Tahun lulus",
  gpa: "IPK/Nilai akhir",
  mainSkill: "Keahlian utama",
  computerSkill: "Kemampuan komputer",
  computerSkillLevel: "Level kemampuan komputer",
  languageSkill: "Bahasa",
  workExperience: "Pengalaman kerja",
  cvFileName: "CV",
  certificateFileName: "Sertifikat",
  experienceLetterFileName: "Surat pengalaman kerja",
  ktpFileName: "KTP",
  ijazahFileName: "Ijazah",
  documentReady: "Konfirmasi dokumen",
};

function getDefaultProfile(currentUser) {
  return {
    fullName: currentUser.userName || "",
    nik: "",
    birthPlace: "",
    birthDate: "",
    gender: "",
    email: currentUser.loginIdentity?.includes("@") ? currentUser.loginIdentity : "",
    phone: "",
    address: "",
    lastEducation: "",
    major: "",
    institution: "",
    graduationYear: "",
    gpa: "",
    mainSkill: "",
    computerSkill: "",
    computerSkillLevel: "",
    languageSkill: "",
    workExperience: "",
    cvFileName: "",
    certificateFileName: "",
    experienceLetterFileName: "",
    ktpFileName: "",
    ijazahFileName: "",
    documentReady: false,
  };
}

function getSavedProfile(currentUser) {
  const defaultProfile = getDefaultProfile(currentUser);

  if (typeof window === "undefined") return defaultProfile;

  try {
    const savedProfile = JSON.parse(window.localStorage.getItem(BPR_HIRE_PROFILE_STORAGE_KEY));
    return {
      ...defaultProfile,
      ...savedProfile,
    };
  } catch {
    return defaultProfile;
  }
}

function cleanText(value) {
  return String(value || "").trim();
}

function buildProfileFormData(profile, profileFiles) {
  const formData = new FormData();

  Object.entries(profile || {}).forEach(([key, value]) => {
    formData.append(key, typeof value === "boolean" ? String(value) : String(value ?? ""));
  });

  Object.entries(profileFiles || {}).forEach(([key, file]) => {
    if (file instanceof File) {
      formData.append(key, file);
    }
  });

  return formData;
}

function pickProfileFieldsFromUser(user = {}, fallbackProfile = {}) {
  return {
    ...fallbackProfile,
    fullName: cleanText(user.fullName) || cleanText(fallbackProfile.fullName),
    nik: cleanText(user.nik) || cleanText(fallbackProfile.nik),
    birthPlace: cleanText(user.birthPlace) || cleanText(fallbackProfile.birthPlace),
    birthDate: cleanText(user.birthDate) || cleanText(fallbackProfile.birthDate),
    gender: cleanText(user.gender) || cleanText(fallbackProfile.gender),
    email: cleanText(user.email) || cleanText(fallbackProfile.email),
    phone: cleanText(user.phone) || cleanText(fallbackProfile.phone),
    address: cleanText(user.address) || cleanText(fallbackProfile.address),
    lastEducation: cleanText(user.lastEducation) || cleanText(fallbackProfile.lastEducation),
    major: cleanText(user.major) || cleanText(fallbackProfile.major),
    institution: cleanText(user.institution) || cleanText(fallbackProfile.institution),
    graduationYear: cleanText(user.graduationYear) || cleanText(fallbackProfile.graduationYear),
    gpa: cleanText(user.gpa) || cleanText(fallbackProfile.gpa),
    mainSkill: cleanText(user.mainSkill) || cleanText(fallbackProfile.mainSkill),
    computerSkill: cleanText(user.computerSkill) || cleanText(fallbackProfile.computerSkill),
    computerSkillLevel:
      cleanText(user.computerSkillLevel) ||
      cleanText(fallbackProfile.computerSkillLevel),
    languageSkill:
      cleanText(user.languageSkill) || cleanText(fallbackProfile.languageSkill),
    workExperience:
      cleanText(user.workExperience) || cleanText(fallbackProfile.workExperience),
    cvFileName: cleanText(user.cvFileName) || cleanText(fallbackProfile.cvFileName),
    certificateFileName:
      cleanText(user.certificateFileName) ||
      cleanText(fallbackProfile.certificateFileName),
    experienceLetterFileName:
      cleanText(user.experienceLetterFileName) ||
      cleanText(fallbackProfile.experienceLetterFileName),
    ktpFileName: cleanText(user.ktpFileName) || cleanText(fallbackProfile.ktpFileName),
    ijazahFileName:
      cleanText(user.ijazahFileName) || cleanText(fallbackProfile.ijazahFileName),
    documentReady:
      typeof user.documentReady === "boolean"
        ? user.documentReady
        : Boolean(fallbackProfile.documentReady),
  };
}

function getCompletion(profile, fields) {
  const completedFields = fields.filter((field) => {
    if (field === "documentReady") return Boolean(profile[field]);
    return String(profile[field] || "").trim().length > 0;
  }).length;

  return Math.round((completedFields / fields.length) * 100);
}

function FieldShell({ label, children, className = "" }) {
  return (
    <label className={`grid gap-2 text-sm font-semibold text-[#102d5b] ${className}`}>
      {label}
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      type={type}
      className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-green-500"
      placeholder={placeholder}
    />
  );
}

function FileInput({ label, value, onChange, disabled = false }) {
  return (
    <div className="rounded-lg border border-[#d6dfed] bg-[#fbfdff] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#102d5b]">{label}</p>
          <span className="mt-1 block text-xs text-[#607792]">{value || "Belum ada file dipilih"}</span>
        </div>
        <FiUploadCloud className="shrink-0 text-xl text-green-600" />
      </div>
      <input
        type="file"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
        disabled={disabled}
        className="block w-full text-xs text-[#506783] file:mr-3 file:rounded-md file:border-0 file:bg-green-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-green-700"
      />
    </div>
  );
}

function Profile() {
  const navigate = useNavigate();
  const currentUser = getDashboardUser();
  const isPeserta = currentUser.role === "peserta";
  const returnPath = isPeserta ? "/pendaftaran" : "/dashboard";
  const returnButtonLabel = isPeserta ? "Kembali ke Lamaran" : "Kembali ke Dashboard";
  const successButtonLabel = isPeserta ? "Pilih Lamaran" : "Kembali ke Dashboard";
  const [activeSection, setActiveSection] = useState("biodata");
  const [profile, setProfile] = useState(() => getSavedProfile(currentUser));
  const [profileFiles, setProfileFiles] = useState({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");

  const activeLayer = PROFILE_SECTIONS.find((section) => section.id === activeSection) || PROFILE_SECTIONS[0];
  const overallCompletion = useMemo(() => {
    const fields = PROFILE_SECTIONS.flatMap((section) => section.fields);
    return getCompletion(profile, fields);
  }, [profile]);

  const updateField = (field, value) => {
    setValidationMessage("");
    setProfile((prevProfile) => ({
      ...prevProfile,
      [field]: value,
    }));
  };

  const updateFileField = (field, file) => {
    setValidationMessage("");
    if (!file) return;

    setProfileFiles((prevFiles) => ({
      ...prevFiles,
      [field]: file,
    }));
    setProfile((prevProfile) => ({
      ...prevProfile,
      [field]: file.name,
    }));
  };

  const findMissingField = () => {
    for (const section of PROFILE_SECTIONS) {
      const missingField = section.fields.find((field) => {
        if (field === "documentReady") return !profile[field];
        return String(profile[field] || "").trim().length === 0;
      });

      if (missingField) {
        return {
          section,
          field: missingField,
        };
      }
    }

    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSavingProfile) return;

    const missing = findMissingField();

    if (missing) {
      setActiveSection(missing.section.id);
      setValidationMessage(`${FIELD_LABELS[missing.field]} wajib dilengkapi pada layer ${missing.section.label}.`);
      return;
    }

    const currentUserUUID = cleanText(currentUser.userUUID);
    if (!currentUserUUID) {
      setValidationMessage("Sesi akun tidak valid. Silakan login ulang.");
      return;
    }

    try {
      setIsSavingProfile(true);
      const updateResult = await updateUserProfileApi(
        currentUserUUID,
        buildProfileFormData(profile, profileFiles)
      );
      const updatedUser = updateResult?.user || {};
      const nextProfile = pickProfileFieldsFromUser(updatedUser, profile);

      window.localStorage.setItem(
        BPR_HIRE_PROFILE_STORAGE_KEY,
        JSON.stringify(nextProfile)
      );
      updateDashboardUser({
        userUUID: cleanText(updatedUser.userUUID) || currentUserUUID,
        username: cleanText(updatedUser.username) || cleanText(currentUser.username),
        userName: nextProfile.fullName,
        email: cleanText(updatedUser.email) || cleanText(currentUser.email),
        role: cleanText(updatedUser.role) || currentUser.role,
        statusUser: cleanText(updatedUser.statusUser) || currentUser.statusUser,
        profileComplete:
          typeof updatedUser.profileComplete === "boolean"
            ? updatedUser.profileComplete
            : true,
      });
      setProfile(nextProfile);
      setProfileFiles({});
      setShowSuccess(true);
    } catch (error) {
      setValidationMessage(
        error instanceof Error ? error.message : "Gagal menyimpan profile."
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div
      className={`bh-dashboard-shell min-h-screen bg-[#f7fbff] text-[#09275a] ${
        isPeserta ? "lg:grid lg:grid-cols-[256px_minmax(0,1fr)]" : ""
      }`}
    >
      {isPeserta && (
        <aside className="bh-dashboard-sidebar-shell border-b border-[#dfe8f5] bg-white p-4 shadow-[12px_0_40px_rgba(20,57,96,0.05)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:border-b-0 lg:border-r lg:px-4 lg:py-8">
          <Sidebar role={currentUser.role} />
        </aside>
      )}

      <main className="bh-dashboard-main min-w-0 px-4 py-6 sm:px-6 lg:px-9 lg:py-10">
        <Header user={currentUser} />

        <section className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-green-600">Profile Peserta</p>
              <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">Lengkapi Data Profile</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#506783]">
                Isi seluruh layer profile agar Anda dapat memilih dan mengirim lamaran di BPR HIRE.
              </p>
            </div>

            <div className="w-full max-w-sm rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#102d5b]">
                <span>Kelengkapan Profile</span>
                <span>{overallCompletion}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e8edf5]">
                <span className="block h-full rounded-full bg-green-600" style={{ width: `${overallCompletion}%` }} />
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-2 md:grid-cols-4">
            {PROFILE_SECTIONS.map((section) => {
              const Icon = section.icon;
              const completion = getCompletion(profile, section.fields);
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`rounded-lg border p-3 text-left transition ${
                    isActive
                      ? "border-green-300 bg-green-50 text-green-700 shadow-[0_12px_24px_rgba(42,160,58,0.08)]"
                      : "border-[#dfe8f5] bg-[#fbfdff] text-[#203b63] hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <Icon />
                      {section.label}
                    </span>
                    <span className="text-xs font-bold">{completion}%</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                    <span className="block h-full rounded-full bg-green-600" style={{ width: `${completion}%` }} />
                  </div>
                </button>
              );
            })}
          </div>

          {validationMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
              <FiAlertCircle className="mt-0.5 shrink-0" />
              <span>{validationMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-xl text-green-600">
                <activeLayer.icon />
              </span>
              <div>
                <h3 className="text-lg font-bold text-[#102d5b]">{activeLayer.label}</h3>
                <p className="text-xs text-[#607792]">Lengkapi data pada layer ini.</p>
              </div>
            </div>

            {activeSection === "biodata" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <FieldShell label="Nama Lengkap">
                  <TextInput value={profile.fullName} onChange={(value) => updateField("fullName", value)} placeholder="Masukkan nama lengkap" />
                </FieldShell>
                <FieldShell label="NIK">
                  <TextInput value={profile.nik} onChange={(value) => updateField("nik", value)} placeholder="Masukkan NIK" />
                </FieldShell>
                <FieldShell label="Tempat Lahir">
                  <TextInput value={profile.birthPlace} onChange={(value) => updateField("birthPlace", value)} placeholder="Contoh: Mataram" />
                </FieldShell>
                <FieldShell label="Tanggal Lahir">
                  <TextInput value={profile.birthDate} onChange={(value) => updateField("birthDate", value)} type="date" />
                </FieldShell>
                <FieldShell label="Jenis Kelamin">
                  <select
                    value={profile.gender}
                    onChange={(event) => updateField("gender", event.target.value)}
                    className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-green-500"
                  >
                    <option value="">Pilih jenis kelamin</option>
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </FieldShell>
                <FieldShell label="Email">
                  <TextInput value={profile.email} onChange={(value) => updateField("email", value)} type="email" placeholder="Masukkan email" />
                </FieldShell>
                <FieldShell label="Nomor HP">
                  <TextInput value={profile.phone} onChange={(value) => updateField("phone", value)} placeholder="Masukkan nomor HP" />
                </FieldShell>
                <FieldShell label="Alamat Domisili" className="lg:col-span-2">
                  <textarea
                    value={profile.address}
                    onChange={(event) => updateField("address", event.target.value)}
                    className="min-h-[96px] rounded-lg border border-[#d6dfed] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-green-500"
                    placeholder="Masukkan alamat lengkap"
                  />
                </FieldShell>
              </div>
            )}

            {activeSection === "pendidikan" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <FieldShell label="Pendidikan Terakhir">
                  <select
                    value={profile.lastEducation}
                    onChange={(event) => updateField("lastEducation", event.target.value)}
                    className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-green-500"
                  >
                    <option value="">Pilih pendidikan</option>
                    {EDUCATION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </FieldShell>
                <FieldShell label="Jurusan">
                  <TextInput value={profile.major} onChange={(value) => updateField("major", value)} placeholder="Contoh: Sistem Informasi" />
                </FieldShell>
                <FieldShell label="Nama Sekolah/Kampus">
                  <TextInput value={profile.institution} onChange={(value) => updateField("institution", value)} placeholder="Masukkan nama institusi" />
                </FieldShell>
                <FieldShell label="Tahun Lulus">
                  <TextInput value={profile.graduationYear} onChange={(value) => updateField("graduationYear", value)} type="number" placeholder="Contoh: 2024" />
                </FieldShell>
                <FieldShell label="IPK/Nilai Akhir">
                  <TextInput value={profile.gpa} onChange={(value) => updateField("gpa", value)} placeholder="Contoh: 3.65" />
                </FieldShell>
              </div>
            )}

            {activeSection === "keahlian" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <FieldShell label="Keahlian Utama">
                  <TextInput value={profile.mainSkill} onChange={(value) => updateField("mainSkill", value)} placeholder="Contoh: Analisis kredit, React, Administrasi SDM" />
                </FieldShell>
                <FieldShell label="Level Kemampuan Komputer">
                  <select
                    value={profile.computerSkillLevel}
                    onChange={(event) => updateField("computerSkillLevel", event.target.value)}
                    className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-green-500"
                  >
                    <option value="">Pilih level kemampuan</option>
                    <option value="Pemula">Pemula</option>
                    <option value="Rendah">Rendah</option>
                    <option value="Baik">Baik</option>
                    <option value="Sangat Baik">Sangat Baik</option>
                  </select>
                </FieldShell>
                <FieldShell label="Kemampuan Komputer">
                  <TextInput value={profile.computerSkill} onChange={(value) => updateField("computerSkill", value)} placeholder="Contoh: Microsoft Office, Database" />
                </FieldShell>
                <FieldShell label="Bahasa">
                  <TextInput value={profile.languageSkill} onChange={(value) => updateField("languageSkill", value)} placeholder="Contoh: Indonesia aktif, Inggris pasif" />
                </FieldShell>
                <FieldShell label="Pengalaman Kerja" className="lg:col-span-2">
                  <textarea
                    value={profile.workExperience}
                    onChange={(event) => updateField("workExperience", event.target.value)}
                    className="min-h-[104px] rounded-lg border border-[#d6dfed] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-green-500"
                    placeholder="Ceritakan pengalaman kerja, organisasi, magang, atau project yang relevan"
                  />
                </FieldShell>
              </div>
            )}

            {activeSection === "berkas" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <FileInput label="Curriculum Vitae (CV)" value={profile.cvFileName} onChange={(file) => updateFileField("cvFileName", file)} disabled={isSavingProfile} />
                <FileInput label="Sertifikat Pendukung" value={profile.certificateFileName} onChange={(file) => updateFileField("certificateFileName", file)} disabled={isSavingProfile} />
                <FileInput label="Surat Pengalaman Kerja" value={profile.experienceLetterFileName} onChange={(file) => updateFileField("experienceLetterFileName", file)} disabled={isSavingProfile} />
                <FileInput label="KTP" value={profile.ktpFileName} onChange={(file) => updateFileField("ktpFileName", file)} disabled={isSavingProfile} />
                <FileInput label="Ijazah Terakhir" value={profile.ijazahFileName} onChange={(file) => updateFileField("ijazahFileName", file)} disabled={isSavingProfile} />
                <label className="flex items-start gap-3 rounded-lg border border-[#d6dfed] bg-[#fbfdff] p-4 text-sm font-semibold text-[#102d5b] lg:col-span-2">
                  <input
                    type="checkbox"
                    checked={profile.documentReady}
                    onChange={(event) => updateField("documentReady", event.target.checked)}
                    disabled={isSavingProfile}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    Saya menyatakan seluruh berkas sudah benar dan siap diverifikasi
                    <small className="mt-1 block text-xs font-normal leading-relaxed text-[#607792]">
                      Berkas meliputi CV, sertifikat, surat pengalaman kerja, KTP, ijazah, dan dokumen pendukung lainnya.
                    </small>
                  </span>
                </label>
              </div>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => navigate(returnPath)}
                className="h-11 rounded-md border border-[#d6dfed] bg-white px-5 text-sm font-bold text-[#102d5b]"
              >
                {returnButtonLabel}
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#43bd32] to-[#158a3b] px-6 text-sm font-bold text-white shadow-[0_14px_26px_rgba(35,149,47,0.24)]"
              >
                <FiSave />
                {isSavingProfile ? "Menyimpan..." : "Simpan Profile"}
              </button>
            </div>
          </form>
        </section>
      </main>

      {showSuccess && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[rgba(12,31,58,0.28)] p-5 backdrop-blur-[8px]">
          <div className="w-full max-w-[360px] rounded-[18px] border border-[#d6dfed] bg-white/95 px-7 py-8 text-center text-[#0f2f5d] shadow-[0_28px_70px_rgba(9,39,90,0.2)]">
            <span className="mx-auto mb-5 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-green-50 text-[30px] text-green-600">
              <FiCheckCircle />
            </span>
            <h3 className="m-0 text-[19px] font-bold leading-tight">Profile Berhasil Dilengkapi</h3>
            <p className="mx-auto mt-2.5 max-w-[270px] text-[13.5px] leading-relaxed text-[#506783]">
              Anda sekarang bisa memilih lamaran yang tersedia di BPR HIRE.
            </p>
            <button
              type="button"
              onClick={() => navigate(returnPath)}
              className="mt-6 h-10 w-full rounded-md bg-gradient-to-r from-[#43bd32] to-[#158a3b] text-sm font-bold text-white"
            >
              {successButtonLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;


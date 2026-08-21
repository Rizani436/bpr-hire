import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiSave,
  FiShield,
  FiUploadCloud,
} from "react-icons/fi";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardUser, updateDashboardUser } from "../../utils/authUser";
import { updateUserProfileApi } from "../../utils/authApi";

const BPR_HIRE_PROFILE_STORAGE_KEY = "bpr-hire-profile-data";

const DOCUMENT_ITEMS = [
  {
    id: "cv",
    label: "Curriculum Vitae (CV)",
    field: "cvFileName",
    note: "Format PDF/DOC, maksimal 2 MB",
  },
  {
    id: "certificate",
    label: "Sertifikat Pendukung",
    field: "certificateFileName",
    note: "Format PDF/JPG, maksimal 2 MB",
  },
  {
    id: "experience-letter",
    label: "Surat Pengalaman Kerja",
    field: "experienceLetterFileName",
    note: "Opsional jika belum memiliki pengalaman",
  },
  {
    id: "ktp",
    label: "KTP",
    field: "ktpFileName",
    note: "Format JPG/PNG, wajib terbaca jelas",
  },
  {
    id: "ijazah",
    label: "Ijazah Terakhir",
    field: "ijazahFileName",
    note: "Format PDF/JPG, sertakan halaman legalisasi jika ada",
  },
];

function cleanText(value) {
  return String(value || "").trim();
}

function getSavedProfile() {
  if (typeof window === "undefined") {
    return {
      cvFileName: "",
      certificateFileName: "",
      experienceLetterFileName: "",
      ktpFileName: "",
      ijazahFileName: "",
      documentReady: false,
    };
  }

  try {
    const savedProfile = JSON.parse(
      window.localStorage.getItem(BPR_HIRE_PROFILE_STORAGE_KEY)
    );

    return {
      cvFileName: String(savedProfile?.cvFileName || ""),
      certificateFileName: String(savedProfile?.certificateFileName || ""),
      experienceLetterFileName: String(savedProfile?.experienceLetterFileName || ""),
      ktpFileName: String(savedProfile?.ktpFileName || ""),
      ijazahFileName: String(savedProfile?.ijazahFileName || ""),
      documentReady: Boolean(savedProfile?.documentReady),
    };
  } catch {
    return {
      cvFileName: "",
      certificateFileName: "",
      experienceLetterFileName: "",
      ktpFileName: "",
      ijazahFileName: "",
      documentReady: false,
    };
  }
}

function DokumenSaya() {
  const navigate = useNavigate();
  const currentUser = getDashboardUser();
  const isPeserta = currentUser.role === "peserta";
  const [documentForm, setDocumentForm] = useState(() => getSavedProfile());
  const [documentFiles, setDocumentFiles] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ type: "idle", message: "" });

  const summary = useMemo(() => {
    const uploadedCount = DOCUMENT_ITEMS.filter(
      (item) => String(documentForm[item.field] || "").trim().length > 0
    ).length;

    return {
      uploadedCount,
      pendingCount: DOCUMENT_ITEMS.length - uploadedCount,
      progress: Math.round((uploadedCount / DOCUMENT_ITEMS.length) * 100),
    };
  }, [documentForm]);

  const handleFileChange = (field, file) => {
    setSaveStatus({ type: "idle", message: "" });
    if (!file) return;

    setDocumentFiles((prevFiles) => ({
      ...prevFiles,
      [field]: file,
    }));
    setDocumentForm((prevDocumentForm) => ({
      ...prevDocumentForm,
      [field]: file.name,
    }));
  };

  const handleSave = async () => {
    if (isSaving) return;

    const currentUserUUID = cleanText(currentUser.userUUID);
    if (!currentUserUUID) {
      setSaveStatus({
        type: "error",
        message: "Sesi akun tidak valid. Silakan login ulang.",
      });
      return;
    }

    const formData = new FormData();
    Object.entries(documentForm).forEach(([key, value]) => {
      formData.append(key, typeof value === "boolean" ? String(value) : String(value || ""));
    });
    Object.entries(documentFiles).forEach(([field, file]) => {
      if (file instanceof File) {
        formData.append(field, file);
      }
    });

    try {
      setIsSaving(true);
      setSaveStatus({ type: "idle", message: "" });

      const updateResult = await updateUserProfileApi(currentUserUUID, formData);
      const updatedUser = updateResult?.user || {};
      const nextDocumentForm = DOCUMENT_ITEMS.reduce(
        (payload, item) => ({
          ...payload,
          [item.field]:
            cleanText(updatedUser?.[item.field]) ||
            cleanText(documentForm?.[item.field]),
        }),
        {
          documentReady:
            typeof updatedUser.documentReady === "boolean"
              ? updatedUser.documentReady
              : Boolean(documentForm.documentReady),
        }
      );
      const existingProfile = JSON.parse(
        window.localStorage.getItem(BPR_HIRE_PROFILE_STORAGE_KEY)
      );
      const mergedProfile = {
        ...(existingProfile || {}),
        ...nextDocumentForm,
      };

      window.localStorage.setItem(
        BPR_HIRE_PROFILE_STORAGE_KEY,
        JSON.stringify(mergedProfile)
      );
      updateDashboardUser({
        userUUID: cleanText(updatedUser.userUUID) || currentUserUUID,
        username: cleanText(updatedUser.username) || cleanText(currentUser.username),
        userName: cleanText(updatedUser.fullName) || currentUser.userName,
        email: cleanText(updatedUser.email) || cleanText(currentUser.email),
        role: cleanText(updatedUser.role) || currentUser.role,
        statusUser: cleanText(updatedUser.statusUser) || currentUser.statusUser,
      });
      setDocumentForm(nextDocumentForm);
      setDocumentFiles({});

      setSaveStatus({
        type: "success",
        message:
          cleanText(updateResult?.msg) ||
          "Dokumen berhasil disimpan. Pastikan seluruh data sudah benar.",
      });
    } catch (error) {
      setSaveStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Gagal menyimpan dokumen.",
      });
    } finally {
      setIsSaving(false);
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

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <p className="text-sm font-semibold text-blue-600">Dokumen Saya</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
            Kelola Berkas Lamaran
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
            Unggah dan perbarui seluruh berkas pendukung agar proses seleksi Anda
            berjalan lancar.
          </p>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Dokumen Terunggah</p>
            <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">
              {summary.uploadedCount}
            </h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Dokumen Belum Lengkap</p>
            <h3 className="mt-2 text-3xl font-bold text-orange-600">
              {summary.pendingCount}
            </h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:col-span-2 xl:col-span-1">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#102d5b]">
              <span>Progress Kelengkapan</span>
              <span>{summary.progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#e8edf5]">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-[#43bd32] to-[#158a3b]"
                style={{ width: `${summary.progress}%` }}
              />
            </div>
          </article>
        </section>

        <section className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FiFileText className="text-[#17355e]" />
            <h3 className="text-lg font-bold text-[#102d5b]">Daftar Dokumen</h3>
          </div>

          {saveStatus.type !== "idle" && (
            <div
              className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
                saveStatus.type === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-orange-200 bg-orange-50 text-orange-700"
              }`}
            >
              {saveStatus.message}
            </div>
          )}

          <div className="grid gap-4">
            {DOCUMENT_ITEMS.map((item) => {
              const fileName = String(documentForm[item.field] || "").trim();
              const isUploaded = fileName.length > 0;

              return (
                <article
                  key={item.id}
                  className="rounded-[10px] border border-[#dfe8f5] bg-[#fbfdff] p-4 sm:p-5"
                >
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[#102d5b]">{item.label}</h4>
                      <p className="mt-1 text-xs text-[#607792]">{item.note}</p>
                    </div>
                    <span
                      className={`inline-flex w-max items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        isUploaded
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {isUploaded ? <FiCheckCircle /> : <FiClock />}
                      {isUploaded ? "Terunggah" : "Belum Unggah"}
                    </span>
                  </div>

                  <div className="rounded-lg border border-[#d6dfed] bg-white p-3">
                    <p className="text-xs text-[#496181]">
                      {isUploaded ? `File: ${fileName}` : "Belum ada file dipilih"}
                    </p>
                    <input
                      type="file"
                      disabled={isSaving}
                      onChange={(event) =>
                        handleFileChange(item.field, event.target.files?.[0] || null)
                      }
                      className="mt-3 block w-full text-xs text-[#506783] file:mr-3 file:rounded-md file:border-0 file:bg-green-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-green-700"
                    />
                  </div>
                </article>
              );
            })}
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-lg border border-[#d6dfed] bg-[#fbfdff] p-4 text-sm font-semibold text-[#102d5b]">
            <input
              type="checkbox"
              checked={Boolean(documentForm.documentReady)}
              disabled={isSaving}
              onChange={(event) =>
                setDocumentForm((prevDocumentForm) => ({
                  ...prevDocumentForm,
                  documentReady: event.target.checked,
                }))
              }
              className="mt-1 h-4 w-4"
            />
            <span>
              Saya menyatakan seluruh dokumen yang diunggah sudah benar.
              <small className="mt-1 block text-xs font-normal leading-relaxed text-[#607792]">
                Pastikan dokumen dapat dibaca dengan jelas untuk mempercepat proses
                verifikasi tim rekrutmen.
              </small>
            </span>
          </label>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="h-11 rounded-md border border-[#d6dfed] bg-white px-5 text-sm font-bold text-[#102d5b]"
            >
              Buka Halaman Biodata
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#43bd32] to-[#158a3b] px-6 text-sm font-bold text-white shadow-[0_14px_26px_rgba(35,149,47,0.24)]"
            >
              <FiSave />
              {isSaving ? "Menyimpan..." : "Simpan Dokumen"}
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-[10px] border border-[#dfe8f5] bg-gradient-to-r from-[#eef9ed] via-white to-[#edf6ff] p-4 shadow-[0_12px_28px_rgba(21,54,92,0.05)] sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-green-600">
              <FiShield />
            </span>
            <div>
              <h4 className="text-sm font-bold text-[#10315f]">
                Catatan Verifikasi Dokumen
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-[#4c6685]">
                Dokumen yang valid dan lengkap akan mempercepat proses seleksi
                administrasi. Jika ada revisi, Anda akan mendapatkan notifikasi pada
                dashboard.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default DokumenSaya;


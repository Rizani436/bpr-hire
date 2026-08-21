import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBookOpen,
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiEye,
  FiFileText,
  FiMail,
  FiMapPin,
  FiPhone,
  FiShield,
  FiStar,
  FiUser,
  FiX,
} from "react-icons/fi";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardUser } from "../../utils/authUser";
import { getDashboardApplications } from "../../utils/applications";

const DOCUMENT_FIELDS = [
  { key: "cvFileName", label: "Curriculum Vitae (CV)" },
  { key: "certificateFileName", label: "Sertifikat Pendukung" },
  { key: "experienceLetterFileName", label: "Surat Pengalaman Kerja" },
  { key: "ktpFileName", label: "KTP" },
  { key: "ijazahFileName", label: "Ijazah Terakhir" },
];

const SECTION_ITEMS = [
  {
    id: "biodata",
    label: "Biodata",
    icon: FiUser,
    description: "Identitas utama peserta",
    fields: [
      "fullName",
      "username",
      "email",
      "phone",
      "nik",
      "birthPlace",
      "birthDate",
      "gender",
      "address",
    ],
  },
  {
    id: "pendidikan",
    label: "Pendidikan",
    icon: FiBookOpen,
    description: "Riwayat akademik peserta",
    fields: ["lastEducation", "major", "institution", "graduationYear", "gpa"],
  },
  {
    id: "keahlian",
    label: "Keahlian",
    icon: FiBriefcase,
    description: "Kompetensi dan pengalaman kerja",
    fields: [
      "mainSkill",
      "computerSkill",
      "languageSkill",
      "workExperience",
    ],
  },
  {
    id: "berkas",
    label: "Berkas",
    icon: FiFileText,
    description: "Status dokumen lamaran",
    fields: [],
  },
];

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeStatus(status) {
  const text = String(status || "").toLowerCase();

  if (text.includes("ditolak") || text.includes("tolak")) {
    return "Ditolak";
  }

  if (text.includes("diterima") || text.includes("selesai")) {
    return "Diterima";
  }

  return "Sedang Diverifikasi";
}

function getStatusTone(status) {
  const text = String(status || "").toLowerCase();

  if (text.includes("diterima")) {
    return "bg-green-50 text-green-700";
  }

  if (text.includes("ditolak")) {
    return "bg-red-50 text-red-700";
  }

  return "bg-yellow-50 text-yellow-700";
}

function isFilled(value) {
  if (typeof value === "boolean") return value;
  return cleanText(value).length > 0;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getValueOrDash(value) {
  return cleanText(value) || "-";
}

function getFileExtension(fileName) {
  const normalizedName = cleanText(fileName);
  const lastDotIndex = normalizedName.lastIndexOf(".");
  if (lastDotIndex < 0) return "";
  return normalizedName.slice(lastDotIndex + 1).toLowerCase();
}

function resolvePreviewType(extension) {
  if (!extension) return "text";

  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];
  if (imageExtensions.includes(extension)) return "image";
  if (extension === "pdf") return "pdf";
  return "text";
}

function buildDocumentRows(sourceData) {
  return DOCUMENT_FIELDS.map((item) => {
    const fileName = cleanText(sourceData?.[item.key]);
    const dataUrl = cleanText(sourceData?.[`${item.key}DataUrl`]);
    const extension = getFileExtension(fileName);

    return {
      ...item,
      fileName,
      uploaded: fileName.length > 0,
      dataUrl,
      previewType: resolvePreviewType(extension),
    };
  });
}

function buildDocumentSummaryText(activeDetail, document) {
  return [
    "RINGKASAN BERKAS PESERTA",
    "",
    `Nama Peserta   : ${activeDetail?.candidate || "-"}`,
    `Username       : ${activeDetail?.username || "-"}`,
    `Posisi Dilamar : ${activeDetail?.role || "-"}`,
    `ID Verifikasi  : ${activeDetail?.verificationId || "-"}`,
    "",
    `Jenis Berkas   : ${document?.label || "-"}`,
    `Nama File      : ${document?.fileName || "-"}`,
    `Status Berkas  : ${document?.uploaded ? "Lengkap" : "Belum Ada"}`,
    "",
    `Generated At   : ${new Date().toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    })}`,
    "",
    "Catatan:",
    "File asli belum tersimpan pada server dalam mode demo ini.",
    "Dokumen ini merupakan ringkasan data berkas untuk kebutuhan verifikasi.",
  ].join("\n");
}

function buildProfileFromSource(sourceData, candidate, username) {
  return {
    fullName: candidate,
    username,
    email: cleanText(sourceData?.email),
    phone: cleanText(sourceData?.phone),
    nik: cleanText(sourceData?.nik),
    birthPlace: cleanText(sourceData?.birthPlace),
    birthDate: cleanText(sourceData?.birthDate),
    gender: cleanText(sourceData?.gender),
    address: cleanText(sourceData?.address),
    lastEducation: cleanText(sourceData?.lastEducation),
    major: cleanText(sourceData?.major),
    institution: cleanText(sourceData?.institution),
    graduationYear: cleanText(sourceData?.graduationYear),
    gpa: cleanText(sourceData?.gpa),
    mainSkill: cleanText(sourceData?.mainSkill),
    computerSkill: cleanText(sourceData?.computerSkill),
    languageSkill: cleanText(sourceData?.languageSkill),
    workExperience: cleanText(sourceData?.workExperience),
    documentReady: Boolean(sourceData?.documentReady),
  };
}

function buildDetailFromApplication(application, index) {
  const applicant = application?.applicant || {};
  const defaultVerificationId = `VRF-APP-${String(index + 1).padStart(3, "0")}`;
  const verificationId = cleanText(application?.verificationId) || defaultVerificationId;
  const candidate =
    cleanText(application?.candidate) || cleanText(applicant.fullName) || "Peserta";
  const username =
    cleanText(application?.candidateUsername) || cleanText(applicant.username) || "-";
  const role = cleanText(application?.role) || "Posisi belum ditentukan";
  const submittedAt = formatDateTime(application?.appliedAt);

  return {
    verificationId,
    candidate,
    username,
    role,
    status: normalizeStatus(application?.status),
    sourceType: "application",
    notes:
      "Data kandidat berasal dari peserta yang berhasil mendaftar pada lamaran ini.",
    submittedAt,
    lastUpdate: submittedAt,
    profile: buildProfileFromSource(applicant, candidate, username),
    documents: buildDocumentRows(applicant),
  };
}

function buildDetailFromQueueItem(item) {
  const candidate = cleanText(item.candidate) || "Peserta";
  const username =
    candidate.toLowerCase().replace(/\s+/g, ".");
  const fallback = {};

  return {
    verificationId: cleanText(item.id) || "-",
    candidate,
    username,
    role: cleanText(item.role) || "Posisi belum ditentukan",
    status: normalizeStatus(item.status),
    sourceType: "queue",
    notes:
      cleanText(item.notes) ||
      "Periksa kesesuaian biodata, dokumen, dan posisi yang dilamar sebelum lanjut ke validasi akhir.",
    submittedAt: cleanText(item.submittedAt) || "-",
    lastUpdate: cleanText(item.lastUpdate) || cleanText(item.submittedAt) || "-",
    profile: buildProfileFromSource(fallback, candidate, username),
    documents: buildDocumentRows(fallback),
  };
}

function calculateSectionCompletion(profile, documents, section) {
  if (section.id === "berkas") {
    if (!Array.isArray(documents) || documents.length === 0) return 0;
    const uploadedCount = documents.filter((document) => document.uploaded).length;
    return Math.round((uploadedCount / documents.length) * 100);
  }

  if (!Array.isArray(section.fields) || section.fields.length === 0) return 0;
  const filledCount = section.fields.filter((field) => isFilled(profile?.[field])).length;
  return Math.round((filledCount / section.fields.length) * 100);
}

function buildSectionRows(activeDetail) {
  const profile = activeDetail?.profile || {};
  return {
    biodata: [
      { label: "Nama Lengkap", value: profile.fullName },
      { label: "Username", value: profile.username },
      { label: "Email", value: profile.email },
      { label: "Nomor HP", value: profile.phone },
      { label: "NIK", value: profile.nik },
      {
        label: "Tempat / Tanggal Lahir",
        value: `${getValueOrDash(profile.birthPlace)} / ${getValueOrDash(profile.birthDate)}`,
      },
      { label: "Jenis Kelamin", value: profile.gender },
      { label: "Alamat Domisili", value: profile.address, fullWidth: true },
    ],
    pendidikan: [
      { label: "Pendidikan Terakhir", value: profile.lastEducation },
      { label: "Jurusan", value: profile.major },
      { label: "Institusi", value: profile.institution, fullWidth: true },
      { label: "Tahun Lulus", value: profile.graduationYear },
      { label: "IPK / Nilai Akhir", value: profile.gpa },
    ],
    keahlian: [
      { label: "Keahlian Utama", value: profile.mainSkill, fullWidth: true },
      { label: "Kemampuan Komputer", value: profile.computerSkill, fullWidth: true },
      { label: "Bahasa", value: profile.languageSkill },
      { label: "Pengalaman Kerja", value: profile.workExperience, fullWidth: true },
    ],
  };
}

function SectionDataGrid({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <article
          key={row.label}
          className={`rounded-xl border border-[#dbe6f6] bg-[#fbfdff] px-4 py-3 ${
            row.fullWidth ? "sm:col-span-2" : ""
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#6f86a2]">
            {row.label}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#163861]">{getValueOrDash(row.value)}</p>
        </article>
      ))}
    </div>
  );
}

function CekData() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verificationId = "" } = useParams();
  const currentUser = getDashboardUser();
  const [activeSection, setActiveSection] = useState("biodata");
  const [previewDocument, setPreviewDocument] = useState(null);

  useEffect(() => {
    setActiveSection("biodata");
    setPreviewDocument(null);
  }, [verificationId]);

  const applicationDetails = useMemo(
    () =>
      getDashboardApplications().map((application, index) =>
        buildDetailFromApplication(application, index)
      ),
    []
  );

  const activeDetail = useMemo(() => {
    const routeId = cleanText(decodeURIComponent(verificationId));
    if (!routeId) return null;

    const fromApplications = applicationDetails.find(
      (item) => item.verificationId === routeId
    );
    if (fromApplications) return fromApplications;

    const queueItemFromState = location.state?.verificationItem;
    if (queueItemFromState && cleanText(queueItemFromState.id) === routeId) {
      return buildDetailFromQueueItem(queueItemFromState);
    }

    return null;
  }, [applicationDetails, location.state, verificationId]);

  const sectionStats = useMemo(() => {
    if (!activeDetail) return [];

    return SECTION_ITEMS.map((section) => ({
      ...section,
      completion: calculateSectionCompletion(
        activeDetail.profile,
        activeDetail.documents,
        section
      ),
    }));
  }, [activeDetail]);

  const sectionRows = useMemo(() => buildSectionRows(activeDetail), [activeDetail]);
  const activeSectionMeta =
    sectionStats.find((section) => section.id === activeSection) || sectionStats[0] || null;

  const handleOpenPreview = (doc) => {
    if (!doc?.uploaded || !activeDetail) return;

    setPreviewDocument({
      ...doc,
      candidate: activeDetail.candidate,
      username: activeDetail.username,
      role: activeDetail.role,
      verificationId: activeDetail.verificationId,
    });
  };

  const handleClosePreview = () => {
    setPreviewDocument(null);
  };

  const handleDownloadDocument = (doc) => {
    if (!doc?.uploaded || !activeDetail) return;

    const linkElement = window.document.createElement("a");

    if (doc.dataUrl) {
      linkElement.href = doc.dataUrl;
      linkElement.download = doc.fileName || `${doc.key || "berkas"}.txt`;
      linkElement.click();
      return;
    }

    const summaryText = buildDocumentSummaryText(activeDetail, doc);
    const blob = new Blob([summaryText], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const baseName = (doc.fileName || doc.key || "berkas").replace(
      /\.[^/.]+$/,
      ""
    );

    linkElement.href = objectUrl;
    linkElement.download = `${baseName}-ringkasan.txt`;
    linkElement.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };

  return (
    <div className="bh-dashboard-shell min-h-screen bg-[#f7fbff] text-[#09275a] lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="bh-dashboard-sidebar-shell border-b border-[#dfe8f5] bg-white p-4 shadow-[12px_0_40px_rgba(20,57,96,0.05)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:border-b-0 lg:border-r lg:px-4 lg:py-8">
        <Sidebar role="pengawas" />
      </aside>

      <main className="bh-dashboard-main min-w-0 px-4 py-6 sm:px-6 lg:px-9 lg:py-10">
        <Header user={{ ...currentUser, role: "pengawas" }} />

        <section className="mb-6 rounded-[12px] border border-[#dfe8f5] bg-white p-5 shadow-[0_16px_36px_rgba(21,54,92,0.08)] sm:p-6">
          <p className="text-sm font-semibold text-blue-600">Pengawas Rekrutmen</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
            Cek Data Peserta
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
            Klik bagian data di bawah untuk meninjau biodata, pendidikan, keahlian,
            dan berkas peserta yang mendaftar.
          </p>
        </section>

        {!activeDetail ? (
          <section className="rounded-[12px] border border-dashed border-[#cddbf0] bg-white px-5 py-10 text-center shadow-[0_12px_28px_rgba(21,54,92,0.04)] sm:px-6">
            <FiAlertCircle className="mx-auto text-3xl text-[#5b7390]" />
            <p className="mt-3 text-sm text-[#607792]">
              Data kandidat tidak ditemukan. Silakan kembali ke antrian verifikasi.
            </p>
            <button
              type="button"
              onClick={() => navigate("/pengawas/antrian-verifikasi")}
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cddbf0] bg-[#edf5ff] px-4 text-sm font-bold text-[#10315f]"
            >
              <FiArrowLeft />
              Kembali ke Antrian
            </button>
          </section>
        ) : (
          <>
            <section className="mb-6 rounded-[12px] border border-[#dfe8f5] bg-gradient-to-br from-[#f8fcff] via-white to-[#f2f9f1] p-5 shadow-[0_16px_36px_rgba(21,54,92,0.08)] sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-[25px] font-extrabold leading-tight text-[#102d5b]">
                    {activeDetail.candidate}
                  </h3>
                  <p className="mt-1 text-sm text-[#607792]">{activeDetail.role}</p>
                  <p className="mt-1 text-xs text-[#607792]">
                    ID Verifikasi: {activeDetail.verificationId}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex w-max items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${getStatusTone(
                      activeDetail.status
                    )}`}
                  >
                    <FiShield />
                    {activeDetail.status}
                  </span>
                  <span className="inline-flex w-max items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                    <FiStar />
                    {activeDetail.sourceType === "application"
                      ? "Data Pendaftar"
                      : "Data Ringkasan Antrian"}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-lg border border-[#d7e5f8] bg-white px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#6f86a2]">
                    Email
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#204067]">
                    <FiMail />
                    {getValueOrDash(activeDetail.profile.email)}
                  </p>
                </article>
                <article className="rounded-lg border border-[#d7e5f8] bg-white px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#6f86a2]">
                    Nomor HP
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#204067]">
                    <FiPhone />
                    {getValueOrDash(activeDetail.profile.phone)}
                  </p>
                </article>
                <article className="rounded-lg border border-[#d7e5f8] bg-white px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#6f86a2]">
                    Domisili
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#204067]">
                    <FiMapPin />
                    {getValueOrDash(activeDetail.profile.birthPlace)}
                  </p>
                </article>
                <article className="rounded-lg border border-[#d7e5f8] bg-white px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#6f86a2]">
                    Dokumen Siap
                  </p>
                  <p
                    className={`mt-1 inline-flex items-center gap-1.5 text-xs font-semibold ${
                      activeDetail.profile.documentReady
                        ? "text-green-700"
                        : "text-orange-700"
                    }`}
                  >
                    {activeDetail.profile.documentReady ? <FiCheckCircle /> : <FiAlertCircle />}
                    {activeDetail.profile.documentReady ? "Ya" : "Belum"}
                  </p>
                </article>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-[#4f6984] sm:grid-cols-2">
                <p className="inline-flex items-center gap-1.5">
                  <FiClock />
                  Masuk antrian: {activeDetail.submittedAt}
                </p>
                <p className="inline-flex items-center gap-1.5">
                  <FiClock />
                  Update terakhir: {activeDetail.lastUpdate}
                </p>
              </div>
              <p className="mt-3 rounded-lg border border-[#dfe8f5] bg-white px-3 py-2 text-xs leading-relaxed text-[#4f6984]">
                {activeDetail.notes}
              </p>
            </section>

            <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {sectionStats.map((section) => {
                const Icon = section.icon;
                const isActive = activeSectionMeta?.id === section.id;

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      isActive
                        ? "border-green-300 bg-green-50 shadow-[0_14px_28px_rgba(31,148,60,0.12)]"
                        : "border-[#dbe6f6] bg-white hover:bg-[#f9fcff]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-xl text-[#18467e]">
                        <Icon />
                      </span>
                      <span className="text-xs font-extrabold text-[#134173]">
                        {section.completion}%
                      </span>
                    </div>
                    <h4 className="mt-3 text-sm font-bold text-[#153a67]">
                      Bagian {section.label}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-[#607792]">
                      {section.description}
                    </p>
                  </button>
                );
              })}
            </section>

            <section className="rounded-[12px] border border-[#dfe8f5] bg-white p-5 shadow-[0_16px_36px_rgba(21,54,92,0.08)] sm:p-6">
              {activeSectionMeta && (
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl text-[#17477d]">
                      <activeSectionMeta.icon />
                    </span>
                    <div>
                      <h3 className="text-lg font-extrabold text-[#102d5b]">
                        Bagian {activeSectionMeta.label}
                      </h3>
                      <p className="text-xs text-[#607792]">{activeSectionMeta.description}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    Kelengkapan {activeSectionMeta.completion}%
                  </span>
                </div>
              )}

              {activeSectionMeta?.id === "biodata" && (
                <SectionDataGrid rows={sectionRows.biodata} />
              )}

              {activeSectionMeta?.id === "pendidikan" && (
                <SectionDataGrid rows={sectionRows.pendidikan} />
              )}

              {activeSectionMeta?.id === "keahlian" && (
                <SectionDataGrid rows={sectionRows.keahlian} />
              )}

              {activeSectionMeta?.id === "berkas" && (
                <div className="grid gap-3">
                  {activeDetail.documents.map((document) => (
                    <article
                      key={document.key}
                      className="rounded-xl border border-[#dbe6f6] bg-[#fbfdff] px-4 py-3"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-bold text-[#163861]">{document.label}</p>
                        <span
                          className={`inline-flex w-max items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            document.uploaded
                              ? "bg-green-100 text-green-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {document.uploaded ? <FiCheckCircle /> : <FiAlertCircle />}
                          {document.uploaded ? "Lengkap" : "Belum Ada"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#607792]">
                        {document.uploaded ? document.fileName : "File belum diunggah."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(document)}
                          disabled={!document.uploaded}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-[#c9daef] bg-white px-3 text-xs font-semibold text-[#1b4f86] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          <FiEye />
                          Lihat
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadDocument(document)}
                          disabled={!document.uploaded}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-green-200 bg-green-50 px-3 text-xs font-semibold text-green-700 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          <FiDownload />
                          Unduh
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-6 rounded-[12px] border border-[#dfe8f5] bg-gradient-to-r from-[#edf6ff] via-white to-[#eef9ed] p-4 shadow-[0_12px_28px_rgba(21,54,92,0.05)] sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-xs leading-relaxed text-[#4c6685]">
                  Jika ada data yang belum lengkap, pengawas dapat mengembalikan status
                  ke <strong>Perlu Review</strong> agar peserta melengkapi data dan
                  dokumen sebelum lanjut ke validasi akhir.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/pengawas/antrian-verifikasi")}
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-[#cddbf0] bg-white px-4 text-sm font-bold text-[#10315f]"
                >
                  <FiArrowLeft />
                  Kembali
                </button>
              </div>
            </section>

            {previewDocument && (
              <div className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(10,31,58,0.36)] p-4 backdrop-blur-[6px]">
                <div className="w-full max-w-[720px] rounded-[16px] border border-[#d6dfed] bg-white p-5 shadow-[0_28px_70px_rgba(9,39,90,0.22)] sm:p-6">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.05em] text-[#5d7898]">
                        Preview Berkas
                      </p>
                      <h3 className="mt-1 text-lg font-extrabold text-[#10315f]">
                        {previewDocument.label}
                      </h3>
                      <p className="mt-1 text-xs text-[#607792]">
                        {previewDocument.fileName} - {previewDocument.candidate}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClosePreview}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d5dfef] bg-white text-[#365a84]"
                      aria-label="Tutup preview"
                    >
                      <FiX />
                    </button>
                  </div>

                  <div className="rounded-xl border border-[#dbe6f6] bg-[#fbfdff] p-4">
                    {previewDocument.dataUrl && previewDocument.previewType === "image" && (
                      <img
                        src={previewDocument.dataUrl}
                        alt={previewDocument.fileName}
                        className="mx-auto max-h-[420px] w-auto rounded-lg object-contain"
                      />
                    )}

                    {previewDocument.dataUrl && previewDocument.previewType === "pdf" && (
                      <iframe
                        src={previewDocument.dataUrl}
                        title={previewDocument.fileName}
                        className="h-[420px] w-full rounded-lg border border-[#d2def0] bg-white"
                      />
                    )}

                    {(!previewDocument.dataUrl || previewDocument.previewType === "text") && (
                      <div className="grid gap-2 text-sm text-[#1d406d]">
                        <p>
                          <span className="font-bold">Nama File:</span>{" "}
                          {previewDocument.fileName}
                        </p>
                        <p>
                          <span className="font-bold">Jenis Berkas:</span>{" "}
                          {previewDocument.label}
                        </p>
                        <p>
                          <span className="font-bold">Peserta:</span>{" "}
                          {previewDocument.candidate} ({previewDocument.username})
                        </p>
                        <p>
                          <span className="font-bold">Posisi:</span>{" "}
                          {previewDocument.role}
                        </p>
                        <p className="rounded-lg border border-[#d8e5f8] bg-white px-3 py-2 text-xs text-[#55708f]">
                          Preview file asli belum tersedia pada mode demo. Anda tetap
                          bisa mengunduh ringkasan berkas melalui tombol Unduh.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadDocument(previewDocument)}
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 text-sm font-bold text-green-700"
                    >
                      <FiDownload />
                      Unduh
                    </button>
                    <button
                      type="button"
                      onClick={handleClosePreview}
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d4dfef] bg-white px-4 text-sm font-bold text-[#163b66]"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default CekData;


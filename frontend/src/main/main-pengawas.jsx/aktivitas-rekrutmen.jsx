import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiFilter,
  FiSearch,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import Swal from "sweetalert2";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardUser } from "../../utils/authUser";
import { getDashboardApplications } from "../../utils/applications";
import { getMasterVacancies, getVacancyOpenStatus } from "../../utils/masterVacancies";

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeStatus(status) {
  const text = cleanText(status).toLowerCase();

  if (text.includes("ditolak") || text.includes("tolak")) {
    return "Ditolak";
  }
  if (text.includes("diterima") || text.includes("selesai")) {
    return "Diterima";
  }
  return "Sedang Diverifikasi";
}

function formatDateLabel(value, fallback = "-") {
  const text = cleanText(value);
  if (!text) return fallback;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;

  return parsed.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapVacancyStatus(statusKey) {
  if (statusKey === "open") {
    return {
      label: "Dibuka",
      tone: "bg-green-100 text-green-700",
    };
  }
  if (statusKey === "scheduled") {
    return {
      label: "Terjadwal",
      tone: "bg-blue-100 text-blue-700",
    };
  }
  if (statusKey === "expired") {
    return {
      label: "Periode Berakhir",
      tone: "bg-orange-100 text-orange-700",
    };
  }

  return {
    label: "Nonaktif",
    tone: "bg-slate-100 text-slate-700",
  };
}

function AktivitasRekrutmen() {
  const navigate = useNavigate();
  const currentUser = getDashboardUser();
  const applications = getDashboardApplications();
  const [masterVacancies, setMasterVacancies] = useState(() => getMasterVacancies());
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua Status");
  const [selectedVacancyId, setSelectedVacancyId] = useState("");

  useEffect(() => {
    const refreshVacancies = () => {
      setMasterVacancies(getMasterVacancies());
    };

    window.addEventListener("focus", refreshVacancies);
    window.addEventListener("storage", refreshVacancies);

    return () => {
      window.removeEventListener("focus", refreshVacancies);
      window.removeEventListener("storage", refreshVacancies);
    };
  }, []);

  const postedVacancies = useMemo(() => {
    return masterVacancies.map((vacancy, index) => {
      const statusKey = getVacancyOpenStatus(vacancy);
      const statusView = mapVacancyStatus(statusKey);
      return {
        id: cleanText(vacancy.id) || `master-${index + 1}`,
        title: cleanText(vacancy.title) || "Posisi belum ditentukan",
        department: cleanText(vacancy.department) || "Departemen belum diisi",
        location: cleanText(vacancy.location) || "Lokasi belum diisi",
        type: cleanText(vacancy.type) || "Full Time",
        statusKey,
        statusLabel: statusView.label,
        statusTone: statusView.tone,
        source: "Master Data Lamaran",
      };
    });
  }, [masterVacancies]);

  const vacancyCards = useMemo(() => {
    return postedVacancies
      .map((vacancy) => {
        const applicants = applications.filter(
          (application) =>
            cleanText(application.role).toLowerCase() ===
            cleanText(vacancy.title).toLowerCase()
        );

        return {
          ...vacancy,
          applicantCount: applicants.length,
        };
      })
      .sort((left, right) => right.applicantCount - left.applicantCount);
  }, [postedVacancies, applications]);

  const filteredVacancies = useMemo(() => {
    const keyword = cleanText(searchKeyword).toLowerCase();

    return vacancyCards.filter((vacancy) => {
      const matchesKeyword =
        !keyword ||
        vacancy.title.toLowerCase().includes(keyword) ||
        vacancy.department.toLowerCase().includes(keyword) ||
        vacancy.location.toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "Semua Status" || vacancy.statusLabel === statusFilter;

      return matchesKeyword && matchesStatus;
    });
  }, [vacancyCards, searchKeyword, statusFilter]);

  useEffect(() => {
    if (!selectedVacancyId) return;
    const stillExists = filteredVacancies.some(
      (vacancy) => vacancy.id === selectedVacancyId
    );
    if (!stillExists) {
      setSelectedVacancyId("");
    }
  }, [filteredVacancies, selectedVacancyId]);

  const selectedVacancy = useMemo(
    () => filteredVacancies.find((vacancy) => vacancy.id === selectedVacancyId) || null,
    [filteredVacancies, selectedVacancyId]
  );

  const selectedApplicants = useMemo(() => {
    if (!selectedVacancy) return [];

    return applications
      .filter(
        (application) =>
          cleanText(application.role).toLowerCase() ===
          cleanText(selectedVacancy.title).toLowerCase()
      )
      .map((application, index) => ({
        no: index + 1,
        candidate:
          cleanText(application.candidate) ||
          cleanText(application.applicant?.fullName) ||
          "Peserta",
        role: cleanText(application.role) || "-",
        verificationId: cleanText(application.verificationId) || "-",
        appliedAt: formatDateLabel(application.appliedAt),
        status: normalizeStatus(application.status),
        stage: cleanText(application.stage) || "Seleksi Administrasi",
        progress: Number(application.progress || 0),
        source: cleanText(application.branch) || "BPR HIRE",
      }));
  }, [applications, selectedVacancy]);

  const summary = useMemo(() => {
    const openVacancies = vacancyCards.filter(
      (vacancy) => vacancy.statusKey === "open"
    ).length;
    const applicants = applications.length;
    const selectedCount = selectedApplicants.length;

    return {
      totalVacancies: vacancyCards.length,
      openVacancies,
      applicants,
      selectedCount,
    };
  }, [vacancyCards, applications.length, selectedApplicants.length]);

  const handleOpenDetail = async (applicant) => {
    await Swal.fire({
      title: "Detail Aktivitas Peserta",
      html: `
        <div style="text-align:left;line-height:1.55;">
          <p><strong>Nama Peserta:</strong> ${applicant.candidate}</p>
          <p><strong>Lamaran:</strong> ${applicant.role}</p>
          <p><strong>ID Verifikasi:</strong> ${applicant.verificationId}</p>
          <p><strong>Tanggal Daftar:</strong> ${applicant.appliedAt}</p>
          <p><strong>Status:</strong> ${applicant.status}</p>
          <p><strong>Tahap Saat Ini:</strong> ${applicant.stage}</p>
          <p><strong>Progress:</strong> ${applicant.progress}%</p>
          <p><strong>Sumber Data:</strong> ${applicant.source}</p>
        </div>
      `,
      confirmButtonText: "Tutup",
      confirmButtonColor: "#1d4ed8",
      width: 620,
    });
  };

  return (
    <div className="bh-dashboard-shell min-h-screen bg-[#f7fbff] text-[#09275a] lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="bh-dashboard-sidebar-shell border-b border-[#dfe8f5] bg-white p-4 shadow-[12px_0_40px_rgba(20,57,96,0.05)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:border-b-0 lg:border-r lg:px-4 lg:py-8">
        <Sidebar role="pengawas" />
      </aside>

      <main className="bh-dashboard-main min-w-0 px-4 py-6 sm:px-6 lg:px-9 lg:py-10">
        <Header user={{ ...currentUser, role: "pengawas" }} />

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <p className="text-sm font-semibold text-blue-600">Pengawas Rekrutmen</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
            Aktivitas Rekrutmen
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
            Pilih dulu lamaran yang dipost ke peserta, lalu lihat tabel peserta
            yang memilih lamaran tersebut beserta aksi detail aktivitasnya.
          </p>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Total Lamaran Dipost</p>
            <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">
              {summary.totalVacancies}
            </h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Lamaran Aktif</p>
            <h3 className="mt-2 text-3xl font-bold text-green-700">
              {summary.openVacancies}
            </h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Peserta Mendaftar</p>
            <h3 className="mt-2 text-3xl font-bold text-blue-700">
              {summary.applicants}
            </h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Dipilih di Lamaran Aktif</p>
            <h3 className="mt-2 text-3xl font-bold text-violet-700">
              {summary.selectedCount}
            </h3>
          </article>
        </section>

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FiFilter className="text-[#17355e]" />
            <h3 className="text-lg font-bold text-[#102d5b]">
              Lamaran Dipost ke Peserta
            </h3>
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
              Cari Lamaran
              <div className="flex h-11 items-center gap-2 rounded-lg border border-[#d6dfed] bg-white px-3">
                <FiSearch className="text-[#5f7894]" />
                <input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  type="text"
                  className="h-full w-full border-0 bg-transparent text-sm font-normal outline-none"
                  placeholder="Judul / departemen / lokasi"
                />
              </div>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
              Status Lamaran
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none"
              >
                <option value="Semua Status">Semua Status</option>
                <option value="Dibuka">Dibuka</option>
                <option value="Terjadwal">Terjadwal</option>
                <option value="Periode Berakhir">Periode Berakhir</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </label>
          </div>

          {filteredVacancies.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
              <FiShield className="mx-auto text-2xl text-[#5b7390]" />
              <p className="mt-2 text-sm text-[#607792]">
                Belum ada lamaran yang sesuai filter.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredVacancies.map((vacancy) => {
                const isSelected = selectedVacancyId === vacancy.id;

                return (
                  <article
                    key={vacancy.id}
                    className={`rounded-lg border p-4 transition ${
                      isSelected
                        ? "border-blue-300 bg-blue-50/40 shadow-[0_10px_24px_rgba(18,81,160,0.12)]"
                        : "border-[#dfe8f5] bg-[#fbfdff]"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-[#102d5b]">{vacancy.title}</p>
                        <p className="mt-1 text-xs text-[#607792]">{vacancy.department}</p>
                        <p className="mt-1 text-xs text-[#607792]">
                          {vacancy.location} - {vacancy.type}
                        </p>
                      </div>
                      <span
                        className={`w-max rounded-full px-2.5 py-1 text-[11px] font-semibold ${vacancy.statusTone}`}
                      >
                        {vacancy.statusLabel}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#4e6885]">
                      <span className="inline-flex items-center gap-1">
                        <FiUsers />
                        {vacancy.applicantCount} peserta memilih
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FiFileText />
                        {vacancy.source}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedVacancyId(vacancy.id)}
                      className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-3 text-xs font-bold text-[#17477d]"
                    >
                      Pilih Lamaran
                      <FiArrowRight />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FiCalendar className="text-[#17355e]" />
              <h3 className="text-lg font-bold text-[#102d5b]">
                Tabel Peserta Berdasarkan Lamaran
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate("/pengawas/antrian-verifikasi")}
                className="inline-flex items-center gap-1 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-3 py-1.5 text-xs font-semibold text-[#17477d]"
              >
                Antrian Verifikasi
                <FiArrowRight />
              </button>
              <button
                type="button"
                onClick={() => navigate("/pengawas/tracking-progress")}
                className="inline-flex items-center gap-1 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-3 py-1.5 text-xs font-semibold text-[#17477d]"
              >
                Tracking Progress
                <FiArrowRight />
              </button>
            </div>
          </div>

          {!selectedVacancy ? (
            <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
              <FiBriefcase className="mx-auto text-2xl text-[#5b7390]" />
              <p className="mt-2 text-sm text-[#607792]">
                Pilih salah satu lamaran di atas untuk menampilkan tabel peserta.
              </p>
            </div>
          ) : selectedApplicants.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
              <FiClock className="mx-auto text-2xl text-[#5b7390]" />
              <p className="mt-2 text-sm text-[#607792]">
                Belum ada peserta yang memilih lamaran{" "}
                <strong>{selectedVacancy.title}</strong>.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#dbe6f6]">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-[#f4f8ff] text-[#123360]">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.04em]">No</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.04em]">Nama Peserta</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.04em]">ID Verifikasi</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.04em]">Tanggal Daftar</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.04em]">Status</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.04em]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4ebf7] bg-white">
                  {selectedApplicants.map((applicant) => (
                    <tr key={`${applicant.verificationId}-${applicant.no}`} className="hover:bg-[#fbfdff]">
                      <td className="px-4 py-3 text-xs text-[#4f6984]">{applicant.no}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-[#102d5b]">{applicant.candidate}</p>
                        <p className="mt-1 text-xs text-[#607792]">{applicant.role}</p>
                      </td>
                      <td className="px-4 py-3 text-[#48627f]">{applicant.verificationId}</td>
                      <td className="px-4 py-3 text-[#48627f]">{applicant.appliedAt}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            applicant.status === "Diterima"
                              ? "bg-green-100 text-green-700"
                              : applicant.status === "Ditolak"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {applicant.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(applicant)}
                          className="inline-flex items-center gap-1 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-3 py-1.5 text-xs font-semibold text-[#17477d]"
                        >
                          <FiCheckCircle />
                          Detail Aktivitas
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AktivitasRekrutmen;


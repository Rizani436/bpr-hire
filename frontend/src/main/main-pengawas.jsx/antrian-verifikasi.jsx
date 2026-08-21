import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  FiArrowRightCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiFilter,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUserCheck,
} from "react-icons/fi";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardUser } from "../../utils/authUser";
import {
  fetchLamaranApplicationsFromBackend,
  removeDashboardApplicationByApplicationUUID,
} from "../../utils/applications";
import { deleteLamaranApplicationApi } from "../../utils/authApi";

const STATUS_OPTIONS = [
  "Semua Status",
  "Sedang Diverifikasi",
  "Ditolak",
  "Diterima",
];

function formatQueueDate(dateValue) {
  if (!dateValue) return "-";

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return String(dateValue);

  return parsedDate.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function cleanText(value) {
  return String(value || "").trim();
}

function buildQueueData(applications = []) {
  return applications.map((application, index) => {
    const defaultVerificationId = `VRF-APP-${String(index + 1).padStart(3, "0")}`;
    const verificationId = String(application.verificationId || defaultVerificationId);
    const submittedAt = formatQueueDate(application.appliedAt);

    return {
      id: verificationId,
      applicationUUID: cleanText(application.applicationUUID || application.id),
      candidate: application.candidate || application.applicant?.fullName || "Peserta",
      role: application.role || "Posisi belum ditentukan",
      submittedAt,
      status: normalizeStatus(application.status),
      lastUpdate: submittedAt,
      notes:
        "Pelamar berhasil mendaftar pada lamaran ini. Lakukan pengecekan biodata dan berkas pada tombol Cek Data.",
      source: "application",
      applicationId: application.id,
    };
  });
}

function getStatusTone(status) {
  const text = String(status || "").toLowerCase();

  if (text.includes("diterima")) {
    return "bg-green-100 text-green-700";
  }
  if (text.includes("ditolak")) {
    return "bg-red-100 text-red-700";
  }
  if (text.includes("diverifikasi")) {
    return "bg-yellow-100 text-yellow-700";
  }

  return "bg-slate-100 text-slate-700";
}

function getStatusActionConfig(status) {
  if (status === "Diterima") {
    return {
      title: "Setujui Peserta?",
      message: "Peserta akan ditandai sebagai Diterima.",
      loadingMessage: "Mengirim status Diterima...",
      successMessage: "Status peserta berhasil diubah menjadi Diterima.",
      confirmButtonColor: "#15803d",
    };
  }

  if (status === "Ditolak") {
    return {
      title: "Tolak Peserta?",
      message: "Peserta akan ditandai sebagai Ditolak.",
      loadingMessage: "Mengirim status Ditolak...",
      successMessage: "Status peserta berhasil diubah menjadi Ditolak.",
      confirmButtonColor: "#b91c1c",
    };
  }

  return {
    title: "Kembalikan ke Proses Verifikasi?",
    message: "Peserta akan ditandai sebagai Sedang Diverifikasi.",
    loadingMessage: "Mengirim status Sedang Diverifikasi...",
    successMessage: "Status peserta berhasil diubah menjadi Sedang Diverifikasi.",
    confirmButtonColor: "#c29418",
  };
}

function AntrianVerifikasi() {
  const navigate = useNavigate();
  const currentUser = getDashboardUser();
  const [verificationQueue, setVerificationQueue] = useState([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [queueLoadError, setQueueLoadError] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua Status");

  const refreshQueue = async () => {
    setIsLoadingQueue(true);
    setQueueLoadError("");

    try {
      const applications = await fetchLamaranApplicationsFromBackend();
      setVerificationQueue(buildQueueData(applications));
    } catch (error) {
      setVerificationQueue([]);
      setQueueLoadError(
        cleanText(error?.message) || "Gagal memuat data antrian dari backend."
      );
    } finally {
      setIsLoadingQueue(false);
    }
  };

  useEffect(() => {
    void refreshQueue();
  }, []);

  const summary = useMemo(() => {
    const total = verificationQueue.length;
    const inReview = verificationQueue.filter(
      (item) => item.status === "Sedang Diverifikasi"
    ).length;
    const rejected = verificationQueue.filter(
      (item) => item.status === "Ditolak"
    ).length;
    const accepted = verificationQueue.filter((item) => item.status === "Diterima").length;

    return {
      total,
      inReview,
      rejected,
      accepted,
    };
  }, [verificationQueue]);

  const filteredQueue = useMemo(() => {
    const keyword = String(searchKeyword || "").trim().toLowerCase();

    return verificationQueue.filter((item) => {
      const matchesKeyword =
        !keyword ||
        String(item.candidate || "").toLowerCase().includes(keyword) ||
        String(item.role || "").toLowerCase().includes(keyword) ||
        String(item.id || "").toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "Semua Status" || String(item.status || "") === statusFilter;

      return matchesKeyword && matchesStatus;
    });
  }, [verificationQueue, searchKeyword, statusFilter]);

  const updateStatus = (id, nextStatus) => {
    setVerificationQueue((prevQueue) =>
      prevQueue.map((item) =>
        item.id === id
          ? {
              ...item,
              status: nextStatus,
              lastUpdate: new Date().toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            }
          : item
      )
    );
  };

  const handleStatusAction = async (item, nextStatus) => {
    const actionConfig = getStatusActionConfig(nextStatus);

    const confirmResult = await Swal.fire({
      title: actionConfig.title,
      text: `${item.candidate} - ${actionConfig.message}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Pilih",
      cancelButtonText: "Tidak",
      reverseButtons: true,
      confirmButtonColor: actionConfig.confirmButtonColor,
      cancelButtonColor: "#64748b",
    });

    if (!confirmResult.isConfirmed) return;

    Swal.fire({
      title: "Memproses",
      text: actionConfig.loadingMessage,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    await new Promise((resolve) => {
      window.setTimeout(resolve, 900);
    });

    updateStatus(item.id, nextStatus);
    Swal.close();

    await Swal.fire({
      title: "Berhasil",
      text: actionConfig.successMessage,
      icon: "success",
      confirmButtonText: "OK",
      confirmButtonColor: "#1d4ed8",
    });
  };

  const handleDeleteParticipant = async (item) => {
    const applicationUUID = cleanText(item?.applicationUUID);
    if (!applicationUUID) {
      await Swal.fire({
        icon: "error",
        iconColor: "#dc2626",
        title: "Data Tidak Valid",
        text: "Application UUID peserta tidak ditemukan.",
        confirmButtonText: "Tutup",
        confirmButtonColor: "#dc2626",
      });
      return;
    }

    const confirmation = await Swal.fire({
      icon: "warning",
      iconColor: "#dc2626",
      title: "Hapus Peserta?",
      text: `Data pendaftaran ${item.candidate} pada lamaran ${item.role} akan dihapus permanen.`,
      showCancelButton: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
      reverseButtons: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });

    if (!confirmation.isConfirmed) return;

    Swal.fire({
      title: "Menghapus Peserta...",
      html: `<p style="margin:0;color:#b91c1c;">Mohon tunggu, data peserta sedang dihapus.</p>`,
      color: "#7f1d1d",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const response = await deleteLamaranApplicationApi(applicationUUID);
      removeDashboardApplicationByApplicationUUID(applicationUUID);
      setVerificationQueue((currentQueue) =>
        currentQueue.filter(
          (queueItem) => cleanText(queueItem.applicationUUID) !== applicationUUID
        )
      );
      Swal.close();

      await Swal.fire({
        icon: "success",
        iconColor: "#dc2626",
        title: "Peserta Berhasil Dihapus",
        text:
          cleanText(response?.msg) ||
          `Data pendaftaran ${item.candidate} berhasil dihapus.`,
        confirmButtonText: "OK",
        confirmButtonColor: "#dc2626",
      });
    } catch (error) {
      Swal.close();
      await Swal.fire({
        icon: "error",
        iconColor: "#dc2626",
        title: "Gagal Menghapus Peserta",
        text:
          cleanText(error?.message) ||
          "Terjadi kendala saat menghapus data peserta. Silakan coba lagi.",
        confirmButtonText: "Tutup",
        confirmButtonColor: "#dc2626",
      });
    }
  };

  const openCandidateData = (item) => {
    navigate(`/pengawas/tracking-progress/cek/${encodeURIComponent(item.id)}`, {
      state: { verificationItem: item },
    });
  };

  return (
    <div className="bh-dashboard-shell min-h-screen bg-[#f7fbff] text-[#09275a] lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="bh-dashboard-sidebar-shell border-b border-[#dfe8f5] bg-white p-4 shadow-[12px_0_40px_rgba(20,57,96,0.05)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:border-b-0 lg:border-r lg:px-4 lg:py-8">
        <Sidebar role="pengawas" />
      </aside>

      <main className="bh-dashboard-main min-w-0 px-4 py-6 sm:px-6 lg:px-9 lg:py-10">
        <Header user={{ ...currentUser, role: "pengawas" }} />

        {(isLoadingQueue || queueLoadError) && (
          <div
            className={`mb-5 rounded-lg border px-4 py-3 text-sm font-medium ${
              queueLoadError
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50 text-blue-700"
            }`}
          >
            {queueLoadError || "Memuat data antrian dari backend..."}
          </div>
        )}

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <p className="text-sm font-semibold text-blue-600">Pengawas Rekrutmen</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
            Antrian Verifikasi
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
            Pantau dan proses verifikasi peserta agar alur
            seleksi tetap cepat dan terkontrol.
          </p>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Total Antrian</p>
            <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">{summary.total}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Sedang Diverifikasi</p>
            <h3 className="mt-2 text-3xl font-bold text-yellow-700">{summary.inReview}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Ditolak</p>
            <h3 className="mt-2 text-3xl font-bold text-red-700">{summary.rejected}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Diterima</p>
            <h3 className="mt-2 text-3xl font-bold text-green-700">{summary.accepted}</h3>
          </article>
        </section>

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FiFilter className="text-[#17355e]" />
            <h3 className="text-lg font-bold text-[#102d5b]">Filter Antrian</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
              Cari kandidat / posisi / ID
              <div className="flex h-11 items-center gap-2 rounded-lg border border-[#d6dfed] bg-white px-3">
                <FiSearch className="text-[#5f7894]" />
                <input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  type="text"
                  className="h-full w-full border-0 bg-transparent text-sm font-normal outline-none"
                  placeholder="Contoh: Ayu / Teller / VRF-101"
                />
              </div>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
              Status Verifikasi
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FiFileText className="text-[#17355e]" />
            <h3 className="text-lg font-bold text-[#102d5b]">Daftar Antrian Verifikasi</h3>
          </div>

          {filteredQueue.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
              <FiShield className="mx-auto text-2xl text-[#5b7390]" />
              <p className="mt-2 text-sm text-[#607792]">
                Tidak ada data antrian yang cocok dengan filter saat ini.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredQueue.map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[#102d5b]">{item.candidate}</h4>
                      <p className="mt-1 text-xs text-[#607792]">{item.role}</p>
                      <p className="mt-1 text-xs text-[#607792]">ID Verifikasi: {item.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`w-max rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-1 text-xs text-[#506783]">
                    <p className="inline-flex items-center gap-1.5">
                      <FiClock />
                      Masuk antrian: {item.submittedAt}
                    </p>
                    <p className="inline-flex items-center gap-1.5">
                      <FiUserCheck />
                      Update terakhir: {item.lastUpdate}
                    </p>
                    <p className="inline-flex items-start gap-1.5">
                      <FiAlertTriangle className="mt-0.5" />
                      Catatan: {item.notes}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openCandidateData(item)}
                      className="inline-flex items-center gap-1 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-3 py-1.5 text-xs font-semibold text-[#17477d]"
                    >
                      <FiArrowRightCircle />
                      Cek Data ...
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusAction(item, "Sedang Diverifikasi")}
                      className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-semibold text-yellow-700"
                    >
                      Sedang Diverifikasi
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusAction(item, "Ditolak")}
                      className="rounded-md border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                    >
                      Ditolak
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusAction(item, "Diterima")}
                      className="inline-flex items-center gap-1 rounded-md border border-green-100 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700"
                    >
                      <FiCheckCircle />
                      Diterima
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteParticipant(item)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                    >
                      <FiTrash2 />
                      Hapus Peserta
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AntrianVerifikasi;

import React, { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowRight,
  FiBell,
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiPlusCircle,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import Swal from "sweetalert2";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardUser } from "../../utils/authUser";
import {
  fetchLamaranApplicationsFromBackend,
  removeDashboardApplicationByApplicationUUID,
} from "../../utils/applications";
import { deleteLamaranApplicationApi } from "../../utils/authApi";
import {
  THEME_CHANGE_EVENT,
  THEME_DARK,
  getActiveThemeMode,
} from "../../utils/themeMode";

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

const STATUS_FILTER_OPTIONS = [
  "Semua Status",
  "Lulus",
  "Tidak Lulus",
  "Sedang Diverifikasi",
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

function formatQueueDate(dateValue) {
  const text = cleanText(dateValue);
  if (!text) return "-";

  const parsedDate = new Date(text);
  if (Number.isNaN(parsedDate.getTime())) return text;

  return parsedDate.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractYear(value) {
  const text = cleanText(value);
  if (!text) return "Tanpa Tahun";

  const parsedDate = new Date(text);
  if (!Number.isNaN(parsedDate.getTime())) {
    return String(parsedDate.getFullYear());
  }

  const yearMatch = text.match(/(19|20)\d{2}/);
  return yearMatch ? yearMatch[0] : "Tanpa Tahun";
}

function getStatusFilterLabel(status) {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === "Diterima") return "Lulus";
  if (normalizedStatus === "Ditolak") return "Tidak Lulus";
  return "Sedang Diverifikasi";
}

const INTERVIEW_SCHEDULE = [];
const RECENT_ACTIVITIES = [];

function getQueueTone(status) {
  const text = String(status || "").toLowerCase();

  if (text.includes("ditolak")) {
    return {
      badge: "bg-red-100 text-red-700",
      dot: "bg-red-500",
    };
  }
  if (text.includes("diterima")) {
    return {
      badge: "bg-green-100 text-green-700",
      dot: "bg-green-500",
    };
  }

  return {
    badge: "bg-yellow-100 text-yellow-700",
    dot: "bg-yellow-500",
  };
}

function buildStatCards(data) {
  return [
    {
      id: "lamaran",
      label: "Total Lamaran Masuk",
      value: String(data.totalApplications),
      note: "Semua posisi aktif",
      icon: FiBriefcase,
      tone: "text-blue-700 bg-blue-50",
    },
    {
      id: "review",
      label: "Sedang Diverifikasi",
      value: String(data.inReviewCount),
      note: "Dalam proses verifikasi",
      icon: FiAlertTriangle,
      tone: "text-yellow-700 bg-yellow-50",
    },
    {
      id: "interview",
      label: "Diterima",
      value: String(data.acceptedCount),
      note: "Lolos verifikasi",
      icon: FiCheckCircle,
      tone: "text-green-700 bg-green-50",
    },
    {
      id: "approval",
      label: "Ditolak",
      value: String(data.rejectedCount),
      note: "Perlu perbaikan data",
      icon: FiShield,
      tone: "text-red-700 bg-red-50",
    },
  ];
}

function formatPopupRows(rows, unitLabel = "peserta") {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length === 0) {
    return `<p style="margin:0;color:#607792;">Belum ada data.</p>`;
  }

  return `
    <div style="text-align:left;">
      <ul style="margin:0;padding-left:18px;">
        ${safeRows
          .map(
            (row) =>
              `<li style="margin:0 0 8px;"><strong>${row.label}</strong>: ${row.value} ${unitLabel}</li>`
          )
          .join("")}
      </ul>
    </div>
  `;
}

function formatParticipantListRows(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length === 0) {
    return `<p style="margin:0;color:#607792;">Tidak ada peserta pada kategori ini.</p>`;
  }

  return `
    <div style="text-align:left;">
      <ul style="margin:0;padding-left:18px;">
        ${safeRows
          .map(
            (row) =>
              `<li style="margin:0 0 8px;"><strong>${row.candidate}</strong> - ${row.role} (${row.id})</li>`
          )
          .join("")}
      </ul>
    </div>
  `;
}

function DashboardPengawas() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = getDashboardUser();
  const isPengawas = true;
  const [applications, setApplications] = useState([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [applicationLoadError, setApplicationLoadError] = useState("");
  const [themeMode, setThemeMode] = useState(() => getActiveThemeMode());
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedRole, setSelectedRole] = useState("Semua Jenis Lamaran");
  const [selectedYear, setSelectedYear] = useState("Semua Tahun");
  const [selectedStatus, setSelectedStatus] = useState("Semua Status");
  const isDarkMode = themeMode === THEME_DARK;

  const verificationQueue = useMemo(() => {
    return applications.map((application, index) => {
      const defaultVerificationId = `VRF-APP-${String(index + 1).padStart(3, "0")}`;
      const verificationId = cleanText(application.verificationId || defaultVerificationId);
      const submittedAt = formatQueueDate(application.appliedAt);
      const status = normalizeStatus(application.status);

      return {
        id: verificationId,
        applicationUUID: cleanText(application.applicationUUID || application.id),
        candidate:
          cleanText(application.candidate) ||
          cleanText(application.applicant?.fullName) ||
          "Peserta",
        role: cleanText(application.role) || "Posisi belum ditentukan",
        submittedAt,
        year: extractYear(application.appliedAt),
        status,
        statusFilterLabel: getStatusFilterLabel(status),
      };
    });
  }, [applications]);

  const roleOptions = useMemo(() => {
    const roles = Array.from(
      new Set(
        verificationQueue
          .map((item) => cleanText(item.role))
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right, "id-ID"));

    return ["Semua Jenis Lamaran", ...roles];
  }, [verificationQueue]);

  const yearOptions = useMemo(() => {
    const years = Array.from(
      new Set(
        verificationQueue
          .map((item) => cleanText(item.year || "Tanpa Tahun"))
          .filter(Boolean)
      )
    ).sort((left, right) => {
      if (left === "Tanpa Tahun") return 1;
      if (right === "Tanpa Tahun") return -1;
      return Number(right) - Number(left);
    });

    return ["Semua Tahun", ...years];
  }, [verificationQueue]);

  const filteredVerificationQueue = useMemo(() => {
    const keyword = cleanText(searchKeyword).toLowerCase();

    return verificationQueue.filter((item) => {
      const matchesKeyword =
        !keyword ||
        item.candidate.toLowerCase().includes(keyword) ||
        item.role.toLowerCase().includes(keyword) ||
        item.id.toLowerCase().includes(keyword);

      const matchesRole =
        selectedRole === "Semua Jenis Lamaran" || item.role === selectedRole;
      const matchesYear =
        selectedYear === "Semua Tahun" || item.year === selectedYear;
      const matchesStatus =
        selectedStatus === "Semua Status" ||
        item.statusFilterLabel === selectedStatus;

      return matchesKeyword && matchesRole && matchesYear && matchesStatus;
    });
  }, [searchKeyword, selectedRole, selectedYear, selectedStatus, verificationQueue]);

  const chartData = useMemo(() => {
    const sourceRows = filteredVerificationQueue;

    const statusRows = [
      {
        id: "lulus",
        label: "Lulus",
        value: sourceRows.filter(
          (item) => item.statusFilterLabel === "Lulus"
        ).length,
        color: isDarkMode ? "#34d399" : "#16a34a",
      },
      {
        id: "tidak-lulus",
        label: "Tidak Lulus",
        value: sourceRows.filter(
          (item) => item.statusFilterLabel === "Tidak Lulus"
        ).length,
        color: isDarkMode ? "#f87171" : "#dc2626",
      },
      {
        id: "review",
        label: "Diverifikasi",
        value: sourceRows.filter(
          (item) => item.statusFilterLabel === "Sedang Diverifikasi"
        ).length,
        color: isDarkMode ? "#fbbf24" : "#d4a017",
      },
    ];

    const roleMap = new Map();
    sourceRows.forEach((item) => {
      roleMap.set(item.role, (roleMap.get(item.role) || 0) + 1);
    });
    const roleRows = Array.from(roleMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 6);

    const yearMap = new Map();
    sourceRows.forEach((item) => {
      yearMap.set(item.year, (yearMap.get(item.year) || 0) + 1);
    });
    const yearRows = Array.from(yearMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => {
        if (left.label === "Tanpa Tahun") return 1;
        if (right.label === "Tanpa Tahun") return -1;
        return Number(left.label) - Number(right.label);
      });

    return { statusRows, roleRows, yearRows };
  }, [filteredVerificationQueue, isDarkMode]);

  const statusChartConfig = useMemo(
    () => ({
      labels: chartData.statusRows.map((row) => row.label),
      datasets: [
        {
          label: "Status Verifikasi",
          data: chartData.statusRows.map((row) => row.value),
          backgroundColor: chartData.statusRows.map((row) => row.color),
          borderWidth: 0,
          hoverOffset: 12,
        },
      ],
    }),
    [chartData.statusRows]
  );

  const roleChartConfig = useMemo(
    () => ({
      labels: chartData.roleRows.map((row) => row.label),
      datasets: [
        {
          label: "Jumlah Peserta",
          data: chartData.roleRows.map((row) => row.value),
          borderRadius: 8,
          backgroundColor: [
            isDarkMode ? "#3b82f6" : "#1d4ed8",
            isDarkMode ? "#60a5fa" : "#2563eb",
            isDarkMode ? "#93c5fd" : "#3b82f6",
            isDarkMode ? "#bfdbfe" : "#60a5fa",
            isDarkMode ? "#1e40af" : "#93c5fd",
            isDarkMode ? "#1d4ed8" : "#bfdbfe",
          ],
          borderWidth: 0,
        },
      ],
    }),
    [chartData.roleRows, isDarkMode]
  );

  const yearChartConfig = useMemo(
    () => ({
      labels: chartData.yearRows.map((row) => row.label),
      datasets: [
        {
          label: "Jumlah Peserta",
          data: chartData.yearRows.map((row) => row.value),
          borderColor: isDarkMode ? "#2dd4bf" : "#0f766e",
          backgroundColor: isDarkMode
            ? "rgba(45, 212, 191, 0.2)"
            : "rgba(15, 118, 110, 0.2)",
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: isDarkMode ? "#5eead4" : "#0f766e",
          pointBorderColor: isDarkMode ? "#0f172a" : "#ffffff",
          pointBorderWidth: 2,
        },
      ],
    }),
    [chartData.yearRows, isDarkMode]
  );

  const sharedChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: isDarkMode ? "#cbd5e1" : "#133862",
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: "circle",
            font: { size: 11, weight: "600" },
          },
        },
      },
    }),
    [isDarkMode]
  );

  const statusChartOptions = useMemo(
    () => ({
      ...sharedChartOptions,
      cutout: "62%",
      plugins: {
        ...sharedChartOptions.plugins,
        legend: {
          ...sharedChartOptions.plugins.legend,
          position: "bottom",
        },
      },
    }),
    [sharedChartOptions]
  );

  const roleChartOptions = useMemo(
    () => ({
      ...sharedChartOptions,
      indexAxis: "y",
      plugins: {
        ...sharedChartOptions.plugins,
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: {
            precision: 0,
            color: isDarkMode ? "#9fb3d5" : "#4e6885",
            font: { size: 10 },
          },
          grid: { color: isDarkMode ? "rgba(71, 85, 105, 0.42)" : "#e7eef8" },
        },
        y: {
          ticks: {
            color: isDarkMode ? "#9fb3d5" : "#4e6885",
            font: { size: 10, weight: "600" },
          },
          grid: { display: false },
        },
      },
    }),
    [isDarkMode, sharedChartOptions]
  );

  const yearChartOptions = useMemo(
    () => ({
      ...sharedChartOptions,
      plugins: {
        ...sharedChartOptions.plugins,
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: {
            color: isDarkMode ? "#9fb3d5" : "#4e6885",
            font: { size: 10 },
          },
          grid: { color: isDarkMode ? "rgba(71, 85, 105, 0.36)" : "#edf3fb" },
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: isDarkMode ? "#9fb3d5" : "#4e6885",
            font: { size: 10 },
          },
          grid: { color: isDarkMode ? "rgba(71, 85, 105, 0.42)" : "#e7eef8" },
        },
      },
    }),
    [isDarkMode, sharedChartOptions]
  );

  const openChartPopup = async (title, rows, unitLabel = "peserta") => {
    await Swal.fire({
      title,
      html: formatPopupRows(rows, unitLabel),
      confirmButtonText: "Tutup",
      confirmButtonColor: "#1d4ed8",
    });
  };

  const openChartSegmentPopup = async (title, rows) => {
    await Swal.fire({
      title,
      html: formatParticipantListRows(rows),
      confirmButtonText: "Tutup",
      confirmButtonColor: "#1d4ed8",
      width: 680,
    });
  };

  const handleStatusChartClick = async (_, elements) => {
    if (!elements.length) {
      await openChartPopup(
        "Detail Status Verifikasi",
        chartData.statusRows.map((row) => ({ label: row.label, value: row.value }))
      );
      return;
    }

    const clickedIndex = elements[0].index;
    const selectedStatus = chartData.statusRows[clickedIndex]?.label;
    if (!selectedStatus) return;

    const relatedRows = filteredVerificationQueue
      .filter((item) => item.statusFilterLabel === selectedStatus)
      .slice(0, 12);

    await openChartSegmentPopup(
      `Peserta - Status ${selectedStatus}`,
      relatedRows
    );
  };

  const handleRoleChartClick = async (_, elements) => {
    if (!elements.length) {
      await openChartPopup("Detail Jenis Lamaran", chartData.roleRows);
      return;
    }

    const clickedIndex = elements[0].index;
    const selectedRole = chartData.roleRows[clickedIndex]?.label;
    if (!selectedRole) return;

    const relatedRows = filteredVerificationQueue
      .filter((item) => item.role === selectedRole)
      .slice(0, 12);

    await openChartSegmentPopup(
      `Peserta - ${selectedRole}`,
      relatedRows
    );
  };

  const handleYearChartClick = async (_, elements) => {
    if (!elements.length) {
      await openChartPopup("Detail Tahun Lamaran", chartData.yearRows);
      return;
    }

    const clickedIndex = elements[0].index;
    const selectedYear = chartData.yearRows[clickedIndex]?.label;
    if (!selectedYear) return;

    const relatedRows = filteredVerificationQueue
      .filter((item) => item.year === selectedYear)
      .slice(0, 12);

    await openChartSegmentPopup(
      `Peserta - Tahun ${selectedYear}`,
      relatedRows
    );
  };

  const dashboardStats = useMemo(() => {
    const inReviewCount = verificationQueue.filter(
      (item) => item.status === "Sedang Diverifikasi"
    ).length;
    const acceptedCount = verificationQueue.filter((item) => item.status === "Diterima").length;
    const rejectedCount = verificationQueue.filter((item) => item.status === "Ditolak").length;

    return {
      totalApplications: verificationQueue.length,
      inReviewCount,
      acceptedCount,
      rejectedCount,
    };
  }, [verificationQueue]);

  const statCards = useMemo(() => buildStatCards(dashboardStats), [dashboardStats]);

  const refreshApplications = async () => {
    setIsLoadingApplications(true);
    setApplicationLoadError("");

    try {
      const backendApplications = await fetchLamaranApplicationsFromBackend();
      setApplications(backendApplications);
    } catch (error) {
      setApplications([]);
      setApplicationLoadError(
        cleanText(error?.message) || "Gagal memuat data peserta dari backend."
      );
    } finally {
      setIsLoadingApplications(false);
    }
  };

  const handleDeleteParticipant = async (item) => {
    const applicationUUID = cleanText(item?.applicationUUID);
    if (!applicationUUID) {
      await Swal.fire({
        icon: "error",
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
      setApplications((currentApplications) =>
        currentApplications.filter(
          (application) =>
            cleanText(application.applicationUUID || application.id) !== applicationUUID
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

  useEffect(() => {
    const sectionId = String(location.hash || "").replace("#", "");
    if (!sectionId) return;

    window.setTimeout(() => {
      const targetElement = document.getElementById(sectionId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);
  }, [location.hash]);

  useEffect(() => {
    const syncThemeMode = (event) => {
      const modeFromEvent = event?.detail?.mode;
      if (modeFromEvent === THEME_DARK || modeFromEvent === "light") {
        setThemeMode(modeFromEvent);
        return;
      }

      setThemeMode(getActiveThemeMode());
    };

    window.addEventListener(THEME_CHANGE_EVENT, syncThemeMode);
    window.addEventListener("storage", syncThemeMode);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncThemeMode);
      window.removeEventListener("storage", syncThemeMode);
    };
  }, []);

  useEffect(() => {
    void refreshApplications();
  }, []);

  return (
    <div
      className={`bh-dashboard-shell min-h-screen bg-[#f7fbff] text-[#09275a] ${
        isPengawas ? "lg:grid lg:grid-cols-[256px_minmax(0,1fr)]" : ""
      }`}
    >
      {isPengawas && (
        <aside className="bh-dashboard-sidebar-shell border-b border-[#dfe8f5] bg-white p-4 shadow-[12px_0_40px_rgba(20,57,96,0.05)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:border-b-0 lg:border-r lg:px-4 lg:py-8">
          <Sidebar role="pengawas" />
        </aside>
      )}

      <main className="bh-dashboard-main min-w-0 px-4 py-6 sm:px-6 lg:px-9 lg:py-10">
        <Header user={{ ...currentUser, role: "pengawas" }} />

        {(isLoadingApplications || applicationLoadError) && (
          <div
            className={`mb-5 rounded-lg border px-4 py-3 text-sm font-medium ${
              applicationLoadError
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50 text-blue-700"
            }`}
          >
            {applicationLoadError || "Memuat data peserta dari backend..."}
          </div>
        )}

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <p className="text-sm font-semibold text-blue-600">Dashboard Pengawas</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
            Kontrol Rekrutmen Harian
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
            Pantau antrian verifikasi peserta, jadwal interview, dan aktivitas tim
            rekrutmen dalam satu panel terintegrasi.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/pengawas/master-data/tambah-lamaran")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-4 text-sm font-bold text-[#17477d]"
            >
              <FiPlusCircle />
              Tambah Lamaran
            </button>
            <button
              type="button"
              onClick={() => navigate("/pengawas/master-data/seleksi1-biodata")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-4 text-sm font-bold text-[#17477d]"
            >
              <FiShield />
              Seleksi Biodata
            </button>
            <button
              type="button"
              onClick={() => navigate("/pengawas/master-data/tambah-pengumuman")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-4 text-sm font-bold text-[#17477d]"
            >
              <FiBell />
              Tambah Pengumuman
            </button>
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.id}
                className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] text-[#213b63]">{card.label}</p>
                    <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">{card.value}</h3>
                    <p className="mt-2 text-xs text-[#607792]">{card.note}</p>
                  </div>
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${card.tone}`}
                  >
                    <Icon />
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-3">
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#102d5b]">Status Verifikasi</h3>
              <button
                type="button"
                onClick={() =>
                  openChartPopup(
                    "Detail Status Verifikasi",
                    chartData.statusRows.map((row) => ({
                      label: row.label,
                      value: row.value,
                    }))
                  )
                }
                className="text-[11px] font-semibold text-[#1d4ed8]"
              >
                Lihat Data
              </button>
            </div>
            <p className="mb-3 text-xs text-[#607792]">
              Klik bagian warna pada chart untuk daftar peserta.
            </p>
            <div className="h-[220px]">
              <Doughnut
                data={statusChartConfig}
                options={statusChartOptions}
                onClick={handleStatusChartClick}
              />
            </div>
          </article>

          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#102d5b]">Jenis Lamaran</h3>
              <button
                type="button"
                onClick={() => openChartPopup("Detail Jenis Lamaran", chartData.roleRows)}
                className="text-[11px] font-semibold text-[#1d4ed8]"
              >
                Lihat Data
              </button>
            </div>
            <p className="mb-3 text-xs text-[#607792]">
              Klik batang untuk melihat peserta pada posisi tersebut.
            </p>
            <div className="h-[220px]">
              <Bar
                data={roleChartConfig}
                options={roleChartOptions}
                onClick={handleRoleChartClick}
              />
            </div>
          </article>

          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#102d5b]">Trend Tahun Lamaran</h3>
              <button
                type="button"
                onClick={() => openChartPopup("Detail Tahun Lamaran", chartData.yearRows)}
                className="text-[11px] font-semibold text-[#1d4ed8]"
              >
                Lihat Data
              </button>
            </div>
            <p className="mb-3 text-xs text-[#607792]">
              Klik titik chart untuk melihat peserta di tahun terpilih.
            </p>
            <div className="h-[220px]">
              <Line
                data={yearChartConfig}
                options={yearChartOptions}
                onClick={handleYearChartClick}
              />
            </div>
          </article>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <article
            id="antrian-verifikasi"
            className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-bold text-[#102d5b]">Antrian Verifikasi Dokumen</h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  {filteredVerificationQueue.length}/{verificationQueue.length} Peserta
                </span>
                <button
                  type="button"
                  onClick={() => navigate("/pengawas/antrian-verifikasi")}
                  className="inline-flex items-center gap-1 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-3 py-1.5 text-xs font-semibold text-[#17477d]"
                >
                  Lihat Selengkapnya
                  <FiArrowRight />
                </button>
              </div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-1 text-xs font-semibold text-[#102d5b]">
                Cari Nama
                <div className="flex h-10 items-center gap-2 rounded-md border border-[#d6dfed] bg-white px-2.5">
                  <FiSearch className="text-[#5f7894]" />
                  <input
                    value={searchKeyword}
                    onChange={(event) => setSearchKeyword(event.target.value)}
                    type="text"
                    className="h-full w-full border-0 bg-transparent text-xs font-normal text-[#143764] outline-none"
                    placeholder="Nama / ID / Posisi"
                  />
                </div>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-[#102d5b]">
                Jenis Lamaran
                <select
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value)}
                  className="h-10 rounded-md border border-[#d6dfed] bg-white px-2.5 text-xs font-normal text-[#143764] outline-none"
                >
                  {roleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-[#102d5b]">
                Tahun
                <select
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(event.target.value)}
                  className="h-10 rounded-md border border-[#d6dfed] bg-white px-2.5 text-xs font-normal text-[#143764] outline-none"
                >
                  {yearOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-[#102d5b]">
                Status
                <select
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                  className="h-10 rounded-md border border-[#d6dfed] bg-white px-2.5 text-xs font-normal text-[#143764] outline-none"
                >
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3">
              {filteredVerificationQueue.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
                  <p className="text-sm text-[#607792]">
                    Tidak ada data antrian yang sesuai filter.
                  </p>
                </div>
              ) : (
                filteredVerificationQueue.map((item) => {
                  const tone = getQueueTone(item.status);

                  return (
                    <article
                      key={item.id}
                      className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-bold text-[#102d5b]">{item.candidate}</p>
                          <p className="mt-1 text-xs text-[#607792]">{item.role}</p>
                          <p className="mt-1 text-xs text-[#607792]">ID: {item.id}</p>
                        </div>
                        <span
                          className={`inline-flex w-max items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-[#4e6885]">
                        <FiClock />
                        Masuk: {item.submittedAt}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
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
                  );
                })
              )}
            </div>
          </article>

          <div className="grid gap-5">
            <article
              id="jadwal-interview"
              className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FiUsers className="text-[#17355e]" />
                  <h3 className="text-lg font-bold text-[#102d5b]">Jadwal Interview Hari Ini</h3>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/pengawas/tracking-progress")}
                  className="inline-flex items-center gap-1 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-3 py-1.5 text-xs font-semibold text-[#17477d]"
                >
                  Lihat Selengkapnya
                  <FiArrowRight />
                </button>
              </div>
              <div className="grid gap-3">
                {INTERVIEW_SCHEDULE.length === 0 ? (
                  <article className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] p-4 text-center">
                    <p className="text-xs text-[#607792]">
                      Belum ada jadwal interview yang tersedia.
                    </p>
                  </article>
                ) : (
                  INTERVIEW_SCHEDULE.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3"
                    >
                      <p className="text-sm font-bold text-[#102d5b]">{item.candidate}</p>
                      <p className="mt-1 text-xs text-blue-700">{item.role}</p>
                      <p className="mt-2 text-xs text-[#4e6885]">{item.time}</p>
                      <p className="mt-1 text-xs text-[#607792]">{item.panel}</p>
                    </article>
                  ))
                )}
              </div>
            </article>

            <article
              id="aktivitas-rekrutmen"
              className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FiActivity className="text-[#17355e]" />
                  <h3 className="text-lg font-bold text-[#102d5b]">Aktivitas Terbaru</h3>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/pengawas/aktivitas-rekrutmen")}
                  className="inline-flex items-center gap-1 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-3 py-1.5 text-xs font-semibold text-[#17477d]"
                >
                  Lihat Selengkapnya
                  <FiArrowRight />
                </button>
              </div>
              <ul className="grid gap-2">
                {RECENT_ACTIVITIES.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-3 py-3 text-center">
                    <p className="text-xs text-[#607792]">
                      Belum ada aktivitas rekrutmen terbaru.
                    </p>
                  </li>
                ) : (
                  RECENT_ACTIVITIES.map((activity) => (
                    <li
                      key={activity.id}
                      className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] px-3 py-2.5"
                    >
                      <p className="text-xs leading-relaxed text-[#4e6885]">{activity.text}</p>
                      <p className="mt-1 text-[11px] text-[#7b93af]">{activity.time}</p>
                    </li>
                  ))
                )}
              </ul>
            </article>
          </div>
        </section>

        <section className="mt-6 rounded-[10px] border border-[#dfe8f5] bg-gradient-to-r from-[#edf6ff] via-white to-[#eef9ed] p-4 shadow-[0_12px_28px_rgba(21,54,92,0.05)] sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-green-600">
              <FiCheckCircle />
            </span>
            <div>
              <h4 className="text-sm font-bold text-[#10315f]">Catatan Pengawas</h4>
              <p className="mt-1 text-xs leading-relaxed text-[#4c6685]">
                Fokuskan verifikasi pada kelengkapan identitas dan berkas peserta
                agar proses seleksi administrasi tetap cepat dan terukur.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default DashboardPengawas;

import React, { useEffect, useMemo, useState } from "react";
import {
  FiArrowRight,
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiChevronRight,
  FiClock,
  FiPieChart,
  FiTrash2,
  FiVolume2,
} from "react-icons/fi";
import Swal from "sweetalert2";
import Header from "../component/header";
import Sidebar from "../component/sidebar";
import {
  fetchDashboardApplicationsFromBackend,
  getApplicationStageDefinitions,
  removeDashboardApplicationByApplicationUUID,
  resolveApplicationStageIndex,
} from "../utils/applications";
import { getDashboardUser } from "../utils/authUser";
import { getPesertaAnnouncementItems } from "../utils/notifications";
import { deleteLamaranApplicationApi } from "../utils/authApi";

const statToneClasses = {
  blue: {
    text: "text-blue-600",
    icon: "bg-blue-50 text-blue-600",
  },
  purple: {
    text: "text-violet-700",
    icon: "bg-violet-50 text-violet-700",
  },
  orange: {
    text: "text-orange-500",
    icon: "bg-orange-50 text-orange-500",
  },
};

const roleToneClasses = {
  green: "bg-green-50 text-green-700",
  blue: "bg-blue-50 text-blue-700",
};

function getApplicationStatusBadgeClass(status) {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus.includes("ditolak")) {
    return "bg-red-50 text-red-700";
  }

  if (normalizedStatus.includes("diterima")) {
    return "bg-green-50 text-green-700";
  }

  if (normalizedStatus.includes("diverifikasi")) {
    return "bg-yellow-50 text-yellow-700";
  }

  return "bg-green-50 text-green-700";
}

function buildStatsCards(activeCount, scheduleCount, averageProgress) {
  return [
    {
      label: "Tahapan Aktif",
      value: String(activeCount),
      note: activeCount > 0 ? "Sedang Berlangsung" : "Belum Ada",
      tone: "blue",
      icon: FiBarChart2,
    },
    {
      label: "Progress Keseluruhan",
      value: `${averageProgress}%`,
      note: "Rata-rata Progress",
      tone: "purple",
      icon: FiPieChart,
    },
    {
      label: "Jadwal Mendatang",
      value: String(scheduleCount),
      note: scheduleCount > 0 ? "Terjadwal" : "Belum Ada",
      tone: "orange",
      icon: FiCalendar,
    },
  ];
}

function parseStageDate(stage = {}) {
  const dateText = String(stage.startDate || "").trim();
  if (!dateText) return null;

  const date = new Date(`${dateText}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateBox(date) {
  return {
    date: date.toLocaleDateString("id-ID", { day: "2-digit" }),
    month: date.toLocaleDateString("id-ID", { month: "short" }).toUpperCase(),
    day: date.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
  };
}

function formatTimeRange(stage = {}) {
  const startTime = String(stage.startTime || "").trim();
  const endTime = String(stage.endTime || "").trim();
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  if (startTime) return startTime;
  return "Menunggu jadwal";
}

function formatRelativeTag(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target - today) / 86400000);

  if (diffDays === 0) return "Hari Ini";
  if (diffDays === 1) return "Besok";
  if (diffDays > 1) return `Dalam ${diffDays} Hari`;
  return "Terlewat";
}

function isFinalApplicationStatus(status) {
  const normalizedStatus = String(status || "").toLowerCase();
  return (
    normalizedStatus.includes("diterima") ||
    normalizedStatus.includes("ditolak") ||
    normalizedStatus.includes("tidak lolos")
  );
}

function cleanText(value) {
  return String(value || "").trim();
}

function buildActiveStagesFromApplications(applications) {
  return applications
    .filter((application) => !isFinalApplicationStatus(application.status))
    .map((application) => {
      const stageDefinitions = getApplicationStageDefinitions(application);
      const activeIndex = resolveApplicationStageIndex(application, stageDefinitions);
      const activeStage = stageDefinitions[activeIndex] || stageDefinitions[0] || {};
      const activeDate = parseStageDate(activeStage);

      return {
        id: `${application.id}-${activeStage.id || activeIndex}`,
        role: application.role,
        stage: application.stage || activeStage.title || "Seleksi Administrasi",
        day: activeDate ? formatDateBox(activeDate).day : "Belum dijadwalkan",
        time: formatTimeRange(activeStage),
      };
    });
}

function buildSchedulesFromApplications(applications) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const schedules = applications.flatMap((application) => {
    if (isFinalApplicationStatus(application.status)) return [];

    return getApplicationStageDefinitions(application)
      .map((stage, index) => {
        const stageDate = parseStageDate(stage);
        if (!stageDate) return null;
        const comparableDate = new Date(stageDate);
        comparableDate.setHours(0, 0, 0, 0);
        if (comparableDate < today) return null;

        return {
          ...formatDateBox(stageDate),
          id: `${application.id}-${stage.id || index}`,
          role: application.role,
          tone: application.tone || "green",
          title: stage.title,
          time: formatTimeRange(stage),
          tag: formatRelativeTag(stageDate),
          sortTime: stageDate.getTime(),
        };
      })
      .filter(Boolean);
  });

  return schedules.sort((left, right) => left.sortTime - right.sortTime);
}

function DashboardPanel({ title, children, className = "", action }) {
  return (
    <section
      className={`rounded-[10px] border border-[#dfe8f5] bg-white p-4 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-5 ${className}`}
    >
      <div className="mb-4 flex min-h-[30px] items-center justify-between gap-4">
        <h2 className="text-base font-bold leading-tight text-[#102d5b]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Dashboard() {
  const currentUser = getDashboardUser();
  const isPeserta = currentUser.role === "peserta";
  const [applications, setApplications] = useState([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [applicationLoadError, setApplicationLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadApplications = async () => {
      setIsLoadingApplications(true);
      setApplicationLoadError("");

      try {
        const backendApplications = await fetchDashboardApplicationsFromBackend();
        if (isMounted) {
          setApplications(backendApplications);
        }
      } catch (error) {
        if (isMounted) {
          setApplications([]);
          setApplicationLoadError(
            String(error?.message || "").trim() ||
              "Gagal memuat data lamaran dari backend."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingApplications(false);
        }
      }
    };

    void loadApplications();

    return () => {
      isMounted = false;
    };
  }, []);

  const upcomingSchedules = useMemo(
    () => buildSchedulesFromApplications(applications),
    [applications]
  );
  const activeStages = useMemo(
    () => buildActiveStagesFromApplications(applications),
    [applications]
  );
  const averageProgress =
    applications.length > 0
      ? Math.round(
          applications.reduce((total, item) => total + Number(item.progress || 0), 0) /
            applications.length
        )
      : 0;
  const statsCards = buildStatsCards(activeStages.length, upcomingSchedules.length, averageProgress);
  const announcementItems = isPeserta ? getPesertaAnnouncementItems() : [];

  const handleDeleteApplication = async (item) => {
    const applicationUUID = cleanText(item?.applicationUUID || item?.id);
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
      title: "Hapus Lamaran?",
      text: `Data pendaftaran pada lamaran ${item.role} akan dihapus permanen.`,
      showCancelButton: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
      reverseButtons: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });

    if (!confirmation.isConfirmed) return;

    Swal.fire({
      title: "Menghapus Lamaran...",
      html: `<p style="margin:0;color:#b91c1c;">Mohon tunggu, data pendaftaran sedang dihapus.</p>`,
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
        title: "Lamaran Berhasil Dihapus",
        text:
          cleanText(response?.msg) ||
          "Data pendaftaran berhasil dihapus.",
        confirmButtonText: "OK",
        confirmButtonColor: "#dc2626",
      });
    } catch (error) {
      Swal.close();
      await Swal.fire({
        icon: "error",
        iconColor: "#dc2626",
        title: "Gagal Menghapus Lamaran",
        text:
          cleanText(error?.message) ||
          "Terjadi kendala saat menghapus data pendaftaran. Silakan coba lagi.",
        confirmButtonText: "Tutup",
        confirmButtonColor: "#dc2626",
      });
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

        {(isLoadingApplications || applicationLoadError) && (
          <div
            className={`mb-5 rounded-lg border px-4 py-3 text-sm font-medium ${
              applicationLoadError
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50 text-blue-700"
            }`}
          >
            {applicationLoadError || "Memuat data lamaran dari backend..."}
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {statsCards.map((card) => {
            const Icon = card.icon;
            const tone = statToneClasses[card.tone];
            return (
              <article
                key={card.label}
                className="flex min-h-[132px] items-start justify-between gap-4 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6"
              >
                <div>
                  <p className="text-[13px] text-[#213b63]">{card.label}</p>
                  <h2 className="my-3 text-4xl font-bold leading-none text-[#09275a]">{card.value}</h2>
                  <span className={`block text-sm font-medium ${tone.text}`}>{card.note}</span>
                </div>
                <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl ${tone.icon}`}>
                  <Icon />
                </span>
              </article>
            );
          })}
        </section>

        <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_310px]">
          <DashboardPanel
            title="Tahapan Aktif"
            className="xl:col-start-3 xl:row-start-1"
            action={
              <span className="flex h-6 min-w-7 items-center justify-center rounded-md bg-blue-50 text-xs font-bold text-blue-600">
                {activeStages.length}
              </span>
            }
          >
            {activeStages.length > 0 ? (
              <>
                <div className="grid gap-3">
                  {activeStages.map((item) => (
                    <article
                      key={item.id}
                      className="flex min-h-[92px] items-center justify-between gap-3 rounded-lg border border-[#dfe8f5] bg-[#fbfdff] px-4 py-3"
                    >
                      <div>
                        <h3 className="text-[13px] font-bold text-[#102d5b]">{item.role}</h3>
                        <p className="mt-1 text-xs text-blue-600">{item.stage}</p>
                        <span className="mt-2 flex items-center gap-2 text-xs text-[#586f8c]">
                          <FiCalendar />
                          {item.day}
                        </span>
                        <span className="mt-1.5 flex items-center gap-2 text-xs text-[#586f8c]">
                          <FiClock />
                          {item.time}
                        </span>
                      </div>
                      <FiChevronRight className="shrink-0" />
                    </article>
                  ))}
                </div>
                <a href="#jadwal" className="mt-4 flex items-center justify-between text-[13px] font-semibold text-blue-600 no-underline">
                  Lihat Semua Jadwal
                  <FiArrowRight />
                </a>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-7 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-xl text-blue-600">
                  <FiBarChart2 />
                </span>
                <h3 className="mt-3 text-sm font-bold text-[#102d5b]">Belum Ada Tahapan</h3>
                <p className="mx-auto mt-2 max-w-[230px] text-xs leading-relaxed text-[#607792]">
                  Tahapan aktif akan muncul setelah lamaran berhasil didaftarkan.
                </p>
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel title="Jadwal Mendatang" className="lg:col-span-2 xl:col-start-1 xl:row-start-1">
            {upcomingSchedules.length > 0 ? (
              <>
                <div className="grid gap-3">
                  {upcomingSchedules.map((item) => (
                    <article
                      key={item.id}
                      className="grid min-h-[64px] grid-cols-[48px_minmax(0,1fr)] gap-3 rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-2.5 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="grid h-[52px] place-items-center content-center rounded-md bg-blue-50 text-blue-700">
                        <strong className="text-xl leading-none">{item.date}</strong>
                        <span className="mt-1 text-[10px] font-bold">{item.month}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[13px] font-bold text-[#102d5b]">{item.title}</h3>
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${roleToneClasses[item.tone] || roleToneClasses.green}`}>
                            {item.role}
                          </span>
                        </div>
                        <p className="mt-2 inline-flex items-center gap-2 text-xs text-[#586f8c]">
                          <FiCalendar />
                          {item.day}
                        </p>
                        <p className="ml-0 mt-1 inline-flex items-center gap-2 text-xs text-[#586f8c] sm:ml-3">
                          <FiClock />
                          {item.time}
                        </p>
                      </div>
                      <span className="col-start-2 w-max rounded-md bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-500 sm:col-auto">
                        {item.tag}
                      </span>
                    </article>
                  ))}
                </div>
                <a href="#jadwal" className="mt-4 flex items-center justify-between text-[13px] font-semibold text-blue-600 no-underline">
                  Lihat Semua Jadwal
                  <FiArrowRight />
                </a>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-2xl text-orange-500">
                  <FiCalendar />
                </span>
                <h3 className="mt-3 text-sm font-bold text-[#102d5b]">Belum Ada Jadwal</h3>
                <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#607792]">
                  Jadwal mendatang akan muncul otomatis setelah status lamaran menjadi Berhasil Mendaftar.
                </p>
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel title="Status Lamaran" className="lg:col-span-2 xl:col-start-1 xl:row-start-2">
            {applications.length > 0 ? (
              <>
                <div className="grid gap-3">
                  {applications.map((item) => (
                    <article
                      key={item.id || item.role}
                      className="grid min-h-[96px] grid-cols-[52px_minmax(0,1fr)_42px_16px] items-center gap-3 rounded-lg border border-[#dfe8f5] bg-[#fbfdff] px-4 py-3"
                    >
                      <span className={`flex h-[52px] w-[52px] items-center justify-center rounded-full text-2xl ${roleToneClasses[item.tone] || roleToneClasses.green}`}>
                        <FiBriefcase />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[13px] font-bold text-[#102d5b]">{item.role}</h3>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${getApplicationStatusBadgeClass(
                              item.status
                            )}`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#607792]">{item.branch}</p>
                        <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#e8edf5]">
                          <span className="block h-full rounded-full bg-green-600" style={{ width: `${item.progress}%` }} />
                        </div>
                        <small className="mt-2 block text-xs text-[#314967]">
                          Tahap: <b className="font-medium text-blue-600">{item.stage}</b>
                        </small>
                        <button
                          type="button"
                          onClick={() => handleDeleteApplication(item)}
                          className="mt-3 inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                        >
                          <FiTrash2 />
                          Hapus Lamaran
                        </button>
                      </div>
                      <strong className="text-right text-xs text-[#183866]">{item.progress}%</strong>
                      <FiChevronRight />
                    </article>
                  ))}
                </div>
                <a href="/pendaftaran" className="mt-4 flex items-center justify-between text-[13px] font-semibold text-blue-600 no-underline">
                  Lihat Semua Lamaran
                  <FiArrowRight />
                </a>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-2xl text-green-600">
                  <FiBriefcase />
                </span>
                <h3 className="mt-3 text-sm font-bold text-[#102d5b]">Belum Ada Lamaran</h3>
                <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#607792]">
                  Pilih posisi lamaran yang tersedia terlebih dahulu untuk melihat status pendaftaran Anda.
                </p>
                <a
                  href="/pendaftaran"
                  className="mx-auto mt-4 flex h-9 w-max items-center gap-2 rounded-md bg-gradient-to-r from-green-500 to-green-700 px-4 text-xs font-bold text-white no-underline"
                >
                  Pilih Lamaran
                  <FiArrowRight />
                </a>
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel
            title="Pengumuman Terbaru"
            className="xl:col-start-3 xl:row-start-2"
            action={<FiVolume2 className="text-xl text-[#17355e]" />}
          >
            {announcementItems.length > 0 ? (
              <>
                <div className="grid gap-3">
                  {announcementItems.map((item) => (
                    <article key={item.id} className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] px-4 py-3">
                      <h3 className="text-[13px] font-bold text-[#102d5b]">{item.title}</h3>
                      <p className="my-2 text-xs leading-relaxed text-[#506783]">{item.message}</p>
                      <small className="text-[11px] text-[#7890ad]">
                        {new Date(item.createdAt).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </article>
                  ))}
                </div>
                <a
                  href="#pengumuman"
                  className="mt-4 flex items-center justify-between text-[13px] font-semibold text-blue-600 no-underline"
                >
                  Lihat Semua Pengumuman
                  <FiArrowRight />
                </a>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-7 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-xl text-blue-600">
                  <FiVolume2 />
                </span>
                <h3 className="mt-3 text-sm font-bold text-[#102d5b]">Belum Ada Pengumuman</h3>
                <p className="mx-auto mt-2 max-w-[230px] text-xs leading-relaxed text-[#607792]">
                  Pengumuman terbaru akan tampil di sini jika sudah dipublikasikan.
                </p>
              </div>
            )}
          </DashboardPanel>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiMapPin,
} from "react-icons/fi";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardUser } from "../../utils/authUser";
import {
  fetchDashboardApplicationsFromBackend,
  getApplicationStageDefinitions,
  resolveApplicationStageIndex,
} from "../../utils/applications";

function parseStageDate(stage = {}) {
  const dateText = String(stage.startDate || "").trim();
  if (!dateText) return null;

  const date = new Date(`${dateText}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateFull(dateValue) {
  return new Date(dateValue).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function addDays(dateValue, dayOffset) {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return date;
}

function formatTimeRange(stage = {}) {
  const startTime = String(stage.startTime || "").trim();
  const endTime = String(stage.endTime || "").trim();
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  if (startTime) return startTime;
  return "Menunggu jadwal";
}

function isFinalApplicationStatus(status) {
  const normalizedStatus = String(status || "").toLowerCase();
  return (
    normalizedStatus.includes("diterima") ||
    normalizedStatus.includes("ditolak") ||
    normalizedStatus.includes("tidak lolos")
  );
}

function getScheduleStatusClass(status) {
  if (status === "done") {
    return {
      wrapper: "border-green-200 bg-green-50",
      icon: "text-green-600",
      badge: "Selesai",
      badgeClass: "bg-green-100 text-green-700",
    };
  }

  if (status === "current") {
    return {
      wrapper: "border-blue-200 bg-blue-50",
      icon: "text-blue-600",
      badge: "Sedang Berjalan",
      badgeClass: "bg-blue-100 text-blue-700",
    };
  }

  return {
    wrapper: "border-[#dfe8f5] bg-[#fbfdff]",
    icon: "text-[#6f87a2]",
    badge: "Terjadwal",
    badgeClass: "bg-[#edf2f8] text-[#57718f]",
  };
}

function buildScheduleEvents(applications) {
  return applications
    .flatMap((application) => {
      if (isFinalApplicationStatus(application.status)) return [];

      const stageDefinitions = getApplicationStageDefinitions(application);
      const activeStageIndex = resolveApplicationStageIndex(
        application,
        stageDefinitions
      );

      return stageDefinitions.map((stage, index) => {
        const stageDate = parseStageDate(stage);
        if (!stageDate) return null;

        let status = "upcoming";
        if (index < activeStageIndex) status = "done";
        if (index === activeStageIndex) status = "current";

        return {
          id: `${application.id}-${stage.id}`,
          role: application.role,
          branch: application.branch,
          label: stage.title || stage.label,
          agenda: stage.description || "Tahap proses seleksi.",
          date: stageDate,
          time: formatTimeRange(stage),
          location: stage.location || application.branch || "Portal BPR HIRE",
          status,
          style: getScheduleStatusClass(status),
        };
      }).filter(Boolean);
    })
    .sort((left, right) => left.date - right.date);
}

function JadwalSaya() {
  const navigate = useNavigate();
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
              "Gagal memuat jadwal dari backend."
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

  const scheduleEvents = useMemo(
    () => buildScheduleEvents(applications),
    [applications]
  );

  const summary = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekAhead = addDays(now, 7);
    const thisWeekCount = scheduleEvents.filter(
      (event) => event.date >= now && event.date <= weekAhead
    ).length;
    const completedCount = scheduleEvents.filter(
      (event) => event.status === "done"
    ).length;
    const nextAgenda =
      scheduleEvents.find((event) => event.status !== "done") || null;

    return {
      total: scheduleEvents.length,
      thisWeekCount,
      completedCount,
      nextAgenda,
    };
  }, [scheduleEvents]);

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
            {applicationLoadError || "Memuat jadwal dari backend..."}
          </div>
        )}

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <p className="text-sm font-semibold text-blue-600">Jadwal Saya</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
            Agenda Seleksi Peserta
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
            Halaman ini menampilkan jadwal proses rekrutmen Anda, mulai dari
            verifikasi administrasi sampai pengumuman akhir.
          </p>
        </section>

        {isLoadingApplications ? (
          <section className="rounded-[10px] border border-[#dfe8f5] bg-white p-8 text-center shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <span className="mx-auto block h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
            <h3 className="mt-4 text-lg font-bold text-[#102d5b]">
              Memuat Jadwal
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[#607792]">
              Sistem sedang mengambil data jadwal seleksi langsung dari backend.
            </p>
          </section>
        ) : scheduleEvents.length === 0 ? (
          <section className="rounded-[10px] border border-dashed border-[#cddbf0] bg-white p-8 text-center shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-600">
              <FiCalendar />
            </span>
            <h3 className="mt-4 text-lg font-bold text-[#102d5b]">
              Belum Ada Jadwal Seleksi
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[#607792]">
              {applications.length === 0
                ? "Silakan pilih posisi pada menu Lamaran terlebih dahulu agar jadwal seleksi Anda dapat ditampilkan di sini."
                : "Lamaran Anda sudah tercatat, tetapi jadwal seleksi belum tersedia di backend."}
            </p>
            {applications.length === 0 && (
              <button
                type="button"
                onClick={() => navigate("/pendaftaran")}
                className="mx-auto mt-6 flex h-10 items-center gap-2 rounded-md bg-gradient-to-r from-[#347dec] to-[#0c3a78] px-5 text-sm font-bold text-white shadow-[0_14px_26px_rgba(19,77,153,0.25)]"
              >
                Pilih Lamaran
                <FiArrowRight />
              </button>
            )}
          </section>
        ) : (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
                <p className="text-[13px] text-[#213b63]">Total Agenda</p>
                <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">
                  {summary.total}
                </h3>
              </article>
              <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
                <p className="text-[13px] text-[#213b63]">Agenda Minggu Ini</p>
                <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">
                  {summary.thisWeekCount}
                </h3>
              </article>
              <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
                <p className="text-[13px] text-[#213b63]">Agenda Selesai</p>
                <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">
                  {summary.completedCount}
                </h3>
              </article>
              <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
                <p className="text-[13px] text-[#213b63]">Agenda Berikutnya</p>
                <h3 className="mt-2 text-sm font-bold leading-snug text-[#0d2c59]">
                  {summary.nextAgenda ? summary.nextAgenda.label : "Semua tahap selesai"}
                </h3>
              </article>
            </section>

            <section className="grid gap-4">
              {scheduleEvents.map((event) => (
                <article
                  key={event.id}
                  className={`rounded-[10px] border p-4 shadow-[0_12px_28px_rgba(21,54,92,0.05)] sm:p-5 ${event.style.wrapper}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-blue-700">{event.role}</p>
                      <h3 className="mt-1 text-base font-bold text-[#102d5b]">
                        {event.label}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-[#4f6886]">
                        {event.agenda}
                      </p>
                    </div>
                    <span
                      className={`w-max rounded-full px-2 py-1 text-[11px] font-semibold ${event.style.badgeClass}`}
                    >
                      {event.style.badge}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs text-[#4e6885] sm:grid-cols-2 lg:grid-cols-4">
                    <p className="inline-flex items-center gap-2">
                      <FiCalendar className={event.style.icon} />
                      {formatDateFull(event.date)}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <FiClock className={event.style.icon} />
                      {event.time}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <FiMapPin className={event.style.icon} />
                      {event.location}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <FiFileText className={event.style.icon} />
                      {event.branch}
                    </p>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}

        <section className="mt-6 rounded-[10px] border border-[#dfe8f5] bg-gradient-to-r from-[#eef9ed] via-white to-[#edf6ff] p-4 shadow-[0_12px_28px_rgba(21,54,92,0.05)] sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-green-600">
              <FiCheckCircle />
            </span>
            <div>
              <h4 className="text-sm font-bold text-[#10315f]">
                Tips Agar Tidak Tertinggal Jadwal
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-[#4c6685]">
                Periksa menu ini setiap hari dan pastikan notifikasi email/nomor HP
                aktif agar Anda tidak melewatkan tahapan seleksi.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default JadwalSaya;


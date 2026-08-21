import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiShield,
  FiTarget,
} from "react-icons/fi";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardUser } from "../../utils/authUser";
import {
  fetchDashboardApplicationsFromBackend,
  getApplicationStageDefinitions,
  resolveApplicationStageIndex,
} from "../../utils/applications";

function getStageTone(status) {
  if (status === "done") {
    return {
      wrapper: "border-green-200 bg-green-50",
      icon: "text-green-600",
      title: "text-green-700",
      subtitle: "text-green-700/90",
      badge: "Selesai",
      badgeClass: "bg-green-100 text-green-700",
    };
  }

  if (status === "current") {
    return {
      wrapper: "border-blue-200 bg-blue-50",
      icon: "text-blue-600",
      title: "text-blue-700",
      subtitle: "text-blue-700/90",
      badge: "Sedang Berjalan",
      badgeClass: "bg-blue-100 text-blue-700",
    };
  }

  return {
    wrapper: "border-[#dfe8f5] bg-[#fbfdff]",
    icon: "text-[#6f87a2]",
    title: "text-[#223e66]",
    subtitle: "text-[#607792]",
    badge: "Menunggu",
    badgeClass: "bg-[#edf2f8] text-[#57718f]",
  };
}

function formatStageDuration(stage = {}) {
  if (stage.duration) return stage.duration;

  const startDate = String(stage.startDate || "").trim();
  const endDate = String(stage.endDate || "").trim();
  const startTime = String(stage.startTime || "").trim();
  const endTime = String(stage.endTime || "").trim();

  if (startDate && endDate && startDate !== endDate) {
    const formattedStart = new Date(`${startDate}T00:00:00`).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
    });
    const formattedEnd = new Date(`${endDate}T00:00:00`).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
    });
    return `${formattedStart} - ${formattedEnd}`;
  }

  if (startTime && endTime) return `${startTime} - ${endTime}`;
  if (startTime) return startTime;
  return "Menunggu jadwal";
}

function buildStageProgress(application) {
  const stageDefinitions = getApplicationStageDefinitions(application);
  const activeIndex = resolveApplicationStageIndex(application, stageDefinitions);

  return stageDefinitions.map((stage, index) => {
    let status = "upcoming";
    if (index < activeIndex) status = "done";
    if (index === activeIndex) status = "current";

    return {
      ...stage,
      label: stage.title || stage.label,
      detail: stage.description || "Tahap proses seleksi.",
      duration: formatStageDuration(stage),
      status,
      tone: getStageTone(status),
    };
  });
}

function TahapanSeleksi() {
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
              "Gagal memuat tahapan dari backend."
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

  const summary = useMemo(() => {
    const totalApplications = applications.length;
    const averageProgress =
      totalApplications > 0
        ? Math.round(
            applications.reduce(
              (accumulator, item) => accumulator + Number(item.progress || 0),
              0
            ) / totalApplications
          )
        : 0;
    const activeSelectionCount = applications.filter((item) => {
      const stageDefinitions = getApplicationStageDefinitions(item);
      return resolveApplicationStageIndex(item, stageDefinitions) <
        Math.max(stageDefinitions.length - 1, 0);
    }).length;
    const completedStageCount = applications.reduce((accumulator, item) => {
      const stageDefinitions = getApplicationStageDefinitions(item);
      return accumulator + resolveApplicationStageIndex(item, stageDefinitions);
    }, 0);

    return {
      totalApplications,
      averageProgress,
      activeSelectionCount,
      completedStageCount,
    };
  }, [applications]);

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
            {applicationLoadError || "Memuat tahapan seleksi dari backend..."}
          </div>
        )}

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <p className="text-sm font-semibold text-blue-600">Tahapan Seleksi Peserta</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
            Pantau Proses Rekrutmen Anda
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
            Setiap lamaran akan melalui beberapa tahapan seleksi. Status di bawah ini
            diperbarui sesuai progres lamaran Anda.
          </p>
        </section>

        {isLoadingApplications ? (
          <section className="rounded-[10px] border border-[#dfe8f5] bg-white p-8 text-center shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <span className="mx-auto block h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
            <h3 className="mt-4 text-lg font-bold text-[#102d5b]">
              Memuat Tahapan
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[#607792]">
              Sistem sedang mengambil tahapan seleksi langsung dari backend.
            </p>
          </section>
        ) : applications.length === 0 ? (
          <section className="rounded-[10px] border border-dashed border-[#cddbf0] bg-white p-8 text-center shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-600">
              <FiFileText />
            </span>
            <h3 className="mt-4 text-lg font-bold text-[#102d5b]">
              Belum Ada Lamaran Aktif
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[#607792]">
              Pilih posisi pada menu Lamaran agar tahapan seleksi Anda bisa dipantau di
              halaman ini.
            </p>
            <button
              type="button"
              onClick={() => navigate("/pendaftaran")}
              className="mx-auto mt-6 flex h-10 items-center gap-2 rounded-md bg-gradient-to-r from-[#347dec] to-[#0c3a78] px-5 text-sm font-bold text-white shadow-[0_14px_26px_rgba(19,77,153,0.25)]"
            >
              Pilih Lamaran
              <FiArrowRight />
            </button>
          </section>
        ) : (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
                <p className="text-[13px] text-[#213b63]">Total Lamaran</p>
                <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">
                  {summary.totalApplications}
                </h3>
              </article>
              <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
                <p className="text-[13px] text-[#213b63]">Rata-rata Progress</p>
                <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">
                  {summary.averageProgress}%
                </h3>
              </article>
              <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
                <p className="text-[13px] text-[#213b63]">Tahapan Selesai</p>
                <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">
                  {summary.completedStageCount}
                </h3>
              </article>
              <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
                <p className="text-[13px] text-[#213b63]">Seleksi Berjalan</p>
                <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">
                  {summary.activeSelectionCount}
                </h3>
              </article>
            </section>

            <section className="grid gap-5">
              {applications.map((application) => {
                const stageItems = buildStageProgress(application);

                return (
                  <article
                    key={application.id}
                    className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6"
                  >
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold text-blue-600">
                          Posisi Dilamar
                        </p>
                        <h3 className="mt-1 text-xl font-bold text-[#102d5b]">
                          {application.role}
                        </h3>
                        <p className="mt-1 text-xs text-[#607792]">
                          {application.branch}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] px-3 py-2 text-xs text-[#3e5a7a]">
                        <p className="font-semibold">Tahap aktif</p>
                        <p className="mt-1">{application.stage || "Seleksi Administrasi"}</p>
                      </div>
                    </div>

                    <div className="mb-5">
                      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#223e66]">
                        <span>Progress Seleksi</span>
                        <span>{Number(application.progress || 0)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#e8edf5]">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-[#3fbf37] to-[#0c7f3b]"
                          style={{ width: `${Math.min(Number(application.progress || 0), 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {stageItems.map((stage) => (
                        <div
                          key={`${application.id}-${stage.id}`}
                          className={`grid gap-3 rounded-lg border p-3 sm:grid-cols-[34px_minmax(0,1fr)_auto] sm:items-center ${stage.tone.wrapper}`}
                        >
                          <span
                            className={`flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white ${stage.tone.icon}`}
                          >
                            {stage.status === "done" ? (
                              <FiCheckCircle />
                            ) : stage.status === "current" ? (
                              <FiClock />
                            ) : (
                              <FiTarget />
                            )}
                          </span>
                          <div>
                            <p className={`text-sm font-bold ${stage.tone.title}`}>{stage.label}</p>
                            <p className={`mt-1 text-xs leading-relaxed ${stage.tone.subtitle}`}>
                              {stage.detail}
                            </p>
                          </div>
                          <div className="flex flex-col items-start gap-1 text-xs sm:items-end">
                            <span
                              className={`rounded-full px-2 py-1 font-semibold ${stage.tone.badgeClass}`}
                            >
                              {stage.tone.badge}
                            </span>
                            <span className="text-[#5b7390]">{stage.duration}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        )}

        <section className="mt-6 rounded-[10px] border border-[#dfe8f5] bg-gradient-to-r from-[#edf6ff] via-white to-[#eef9ed] p-4 shadow-[0_12px_28px_rgba(21,54,92,0.05)] sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-blue-700">
              <FiShield />
            </span>
            <div>
              <h4 className="text-sm font-bold text-[#10315f]">Tips untuk Peserta</h4>
              <p className="mt-1 text-xs leading-relaxed text-[#4c6685]">
                Pastikan email dan nomor HP Anda aktif agar tidak ketinggalan panggilan
                tes atau interview pada setiap tahapan.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default TahapanSeleksi;


import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiBell,
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiInfo,
  FiShield,
  FiXCircle,
} from "react-icons/fi";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardUser } from "../../utils/authUser";
import { getDashboardApplications } from "../../utils/applications";
import { getPesertaAnnouncementItems } from "../../utils/notifications";

function getResultTone(status) {
  if (status === "Lolos Tahap Akhir") {
    return {
      wrapper: "border-green-200 bg-green-50",
      text: "text-green-700",
      badge: "bg-green-100 text-green-700",
      icon: FiCheckCircle,
      message:
        "Selamat, Anda dinyatakan lolos tahap akhir. Tim rekrutmen akan menghubungi Anda untuk proses lanjutan.",
    };
  }

  if (status === "Cadangan") {
    return {
      wrapper: "border-orange-200 bg-orange-50",
      text: "text-orange-700",
      badge: "bg-orange-100 text-orange-700",
      icon: FiClock,
      message:
        "Anda masuk daftar cadangan. Tetap pantau dashboard untuk pembaruan status berikutnya.",
    };
  }

  if (status === "Diproses") {
    return {
      wrapper: "border-blue-200 bg-blue-50",
      text: "text-blue-700",
      badge: "bg-blue-100 text-blue-700",
      icon: FiInfo,
      message:
        "Lamaran Anda sedang diproses oleh tim rekrutmen. Mohon tunggu tahapan lanjutan.",
    };
  }

  if (status === "Ditolak") {
    return {
      wrapper: "border-red-200 bg-red-50",
      text: "text-red-700",
      badge: "bg-red-100 text-red-700",
      icon: FiXCircle,
      message:
        "Mohon maaf, Anda belum lulus pada rekrutmen ini. Silakan pantau pembukaan posisi berikutnya.",
    };
  }

  return {
    wrapper: "border-[#dfe8f5] bg-[#fbfdff]",
    text: "text-[#4f6886]",
    badge: "bg-[#edf2f8] text-[#57718f]",
    icon: FiShield,
    message:
      "Lamaran telah diterima. Proses verifikasi administrasi sedang berlangsung.",
  };
}

function resolveSelectionStatus(application) {
  const normalizedStatus = String(application?.status || "").trim().toLowerCase();

  if (normalizedStatus.includes("ditolak")) return "Ditolak";
  if (
    normalizedStatus.includes("diterima") ||
    normalizedStatus.includes("lolos tahap akhir")
  ) {
    return "Lolos Tahap Akhir";
  }

  if (
    normalizedStatus.includes("diproses") ||
    normalizedStatus.includes("diverifikasi")
  ) {
    return "Diproses";
  }

  if (normalizedStatus.includes("menunggu")) return "Menunggu Verifikasi";

  const progress = Number(application.progress || 0);

  if (progress >= 85) return "Lolos Tahap Akhir";
  if (progress >= 60) return "Cadangan";
  if (progress >= 30) return "Diproses";
  return "Menunggu Verifikasi";
}

function buildResultItems(applications) {
  return applications.map((application) => {
    const status = resolveSelectionStatus(application);
    const tone = getResultTone(status);

    return {
      ...application,
      status,
      tone,
      registerNo: `REG-${String(application.id || "000").toUpperCase()}`,
    };
  });
}

function getAnnouncementToneClass(tone) {
  if (tone === "green") {
    return {
      card: "border-green-100 bg-green-50/60",
      tag: "bg-green-100 text-green-700",
      icon: "text-green-600",
    };
  }
  if (tone === "orange") {
    return {
      card: "border-orange-100 bg-orange-50/60",
      tag: "bg-orange-100 text-orange-700",
      icon: "text-orange-600",
    };
  }

  return {
    card: "border-blue-100 bg-blue-50/60",
    tag: "bg-blue-100 text-blue-700",
    icon: "text-blue-600",
  };
}

function getAnnouncementTag(tone) {
  if (tone === "red") return "Penting";
  if (tone === "green") return "Info";
  if (tone === "orange") return "Update";
  return "Pengumuman";
}

function formatAnnouncementDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function HasilPengumuman() {
  const navigate = useNavigate();
  const currentUser = getDashboardUser();
  const isPeserta = currentUser.role === "peserta";
  const applications = getDashboardApplications();
  const [announcementItems, setAnnouncementItems] = useState(() =>
    getPesertaAnnouncementItems()
  );

  useEffect(() => {
    const refreshAnnouncements = () => {
      setAnnouncementItems(getPesertaAnnouncementItems());
    };

    window.addEventListener("focus", refreshAnnouncements);
    window.addEventListener("storage", refreshAnnouncements);

    return () => {
      window.removeEventListener("focus", refreshAnnouncements);
      window.removeEventListener("storage", refreshAnnouncements);
    };
  }, []);

  const resultItems = useMemo(
    () => buildResultItems(applications),
    [applications]
  );

  const summary = useMemo(() => {
    const passedCount = resultItems.filter(
      (item) => item.status === "Lolos Tahap Akhir"
    ).length;
    const processingCount = resultItems.filter(
      (item) => item.status === "Diproses" || item.status === "Menunggu Verifikasi"
    ).length;

    return {
      total: resultItems.length,
      passedCount,
      processingCount,
    };
  }, [resultItems]);

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
          <p className="text-sm font-semibold text-blue-600">Hasil Pengumuman</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
            Hasil Seleksi & Info Terbaru
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
            Pantau status hasil seleksi dari setiap lamaran Anda dan lihat pengumuman
            terbaru dari tim rekrutmen PT. BPR NTB (Perseroda).
          </p>
        </section>

        {applications.length === 0 ? (
          <section className="rounded-[10px] border border-dashed border-[#cddbf0] bg-white p-8 text-center shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-600">
              <FiBriefcase />
            </span>
            <h3 className="mt-4 text-lg font-bold text-[#102d5b]">
              Belum Ada Hasil Seleksi
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[#607792]">
              Anda belum memiliki lamaran aktif. Pilih posisi terlebih dahulu untuk
              melihat hasil seleksi dan pengumuman terbaru.
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
            <section className="mb-6 grid gap-4 sm:grid-cols-3">
              <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
                <p className="text-[13px] text-[#213b63]">Total Lamaran Dinilai</p>
                <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">
                  {summary.total}
                </h3>
              </article>
              <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
                <p className="text-[13px] text-[#213b63]">Lolos Tahap Akhir</p>
                <h3 className="mt-2 text-3xl font-bold text-green-700">
                  {summary.passedCount}
                </h3>
              </article>
              <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
                <p className="text-[13px] text-[#213b63]">Masih Diproses</p>
                <h3 className="mt-2 text-3xl font-bold text-blue-700">
                  {summary.processingCount}
                </h3>
              </article>
            </section>

            <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <FiShield className="text-[#17355e]" />
                <h3 className="text-lg font-bold text-[#102d5b]">Status Hasil Seleksi</h3>
              </div>

              <div className="grid gap-4">
                {resultItems.map((item) => {
                  const StatusIcon = item.tone.icon;

                  return (
                    <article
                      key={item.id}
                      className={`rounded-[10px] border p-4 sm:p-5 ${item.tone.wrapper}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold text-[#5c7593]">
                            Nomor Registrasi: {item.registerNo}
                          </p>
                          <h4 className="mt-1 text-base font-bold text-[#102d5b]">
                            {item.role}
                          </h4>
                          <p className="mt-1 text-xs text-[#607792]">{item.branch}</p>
                        </div>
                        <span
                          className={`w-max rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.tone.badge}`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div className={`mt-4 flex items-start gap-2 text-sm ${item.tone.text}`}>
                        <StatusIcon className="mt-0.5 shrink-0" />
                        <p>{item.tone.message}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <section className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FiBell className="text-[#17355e]" />
            <h3 className="text-lg font-bold text-[#102d5b]">Pengumuman Terbaru</h3>
          </div>

          <div className="grid gap-4">
            {announcementItems.length > 0 ? (
              announcementItems.map((announcement) => {
                const toneClass = getAnnouncementToneClass(announcement.tone);

                return (
                  <article
                    key={announcement.id}
                    className={`rounded-[10px] border p-4 sm:p-5 ${toneClass.card}`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-[#102d5b]">
                          {announcement.title}
                        </h4>
                        <p className="mt-2 text-xs leading-relaxed text-[#506783]">
                          {announcement.message}
                        </p>
                        <p className="mt-3 text-[11px] text-[#607792]">
                          Diperbarui: {formatAnnouncementDate(announcement.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`w-max rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass.tag}`}
                      >
                        {getAnnouncementTag(announcement.tone)}
                      </span>
                    </div>
                  </article>
                );
              })
            ) : (
              <article className="rounded-[10px] border border-dashed border-[#cddbf0] bg-[#fbfdff] p-6 text-center">
                <h4 className="text-sm font-bold text-[#102d5b]">Belum Ada Pengumuman</h4>
                <p className="mt-2 text-xs leading-relaxed text-[#607792]">
                  Pengumuman terbaru akan muncul di sini setelah dipublikasikan.
                </p>
              </article>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default HasilPengumuman;


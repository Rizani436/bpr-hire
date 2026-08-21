import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiBell,
  FiBriefcase,
  FiChevronLeft,
  FiChevronRight,
  FiShield,
  FiUser,
} from "react-icons/fi";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardUser } from "../../utils/authUser";
import { getPesertaNotifications } from "../../utils/notifications";

const ITEMS_PER_SLIDE = 3;

function parseDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const parsedDate = parseDateTime(value);
  if (!parsedDate) return "-";

  return parsedDate.toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getKindLabel(kind) {
  if (kind === "announcement") return "Pengumuman";
  if (kind === "application") return "Lamaran";
  return "Akun";
}

function getNotificationToneClasses(tone) {
  if (tone === "green") {
    return {
      wrapper: "border-green-200 bg-green-50",
      icon: "bg-green-100 text-green-700",
      badge: "bg-green-100 text-green-700",
    };
  }

  if (tone === "orange") {
    return {
      wrapper: "border-orange-200 bg-orange-50",
      icon: "bg-orange-100 text-orange-700",
      badge: "bg-orange-100 text-orange-700",
    };
  }

  if (tone === "red") {
    return {
      wrapper: "border-red-200 bg-red-50",
      icon: "bg-red-100 text-red-700",
      badge: "bg-red-100 text-red-700",
    };
  }

  return {
    wrapper: "border-blue-200 bg-blue-50",
    icon: "bg-blue-100 text-blue-700",
    badge: "bg-blue-100 text-blue-700",
  };
}

function getNotificationIcon(kind) {
  if (kind === "announcement") return FiBell;
  if (kind === "application") return FiBriefcase;
  return FiUser;
}

function LoncengNotifikasi() {
  const navigate = useNavigate();
  const currentUser = getDashboardUser();
  const isPeserta = currentUser.role === "peserta";
  const [notifications, setNotifications] = useState(() =>
    getPesertaNotifications()
  );
  const [slideIndex, setSlideIndex] = useState(1);

  useEffect(() => {
    if (!isPeserta) {
      navigate("/dashboard", { replace: true });
      return undefined;
    }

    const refreshNotifications = () => {
      setNotifications(getPesertaNotifications());
    };

    window.addEventListener("focus", refreshNotifications);
    window.addEventListener("storage", refreshNotifications);

    return () => {
      window.removeEventListener("focus", refreshNotifications);
      window.removeEventListener("storage", refreshNotifications);
    };
  }, [isPeserta, navigate]);

  const summary = useMemo(() => {
    const announcementCount = notifications.filter(
      (item) => item.kind === "announcement"
    ).length;
    const applicationCount = notifications.filter(
      (item) => item.kind === "application"
    ).length;
    const accountCount = notifications.filter(
      (item) => item.kind === "account"
    ).length;

    return {
      total: notifications.length,
      announcementCount,
      applicationCount,
      accountCount,
    };
  }, [notifications]);

  const totalSlides = Math.max(
    1,
    Math.ceil(notifications.length / ITEMS_PER_SLIDE)
  );

  useEffect(() => {
    if (slideIndex > totalSlides) {
      setSlideIndex(totalSlides);
    }
  }, [slideIndex, totalSlides]);

  const visibleNotifications = useMemo(() => {
    const startIndex = (slideIndex - 1) * ITEMS_PER_SLIDE;
    const endIndex = startIndex + ITEMS_PER_SLIDE;
    return notifications.slice(startIndex, endIndex);
  }, [notifications, slideIndex]);

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
          <p className="text-sm font-semibold text-blue-600">Lonceng Notifikasi</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
            Pengumuman & Informasi Akun
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
            Semua pengumuman rekrutmen dan informasi yang terkait akun peserta
            Anda akan ditampilkan di halaman ini.
          </p>
        </section>

        {notifications.length === 0 ? (
          <section className="rounded-[10px] border border-dashed border-[#cddbf0] bg-white p-8 text-center shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-600">
              <FiBell />
            </span>
            <h3 className="mt-4 text-lg font-bold text-[#102d5b]">
              Belum Ada Notifikasi
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[#607792]">
              Notifikasi akan muncul saat ada pengumuman baru atau pembaruan
              terkait akun dan lamaran Anda.
            </p>
          </section>
        ) : (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
                <p className="text-[13px] text-[#213b63]">Total Notifikasi</p>
                <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">
                  {summary.total}
                </h3>
              </article>
              <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
                <p className="text-[13px] text-[#213b63]">Pengumuman</p>
                <h3 className="mt-2 text-3xl font-bold text-blue-700">
                  {summary.announcementCount}
                </h3>
              </article>
              <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
                <p className="text-[13px] text-[#213b63]">Info Lamaran</p>
                <h3 className="mt-2 text-3xl font-bold text-green-700">
                  {summary.applicationCount}
                </h3>
              </article>
              <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
                <p className="text-[13px] text-[#213b63]">Info Akun</p>
                <h3 className="mt-2 text-3xl font-bold text-orange-700">
                  {summary.accountCount}
                </h3>
              </article>
            </section>

            <section className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <FiShield className="text-[#17355e]" />
                  <h3 className="text-lg font-bold text-[#102d5b]">
                    Daftar Notifikasi Peserta
                  </h3>
                </div>
                <span className="w-max rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  Slide {slideIndex} dari {totalSlides} (3 data per slide)
                </span>
              </div>

              <div className="grid gap-4">
                {visibleNotifications.map((item) => {
                  const toneClass = getNotificationToneClasses(item.tone);
                  const Icon = getNotificationIcon(item.kind);

                  return (
                    <article
                      key={item.id}
                      className={`rounded-[10px] border p-4 sm:p-5 ${toneClass.wrapper}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${toneClass.icon}`}
                            >
                              <Icon />
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass.badge}`}
                            >
                              {getKindLabel(item.kind)}
                            </span>
                          </div>
                          <h4 className="mt-3 text-sm font-bold text-[#102d5b]">
                            {item.title}
                          </h4>
                          <p className="mt-2 text-xs leading-relaxed text-[#4f6886]">
                            {item.message}
                          </p>
                          <p className="mt-3 text-[11px] text-[#607792]">
                            {formatDateTime(item.createdAt)}
                          </p>
                        </div>
                        {item.actionPath && (
                          <button
                            type="button"
                            onClick={() => navigate(item.actionPath)}
                            className="h-9 w-max rounded-md bg-white px-3 text-xs font-bold text-[#10315f] shadow-[0_8px_18px_rgba(20,57,96,0.08)]"
                          >
                            Lihat Detail
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSlideIndex((prev) => Math.max(1, prev - 1))}
                  disabled={slideIndex === 1}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-[#d6dfed] bg-white px-3 text-xs font-bold text-[#102d5b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiChevronLeft />
                  Slide Sebelumnya
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {Array.from({ length: totalSlides }, (_, index) => index + 1).map(
                    (pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => setSlideIndex(pageNumber)}
                        className={`h-8 min-w-8 rounded-md px-2 text-xs font-bold ${
                          pageNumber === slideIndex
                            ? "bg-blue-600 text-white"
                            : "border border-[#d6dfed] bg-white text-[#102d5b]"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSlideIndex((prev) => Math.min(totalSlides, prev + 1))
                  }
                  disabled={slideIndex === totalSlides}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-[#d6dfed] bg-white px-3 text-xs font-bold text-[#102d5b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Slide Berikutnya
                  <FiChevronRight />
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default LoncengNotifikasi;

import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import {
  FiBell,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiLogOut,
  FiSettings,
  FiUser,
} from "react-icons/fi";
import Swal from "sweetalert2";
import ThemeToggle from "./theme-toggle";
import { getAlertThemeConfig } from "../utils/alertTheme";
import {
  clearDashboardUser,
  DEFAULT_DASHBOARD_USER,
  getUserInitials,
} from "../utils/authUser";
import { logoutApi } from "../utils/authApi";
import {
  getPesertaNotificationReadMap,
  getPesertaNotifications,
  markPesertaNotificationAsRead,
} from "../utils/notifications";

const NOTIFICATION_ITEMS_PER_SLIDE = 3;
const LOGIN_ANNOUNCEMENT_HINT_KEY = "bpr-hire-show-announcement-login-hint";

function formatRoleLabel(role) {
  const normalizedRole = String(role || DEFAULT_DASHBOARD_USER.role).toLowerCase();

  if (normalizedRole === "peserta") return "Peserta";

  return normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);
}

function formatNotificationDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNotificationKindLabel(kind) {
  if (kind === "announcement") return "Pengumuman";
  if (kind === "application") return "Lamaran";
  return "Akun";
}

function getRoleWelcomeMessage(role) {
  const normalizedRole = String(role || "").toLowerCase();

  if (normalizedRole === "superadmin") {
    return "Monitoring seluruh user dan keamanan akun di sini.";
  }

  if (normalizedRole === "pengawas") {
    return "Pantau progress seleksi dan jadwal Anda di sini.";
  }

  return "Pantau progress seleksi dan jadwal Anda di sini.";
}

function Header({ user = DEFAULT_DASHBOARD_USER }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notificationSlide, setNotificationSlide] = useState(1);
  const [hasLoginAnnouncementHint, setHasLoginAnnouncementHint] = useState(false);
  const [notifications, setNotifications] = useState(() =>
    getPesertaNotifications()
  );
  const [notificationReadMap, setNotificationReadMap] = useState(() =>
    getPesertaNotificationReadMap()
  );
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const notificationRef = useRef(null);
  const userName = user.userName || DEFAULT_DASHBOARD_USER.userName;
  const roleLabel = formatRoleLabel(user.role);
  const normalizedRole = String(user.role || "").toLowerCase();
  const isNonPeserta = normalizedRole !== "peserta";
  const initials = getUserInitials(userName);

  const unreadNotificationCount = useMemo(() => {
    if (isNonPeserta) return 0;

    return notifications.reduce(
      (total, notification) =>
        total + (notificationReadMap[notification.id] ? 0 : 1),
      0
    );
  }, [isNonPeserta, notifications, notificationReadMap]);

  const unreadAnnouncementCount = useMemo(() => {
    if (isNonPeserta) return 0;

    return notifications.reduce((total, notification) => {
      if (notification.kind !== "announcement") return total;
      return total + (notificationReadMap[notification.id] ? 0 : 1);
    }, 0);
  }, [isNonPeserta, notifications, notificationReadMap]);

  const unreadNotificationLabel =
    unreadNotificationCount > 99 ? "99+" : String(unreadNotificationCount);

  const totalNotificationSlides = Math.max(
    1,
    Math.ceil(notifications.length / NOTIFICATION_ITEMS_PER_SLIDE)
  );

  const visibleNotifications = useMemo(() => {
    const startIndex = (notificationSlide - 1) * NOTIFICATION_ITEMS_PER_SLIDE;
    return notifications.slice(
      startIndex,
      startIndex + NOTIFICATION_ITEMS_PER_SLIDE
    );
  }, [notifications, notificationSlide]);

  useEffect(() => {
    if (notificationSlide > totalNotificationSlides) {
      setNotificationSlide(totalNotificationSlides);
    }
  }, [notificationSlide, totalNotificationSlides]);

  useEffect(() => {
    if (isNonPeserta) return undefined;

    const refreshNotifications = () => {
      setNotifications(getPesertaNotifications());
      setNotificationReadMap(getPesertaNotificationReadMap());
    };

    window.addEventListener("focus", refreshNotifications);
    window.addEventListener("storage", refreshNotifications);

    return () => {
      window.removeEventListener("focus", refreshNotifications);
      window.removeEventListener("storage", refreshNotifications);
    };
  }, [isNonPeserta]);

  useEffect(() => {
    if (isNonPeserta) {
      setHasLoginAnnouncementHint(false);
      return undefined;
    }
    if (typeof window === "undefined") return undefined;

    const shouldShowHint =
      window.sessionStorage.getItem(LOGIN_ANNOUNCEMENT_HINT_KEY) === "1";
    setHasLoginAnnouncementHint(shouldShowHint);
    window.sessionStorage.removeItem(LOGIN_ANNOUNCEMENT_HINT_KEY);
    return undefined;
  }, [isNonPeserta]);

  useEffect(() => {
    if (!hasLoginAnnouncementHint) return;
    if (unreadAnnouncementCount <= 0) {
      setHasLoginAnnouncementHint(false);
    }
  }, [hasLoginAnnouncementHint, unreadAnnouncementCount]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }

      if (!notificationRef.current?.contains(event.target)) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setMenuOpen(false);
    setNotificationOpen(false);
    const logoutConfirmTheme = getAlertThemeConfig("logoutConfirm");

    const confirmation = await Swal.fire({
      icon: "question",
      title: "Konfirmasi Logout",
      text: "Apakah Anda yakin ingin logout sekarang?",
      showCancelButton: true,
      confirmButtonText: "Ya, Logout",
      cancelButtonText: "Batal",
      background: logoutConfirmTheme.background,
      color: logoutConfirmTheme.color,
      iconColor: logoutConfirmTheme.iconColor,
      confirmButtonColor: logoutConfirmTheme.confirmButtonColor,
      cancelButtonColor: logoutConfirmTheme.cancelButtonColor,
      reverseButtons: true,
      focusCancel: true,
    });

    if (!confirmation.isConfirmed) return;

    setIsLoggingOut(true);

    try {
      await logoutApi();

      const logoutSuccessTheme = getAlertThemeConfig("logoutSuccess");

      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Logout berhasil. Sampai jumpa kembali!",
        timer: 1800,
        timerProgressBar: true,
        showConfirmButton: false,
        background: logoutSuccessTheme.background,
        color: logoutSuccessTheme.color,
        iconColor: logoutSuccessTheme.iconColor,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: (toast) => {
          toast.style.boxShadow = logoutSuccessTheme.boxShadow;
        },
      });

      clearDashboardUser();
      navigate("/login", { replace: true });
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Logout Gagal",
        text:
          error instanceof Error
            ? error.message
            : "Terjadi kendala saat logout. Coba lagi.",
        confirmButtonText: "Tutup",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleOpenProfile = () => {
    setMenuOpen(false);
    navigate("/profile");
  };

  const handleOpenSetting = () => {
    setMenuOpen(false);
    navigate("/setting");
  };

  const handleToggleNotificationDropdown = () => {
    if (isNonPeserta) return;

    setMenuOpen(false);
    setNotificationOpen((prev) => !prev);
  };

  const handleMarkNotificationRead = (notification) => {
    const notificationId = String(notification?.id || "").trim();
    if (!notificationId) return;

    const nextReadMap = markPesertaNotificationAsRead(notificationId);
    setNotificationReadMap(nextReadMap);

    if (notification?.kind === "announcement") {
      setHasLoginAnnouncementHint(false);
    }
  };

  const handleOpenNotificationDetail = async (notification) => {
    handleMarkNotificationRead(notification);

    await Swal.fire({
      icon: "info",
      title: notification.title,
      text: notification.message,
      footer: `${getNotificationKindLabel(
        notification.kind
      )} - ${formatNotificationDate(notification.createdAt)}`,
      confirmButtonText: "Tutup",
    });
  };

  return (
    <header className="bh-dashboard-header mb-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="m-0 text-[15px] font-medium text-[#09275a]">Selamat datang,</p>
        <h1 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
          {userName}
        </h1>
        <small className="mt-2 block text-[13px] text-[#546a87]">
          {getRoleWelcomeMessage(user.role)}
        </small>
      </div>

      <div className="bh-dashboard-header-actions flex items-center gap-3">
        <ThemeToggle
          className="bh-theme-toggle inline-flex h-9 items-center gap-2 rounded-full border border-[#d8e2f0] bg-white px-3 text-xs font-semibold text-[#17355e] transition hover:border-[#b9cbe3] hover:bg-[#f5f9ff]"
          titlePrefix="Tema Dashboard"
        />

        {!isNonPeserta && (
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={handleToggleNotificationDropdown}
              className="relative flex h-9 w-9 items-center justify-center text-[22px] text-[#17355e]"
              aria-label={`Notifikasi (${unreadNotificationLabel})`}
            >
              <FiBell />
              {unreadNotificationCount > 0 && (
                <span className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-green-600 px-1 text-[10px] font-bold text-white">
                  {unreadNotificationLabel}
                </span>
              )}
            </button>

            {notificationOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(380px,calc(100vw-28px))] rounded-[12px] border border-[#dfe8f5] bg-white p-3 shadow-[0_18px_42px_rgba(21,54,92,0.14)]">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#102d5b]">Notifikasi Peserta</h3>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                    {notificationSlide}/{totalNotificationSlides}
                  </span>
                </div>

                {visibleNotifications.length === 0 ? (
                  <p className="rounded-md border border-dashed border-[#d6dfed] px-3 py-4 text-center text-xs text-[#607792]">
                    Belum ada notifikasi.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {visibleNotifications.map((notification) => {
                      const isRead = Boolean(notificationReadMap[notification.id]);

                      return (
                        <article
                          key={notification.id}
                          className="rounded-md border border-[#e2eaf6] bg-[#f9fbff] p-2.5"
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p
                              className={`text-[11px] font-bold ${
                                isRead ? "text-[#536a88]" : "text-[#102d5b]"
                              }`}
                            >
                              {notification.title}
                            </p>
                            <span className="rounded-full bg-[#e9eff9] px-2 py-0.5 text-[10px] font-semibold text-[#4f6886]">
                              {getNotificationKindLabel(notification.kind)}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-[#5b7390]">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-[10px] text-[#7a90aa]">
                            {formatNotificationDate(notification.createdAt)}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenNotificationDetail(notification)}
                              className="h-7 rounded-md bg-blue-600 px-2.5 text-[10px] font-bold text-white"
                            >
                              Detail
                            </button>
                              <button
                                type="button"
                                onClick={() => handleMarkNotificationRead(notification)}
                                disabled={isRead}
                                className="h-7 rounded-md border border-[#d6dfed] bg-white px-2.5 text-[10px] font-bold text-[#304d74] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                              {isRead ? "Sudah dibaca" : "Tandai sudah dibaca"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setNotificationSlide((prev) => Math.max(1, prev - 1))
                    }
                    disabled={notificationSlide === 1}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-[#d6dfed] bg-white px-2 text-[10px] font-bold text-[#304d74] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiChevronLeft />
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNotificationSlide((prev) =>
                        Math.min(totalNotificationSlides, prev + 1)
                      )
                    }
                    disabled={notificationSlide === totalNotificationSlides}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-[#d6dfed] bg-white px-2 text-[10px] font-bold text-[#304d74] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Next
                    <FiChevronRight />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bh-dashboard-user-menu relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              setNotificationOpen(false);
              setMenuOpen((value) => !value);
            }}
            className="flex items-center gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-white"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e9effc] text-[17px] font-bold text-[#102d5b]">
              {initials}
            </span>
            <span className="min-w-0">
              <strong className="block text-sm font-bold text-[#102d5b]">{userName}</strong>
              <span className="mt-1 block text-xs text-[#506783]">{roleLabel}</span>
            </span>
            <FiChevronDown
              className={`text-[#17355e] transition ${
                menuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="bh-dashboard-user-menu-panel absolute right-0 top-[calc(100%+10px)] z-50 w-44 rounded-[10px] border border-[#dfe8f5] bg-white p-2 shadow-[0_18px_42px_rgba(21,54,92,0.14)]"
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleOpenSetting}
                className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold text-[#203b63] transition hover:bg-blue-50 hover:text-blue-700"
              >
                <FiSettings />
                Setting
              </button>
              {!isNonPeserta && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleOpenProfile}
                  className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold text-[#203b63] transition hover:bg-green-50 hover:text-green-700"
                >
                  <FiUser />
                  Biodata
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold text-[#203b63] transition hover:bg-red-50 hover:text-red-600"
              >
                <FiLogOut />
                Keluar
              </button>
            </div>
          )}
        </div>
      </div>

      {!isNonPeserta && hasLoginAnnouncementHint && unreadAnnouncementCount > 0 && (
        <div className="fixed right-4 top-4 z-[85] w-[min(350px,calc(100vw-24px))] rounded-[10px] border border-[#cfe0fa] bg-white p-3 shadow-[0_14px_34px_rgba(21,54,92,0.18)]">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
              <FiBell />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#102d5b]">
                Ada pengumuman baru untuk Anda
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#506783]">
                {unreadAnnouncementCount} pengumuman belum dibaca. Buka icon lonceng
                lalu tekan tombol sudah dibaca.
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

Header.propTypes = {
  user: PropTypes.shape({
    userName: PropTypes.string,
    role: PropTypes.string,
    loginIdentity: PropTypes.string,
    profileComplete: PropTypes.bool,
  }),
};

export default Header;

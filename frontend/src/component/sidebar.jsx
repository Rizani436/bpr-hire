import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiActivity,
  FiBell,
  FiBriefcase,
  FiCalendar,
  FiCheck,
  FiClock,
  FiDatabase,
  FiFileText,
  FiHome,
  FiLogOut,
  FiMenu,
  FiPlusCircle,
  FiShield,
  FiUsers,
  FiX,
} from "react-icons/fi";
import Swal from "sweetalert2";
import { getAlertThemeConfig } from "../utils/alertTheme";
import { clearDashboardUser, getDashboardUser } from "../utils/authUser";
import { logoutApi } from "../utils/authApi";

const pesertaSidebarItems = [
  { label: "Dashboard", icon: FiHome, path: "/dashboard" },
  { label: "Lamaran", icon: FiBriefcase, path: "/pendaftaran" },
  { label: "Tahapan Seleksi", icon: FiFileText, path: "/tahapan-seleksi" },
  { label: "Jadwal Saya", icon: FiCalendar, path: "/jadwal-saya" },
  { label: "Hasil Pengumuman", icon: FiShield, path: "/hasil-pengumuman" },
  { label: "Dokumen Saya", icon: FiFileText, path: "/dokumen-saya" },
];

const pengawasSidebarItems = [
  { label: "Dashboard Pengawas", icon: FiHome, path: "/dashboard" },
  { label: "Antrian Verifikasi", icon: FiFileText, path: "/pengawas/antrian-verifikasi" },
  { label: "Tracking Progress", icon: FiUsers, path: "/pengawas/tracking-progress", matchPrefix: true },
  { label: "Aktivitas Rekrutmen", icon: FiActivity, path: "/pengawas/aktivitas-rekrutmen" },
  { label: "Pengumuman Peserta", icon: FiBell, path: "/pengawas/master-data/tambah-pengumuman" },
];

const superadminSidebarItems = [
  { label: "Monitoring User", icon: FiUsers, path: "/superadmin/dashboard-user" },
  { label: "Kelola Data", icon: FiDatabase, path: "/superadmin/kelola-data" },
  { label: "Logs Riwayat", icon: FiClock, path: "/superadmin/logs-activity" },
  { label: "Dashboard Pengawas", icon: FiHome, path: "/dashboard-pengawas" },
  { label: "Antrian Verifikasi", icon: FiFileText, path: "/pengawas/antrian-verifikasi" },
  { label: "Tracking Progress", icon: FiUsers, path: "/pengawas/tracking-progress", matchPrefix: true },
  { label: "Aktivitas Rekrutmen", icon: FiActivity, path: "/pengawas/aktivitas-rekrutmen" },
  { label: "Pengumuman Peserta", icon: FiBell, path: "/pengawas/master-data/tambah-pengumuman" },
];

const pengawasMasterDataItems = [
  { label: "Tambah Lamaran", icon: FiPlusCircle, path: "/pengawas/master-data/tambah-lamaran" },
  { label: "Tambah Seleksi Biodata", icon: FiShield, path: "/pengawas/master-data/seleksi1-biodata" },
  { label: "Tambah Pengumuman", icon: FiBell, path: "/pengawas/master-data/tambah-pengumuman" },
];

function Sidebar({ role = "peserta" }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const currentDashboardRole = String(getDashboardUser()?.role || "").toLowerCase();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.hash]);

  const handleLogout = async () => {
    if (isLoggingOut) return;

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

  const normalizedRole =
    currentDashboardRole === "superadmin"
      ? "superadmin"
      : String(role).toLowerCase();
  const isPeserta = normalizedRole === "peserta";
  const isPengawas = normalizedRole === "pengawas";
  const isSuperadmin = normalizedRole === "superadmin";
  const isManagementRole = isPengawas || isSuperadmin;

  if (!isPeserta && !isManagementRole) {
    return null;
  }

  const pengawasBasePath =
    location.pathname === "/dashboard-pengawas" ? "/dashboard-pengawas" : "/dashboard";
  const sidebarItems = isSuperadmin
    ? superadminSidebarItems
    : isPengawas
    ? pengawasSidebarItems.map((item) =>
        item.sectionId ? { ...item, path: pengawasBasePath } : item
      )
    : pesertaSidebarItems;

  const isMenuItemActive = (item) => {
    const currentHash = String(location.hash || "").replace("#", "");
    if (!item.path) return false;

    const pathMatched = item.matchPrefix
      ? location.pathname === item.path ||
        location.pathname.startsWith(`${item.path}/`)
      : location.pathname === item.path;

    return (
      pathMatched &&
      (!item.sectionId ||
        currentHash === item.sectionId ||
        (!currentHash && !item.sectionId))
    );
  };

  const handleItemNavigate = (item) => {
    if (!item.path) return;
    setIsMobileMenuOpen(false);

    if (item.sectionId) {
      if (location.pathname === item.path) {
        const targetElement = document.getElementById(item.sectionId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }

      navigate(`${item.path}#${item.sectionId}`);
      return;
    }

    navigate(item.path);
  };

  const activeItem =
    sidebarItems.find((item) => isMenuItemActive(item)) ||
    pengawasMasterDataItems.find((item) => isMenuItemActive(item));

  const renderMenuItem = (item, { isMobile = false } = {}) => {
    const Icon = item.icon;
    const isActive = isMenuItemActive(item);

    return (
      <button
        key={item.label}
        type="button"
        onClick={() => handleItemNavigate(item)}
        className={`relative flex min-h-11 w-full items-center gap-3 rounded-[7px] text-left text-sm font-medium transition ${
          isMobile ? "px-4" : "px-5"
        } ${
          isActive
            ? "bg-gradient-to-r from-green-50 to-white text-green-600 lg:before:absolute lg:before:-left-4 lg:before:top-2 lg:before:bottom-2 lg:before:w-[3px] lg:before:rounded-full lg:before:bg-green-500"
            : "text-[#203b63] hover:bg-slate-50"
        }`}
      >
        <Icon className={`shrink-0 text-lg ${isActive ? "text-green-600" : "text-[#496181]"}`} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </button>
    );
  };

  const renderMasterDataItems = ({ isMobile = false } = {}) =>
    isManagementRole ? (
      <div
        className={`bh-dashboard-sidebar-master rounded-md border border-[#e4ecf7] bg-[#f9fbff] p-2 ${
          isMobile ? "mt-3" : "mt-2"
        }`}
      >
        <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#607792]">
          Master Data
        </p>
        {pengawasMasterDataItems.map((item) => renderMenuItem(item, { isMobile }))}
      </div>
    ) : null;

  return (
    <>
      <div className="lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <img src="/bpr.png" alt="BPR HIRE" className="h-auto w-[128px]" />
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d6dfed] bg-white px-3 text-sm font-bold text-[#102d5b] shadow-[0_8px_18px_rgba(21,54,92,0.08)]"
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? "Tutup menu" : "Buka menu"}
          >
            {isMobileMenuOpen ? <FiX /> : <FiMenu />}
            Menu
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-[#e3ebf6] bg-[#fbfdff] px-3 py-2">
          <span className="text-xs font-semibold text-[#607792]">Halaman aktif</span>
          <span className="max-w-[55vw] truncate text-xs font-bold text-green-700">
            {activeItem?.label || "Dashboard"}
          </span>
        </div>

        {isMobileMenuOpen && (
          <div className="mt-4 rounded-[12px] border border-[#dfe8f5] bg-white p-3 shadow-[0_18px_42px_rgba(21,54,92,0.12)]">
            <nav
              className="grid max-h-[62vh] gap-2 overflow-y-auto pr-1"
              aria-label={isSuperadmin ? "Menu superadmin" : isPengawas ? "Menu pengawas" : "Menu peserta"}
            >
              {sidebarItems.map((item) => renderMenuItem(item, { isMobile: true }))}
              {renderMasterDataItems({ isMobile: true })}
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-[#e3ebf6] bg-[#fbfdff] px-4 text-sm font-bold text-[#213d65]"
            >
              <FiLogOut />
              <span>{isLoggingOut ? "Keluar..." : "Keluar"}</span>
            </button>
          </div>
        )}
      </div>

      <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-4">
        <div className="bh-dashboard-sidebar-brand px-4">
          <img src="/bpr.png" alt="BPR HIRE" className="h-auto w-[150px]" />
        </div>

        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1 [scrollbar-width:thin]">
          <nav
            className="bh-dashboard-sidebar-nav grid grid-cols-1 gap-2 overflow-visible pb-1"
            aria-label={isSuperadmin ? "Menu superadmin" : isPengawas ? "Menu pengawas" : "Menu peserta"}
          >
            {sidebarItems.map((item) => renderMenuItem(item))}
            {renderMasterDataItems()}
          </nav>

          {!isSuperadmin && (
            <div className="bh-dashboard-sidebar-cta mt-6 rounded-[10px] border border-green-100 bg-gradient-to-br from-[#eef9ed] via-white to-[#edf5ff] px-5 py-6 text-center shadow-[0_18px_42px_rgba(45,122,65,0.08)]">
              <div className="relative mx-auto mb-4 flex h-16 w-14 items-center justify-center rounded-[9px] bg-white text-3xl text-blue-600 shadow-[0_14px_30px_rgba(40,84,124,0.12)]">
                <FiFileText />
                <span className="absolute -right-2 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-xs text-white shadow-[0_8px_18px_rgba(39,145,54,0.22)]">
                  <FiCheck />
                </span>
              </div>
              <h3 className="text-base font-bold leading-tight text-[#0d2c59]">
                {isSuperadmin
                  ? "Kontrol User Terpusat"
                  : isPengawas
                    ? "Pantau Rekrutmen Harian"
                    : "Lengkapi Profil Anda"}
              </h3>
              <p className="my-4 text-xs leading-relaxed text-[#536983]">
                {isSuperadmin
                  ? "Gunakan panel ini untuk monitoring akun user, biodata, dan keamanan password."
                  : isPengawas
                    ? "Gunakan panel ini untuk memantau verifikasi, interview, dan aktivitas tim."
                    : "Lengkapi data diri agar kesempatan lolos lebih besar"}
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    isSuperadmin ? "/dashboard" : isPengawas ? pengawasBasePath : "/profile"
                  )
                }
                className="h-10 w-full rounded-md border border-[#23952f] bg-gradient-to-r from-[#43bd32] via-[#31aa35] to-[#158a3b] text-xs font-extrabold text-white shadow-[0_14px_26px_rgba(35,149,47,0.28)] [text-shadow:0_1px_1px_rgba(0,0,0,0.18)] hover:from-[#4dc83a] hover:to-[#0f7835]"
              >
                {isSuperadmin
                  ? "Buka Monitoring User"
                  : isPengawas
                    ? "Buka Ringkasan Pengawas"
                    : "Lengkapi Sekarang"}
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="bh-dashboard-sidebar-logout flex min-h-11 w-full shrink-0 items-center gap-3 rounded-[7px] border border-[#e3ebf6] bg-white/80 px-5 text-sm font-semibold text-[#213d65] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <FiLogOut />
          <span>{isLoggingOut ? "Keluar..." : "Keluar"}</span>
        </button>

      </div>
    </>
  );
}

Sidebar.propTypes = {
  role: PropTypes.string,
};

export default Sidebar;


import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { createUserActivityLogApi } from "../utils/authApi";
import { getDashboardUser } from "../utils/authUser";

const IGNORED_PATHS = new Set(["/", "/login"]);
const MIN_RELOG_INTERVAL_MS = 15 * 1000;

const cleanText = (value) => String(value || "").trim();

const labelByPath = [
  { startsWith: "/dashboard-pengawas", label: "Buka Dashboard Pengawas" },
  { startsWith: "/superadmin/dashboard-user", label: "Monitoring User" },
  { startsWith: "/superadmin/kelola-data", label: "Kelola Data" },
  { startsWith: "/superadmin/logs-activity", label: "Logs Riwayat" },
  { startsWith: "/dashboard", label: "Buka Dashboard" },
  { startsWith: "/pengawas/antrian-verifikasi", label: "Antrian Verifikasi" },
  { startsWith: "/pengawas/tracking-progress", label: "Tracking Progress" },
  { startsWith: "/pengawas/aktivitas-rekrutmen", label: "Aktivitas Rekrutmen" },
  { startsWith: "/pengawas/master-data/tambah-lamaran", label: "Tambah Lamaran" },
  {
    startsWith: "/pengawas/master-data/seleksi1-biodata",
    label: "Tambah Seleksi Biodata",
  },
  {
    startsWith: "/pengawas/master-data/tambah-pengumuman",
    label: "Tambah Pengumuman",
  },
  { startsWith: "/pendaftaran", label: "Lamaran" },
  { startsWith: "/tahapan-seleksi", label: "Tahapan Seleksi" },
  { startsWith: "/jadwal-saya", label: "Jadwal Saya" },
  { startsWith: "/hasil-pengumuman", label: "Hasil Pengumuman" },
  { startsWith: "/dokumen-saya", label: "Dokumen Saya" },
  { startsWith: "/profile", label: "Profil" },
  { startsWith: "/setting", label: "Pengaturan" },
];

const resolveEventLabel = (pathname) => {
  const safePathname = cleanText(pathname);
  if (!safePathname) return "Akses halaman";

  const matched = labelByPath.find((item) => safePathname.startsWith(item.startsWith));
  if (matched) return matched.label;
  return `Akses ${safePathname}`;
};

function ActivityTracker() {
  const location = useLocation();
  const lastLogRef = useRef({
    path: "",
    at: 0,
  });

  useEffect(() => {
    const accessToken =
      typeof window !== "undefined"
        ? cleanText(window.localStorage.getItem("accessToken"))
        : "";

    if (!accessToken) return;

    const pathname = cleanText(location.pathname);
    if (!pathname || IGNORED_PATHS.has(pathname)) return;

    const user = getDashboardUser();
    const loginIdentity = cleanText(user?.loginIdentity);
    if (!loginIdentity) return;

    const now = Date.now();
    if (
      lastLogRef.current.path === pathname &&
      now - Number(lastLogRef.current.at || 0) < MIN_RELOG_INTERVAL_MS
    ) {
      return;
    }
    lastLogRef.current = { path: pathname, at: now };

    const payload = {
      eventType: "access",
      eventLabel: resolveEventLabel(pathname),
      routePath: pathname,
    };

    createUserActivityLogApi(payload).catch(() => {
      // Do not interrupt user navigation when logging fails.
    });
  }, [location.pathname]);

  return null;
}

export default ActivityTracker;

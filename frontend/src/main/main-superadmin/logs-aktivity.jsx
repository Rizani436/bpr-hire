import { useCallback, useEffect, useMemo, useState } from "react";
import { FiClock, FiFilter, FiRefreshCw, FiSearch, FiTrash2 } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardUser } from "../../utils/authUser";
import { getUserActivityLogsApi } from "../../utils/authApi";

const FILTER_ALL = "all";
const FILTER_ACCESS = "access";
const FILTER_DELETE = "delete_user";

const cleanText = (value) => String(value || "").trim();
const normalizeText = (value) => cleanText(value).toLowerCase();

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const getTypeLabel = (eventType) =>
  normalizeText(eventType) === FILTER_DELETE ? "Hapus User" : "Akses Halaman";

const getTypeTone = (eventType) =>
  normalizeText(eventType) === FILTER_DELETE
    ? "bg-red-100 text-red-700"
    : "bg-blue-100 text-blue-700";

const buildLogActivityText = (log) => {
  const eventType = normalizeText(log?.eventType);
  if (eventType === FILTER_DELETE) {
    const targetFullName = cleanText(log?.targetFullName);
    const targetUsername = cleanText(log?.targetUsername);
    const targetRole = cleanText(log?.targetUserRole);

    const userLabel =
      targetFullName && targetUsername
        ? `${targetFullName} (@${targetUsername})`
        : targetFullName || (targetUsername ? `@${targetUsername}` : "User tanpa nama");

    return `Data ${userLabel} (${targetRole || "role tidak diketahui"}) dihapus dari sistem.`;
  }

  const actor = cleanText(log?.username) || "user";
  const role = cleanText(log?.userRole) || "-";
  const eventLabel = cleanText(log?.eventLabel) || "Akses halaman";
  const routePath = cleanText(log?.routePath) || "-";
  return `${actor} (${role}) melakukan "${eventLabel}" pada ${routePath}.`;
};

function LogsAktivitySuperadmin() {
  const navigate = useNavigate();
  const currentUser = getDashboardUser();
  const isSuperadmin = normalizeText(currentUser?.role) === "superadmin";

  const [logs, setLogs] = useState([]);
  const [retentionHours, setRetentionHours] = useState(24);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState(FILTER_ALL);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [lastFetchedAt, setLastFetchedAt] = useState("");

  const loadLogs = useCallback(
    async ({ silent = false } = {}) => {
      if (!isSuperadmin) return;
      if (!silent) setIsLoading(true);
      setLoadError("");

      try {
        const response = await getUserActivityLogsApi({
          eventType: eventTypeFilter === FILTER_ALL ? "" : eventTypeFilter,
          search: searchKeyword,
          limit: 400,
        });
        setLogs(Array.isArray(response?.logs) ? response.logs : []);
        setRetentionHours(Number(response?.retentionHours) || 24);
        setLastFetchedAt(new Date().toISOString());
      } catch (error) {
        setLogs([]);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Gagal mengambil logs aktivitas dari server."
        );
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [eventTypeFilter, isSuperadmin, searchKeyword]
  );

  useEffect(() => {
    if (!isSuperadmin) {
      navigate("/dashboard", { replace: true });
      return;
    }
    loadLogs();
  }, [isSuperadmin, loadLogs, navigate]);

  useEffect(() => {
    if (!isSuperadmin) return undefined;
    const timerId = setInterval(() => {
      loadLogs({ silent: true });
    }, 30 * 1000);
    return () => clearInterval(timerId);
  }, [isSuperadmin, loadLogs]);

  const deleteLogs = useMemo(
    () => logs.filter((item) => normalizeText(item?.eventType) === FILTER_DELETE),
    [logs]
  );

  const summary = useMemo(() => {
    const total = logs.length;
    const totalAccess = logs.filter(
      (item) => normalizeText(item?.eventType) === FILTER_ACCESS
    ).length;
    const totalDelete = logs.filter(
      (item) => normalizeText(item?.eventType) === FILTER_DELETE
    ).length;

    return {
      total,
      totalAccess,
      totalDelete,
    };
  }, [logs]);

  return (
    <div className="bh-dashboard-shell min-h-screen bg-[#f7fbff] text-[#09275a] lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="bh-dashboard-sidebar-shell border-b border-[#dfe8f5] bg-white p-4 shadow-[12px_0_40px_rgba(20,57,96,0.05)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:border-b-0 lg:border-r lg:px-4 lg:py-8">
        <Sidebar role="superadmin" />
      </aside>

      <main className="bh-dashboard-main min-w-0 px-4 py-6 sm:px-6 lg:px-9 lg:py-10">
        <Header user={{ ...currentUser, role: "superadmin" }} />

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">Superadmin Panel</p>
              <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
                Logs Riwayat Aktivitas User
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
                Seluruh log aktivitas dan riwayat hapus user disimpan sementara lalu otomatis
                terhapus setelah {retentionHours} jam.
              </p>
              <p className="mt-1 text-xs text-[#7086a1]">
                Terakhir diperbarui: {lastFetchedAt ? formatDateTime(lastFetchedAt) : "-"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadLogs()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#c9d7ed] bg-white px-4 text-sm font-bold text-[#17355e]"
            >
              <FiRefreshCw />
              Muat Ulang
            </button>
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Total Logs</p>
            <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">{summary.total}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Akses Halaman</p>
            <h3 className="mt-2 text-3xl font-bold text-blue-700">{summary.totalAccess}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Riwayat Hapus User</p>
            <h3 className="mt-2 text-3xl font-bold text-red-700">{summary.totalDelete}</h3>
          </article>
        </section>

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
              <span className="inline-flex items-center gap-1">
                <FiSearch />
                Cari Log
              </span>
              <input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                type="text"
                className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                placeholder="Cari username, nama user, atau route"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
              <span className="inline-flex items-center gap-1">
                <FiFilter />
                Filter Jenis Log
              </span>
              <select
                value={eventTypeFilter}
                onChange={(event) => setEventTypeFilter(event.target.value)}
                className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
              >
                <option value={FILTER_ALL}>Semua Logs</option>
                <option value={FILTER_ACCESS}>Akses Halaman</option>
                <option value={FILTER_DELETE}>Hapus User</option>
              </select>
            </label>
          </div>
        </section>

        <section className="mb-6 rounded-[10px] border border-[#f1d7d7] bg-white p-5 shadow-[0_12px_28px_rgba(92,21,21,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FiTrash2 className="text-red-700" />
            <h3 className="text-lg font-bold text-[#8d1f1f]">
              Riwayat Hapus User (Waktu Kejadian)
            </h3>
          </div>

          {deleteLogs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#f0caca] bg-[#fff9f9] px-4 py-8 text-center">
              <p className="text-sm text-[#8f5f5f]">Belum ada riwayat hapus user.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#fff4f4] text-left text-xs font-bold uppercase tracking-[0.06em] text-[#7b3131]">
                    <th className="rounded-l-md px-3 py-3">No</th>
                    <th className="px-3 py-3">User Dihapus</th>
                    <th className="rounded-r-md px-3 py-3">Waktu Hapus</th>
                  </tr>
                </thead>
                <tbody>
                  {deleteLogs.map((log, index) => {
                    const fullName = cleanText(log?.targetFullName);
                    const username = cleanText(log?.targetUsername);
                    const role = cleanText(log?.targetUserRole);
                    const label =
                      fullName && username
                        ? `${fullName} (@${username})`
                        : fullName || (username ? `@${username}` : "-");

                    return (
                      <tr
                        key={log.logUUID || `${username}-${index}`}
                        className="border-b border-[#fae3e3] text-[#6d2e2e] hover:bg-[#fffbfb]"
                      >
                        <td className="px-3 py-3 text-xs">{index + 1}</td>
                        <td className="px-3 py-3">
                          <p className="font-semibold">{label}</p>
                          <p className="mt-1 text-xs text-[#9b5a5a]">{role || "-"}</p>
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold">
                          {formatDateTime(log?.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FiClock className="text-[#17355e]" />
            <h3 className="text-lg font-bold text-[#102d5b]">Daftar Logs Aktivitas</h3>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
              <p className="text-sm text-[#607792]">Memuat logs aktivitas dari server...</p>
            </div>
          ) : loadError ? (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-6 text-center">
              <p className="text-sm text-orange-700">{loadError}</p>
              <button
                type="button"
                onClick={() => loadLogs()}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-orange-300 bg-white px-4 text-xs font-semibold text-orange-700"
              >
                Coba Muat Ulang
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
              <p className="text-sm text-[#607792]">
                Tidak ada data log untuk filter yang dipilih.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#f3f8ff] text-left text-xs font-bold uppercase tracking-[0.06em] text-[#274777]">
                    <th className="rounded-l-md px-3 py-3">No</th>
                    <th className="px-3 py-3">Waktu</th>
                    <th className="px-3 py-3">Jenis</th>
                    <th className="rounded-r-md px-3 py-3">Aktivitas</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => (
                    <tr
                      key={log.logUUID || `${log.eventType}-${index}`}
                      className="border-b border-[#e6eef9] text-[#1b3b66] hover:bg-[#f9fbff]"
                    >
                      <td className="px-3 py-3 text-xs text-[#5e7692]">{index + 1}</td>
                      <td className="px-3 py-3 text-xs font-semibold text-[#244877]">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getTypeTone(
                            log.eventType
                          )}`}
                        >
                          {getTypeLabel(log.eventType)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs leading-relaxed">
                        {buildLogActivityText(log)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default LogsAktivitySuperadmin;

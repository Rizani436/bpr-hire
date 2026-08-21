import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiBriefcase,
  FiCheckCircle,
  FiDatabase,
  FiFileText,
  FiRefreshCcw,
  FiUploadCloud,
  FiUsers,
} from "react-icons/fi";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getAlertThemeConfig } from "../../utils/alertTheme";
import { getDashboardUser } from "../../utils/authUser";
import {
  getMasterDataPegawaiApi,
  getMasterDataUnitKerjaApi,
  importMasterDataPegawaiExcelApi,
  importMasterDataUnitKerjaExcelApi,
} from "../../utils/authApi";

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return cleanText(value).toLowerCase();
}

function KelolaDataSuperadmin() {
  const navigate = useNavigate();
  const currentUser = getDashboardUser();
  const isSuperadmin = normalizeText(currentUser.role) === "superadmin";

  const [unitKerjaRows, setUnitKerjaRows] = useState([]);
  const [pegawaiRows, setPegawaiRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [unitKerjaFile, setUnitKerjaFile] = useState(null);
  const [pegawaiFile, setPegawaiFile] = useState(null);
  const [isImportingUnitKerja, setIsImportingUnitKerja] = useState(false);
  const [isImportingPegawai, setIsImportingPegawai] = useState(false);
  const [searchUnitKerja, setSearchUnitKerja] = useState("");
  const [searchPegawai, setSearchPegawai] = useState("");

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!isSuperadmin) return;
    if (!silent) setIsLoading(true);
    setLoadError("");

    try {
      const [unitKerjaResult, pegawaiResult] = await Promise.all([
        getMasterDataUnitKerjaApi(),
        getMasterDataPegawaiApi(),
      ]);

      setUnitKerjaRows(Array.isArray(unitKerjaResult?.rows) ? unitKerjaResult.rows : []);
      setPegawaiRows(Array.isArray(pegawaiResult?.rows) ? pegawaiResult.rows : []);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data kelola data."
      );
      setUnitKerjaRows([]);
      setPegawaiRows([]);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [isSuperadmin]);

  useEffect(() => {
    if (!isSuperadmin) {
      navigate("/dashboard", { replace: true });
      return;
    }
    loadData();
  }, [isSuperadmin, loadData, navigate]);

  const filteredUnitKerjaRows = useMemo(() => {
    const keyword = normalizeText(searchUnitKerja);
    if (!keyword) return unitKerjaRows;
    return unitKerjaRows.filter((row) => {
      return (
        normalizeText(row.kodeKantor).includes(keyword) ||
        normalizeText(row.namaKantor).includes(keyword) ||
        normalizeText(row.alamatLengkap).includes(keyword)
      );
    });
  }, [searchUnitKerja, unitKerjaRows]);

  const filteredPegawaiRows = useMemo(() => {
    const keyword = normalizeText(searchPegawai);
    if (!keyword) return pegawaiRows;
    return pegawaiRows.filter((row) => {
      return (
        normalizeText(row.kodePegawai).includes(keyword) ||
        normalizeText(row.namaPegawai).includes(keyword) ||
        normalizeText(row.jabatan).includes(keyword) ||
        normalizeText(row.kodeKantor).includes(keyword) ||
        normalizeText(row.namaUnitKerja).includes(keyword)
      );
    });
  }, [searchPegawai, pegawaiRows]);

  const handleImportUnitKerja = async () => {
    if (!unitKerjaFile || isImportingUnitKerja) return;
    setIsImportingUnitKerja(true);

    try {
      const result = await importMasterDataUnitKerjaExcelApi(unitKerjaFile);
      await loadData({ silent: true });
      setUnitKerjaFile(null);

      const successTheme = getAlertThemeConfig("publishSuccess");
      await Swal.fire({
        icon: "success",
        title: "Import Unit Kerja Berhasil",
        text: cleanText(result?.msg) || "Data unit kerja berhasil diperbarui.",
        confirmButtonText: "OK",
        background: successTheme.background,
        color: successTheme.color,
        iconColor: successTheme.iconColor,
        confirmButtonColor: successTheme.confirmButtonColor,
      });
    } catch (error) {
      const errorTheme = getAlertThemeConfig("logoutConfirm");
      await Swal.fire({
        icon: "error",
        title: "Import Unit Kerja Gagal",
        text:
          error instanceof Error ? error.message : "Terjadi kendala saat import unit kerja.",
        confirmButtonText: "OK",
        background: errorTheme.background,
        color: errorTheme.color,
        iconColor: errorTheme.iconColor,
        confirmButtonColor: errorTheme.confirmButtonColor,
      });
    } finally {
      setIsImportingUnitKerja(false);
    }
  };

  const handleImportPegawai = async () => {
    if (!pegawaiFile || isImportingPegawai) return;
    setIsImportingPegawai(true);

    try {
      const result = await importMasterDataPegawaiExcelApi(pegawaiFile);
      await loadData({ silent: true });
      setPegawaiFile(null);

      const successTheme = getAlertThemeConfig("publishSuccess");
      await Swal.fire({
        icon: "success",
        title: "Import Pegawai Berhasil",
        text: cleanText(result?.msg) || "Data pegawai berhasil diperbarui.",
        confirmButtonText: "OK",
        background: successTheme.background,
        color: successTheme.color,
        iconColor: successTheme.iconColor,
        confirmButtonColor: successTheme.confirmButtonColor,
      });
    } catch (error) {
      const errorTheme = getAlertThemeConfig("logoutConfirm");
      await Swal.fire({
        icon: "error",
        title: "Import Pegawai Gagal",
        text:
          error instanceof Error ? error.message : "Terjadi kendala saat import pegawai.",
        confirmButtonText: "OK",
        background: errorTheme.background,
        color: errorTheme.color,
        iconColor: errorTheme.iconColor,
        confirmButtonColor: errorTheme.confirmButtonColor,
      });
    } finally {
      setIsImportingPegawai(false);
    }
  };

  return (
    <div className="bh-dashboard-shell min-h-screen bg-[#f7fbff] text-[#09275a] lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="bh-dashboard-sidebar-shell border-b border-[#dfe8f5] bg-white p-4 shadow-[12px_0_40px_rgba(20,57,96,0.05)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:border-b-0 lg:border-r lg:px-4 lg:py-8">
        <Sidebar role="superadmin" />
      </aside>

      <main className="bh-dashboard-main min-w-0 px-4 py-6 sm:px-6 lg:px-9 lg:py-10">
        <Header user={{ ...currentUser, role: "superadmin" }} />

        <section className="mb-6 rounded-[12px] border border-[#dfe8f5] bg-white p-5 shadow-[0_16px_36px_rgba(21,54,92,0.08)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">Superadmin</p>
              <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
                Kelola Data Pegawai & Unit Kerja
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
                Upload file Excel untuk memperbarui master data. Setelah upload berhasil,
                data langsung ditampilkan ke tabel.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadData()}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cddbf0] bg-white px-4 text-sm font-bold text-[#10315f]"
              disabled={isLoading}
            >
              <FiRefreshCcw />
              Refresh Data
            </button>
          </div>
        </section>

        {loadError && (
          <section className="mb-6 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </section>
        )}

        <section className="mb-6 rounded-[12px] border border-[#dfe8f5] bg-white p-5 shadow-[0_16px_36px_rgba(21,54,92,0.08)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <FiBriefcase />
            </span>
            <h3 className="text-lg font-bold text-[#102d5b]">Master Unit Kerja</h3>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3">
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                Upload Excel Unit Kerja
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => setUnitKerjaFile(event.target.files?.[0] || null)}
                  className="block w-full text-xs text-[#506783] file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-blue-700"
                />
              </label>
              <p className="mt-2 text-xs text-[#6f87a3]">
                Gunakan file Excel Unit Kerja BPR. Pastikan kolom kode kantor dan nama kantor tersedia.
              </p>
            </div>
            <button
              type="button"
              onClick={handleImportUnitKerja}
              disabled={!unitKerjaFile || isImportingUnitKerja}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#347dec] to-[#0c3a78] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isImportingUnitKerja ? <FiCheckCircle /> : <FiUploadCloud />}
              {isImportingUnitKerja ? "Memproses..." : "Import Unit Kerja"}
            </button>
          </div>

          <div className="mb-3">
            <input
              value={searchUnitKerja}
              onChange={(event) => setSearchUnitKerja(event.target.value)}
              type="text"
              className="h-10 w-full rounded-md border border-[#d7e5f8] bg-white px-3 text-sm outline-none focus:border-blue-500"
              placeholder="Cari unit kerja (kode/nama/alamat)..."
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#dfe8f5]">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[#f3f8ff] text-left text-[#123561]">
                <tr>
                  <th className="px-3 py-3">Kode Kantor</th>
                  <th className="px-3 py-3">Nama Unit Kerja</th>
                  <th className="px-3 py-3">Longitude</th>
                  <th className="px-3 py-3">Latitude</th>
                  <th className="px-3 py-3">Alamat</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnitKerjaRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[#6f87a3]">
                      {isLoading ? "Memuat data..." : "Belum ada data unit kerja."}
                    </td>
                  </tr>
                ) : (
                  filteredUnitKerjaRows.map((row) => (
                    <tr key={`unit-${row.kodeKantor}`} className="border-t border-[#e6eef9]">
                      <td className="px-3 py-2.5 font-semibold text-[#113760]">{row.kodeKantor}</td>
                      <td className="px-3 py-2.5">{row.namaKantor}</td>
                      <td className="px-3 py-2.5">{cleanText(row.longitude) || "-"}</td>
                      <td className="px-3 py-2.5">{cleanText(row.latitude) || "-"}</td>
                      <td className="px-3 py-2.5">{cleanText(row.alamatLengkap) || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[12px] border border-[#dfe8f5] bg-white p-5 shadow-[0_16px_36px_rgba(21,54,92,0.08)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-700">
              <FiUsers />
            </span>
            <h3 className="text-lg font-bold text-[#102d5b]">Master Pegawai</h3>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3">
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                Upload Excel Pegawai
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => setPegawaiFile(event.target.files?.[0] || null)}
                  className="block w-full text-xs text-[#506783] file:mr-3 file:rounded-md file:border-0 file:bg-green-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-green-700"
                />
              </label>
              <p className="mt-2 text-xs text-[#6f87a3]">
                Format minimal: <b>KodePegawai</b>, <b>Nama Pegawai</b>, <b>KodeKantor</b>.
                Jika ada kolom jabatan, data jabatan juga akan ikut dipakai.
              </p>
            </div>
            <button
              type="button"
              onClick={handleImportPegawai}
              disabled={!pegawaiFile || isImportingPegawai}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#43bd32] to-[#158a3b] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isImportingPegawai ? <FiCheckCircle /> : <FiUploadCloud />}
              {isImportingPegawai ? "Memproses..." : "Import Pegawai"}
            </button>
          </div>

          <div className="mb-3">
            <input
              value={searchPegawai}
              onChange={(event) => setSearchPegawai(event.target.value)}
              type="text"
              className="h-10 w-full rounded-md border border-[#d7e5f8] bg-white px-3 text-sm outline-none focus:border-green-500"
              placeholder="Cari pegawai (kode/nama/jabatan/unit kerja)..."
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#dfe8f5]">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[#f3fff5] text-left text-[#123561]">
                <tr>
                  <th className="px-3 py-3">Kode Pegawai</th>
                  <th className="px-3 py-3">Nama Pegawai</th>
                  <th className="px-3 py-3">Jabatan</th>
                  <th className="px-3 py-3">Kode Kantor</th>
                  <th className="px-3 py-3">Nama Unit Kerja</th>
                </tr>
              </thead>
              <tbody>
                {filteredPegawaiRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[#6f87a3]">
                      {isLoading ? "Memuat data..." : "Belum ada data pegawai."}
                    </td>
                  </tr>
                ) : (
                  filteredPegawaiRows.map((row) => (
                    <tr key={`pegawai-${row.kodePegawai}`} className="border-t border-[#e6eef9]">
                      <td className="px-3 py-2.5 font-semibold text-[#113760]">{row.kodePegawai}</td>
                      <td className="px-3 py-2.5">{row.namaPegawai}</td>
                      <td className="px-3 py-2.5">{cleanText(row.jabatan) || "-"}</td>
                      <td className="px-3 py-2.5">{row.kodeKantor}</td>
                      <td className="px-3 py-2.5">{cleanText(row.namaUnitKerja) || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-[12px] border border-[#dfe8f5] bg-white p-4 shadow-[0_12px_28px_rgba(21,54,92,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#607792]">
            <span className="inline-flex items-center gap-2">
              <FiDatabase />
              Total Unit Kerja: <b>{unitKerjaRows.length}</b>
            </span>
            <span className="inline-flex items-center gap-2">
              <FiFileText />
              Total Pegawai: <b>{pegawaiRows.length}</b>
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}

export default KelolaDataSuperadmin;

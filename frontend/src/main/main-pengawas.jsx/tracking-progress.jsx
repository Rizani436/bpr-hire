import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  FiCheck,
  FiChevronDown,
  FiFileText,
  FiFilter,
  FiSearch,
  FiSend,
  FiShield,
  FiTrash2,
} from "react-icons/fi";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardUser } from "../../utils/authUser";
import { getAlertThemeConfig } from "../../utils/alertTheme";
import {
  fetchLamaranApplicationsFromBackend,
  removeDashboardApplicationByApplicationUUID,
} from "../../utils/applications";
import { deleteLamaranApplicationApi } from "../../utils/authApi";
import {
  buildTrackingRows,
  cleanText,
  getParticipantSummary,
  publishTrackingResultsToParticipants,
  getTrackingParticipants,
  saveTrackingRows,
} from "./sub-main/tracking-progress-shared";

const ALL_YEARS_VALUE = "__ALL_YEARS__";
const ALL_LAMARAN_VALUE = "__ALL_LAMARAN__";
const RESULT_OPTIONS = ["Semua Hasil", "Diverifikasi", "Diterima", "Ditolak"];

function SearchableMultiDropdown({
  label,
  allLabel,
  allValue,
  options,
  selectedValues,
  onChange,
  isOpen,
  setIsOpen,
  searchKeyword,
  setSearchKeyword,
}) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen, setIsOpen]);

  const selectedMap = useMemo(
    () => new Map(options.map((option) => [option.value, option.shortLabel || option.label])),
    [options]
  );

  const showAll = selectedValues.includes(allValue) || selectedValues.length === 0;
  const displayValue = showAll
    ? allLabel
    : selectedValues.length <= 2
      ? selectedValues
          .map((value) => selectedMap.get(value))
          .filter(Boolean)
          .join(", ")
      : `${selectedValues.length} dipilih`;

  const normalizedSearch = cleanText(searchKeyword).toLowerCase();
  const filteredOptions = options.filter((option) => {
    if (!normalizedSearch) return true;
    return `${option.label} ${option.shortLabel || ""}`
      .toLowerCase()
      .includes(normalizedSearch);
  });

  const toggleValue = (value) => {
    if (value === allValue) {
      onChange([allValue]);
      return;
    }

    const baseValues = selectedValues.includes(allValue) ? [] : [...selectedValues];
    const exists = baseValues.includes(value);
    const nextValues = exists
      ? baseValues.filter((item) => item !== value)
      : [...baseValues, value];

    if (nextValues.length === 0) {
      onChange([allValue]);
      return;
    }

    if (nextValues.length >= options.length) {
      onChange([allValue]);
      return;
    }

    onChange(nextValues);
  };

  return (
    <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
      {label}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[#d6dfed] bg-white px-3 text-left text-sm font-normal text-[#143764]"
        >
          <span className="truncate">{displayValue}</span>
          <FiChevronDown className={`shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute z-30 mt-2 w-full rounded-lg border border-[#d6dfed] bg-white shadow-[0_18px_38px_rgba(18,53,95,0.13)]">
            <div className="border-b border-[#e4ebf7] p-2">
              <div className="flex h-9 items-center gap-2 rounded-md border border-[#d6dfed] px-2.5">
                <FiSearch className="text-[#5f7894]" />
                <input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  type="text"
                  className="h-full w-full border-0 bg-transparent text-xs font-normal outline-none"
                  placeholder="Cari data..."
                />
              </div>
            </div>

            <div className="max-h-56 overflow-auto p-1.5">
              <button
                type="button"
                onClick={() => toggleValue(allValue)}
                className={`mb-1 flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs ${
                  showAll
                    ? "bg-blue-50 font-semibold text-blue-700"
                    : "text-[#1d406d] hover:bg-[#f5f9ff]"
                }`}
              >
                <span>{allLabel}</span>
                {showAll && <FiCheck className="text-blue-600" />}
              </button>

              {filteredOptions.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-[#6f87a3]">Data tidak ditemukan.</p>
              ) : (
                filteredOptions.map((option) => {
                  const checked = !showAll && selectedValues.includes(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleValue(option.value)}
                      className={`mb-1 flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs ${
                        checked
                          ? "bg-green-50 font-semibold text-green-700"
                          : "text-[#1d406d] hover:bg-[#f5f9ff]"
                      }`}
                    >
                      <span>{option.label}</span>
                      {checked && <FiCheck className="text-green-600" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </label>
  );
}

SearchableMultiDropdown.propTypes = {
  label: PropTypes.string.isRequired,
  allLabel: PropTypes.string.isRequired,
  allValue: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      shortLabel: PropTypes.string,
    })
  ).isRequired,
  selectedValues: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  setIsOpen: PropTypes.func.isRequired,
  searchKeyword: PropTypes.string.isRequired,
  setSearchKeyword: PropTypes.func.isRequired,
};

function SearchableSingleDropdown({
  label,
  options,
  selectedValue,
  onChange,
  isOpen,
  setIsOpen,
  searchKeyword,
  setSearchKeyword,
}) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen, setIsOpen]);

  const normalizedSearch = cleanText(searchKeyword).toLowerCase();
  const filteredOptions = options.filter((option) =>
    !normalizedSearch ? true : option.toLowerCase().includes(normalizedSearch)
  );

  return (
    <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
      {label}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[#d6dfed] bg-white px-3 text-left text-sm font-normal text-[#143764]"
        >
          <span className="truncate">{selectedValue}</span>
          <FiChevronDown className={`shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute z-30 mt-2 w-full rounded-lg border border-[#d6dfed] bg-white shadow-[0_18px_38px_rgba(18,53,95,0.13)]">
            <div className="border-b border-[#e4ebf7] p-2">
              <div className="flex h-9 items-center gap-2 rounded-md border border-[#d6dfed] px-2.5">
                <FiSearch className="text-[#5f7894]" />
                <input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  type="text"
                  className="h-full w-full border-0 bg-transparent text-xs font-normal outline-none"
                  placeholder="Cari data..."
                />
              </div>
            </div>

            <div className="max-h-56 overflow-auto p-1.5">
              {filteredOptions.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-[#6f87a3]">Data tidak ditemukan.</p>
              ) : (
                filteredOptions.map((option) => {
                  const checked = option === selectedValue;

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        onChange(option);
                        setIsOpen(false);
                      }}
                      className={`mb-1 flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs ${
                        checked
                          ? "bg-blue-50 font-semibold text-blue-700"
                          : "text-[#1d406d] hover:bg-[#f5f9ff]"
                      }`}
                    >
                      <span>{option}</span>
                      {checked && <FiCheck className="text-blue-600" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </label>
  );
}

SearchableSingleDropdown.propTypes = {
  label: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedValue: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  setIsOpen: PropTypes.func.isRequired,
  searchKeyword: PropTypes.string.isRequired,
  setSearchKeyword: PropTypes.func.isRequired,
};

function TrackingProgress() {
  const navigate = useNavigate();
  const currentUser = getDashboardUser();
  const [trackingRows, setTrackingRows] = useState([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [participantsLoadError, setParticipantsLoadError] = useState("");
  const [hasLoadedParticipants, setHasLoadedParticipants] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [resultFilter, setResultFilter] = useState("Semua Hasil");
  const [selectedYears, setSelectedYears] = useState([ALL_YEARS_VALUE]);
  const [selectedLamaran, setSelectedLamaran] = useState([ALL_LAMARAN_VALUE]);

  const [resultDropdownOpen, setResultDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [lamaranDropdownOpen, setLamaranDropdownOpen] = useState(false);
  const [resultSearchKeyword, setResultSearchKeyword] = useState("");
  const [yearSearchKeyword, setYearSearchKeyword] = useState("");
  const [lamaranSearchKeyword, setLamaranSearchKeyword] = useState("");
  const [publishState, setPublishState] = useState({
    type: "idle",
    message: "",
  });
  const [isPublishingStatuses, setIsPublishingStatuses] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadParticipants = async () => {
      setIsLoadingParticipants(true);
      setParticipantsLoadError("");

      try {
        const backendApplications = await fetchLamaranApplicationsFromBackend();
        if (!isMounted) return;

        const participants = getTrackingParticipants(backendApplications);
        setTrackingRows(buildTrackingRows(participants));
        setHasLoadedParticipants(true);
      } catch (error) {
        if (!isMounted) return;

        setTrackingRows([]);
        setHasLoadedParticipants(false);
        setParticipantsLoadError(
          cleanText(error?.message) || "Gagal memuat data peserta dari backend."
        );
      } finally {
        if (isMounted) {
          setIsLoadingParticipants(false);
        }
      }
    };

    loadParticipants();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedParticipants) return;
    saveTrackingRows(trackingRows);
  }, [hasLoadedParticipants, trackingRows]);

  const annotatedRows = useMemo(
    () =>
      trackingRows.map((row) => ({
        ...row,
        year: cleanText(row.year || "Tanpa Tahun"),
        summary: getParticipantSummary(row.stages),
      })),
    [trackingRows]
  );

  const summaryCards = useMemo(() => {
    const total = annotatedRows.length;
    const inProgress = annotatedRows.filter(
      (row) => row.summary.label === "Diverifikasi"
    ).length;
    const accepted = annotatedRows.filter((row) => row.summary.label === "Diterima").length;
    const rejected = annotatedRows.filter((row) => row.summary.label === "Ditolak").length;

    return { total, inProgress, accepted, rejected };
  }, [annotatedRows]);

  const yearOptions = useMemo(() => {
    const yearCounts = new Map();

    annotatedRows.forEach((row) => {
      const year = cleanText(row.year || "Tanpa Tahun");
      yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    });

    return Array.from(yearCounts.entries())
      .sort((left, right) => {
        const [leftYear] = left;
        const [rightYear] = right;

        if (leftYear === "Tanpa Tahun") return 1;
        if (rightYear === "Tanpa Tahun") return -1;
        return Number(rightYear) - Number(leftYear);
      })
      .map(([year, count]) => ({
        value: year,
        shortLabel: year,
        label: `${year} (${count} peserta)`,
      }));
  }, [annotatedRows]);

  const yearFilteredRows = useMemo(() => {
    if (selectedYears.includes(ALL_YEARS_VALUE)) return annotatedRows;
    return annotatedRows.filter((row) => selectedYears.includes(row.year));
  }, [annotatedRows, selectedYears]);

  const lamaranOptions = useMemo(() => {
    const lamaranCounts = new Map();

    yearFilteredRows.forEach((row) => {
      const lamaran = cleanText(row.role || "Posisi belum ditentukan");
      lamaranCounts.set(lamaran, (lamaranCounts.get(lamaran) || 0) + 1);
    });

    return Array.from(lamaranCounts.entries())
      .sort((left, right) => left[0].localeCompare(right[0], "id-ID"))
      .map(([lamaran, count]) => ({
        value: lamaran,
        shortLabel: lamaran,
        label: `${lamaran} (${count} lamaran)`,
      }));
  }, [yearFilteredRows]);

  useEffect(() => {
    if (selectedLamaran.includes(ALL_LAMARAN_VALUE)) return;

    const availableValues = new Set(lamaranOptions.map((option) => option.value));
    const nextValues = selectedLamaran.filter((value) => availableValues.has(value));

    if (nextValues.length === selectedLamaran.length) return;
    if (nextValues.length === 0) {
      setSelectedLamaran([ALL_LAMARAN_VALUE]);
      return;
    }

    setSelectedLamaran(nextValues);
  }, [lamaranOptions, selectedLamaran]);

  const filteredRows = useMemo(() => {
    const keyword = cleanText(searchKeyword).toLowerCase();

    return annotatedRows.filter((row) => {
      const matchesKeyword =
        !keyword ||
        row.candidate.toLowerCase().includes(keyword) ||
        row.role.toLowerCase().includes(keyword) ||
        row.participantId.toLowerCase().includes(keyword);

      const matchesResult =
        resultFilter === "Semua Hasil" || row.summary.label === resultFilter;

      const matchesYear =
        selectedYears.includes(ALL_YEARS_VALUE) || selectedYears.includes(row.year);

      const matchesLamaran =
        selectedLamaran.includes(ALL_LAMARAN_VALUE) ||
        selectedLamaran.includes(row.role);

      return matchesKeyword && matchesResult && matchesYear && matchesLamaran;
    });
  }, [annotatedRows, resultFilter, searchKeyword, selectedLamaran, selectedYears]);

  const handleOpenTracking = (participantId) => {
    navigate(`/pengawas/tracking-progress/cek/${encodeURIComponent(participantId)}`);
  };

  const handleDeleteParticipant = async (item) => {
    const applicationUUID = cleanText(item?.applicationUUID);
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
      title: "Hapus Peserta?",
      text: `Data pendaftaran ${item.candidate} pada lamaran ${item.role} akan dihapus permanen.`,
      showCancelButton: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
      reverseButtons: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });

    if (!confirmation.isConfirmed) return;

    Swal.fire({
      title: "Menghapus Peserta...",
      html: `<p style="margin:0;color:#b91c1c;">Mohon tunggu, data peserta sedang dihapus.</p>`,
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
      setTrackingRows((currentRows) =>
        currentRows.filter(
          (row) => cleanText(row.applicationUUID || row.participantId) !== applicationUUID
        )
      );
      Swal.close();

      await Swal.fire({
        icon: "success",
        iconColor: "#dc2626",
        title: "Peserta Berhasil Dihapus",
        text:
          cleanText(response?.msg) ||
          `Data pendaftaran ${item.candidate} berhasil dihapus.`,
        confirmButtonText: "OK",
        confirmButtonColor: "#dc2626",
      });
    } catch (error) {
      Swal.close();
      await Swal.fire({
        icon: "error",
        iconColor: "#dc2626",
        title: "Gagal Menghapus Peserta",
        text:
          cleanText(error?.message) ||
          "Terjadi kendala saat menghapus data peserta. Silakan coba lagi.",
        confirmButtonText: "Tutup",
        confirmButtonColor: "#dc2626",
      });
    }
  };

  const handlePublishStatuses = async () => {
    if (isPublishingStatuses) return;
    setPublishState({ type: "idle", message: "" });

    const finalParticipantCount = trackingRows.filter((row) => {
      const summary = getParticipantSummary(row.stages);
      return summary.label === "Diterima" || summary.label === "Ditolak";
    }).length;

    const confirmTheme = getAlertThemeConfig("publishConfirm");
    const loadingTheme = getAlertThemeConfig("publishLoading");
    const successTheme = getAlertThemeConfig("publishSuccess");
    const warningTheme = getAlertThemeConfig("publishWarning");

    const confirmation = await Swal.fire({
      icon: "question",
      title: "Kirim Status ke Peserta?",
      text:
        finalParticipantCount > 0
          ? `Saat ini ada ${finalParticipantCount} peserta dengan status final. Lanjut kirim status sekarang?`
          : "Belum ada peserta dengan status final. Tetap lanjut untuk validasi data?",
      showCancelButton: true,
      confirmButtonText: "Lanjut Kirim",
      cancelButtonText: "Nanti Saja",
      reverseButtons: true,
      focusCancel: true,
      background: confirmTheme.background,
      color: confirmTheme.color,
      iconColor: confirmTheme.iconColor,
      confirmButtonColor: confirmTheme.confirmButtonColor,
      cancelButtonColor: confirmTheme.cancelButtonColor,
    });

    if (!confirmation.isConfirmed) {
      setPublishState({
        type: "warning",
        message: "Pengiriman status dibatalkan.",
      });
      return;
    }

    setIsPublishingStatuses(true);
    try {
      Swal.fire({
        title: "Memproses Pengiriman",
        text: "Status peserta sedang diproses...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        background: loadingTheme.background,
        color: loadingTheme.color,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      await new Promise((resolve) => {
        window.setTimeout(resolve, 900);
      });

      const publishResult = publishTrackingResultsToParticipants(
        trackingRows,
        currentUser.userName
      );
      Swal.close();

      if (publishResult.eligibleCount === 0) {
        await Swal.fire({
          icon: "warning",
          title: "Belum Bisa Dikirim",
          text:
            "Belum ada hasil final untuk dikirim. Pastikan status peserta sudah Diterima atau Ditolak.",
          confirmButtonText: "Tutup",
          background: warningTheme.background,
          color: warningTheme.color,
          iconColor: warningTheme.iconColor,
          confirmButtonColor: warningTheme.confirmButtonColor,
        });
        setPublishState({
          type: "warning",
          message:
            "Belum ada hasil final untuk dikirim. Pastikan status peserta sudah Diterima atau Ditolak.",
        });
        return;
      }

      if (publishResult.updatedCount === 0) {
        await Swal.fire({
          icon: "warning",
          title: "Data Belum Cocok",
          text:
            "Data hasil final sudah ada, tetapi belum cocok ke data lamaran peserta. Cek kembali ID Verifikasi.",
          confirmButtonText: "Tutup",
          background: warningTheme.background,
          color: warningTheme.color,
          iconColor: warningTheme.iconColor,
          confirmButtonColor: warningTheme.confirmButtonColor,
        });
        setPublishState({
          type: "warning",
          message:
            "Data hasil final sudah ada, tetapi belum cocok ke data lamaran peserta. Cek kembali ID Verifikasi.",
        });
        return;
      }

      const details = [
        `${publishResult.updatedCount} peserta berhasil dikirim`,
        `${publishResult.acceptedCount} diterima`,
        `${publishResult.rejectedCount} ditolak`,
      ];

      if (publishResult.missingApplicationCount > 0) {
        details.push(
          `${publishResult.missingApplicationCount} belum cocok ID verifikasinya`
        );
      }

      if (publishResult.skippedCount > 0) {
        details.push(`${publishResult.skippedCount} masih diverifikasi`);
      }

      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: `Status berhasil dipublish ke peserta: ${details.join(", ")}.`,
        timer: 2200,
        timerProgressBar: true,
        showConfirmButton: false,
        background: successTheme.background,
        color: successTheme.color,
        iconColor: successTheme.iconColor,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: (toast) => {
          toast.style.boxShadow = successTheme.boxShadow || "";
        },
      });

      setPublishState({
        type: "success",
        message: `Status berhasil dipublish ke peserta: ${details.join(", ")}.`,
      });
    } catch {
      Swal.close();
      await Swal.fire({
        icon: "error",
        title: "Terjadi Kendala",
        text: "Pengiriman status belum berhasil. Silakan coba lagi.",
        confirmButtonText: "Tutup",
        background: warningTheme.background,
        color: warningTheme.color,
        iconColor: warningTheme.iconColor,
        confirmButtonColor: warningTheme.confirmButtonColor,
      });
      setPublishState({
        type: "warning",
        message: "Pengiriman status belum berhasil. Silakan coba lagi.",
      });
    } finally {
      setIsPublishingStatuses(false);
    }
  };

  return (
    <div className="bh-dashboard-shell min-h-screen bg-[#f7fbff] text-[#09275a] lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="bh-dashboard-sidebar-shell border-b border-[#dfe8f5] bg-white p-4 shadow-[12px_0_40px_rgba(20,57,96,0.05)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:border-b-0 lg:border-r lg:px-4 lg:py-8">
        <Sidebar role="pengawas" />
      </aside>

      <main className="bh-dashboard-main min-w-0 px-4 py-6 sm:px-6 lg:px-9 lg:py-10">
        <Header user={{ ...currentUser, role: "pengawas" }} />

        {(isLoadingParticipants || participantsLoadError) && (
          <div
            className={`mb-5 rounded-lg border px-4 py-3 text-sm font-medium ${
              participantsLoadError
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50 text-blue-700"
            }`}
          >
            {participantsLoadError || "Memuat data peserta dari backend..."}
          </div>
        )}

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">Pengawas Rekrutmen</p>
              <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
                Tracking Progress Seleksi
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
                Daftar peserta pelamar dan status progress seleksi. Tekan tombol Cek
                Tracking untuk melihat detail tahap per peserta.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePublishStatuses}
              disabled={isPublishingStatuses}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold text-white shadow-[0_14px_26px_rgba(19,77,153,0.24)] ${
                isPublishingStatuses
                  ? "cursor-not-allowed bg-[#7d9bc4]"
                  : "bg-gradient-to-r from-[#347dec] to-[#0c3a78]"
              }`}
            >
              <FiSend />
              {isPublishingStatuses ? "Memproses..." : "Kirim Status ke Peserta"}
            </button>
          </div>
          {publishState.type !== "idle" && (
            <p
              className={`mt-4 rounded-md border px-3 py-2 text-xs font-semibold ${
                publishState.type === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-yellow-200 bg-yellow-50 text-yellow-700"
              }`}
            >
              {publishState.message}
            </p>
          )}
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Total Peserta</p>
            <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">{summaryCards.total}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Diverifikasi</p>
            <h3 className="mt-2 text-3xl font-bold text-yellow-700">{summaryCards.inProgress}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Diterima</p>
            <h3 className="mt-2 text-3xl font-bold text-green-700">{summaryCards.accepted}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Ditolak</p>
            <h3 className="mt-2 text-3xl font-bold text-red-700">{summaryCards.rejected}</h3>
          </article>
        </section>

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FiFilter className="text-[#17355e]" />
            <h3 className="text-lg font-bold text-[#102d5b]">Filter Peserta</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
              Cari peserta / posisi / ID
              <div className="flex h-11 items-center gap-2 rounded-lg border border-[#d6dfed] bg-white px-3">
                <FiSearch className="text-[#5f7894]" />
                <input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  type="text"
                  className="h-full w-full border-0 bg-transparent text-sm font-normal outline-none"
                  placeholder="Contoh: Ayu / Teller / VRF-101"
                />
              </div>
            </label>

            <SearchableSingleDropdown
              label="Hasil Progress"
              options={RESULT_OPTIONS}
              selectedValue={resultFilter}
              onChange={setResultFilter}
              isOpen={resultDropdownOpen}
              setIsOpen={setResultDropdownOpen}
              searchKeyword={resultSearchKeyword}
              setSearchKeyword={setResultSearchKeyword}
            />

            <SearchableMultiDropdown
              label="Tahun"
              allLabel="Semua Tahun"
              allValue={ALL_YEARS_VALUE}
              options={yearOptions}
              selectedValues={selectedYears}
              onChange={setSelectedYears}
              isOpen={yearDropdownOpen}
              setIsOpen={setYearDropdownOpen}
              searchKeyword={yearSearchKeyword}
              setSearchKeyword={setYearSearchKeyword}
            />

            <SearchableMultiDropdown
              label="Lamaran"
              allLabel="Semua Lamaran"
              allValue={ALL_LAMARAN_VALUE}
              options={lamaranOptions}
              selectedValues={selectedLamaran}
              onChange={setSelectedLamaran}
              isOpen={lamaranDropdownOpen}
              setIsOpen={setLamaranDropdownOpen}
              searchKeyword={lamaranSearchKeyword}
              setSearchKeyword={setLamaranSearchKeyword}
            />
          </div>
        </section>

        <section className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FiFileText className="text-[#17355e]" />
            <h3 className="text-lg font-bold text-[#102d5b]">Tabel Peserta Pelamar</h3>
          </div>

          {filteredRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
              <FiShield className="mx-auto text-2xl text-[#5b7390]" />
              <p className="mt-2 text-sm text-[#607792]">
                Belum ada peserta yang sesuai dengan filter saat ini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#dbe6f6]">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-[#f4f8ff] text-[#123360]">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.04em]">No</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.04em]">Nama Peserta</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.04em]">Posisi Dilamar</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.04em]">Tahun</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.04em]">ID Verifikasi</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.04em]">Tanggal Daftar</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.04em]">Status</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.04em]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4ebf7] bg-white">
                  {filteredRows.map((row, index) => (
                    <tr key={row.participantId} className="hover:bg-[#fbfdff]">
                      <td className="px-4 py-3 text-xs text-[#4f6984]">{index + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-[#102d5b]">{row.candidate}</p>
                      </td>
                      <td className="px-4 py-3 text-[#48627f]">{row.role}</td>
                      <td className="px-4 py-3 text-[#48627f]">{row.year}</td>
                      <td className="px-4 py-3 text-[#48627f]">{row.participantId}</td>
                      <td className="px-4 py-3 text-[#48627f]">{row.submittedAt}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.summary.tone}`}
                        >
                          {row.summary.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenTracking(row.participantId)}
                            className="rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-3 py-1.5 text-xs font-semibold text-[#17477d]"
                          >
                            Cek Tracking
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteParticipant(row)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            <FiTrash2 />
                            Hapus Peserta
                          </button>
                        </div>
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

export default TrackingProgress;


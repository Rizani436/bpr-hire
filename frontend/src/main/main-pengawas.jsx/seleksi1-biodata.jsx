import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiBell,
  FiCheck,
  FiChevronDown,
  FiFilter,
  FiSave,
  FiSearch,
  FiSettings,
  FiShield,
  FiX,
} from "react-icons/fi";
import Swal from "sweetalert2";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardUser } from "../../utils/authUser";
import {
  getDefaultBiodataCriteria,
  getMasterVacancies,
  saveMasterVacancies,
  getVacancyOpenStatus,
  updateMasterVacancyBiodataCriteria,
} from "../../utils/masterVacancies";
import { getLamaranApi, updateLamaranApi } from "../../utils/authApi";
import {
  getDashboardApplications,
  reevaluateApplicationsByVacancy,
} from "../../utils/applications";
import {
  getProfileFieldDropdownOptions,
  normalizeFieldValueRules,
  PROFILE_LAYER_FIELDS,
} from "../../utils/profileCriteria";

const EDUCATION_OPTIONS = ["", "SMA/SMK", "D3", "D4", "S1", "S2", "S3"];
const COMPUTER_SKILL_LEVEL_OPTIONS = ["Pemula", "Rendah", "Baik", "Sangat Baik"];

const BIODATA_LAYER_FIELDS = (
  PROFILE_LAYER_FIELDS.find((layer) => layer.id === "biodata")?.fields || []
).map((field) => field.key);
const BERKAS_LAYER_FIELDS = (
  PROFILE_LAYER_FIELDS.find((layer) => layer.id === "berkas")?.fields || []
).map((field) => field.key);
const FIXED_REQUIRED_FIELD_KEYS = Array.from(
  new Set([...BIODATA_LAYER_FIELDS, ...BERKAS_LAYER_FIELDS, "workExperience"])
);

function cleanText(value) {
  return String(value || "").trim();
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belum pernah";
  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function normalizeSelectedValues(values) {
  const rawValues = Array.isArray(values) ? values : [values];
  return Array.from(
    new Set(
      rawValues
        .map((item) => cleanText(item))
        .filter(Boolean)
    )
  );
}

function parseNumberOrZero(value) {
  const parsed = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseYearOrZero(value) {
  const parsed = Number.parseInt(String(value || "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildFormFromCriteria(criteria) {
  const normalized = criteria && typeof criteria === "object"
    ? criteria
    : getDefaultBiodataCriteria();
  const fieldRules = normalizeFieldValueRules(normalized.fieldValueRules);

  return {
    isEnabled: Boolean(normalized.isEnabled),
    minimumEducation: cleanText(normalized.minimumEducation).toUpperCase(),
    minimumGraduationYear:
      Number(normalized.minimumGraduationYear || 0) > 0
        ? String(normalized.minimumGraduationYear)
        : "",
    minimumGpa:
      Number(normalized.minimumGpa || 0) > 0
        ? String(normalized.minimumGpa)
        : "",
    allowedMajors: normalizeSelectedValues(fieldRules.major),
    allowedMainSkills: normalizeSelectedValues(fieldRules.mainSkill),
    allowedComputerSkillLevels: normalizeSelectedValues(
      fieldRules.computerSkillLevel
    ),
    updatedAt: cleanText(normalized.updatedAt),
    updatedBy: cleanText(normalized.updatedBy || "pengawas"),
  };
}

function getStatusBadge(status) {
  if (status === "open") return "bg-green-100 text-green-700";
  if (status === "scheduled") return "bg-blue-100 text-blue-700";
  if (status === "expired") return "bg-orange-100 text-orange-700";
  return "bg-slate-100 text-slate-700";
}

function getStatusLabel(status) {
  if (status === "open") return "Dibuka";
  if (status === "scheduled") return "Terjadwal";
  if (status === "expired") return "Berakhir";
  return "Nonaktif";
}

function SearchableMultiSelectDropdown({
  label,
  placeholder,
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
    () => new Map(options.map((option) => [option.value, option.label])),
    [options]
  );
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const normalizedSearch = cleanText(searchKeyword).toLowerCase();
  const filteredOptions = options.filter((option) => {
    if (!normalizedSearch) return true;
    return option.label.toLowerCase().includes(normalizedSearch);
  });

  const displayValue =
    selectedValues.length === 0
      ? placeholder
      : selectedValues.length <= 2
        ? selectedValues
            .map((value) => selectedMap.get(value))
            .filter(Boolean)
            .join(", ")
        : `${selectedValues.length} dipilih`;

  const toggleValue = (value) => {
    const nextSet = new Set(selectedSet);
    if (nextSet.has(value)) {
      nextSet.delete(value);
    } else {
      nextSet.add(value);
    }

    const orderedValues = options
      .map((option) => option.value)
      .filter((valueOption) => nextSet.has(valueOption));

    onChange(orderedValues);
  };

  return (
    <label className="grid gap-2 text-xs font-semibold text-[#102d5b]">
      {label}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-[#d6dfed] bg-white px-3 text-left text-xs font-normal text-[#143764]"
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
              {filteredOptions.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-[#6f87a3]">Data tidak ditemukan.</p>
              ) : (
                filteredOptions.map((option) => {
                  const checked = selectedSet.has(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleValue(option.value)}
                      className={`mb-1 flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs ${
                        checked
                          ? "bg-blue-50 font-semibold text-blue-700"
                          : "text-[#1d406d] hover:bg-[#f5f9ff]"
                      }`}
                    >
                      <span>{option.label}</span>
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

SearchableMultiSelectDropdown.propTypes = {
  label: PropTypes.string.isRequired,
  placeholder: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  selectedValues: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  setIsOpen: PropTypes.func.isRequired,
  searchKeyword: PropTypes.string.isRequired,
  setSearchKeyword: PropTypes.func.isRequired,
};

function Seleksi1Biodata() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = getDashboardUser();
  const hasAutoOpenFromQueryRef = useRef(false);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [masterVacancies, setMasterVacancies] = useState(() => getMasterVacancies());
  const [applications, setApplications] = useState(() => getDashboardApplications());
  const [selectedVacancyId, setSelectedVacancyId] = useState(() =>
    cleanText(searchParams.get("vacancyId"))
  );
  const [configuredVacancyId, setConfiguredVacancyId] = useState("");
  const [isConfigurationModalVisible, setIsConfigurationModalVisible] = useState(false);
  const [form, setForm] = useState(() => buildFormFromCriteria(null));

  const [majorDropdownOpen, setMajorDropdownOpen] = useState(false);
  const [majorSearchKeyword, setMajorSearchKeyword] = useState("");
  const [mainSkillDropdownOpen, setMainSkillDropdownOpen] = useState(false);
  const [mainSkillSearchKeyword, setMainSkillSearchKeyword] = useState("");
  const [computerLevelDropdownOpen, setComputerLevelDropdownOpen] = useState(false);
  const [computerLevelSearchKeyword, setComputerLevelSearchKeyword] = useState("");

  const refreshData = useCallback(async () => {
    try {
      const response = await getLamaranApi();
      const fetchedVacancies = Array.isArray(response?.lamaran) ? response.lamaran : [];
      const normalizedVacancies = saveMasterVacancies(fetchedVacancies);
      setMasterVacancies(normalizedVacancies);
    } catch {
      setMasterVacancies(getMasterVacancies());
    }

    setApplications(getDashboardApplications());
  }, []);

  useEffect(() => {
    void refreshData();

    const handleRefresh = () => {
      void refreshData();
    };

    window.addEventListener("focus", handleRefresh);
    window.addEventListener("storage", handleRefresh);
    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("storage", handleRefresh);
    };
  }, [refreshData]);

  const filteredVacancies = useMemo(() => {
    const keyword = cleanText(searchKeyword).toLowerCase();
    return masterVacancies.filter((vacancy) => {
      if (!keyword) return true;
      return (
        cleanText(vacancy.title).toLowerCase().includes(keyword) ||
        cleanText(vacancy.department).toLowerCase().includes(keyword) ||
        cleanText(vacancy.location).toLowerCase().includes(keyword)
      );
    });
  }, [masterVacancies, searchKeyword]);

  useEffect(() => {
    if (selectedVacancyId && masterVacancies.some((item) => item.id === selectedVacancyId)) {
      return;
    }

    setSelectedVacancyId(masterVacancies[0]?.id || "");
  }, [masterVacancies, selectedVacancyId]);

  useEffect(() => {
    if (!configuredVacancyId) return;

    const stillExists = masterVacancies.some((vacancy) => vacancy.id === configuredVacancyId);
    if (!stillExists) {
      setConfiguredVacancyId("");
    }
  }, [configuredVacancyId, masterVacancies]);

  const selectedVacancyCandidate = useMemo(
    () => masterVacancies.find((vacancy) => vacancy.id === selectedVacancyId) || null,
    [masterVacancies, selectedVacancyId]
  );
  const selectedVacancy = useMemo(
    () => masterVacancies.find((vacancy) => vacancy.id === configuredVacancyId) || null,
    [configuredVacancyId, masterVacancies]
  );

  useEffect(() => {
    if (!selectedVacancy) {
      setForm(buildFormFromCriteria(null));
      return;
    }

    setForm(buildFormFromCriteria(selectedVacancy.biodataCriteria));
  }, [selectedVacancy]);

  const selectedVacancyApplications = useMemo(() => {
    if (!selectedVacancy) return [];

    const vacancyId = cleanText(selectedVacancy.id);
    const vacancyTitle = cleanText(selectedVacancy.title).toLowerCase();

    return applications.filter((application) => {
      const matchesById = cleanText(application.vacancyId) === vacancyId;
      const matchesByTitle = cleanText(application.role).toLowerCase() === vacancyTitle;
      return matchesById || matchesByTitle;
    });
  }, [applications, selectedVacancy]);

  const selectedApplicantSnapshots = useMemo(
    () =>
      selectedVacancyApplications.map((application) =>
        application?.applicant && typeof application.applicant === "object"
          ? application.applicant
          : {}
      ),
    [selectedVacancyApplications]
  );

  const majorOptions = useMemo(
    () => getProfileFieldDropdownOptions("major", selectedApplicantSnapshots),
    [selectedApplicantSnapshots]
  );
  const mainSkillOptions = useMemo(
    () => getProfileFieldDropdownOptions("mainSkill", selectedApplicantSnapshots),
    [selectedApplicantSnapshots]
  );
  const computerLevelOptions = useMemo(() => {
    const fromProfiles = getProfileFieldDropdownOptions(
      "computerSkillLevel",
      selectedApplicantSnapshots
    );

    if (fromProfiles.length > 0) return fromProfiles;

    return COMPUTER_SKILL_LEVEL_OPTIONS.map((option) => ({
      value: option,
      label: option,
    }));
  }, [selectedApplicantSnapshots]);

  const summary = useMemo(() => {
    const totalVacancies = masterVacancies.length;
    const withEnabledCriteria = masterVacancies.filter(
      (vacancy) => Boolean(vacancy?.biodataCriteria?.isEnabled)
    ).length;
    const adminFailedApplications = applications.filter((application) =>
      cleanText(application.status).toLowerCase().includes("tidak lolos administrasi")
    ).length;

    return {
      totalVacancies,
      withEnabledCriteria,
      adminFailedApplications,
    };
  }, [applications, masterVacancies]);

  const handleFieldChange = (field, value) => {
    setForm((prevForm) => ({
      ...prevForm,
      [field]: value,
    }));
  };

  const handleCloseConfigurationModal = () => {
    setIsConfigurationModalVisible(false);
    setMajorDropdownOpen(false);
    setMainSkillDropdownOpen(false);
    setComputerLevelDropdownOpen(false);
    setMajorSearchKeyword("");
    setMainSkillSearchKeyword("");
    setComputerLevelSearchKeyword("");
  };

  useEffect(() => {
    if (!isConfigurationModalVisible) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      handleCloseConfigurationModal();
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isConfigurationModalVisible]);

  const handleOpenConfigurationForm = async () => {
    if (!selectedVacancyCandidate) {
      await Swal.fire({
        icon: "warning",
        title: "Lowongan Belum Dipilih",
        text: "Pilih lowongan terlebih dahulu sebelum mengatur kualifikasi.",
        confirmButtonText: "Tutup",
        confirmButtonColor: "#1d4ed8",
      });
      return;
    }

    const confirmation = await Swal.fire({
      icon: "question",
      title: "Atur Kualifikasi Lamaran",
      text: `Apakah Anda ingin mengatur kualifikasi administrasi untuk lowongan "${selectedVacancyCandidate.title}" sekarang?`,
      showCancelButton: true,
      confirmButtonText: "Ya, Atur Sekarang",
      cancelButtonText: "Batal",
      confirmButtonColor: "#1d4ed8",
      cancelButtonColor: "#94a3b8",
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) return;

    Swal.fire({
      title: "Menyiapkan Form Kualifikasi",
      text: "Sistem sedang memuat data lowongan dan profile peserta...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    await new Promise((resolve) => {
      window.setTimeout(resolve, 900);
    });

    Swal.close();

    await Swal.fire({
      icon: "success",
      title: "Form Kualifikasi Siap",
      text: `Kualifikasi lowongan "${selectedVacancyCandidate.title}" siap diatur.`,
      confirmButtonText: "Lanjut",
      confirmButtonColor: "#1d4ed8",
    });

    setConfiguredVacancyId(selectedVacancyCandidate.id);
    setIsConfigurationModalVisible(true);
  };

  useEffect(() => {
    const shouldOpenModalFromQuery = cleanText(searchParams.get("openModal")) === "1";
    if (!shouldOpenModalFromQuery || hasAutoOpenFromQueryRef.current) return;
    if (!selectedVacancyCandidate) return;

    hasAutoOpenFromQueryRef.current = true;
    setConfiguredVacancyId(selectedVacancyCandidate.id);
    setIsConfigurationModalVisible(true);
  }, [searchParams, selectedVacancyCandidate]);

  const handleSave = async (event) => {
    event.preventDefault();

    if (!selectedVacancy) {
      await Swal.fire({
        icon: "warning",
        title: "Lowongan Belum Dipilih",
        text: "Pilih lowongan terlebih dahulu sebelum menyimpan seleksi biodata.",
        confirmButtonText: "Tutup",
        confirmButtonColor: "#1d4ed8",
      });
      return;
    }

    const parsedMinimumGpa = parseNumberOrZero(form.minimumGpa);
    if (cleanText(form.minimumGpa).length > 0) {
      if (!Number.isFinite(parsedMinimumGpa) || parsedMinimumGpa < 0 || parsedMinimumGpa > 4) {
        await Swal.fire({
          icon: "warning",
          title: "Format IPK Belum Valid",
          text: "Minimal IPK harus berupa angka antara 0 sampai 4.",
          confirmButtonText: "Tutup",
          confirmButtonColor: "#1d4ed8",
        });
        return;
      }
    }

    const parsedMinimumGraduationYear = parseYearOrZero(form.minimumGraduationYear);
    if (cleanText(form.minimumGraduationYear).length > 0) {
      if (
        !Number.isFinite(parsedMinimumGraduationYear) ||
        parsedMinimumGraduationYear < 1900 ||
        parsedMinimumGraduationYear > 2100
      ) {
        await Swal.fire({
          icon: "warning",
          title: "Tahun Lulus Belum Valid",
          text: "Masukkan tahun lulus minimal (contoh: 2020).",
          confirmButtonText: "Tutup",
          confirmButtonColor: "#1d4ed8",
        });
        return;
      }
    }

    const fieldValueRules = {
      major: normalizeSelectedValues(form.allowedMajors),
      mainSkill: normalizeSelectedValues(form.allowedMainSkills),
      computerSkillLevel: normalizeSelectedValues(form.allowedComputerSkillLevels),
    };

    const payload = {
      isEnabled: Boolean(form.isEnabled),
      minimumEducation: cleanText(form.minimumEducation).toUpperCase(),
      minimumGraduationYear:
        parsedMinimumGraduationYear > 0 ? parsedMinimumGraduationYear : 0,
      minimumGpa: parsedMinimumGpa > 0 ? parsedMinimumGpa : 0,
      majorKeywords: [],
      allowedGenders: [],
      requiredProfileFields: FIXED_REQUIRED_FIELD_KEYS,
      fieldValueRules,
      requireDocumentReady: true,
    };

    const deskripsiLamaran = cleanText(
      selectedVacancy.deskripsiLamaran || selectedVacancy.description
    );
    const ruangLingkupPekerjaan =
      cleanText(
        selectedVacancy.ruangLingkupPekerjaan ||
          selectedVacancy.summary ||
          selectedVacancy.description
      ) || deskripsiLamaran;
    const kualifikasi = Array.isArray(selectedVacancy.kualifikasi)
      ? selectedVacancy.kualifikasi
      : Array.isArray(selectedVacancy.requirements)
        ? selectedVacancy.requirements
        : [];
    const kompetensi = Array.isArray(selectedVacancy.kompetensi)
      ? selectedVacancy.kompetensi
      : Array.isArray(selectedVacancy.qualifications)
        ? selectedVacancy.qualifications
        : [];

    const lamaranSyncPayload = {
      title: cleanText(selectedVacancy.title),
      tenagaAhli: cleanText(selectedVacancy.tenagaAhli || selectedVacancy.department),
      department: cleanText(selectedVacancy.tenagaAhli || selectedVacancy.department),
      location: cleanText(selectedVacancy.location),
      type: cleanText(selectedVacancy.type || "Full Time"),
      deskripsiLamaran,
      description: deskripsiLamaran,
      ruangLingkupPekerjaan,
      summary: ruangLingkupPekerjaan,
      pendidikan: Array.isArray(selectedVacancy.pendidikan) ? selectedVacancy.pendidikan : [],
      pengalaman: Array.isArray(selectedVacancy.pengalaman) ? selectedVacancy.pengalaman : [],
      karakterDibutuhkan: Array.isArray(selectedVacancy.karakterDibutuhkan)
        ? selectedVacancy.karakterDibutuhkan
        : [],
      kualifikasi,
      requirements: kualifikasi,
      kompetensi,
      qualifications: kompetensi,
      requiredDocuments: Array.isArray(selectedVacancy.requiredDocuments)
        ? selectedVacancy.requiredDocuments
        : [],
      selectionFlow:
        cleanText(selectedVacancy.selectionFlow).toLowerCase() === "langsung"
          ? "langsung"
          : "berurutan",
      selectionStages: Array.isArray(selectedVacancy.selectionStages)
        ? selectedVacancy.selectionStages
        : [],
      openDate: cleanText(selectedVacancy.openDate),
      closeDate: cleanText(selectedVacancy.closeDate),
      isActive: Boolean(selectedVacancy.isActive),
      biodataCriteria: payload,
      createdBy: currentUser.userName || "pengawas",
    };

    try {
      await updateLamaranApi(selectedVacancy.id, lamaranSyncPayload);

      updateMasterVacancyBiodataCriteria(
        selectedVacancy.id,
        payload,
        currentUser.userName
      );
      const reevaluateResult = reevaluateApplicationsByVacancy(selectedVacancy.id);
      await refreshData();

      await Swal.fire({
        icon: "success",
        title: "Seleksi Biodata Tersimpan",
        text: `Evaluasi otomatis selesai. Dicek ${reevaluateResult.totalChecked} lamaran, ${reevaluateResult.autoFailed} tidak lolos administrasi, ${reevaluateResult.movedToReview} masuk verifikasi pengawas.`,
        confirmButtonText: "OK",
        confirmButtonColor: "#1d4ed8",
      });
      handleCloseConfigurationModal();
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Gagal Menyimpan Seleksi Biodata",
        text:
          error instanceof Error
            ? error.message
            : "Terjadi kendala saat menyimpan setting seleksi biodata.",
        confirmButtonText: "Tutup",
        confirmButtonColor: "#dc2626",
      });
    }
  };

  return (
    <div className="bh-dashboard-shell min-h-screen bg-[#f7fbff] text-[#09275a] lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="bh-dashboard-sidebar-shell border-b border-[#dfe8f5] bg-white p-4 shadow-[12px_0_40px_rgba(20,57,96,0.05)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:border-b-0 lg:border-r lg:px-4 lg:py-8">
        <Sidebar role="pengawas" />
      </aside>

      <main className="bh-dashboard-main min-w-0 px-4 py-6 sm:px-6 lg:px-9 lg:py-10">
        <Header user={{ ...currentUser, role: "pengawas" }} />

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <p className="text-sm font-semibold text-blue-600">Master Data</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
            Tambah Seleksi Biodata
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
            Atur rule seleksi administrasi per lowongan. Biodata dan berkas wajib lengkap,
            lalu tambahkan filter pendidikan dan keahlian sesuai kebutuhan pengawas.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/pengawas/master-data/tambah-lamaran")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-4 text-sm font-bold text-[#17477d]"
            >
              <FiShield />
              Tambah Lamaran
            </button>
            <button
              type="button"
              onClick={() => navigate("/pengawas/master-data/tambah-pengumuman")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-4 text-sm font-bold text-[#17477d]"
            >
              <FiBell />
              Tambah Pengumuman
            </button>
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Total Master Lamaran</p>
            <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">{summary.totalVacancies}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Rule Seleksi Aktif</p>
            <h3 className="mt-2 text-3xl font-bold text-blue-700">{summary.withEnabledCriteria}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Tidak Lolos Administrasi</p>
            <h3 className="mt-2 text-3xl font-bold text-red-700">{summary.adminFailedApplications}</h3>
          </article>
        </section>

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FiFilter className="text-[#17355e]" />
            <h3 className="text-lg font-bold text-[#102d5b]">Pilih Lowongan</h3>
          </div>

          <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
            Cari Judul / Departemen / Lokasi
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              type="text"
              className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
              placeholder="Contoh: Analis Kredit / Bisnis / Mataram"
            />
          </label>

          {filteredVacancies.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
              <p className="text-sm text-[#607792]">Belum ada lowongan yang cocok.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {filteredVacancies.map((vacancy) => {
                const isSelected = vacancy.id === selectedVacancyId;
                const status = getVacancyOpenStatus(vacancy);

                return (
                  <button
                    key={vacancy.id}
                    type="button"
                    onClick={() => setSelectedVacancyId(vacancy.id)}
                    className={`rounded-lg border p-4 text-left transition ${
                      isSelected
                        ? "border-blue-300 bg-blue-50 shadow-[0_12px_24px_rgba(47,114,211,0.08)]"
                        : "border-[#dfe8f5] bg-[#fbfdff] hover:bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-[#102d5b]">{vacancy.title}</p>
                        <p className="text-xs text-[#607792]">
                          {vacancy.department} - {vacancy.location}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusBadge(status)}`}
                        >
                          {getStatusLabel(status)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            vacancy?.biodataCriteria?.isEnabled
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {vacancy?.biodataCriteria?.isEnabled ? "Rule Aktif" : "Rule Nonaktif"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}

              <div className="rounded-lg border border-[#d6dfed] bg-[#fbfdff] p-3">
                <p className="text-xs text-[#5c7592]">
                  Lowongan terpilih:{" "}
                  <span className="font-semibold text-[#12345e]">
                    {selectedVacancyCandidate?.title || "-"}
                  </span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleOpenConfigurationForm}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-gradient-to-r from-[#347dec] to-[#0c3a78] px-4 text-sm font-bold text-white"
                  >
                    Atur Kualifikasi Lowongan Terpilih
                  </button>
                  {selectedVacancy && (
                    <span className="inline-flex h-10 items-center rounded-md border border-green-200 bg-green-50 px-3 text-xs font-semibold text-green-700">
                      Form aktif: {selectedVacancy.title}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {isConfigurationModalVisible && (
          <div
            className="fixed inset-0 z-[90] bg-[rgba(8,27,53,0.52)] p-3 backdrop-blur-[3px] sm:p-5"
            onMouseDown={handleCloseConfigurationModal}
          >
            <section
              className="mx-auto flex h-[calc(100vh-1.5rem)] max-h-[860px] w-full max-w-5xl flex-col overflow-hidden rounded-[12px] border border-[#d6dfed] bg-white shadow-[0_24px_72px_rgba(9,39,90,0.35)] sm:h-[calc(100vh-2.5rem)]"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-[#e4ebf7] px-5 py-4 sm:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-600">
                    Pengawas
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <FiSettings className="text-[#17355e]" />
                    <h3 className="text-lg font-bold text-[#102d5b]">
                      Setting Seleksi Biodata
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-[#5f7894]">
                    Atur filter biodata agar seleksi administrasi berjalan lebih tepat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseConfigurationModal}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d6dfed] bg-white text-[#17355e] transition hover:bg-[#f4f8ff]"
                  aria-label="Tutup modal setting seleksi biodata"
                >
                  <FiX />
                </button>
              </div>

              {!selectedVacancy ? (
                <div className="m-5 rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center sm:m-6">
                  <p className="text-sm text-[#607792]">
                    Pilih lowongan lalu tekan tombol "Atur Kualifikasi Lowongan Terpilih"
                    untuk membuka form.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                    <div className="mb-5 rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-4">
                      <p className="text-sm font-bold text-[#102d5b]">{selectedVacancy.title}</p>
                      <p className="mt-1 text-xs text-[#607792]">
                        {selectedVacancy.department} - {selectedVacancy.location}
                      </p>
                      <p className="mt-2 text-[11px] text-[#7b8fa9]">
                        Terakhir diubah: {formatDateTime(form.updatedAt)} oleh {form.updatedBy || "-"}
                      </p>
                      <p className="mt-1 text-[11px] text-[#7b8fa9]">
                        Lamaran masuk pada posisi ini: {selectedVacancyApplications.length}
                      </p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="flex items-start gap-3 rounded-lg border border-[#d6dfed] bg-[#fbfdff] p-4 text-sm font-semibold text-[#102d5b] lg:col-span-2">
                        <input
                          type="checkbox"
                          checked={form.isEnabled}
                          onChange={(event) => handleFieldChange("isEnabled", event.target.checked)}
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          Aktifkan seleksi administrasi otomatis untuk lowongan ini.
                          <small className="mt-1 block text-xs font-normal leading-relaxed text-[#607792]">
                            Jika aktif, peserta yang tidak sesuai kriteria akan otomatis tidak lolos administrasi.
                          </small>
                        </span>
                      </label>

                      <div className="rounded-lg border border-[#d6dfed] bg-gradient-to-r from-[#f6fbff] to-white p-4 lg:col-span-2">
                        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#102d5b]">
                          <FiShield />
                          Rule Tetap Sistem
                        </div>
                        <div className="grid gap-2 text-xs text-[#4f6784]">
                          <p>1. Layer Biodata wajib lengkap semua field.</p>
                          <p>2. Layer Berkas wajib lengkap semua field.</p>
                          <p>3. Pengalaman Kerja wajib diisi oleh peserta.</p>
                        </div>
                      </div>

                      <div className="grid gap-3 rounded-lg border border-[#d6dfed] bg-[#fbfdff] p-4 lg:col-span-2">
                        <h4 className="text-sm font-bold text-[#12345e]">Kriteria Pendidikan</h4>

                        <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                          Pendidikan Minimal
                          <select
                            value={form.minimumEducation}
                            onChange={(event) => handleFieldChange("minimumEducation", event.target.value)}
                            className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                          >
                            {EDUCATION_OPTIONS.map((option) => (
                              <option key={option || "all"} value={option}>
                                {option || "Tidak ditentukan"}
                              </option>
                            ))}
                          </select>
                          <small className="text-xs font-normal leading-relaxed text-[#607792]">
                            Contoh: pilih S1 berarti peserta S1, D4, S2, dan S3 memenuhi syarat. Peserta di bawah jenjang itu otomatis tidak bisa melamar.
                          </small>
                        </label>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                            Minimal Tahun Lulus
                            <input
                              value={form.minimumGraduationYear}
                              onChange={(event) =>
                                handleFieldChange("minimumGraduationYear", event.target.value)
                              }
                              type="number"
                              className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                              placeholder="Contoh: 2020"
                            />
                            <small className="text-xs font-normal leading-relaxed text-[#607792]">
                              Peserta dengan tahun lulus sama atau setelah tahun ini memenuhi syarat.
                            </small>
                          </label>
                          <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                            Minimal IPK
                            <input
                              value={form.minimumGpa}
                              onChange={(event) => handleFieldChange("minimumGpa", event.target.value)}
                              type="text"
                              className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                              placeholder="Contoh: 3.25"
                            />
                            <small className="text-xs font-normal leading-relaxed text-[#607792]">
                              Peserta dengan IPK sama atau lebih besar dari nilai ini memenuhi syarat.
                            </small>
                          </label>
                        </div>

                        <SearchableMultiSelectDropdown
                          label="Jurusan yang Diterima"
                          placeholder="Semua jurusan diterima"
                          options={majorOptions}
                          selectedValues={form.allowedMajors}
                          onChange={(values) => handleFieldChange("allowedMajors", values)}
                          isOpen={majorDropdownOpen}
                          setIsOpen={setMajorDropdownOpen}
                          searchKeyword={majorSearchKeyword}
                          setSearchKeyword={setMajorSearchKeyword}
                        />
                        <small className="text-xs font-normal leading-relaxed text-[#607792]">
                          Jika memilih beberapa jurusan, peserta cukup memiliki salah satu jurusan yang sama agar memenuhi syarat.
                        </small>
                      </div>

                      <div className="grid gap-3 rounded-lg border border-[#d6dfed] bg-[#fbfdff] p-4 lg:col-span-2">
                        <h4 className="text-sm font-bold text-[#12345e]">Kriteria Keahlian</h4>

                        <SearchableMultiSelectDropdown
                          label="Keahlian Utama yang Diterima"
                          placeholder="Semua keahlian utama diterima"
                          options={mainSkillOptions}
                          selectedValues={form.allowedMainSkills}
                          onChange={(values) => handleFieldChange("allowedMainSkills", values)}
                          isOpen={mainSkillDropdownOpen}
                          setIsOpen={setMainSkillDropdownOpen}
                          searchKeyword={mainSkillSearchKeyword}
                          setSearchKeyword={setMainSkillSearchKeyword}
                        />
                        <small className="text-xs font-normal leading-relaxed text-[#607792]">
                          Peserta cukup memiliki salah satu keahlian utama yang sama dengan pilihan kriteria.
                        </small>

                        <SearchableMultiSelectDropdown
                          label="Level Kemampuan Komputer yang Diterima"
                          placeholder="Semua level diterima"
                          options={computerLevelOptions}
                          selectedValues={form.allowedComputerSkillLevels}
                          onChange={(values) =>
                            handleFieldChange("allowedComputerSkillLevels", values)
                          }
                          isOpen={computerLevelDropdownOpen}
                          setIsOpen={setComputerLevelDropdownOpen}
                          searchKeyword={computerLevelSearchKeyword}
                          setSearchKeyword={setComputerLevelSearchKeyword}
                        />
                        <small className="text-xs font-normal leading-relaxed text-[#607792]">
                          Peserta harus memiliki salah satu level kemampuan komputer yang dipilih agar memenuhi syarat.
                        </small>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-[#e4ebf7] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <button
                      type="button"
                      onClick={handleCloseConfigurationModal}
                      className="h-11 rounded-md border border-[#d6dfed] bg-white px-5 text-sm font-bold text-[#102d5b]"
                    >
                      Tutup Modal
                    </button>
                    <button
                      type="submit"
                      className="flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#347dec] to-[#0c3a78] px-6 text-sm font-bold text-white shadow-[0_14px_26px_rgba(19,77,153,0.25)]"
                    >
                      <FiSave />
                      Simpan Seleksi Biodata
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default Seleksi1Biodata;

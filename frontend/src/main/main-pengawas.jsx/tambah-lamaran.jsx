import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowDown,
  FiArrowUp,
  FiBriefcase,
  FiCalendar,
  FiEdit3,
  FiFileText,
  FiPlusCircle,
  FiSave,
  FiShield,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import Swal from "sweetalert2";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardUser } from "../../utils/authUser";
import {
  getVacancyOpenStatus,
  saveMasterVacancies,
} from "../../utils/masterVacancies";
import {
  createLamaranApi,
  deleteLamaranApi,
  getLamaranApi,
  updateLamaranApi,
  updateLamaranStatusApi,
} from "../../utils/authApi";
import { removeDashboardApplicationsByVacancy } from "../../utils/applications";

const JOB_TYPE_OPTIONS = ["Full Time", "Contract", "Part Time", "Internship"];
const PENDIDIKAN_OPTIONS = [
  "SMA/SMK",
  "D1",
  "D2",
  "D3",
  "D4",
  "S1",
  "S2",
  "S3",
];
const SELECTION_FLOW_OPTIONS = [
  {
    value: "berurutan",
    label: "Berurutan (Tahap 1, 2, 3, ...)",
  },
  {
    value: "langsung",
    label: "Langsung (Satu tahap saja)",
  },
];

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateText, daysToAdd) {
  const baseDate = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) return dateText;

  baseDate.setDate(baseDate.getDate() + daysToAdd);
  const year = baseDate.getFullYear();
  const month = String(baseDate.getMonth() + 1).padStart(2, "0");
  const day = String(baseDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultForm() {
  const today = getTodayDateInput();
  return {
    title: "",
    tenagaAhli: "",
    location: "",
    type: "Full Time",
    deskripsiLamaran: "",
    ruangLingkupPekerjaan: "",
    pendidikan: [],
    pengalamanText: "",
    karakterDibutuhkanText: "",
    kualifikasiText: "",
    kompetensiText: "",
    requiredDocumentsText: "",
    selectionFlow: "berurutan",
    selectionStages: [],
    openDate: today,
    closeDate: addDays(today, 30),
    isActive: false,
  };
}

function listToText(value) {
  return Array.isArray(value)
    ? value
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0)
        .join("\n")
    : "";
}

function buildFormFromVacancy(vacancy = {}) {
  return {
    ...getDefaultForm(),
    title: String(vacancy.title || "").trim(),
    tenagaAhli: String(vacancy.tenagaAhli || vacancy.department || "").trim(),
    location: String(vacancy.location || "").trim(),
    type: String(vacancy.type || "Full Time").trim(),
    deskripsiLamaran: String(
      vacancy.deskripsiLamaran || vacancy.description || ""
    ).trim(),
    ruangLingkupPekerjaan: String(
      vacancy.ruangLingkupPekerjaan || vacancy.summary || vacancy.description || ""
    ).trim(),
    pendidikan: Array.isArray(vacancy.pendidikan) ? vacancy.pendidikan : [],
    pengalamanText: listToText(vacancy.pengalaman),
    karakterDibutuhkanText: listToText(vacancy.karakterDibutuhkan),
    kualifikasiText: listToText(vacancy.kualifikasi || vacancy.requirements),
    kompetensiText: listToText(vacancy.kompetensi || vacancy.qualifications),
    requiredDocumentsText: listToText(vacancy.requiredDocuments),
    selectionFlow: vacancy.selectionFlow === "langsung" ? "langsung" : "berurutan",
    selectionStages: Array.isArray(vacancy.selectionStages)
      ? vacancy.selectionStages
          .filter((stage) => !isAdministrationStage(stage))
          .map((stage) => ({
            title: String(stage?.title || "").trim(),
            description: String(stage?.description || "").trim(),
            startDate: String(stage?.startDate || "").trim(),
            endDate: String(stage?.endDate || "").trim(),
            startTime: String(stage?.startTime || "").trim(),
            endTime: String(stage?.endTime || "").trim(),
          }))
      : [],
    openDate: String(vacancy.openDate || "").trim() || getTodayDateInput(),
    closeDate:
      String(vacancy.closeDate || "").trim() || addDays(getTodayDateInput(), 30),
    isActive: Boolean(vacancy.isActive),
  };
}

function validateSelectionStageSchedules(selectionStages = []) {
  const safeStages = Array.isArray(selectionStages) ? selectionStages : [];

  for (let index = 0; index < safeStages.length; index += 1) {
    const stage = safeStages[index] || {};
    const stageLabel = `tahap lanjutan ${index + 1}`;
    const hasSchedule = [
      stage.startDate,
      stage.endDate,
      stage.startTime,
      stage.endTime,
    ].some((value) => String(value || "").trim().length > 0);

    if (!hasSchedule) continue;

    if (!stage.startDate || !stage.endDate || !stage.startTime || !stage.endTime) {
      return `Tanggal mulai, tanggal selesai, jam mulai, dan jam selesai wajib lengkap pada ${stageLabel}.`;
    }

    if (stage.endDate < stage.startDate) {
      return `Tanggal selesai tidak boleh sebelum tanggal mulai pada ${stageLabel}.`;
    }

    if (stage.startDate === stage.endDate && stage.endTime < stage.startTime) {
      return `Jam selesai tidak boleh sebelum jam mulai pada ${stageLabel}.`;
    }
  }

  return "";
}

function splitLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isAdministrationStage(stage = {}) {
  const normalizedTitle = String(stage?.title || stage || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return (
    normalizedTitle === "administrasi" ||
    normalizedTitle === "seleksiadministrasi" ||
    normalizedTitle === "tahapadministrasi"
  );
}

function formatDateLabel(dateText) {
  if (!dateText) return "-";
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText;

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusPresentation(status) {
  if (status === "open") {
    return {
      label: "Dibuka",
      tone: "bg-green-100 text-green-700",
    };
  }

  if (status === "scheduled") {
    return {
      label: "Terjadwal",
      tone: "bg-blue-100 text-blue-700",
    };
  }

  if (status === "expired") {
    return {
      label: "Periode Berakhir",
      tone: "bg-orange-100 text-orange-700",
    };
  }

  return {
    label: "Nonaktif",
    tone: "bg-slate-100 text-slate-700",
  };
}

function normalizeLamaranItem(item) {
  const lamaranUUID = String(item?.lamaranUUID || item?.id || "").trim();
  const tenagaAhli = String(item?.tenagaAhli || item?.department || "").trim();
  const deskripsiLamaran = String(
    item?.deskripsiLamaran || item?.description || ""
  ).trim();
  const ruangLingkupPekerjaan = String(
    item?.ruangLingkupPekerjaan || item?.summary || item?.description || ""
  ).trim();
  const kualifikasi = Array.isArray(item?.kualifikasi)
    ? item.kualifikasi
    : Array.isArray(item?.requirements)
      ? item.requirements
      : [];
  const kompetensi = Array.isArray(item?.kompetensi)
    ? item.kompetensi
    : Array.isArray(item?.qualifications)
      ? item.qualifications
      : [];
  const pendidikan = Array.isArray(item?.pendidikan) ? item.pendidikan : [];
  const pengalaman = Array.isArray(item?.pengalaman) ? item.pengalaman : [];
  const karakterDibutuhkan = Array.isArray(item?.karakterDibutuhkan)
    ? item.karakterDibutuhkan
    : [];

  return {
    id: lamaranUUID,
    lamaranUUID,
    title: String(item?.title || "").trim(),
    department: tenagaAhli,
    tenagaAhli,
    location: String(item?.location || "").trim(),
    type: String(item?.type || "Full Time").trim(),
    description: deskripsiLamaran,
    deskripsiLamaran,
    summary: ruangLingkupPekerjaan,
    ruangLingkupPekerjaan,
    requirements: kualifikasi,
    kualifikasi,
    qualifications: kompetensi,
    kompetensi,
    pendidikan,
    pengalaman,
    karakterDibutuhkan,
    requiredDocuments: Array.isArray(item?.requiredDocuments)
      ? item.requiredDocuments
      : [],
    selectionFlow: item?.selectionFlow === "langsung" ? "langsung" : "berurutan",
    selectionStages: Array.isArray(item?.selectionStages)
      ? item.selectionStages.filter((stage) => !isAdministrationStage(stage))
      : [],
    biodataCriteria:
      item?.biodataCriteria && typeof item.biodataCriteria === "object"
        ? item.biodataCriteria
        : {},
    isActive: Boolean(item?.isActive),
    openDate: String(item?.openDate || "").trim(),
    closeDate: String(item?.closeDate || "").trim(),
    createdBy: String(item?.createdBy || "").trim(),
    createdAt: String(item?.createdAt || "").trim(),
    updatedAt: String(item?.updatedAt || "").trim(),
    status: String(item?.status || "").trim(),
  };
}

function TambahLamaran() {
  const navigate = useNavigate();
  const currentUser = getDashboardUser();
  const [form, setForm] = useState(() => getDefaultForm());
  const [formStatus, setFormStatus] = useState({ type: "idle", message: "" });
  const [masterVacancies, setMasterVacancies] = useState([]);
  const [processingVacancyActionId, setProcessingVacancyActionId] = useState("");
  const [isCreateFormVisible, setIsCreateFormVisible] = useState(false);
  const [editingVacancy, setEditingVacancy] = useState(null);
  const isEditMode = Boolean(editingVacancy?.id);

  const summary = useMemo(() => {
    let openCount = 0;
    let scheduledCount = 0;
    let closedCount = 0;

    for (const vacancy of masterVacancies) {
      const status = getVacancyOpenStatus(vacancy);
      if (status === "open") openCount += 1;
      if (status === "scheduled") scheduledCount += 1;
      if (status === "expired" || status === "inactive") closedCount += 1;
    }

    return {
      total: masterVacancies.length,
      openCount,
      scheduledCount,
      closedCount,
    };
  }, [masterVacancies]);

  const handleFieldChange = (field, value) => {
    setFormStatus({ type: "idle", message: "" });
    setForm((prevForm) => ({
      ...prevForm,
      [field]: value,
    }));
  };

  const handleTogglePendidikan = (value) => {
    const safeValue = String(value || "").trim();
    if (!safeValue) return;

    setFormStatus({ type: "idle", message: "" });
    setForm((prevForm) => {
      const currentList = Array.isArray(prevForm.pendidikan)
        ? prevForm.pendidikan
        : [];
      const exists = currentList.includes(safeValue);
      const nextList = exists
        ? currentList.filter((item) => item !== safeValue)
        : [...currentList, safeValue];

      return {
        ...prevForm,
        pendidikan: nextList,
      };
    });
  };

  const handleStageChange = (index, field, value) => {
    setFormStatus({ type: "idle", message: "" });
    setForm((prevForm) => {
      const nextStages = Array.isArray(prevForm.selectionStages)
        ? [...prevForm.selectionStages]
        : [];

      if (!nextStages[index]) return prevForm;

      nextStages[index] = {
        ...nextStages[index],
        [field]: value,
      };

      return {
        ...prevForm,
        selectionStages: nextStages,
      };
    });
  };

  const handleSelectionFlowChange = (value) => {
    setFormStatus({ type: "idle", message: "" });
    setForm((prevForm) => {
      const normalizedValue = value === "langsung" ? "langsung" : "berurutan";
      const currentStages = Array.isArray(prevForm.selectionStages)
        ? prevForm.selectionStages
        : [];

      let nextStages = currentStages;
      if (normalizedValue === "langsung") {
        nextStages = nextStages.length > 0 ? [nextStages[0]] : [];
      }

      return {
        ...prevForm,
        selectionFlow: normalizedValue,
        selectionStages: nextStages,
      };
    });
  };

  const handleAddStage = () => {
    setFormStatus({ type: "idle", message: "" });
    setForm((prevForm) => {
      const currentStages = Array.isArray(prevForm.selectionStages)
        ? prevForm.selectionStages
        : [];
      if (prevForm.selectionFlow === "langsung" && currentStages.length > 0) {
        return prevForm;
      }

      return {
        ...prevForm,
        selectionStages: [
          ...currentStages,
          {
            title: "",
            description: "",
            startDate: "",
            endDate: "",
            startTime: "",
            endTime: "",
          },
        ],
      };
    });
  };

  const handleRemoveStage = (index) => {
    setFormStatus({ type: "idle", message: "" });
    setForm((prevForm) => {
      const currentStages = Array.isArray(prevForm.selectionStages)
        ? prevForm.selectionStages
        : [];

      return {
        ...prevForm,
        selectionStages: currentStages.filter((_, stageIndex) => stageIndex !== index),
      };
    });
  };

  const handleMoveStage = (index, direction) => {
    setFormStatus({ type: "idle", message: "" });
    setForm((prevForm) => {
      const currentStages = Array.isArray(prevForm.selectionStages)
        ? [...prevForm.selectionStages]
        : [];

      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= currentStages.length) return prevForm;

      const temp = currentStages[index];
      currentStages[index] = currentStages[nextIndex];
      currentStages[nextIndex] = temp;

      return {
        ...prevForm,
        selectionStages: currentStages,
      };
    });
  };

  const handleOpenCreateForm = async () => {
    if (isCreateFormVisible) return;

    setEditingVacancy(null);
    resetForm();

    const confirmation = await Swal.fire({
      icon: "question",
      title: "Form Tambah Lamaran",
      text: "Apakah Anda ingin membuka form tambah lamaran sekarang?",
      showCancelButton: true,
      confirmButtonText: "Ya, Buka Form",
      cancelButtonText: "Batal",
      confirmButtonColor: "#1d4ed8",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) return;

    setIsCreateFormVisible(true);

    await Swal.fire({
      icon: "success",
      title: "Form Siap Diisi",
      text: "Silakan lengkapi data lamaran pada form yang sudah ditampilkan.",
      timer: 1500,
      showConfirmButton: false,
    });
  };

  const handleOpenEditForm = (vacancy) => {
    if (!vacancy?.id || isCreateFormVisible) return;
    setForm(buildFormFromVacancy(vacancy));
    setEditingVacancy(vacancy);
    setFormStatus({ type: "idle", message: "" });
    setIsCreateFormVisible(true);
  };

  const handleCloseCreateForm = () => {
    setIsCreateFormVisible(false);
    setEditingVacancy(null);
    resetForm();
    setFormStatus({ type: "idle", message: "" });
  };

  const resetForm = () => {
    setForm(getDefaultForm());
  };

  const refreshVacancies = useCallback(async () => {
    try {
      const response = await getLamaranApi();
      const fetchedVacancies = Array.isArray(response?.lamaran)
        ? response.lamaran.map((item) => normalizeLamaranItem(item))
        : [];
      saveMasterVacancies(fetchedVacancies);
      setMasterVacancies(fetchedVacancies);
    } catch {
      setMasterVacancies([]);
    }
  }, []);

  useEffect(() => {
    void refreshVacancies();

    const handleRefresh = () => {
      void refreshVacancies();
    };

    window.addEventListener("focus", handleRefresh);
    return () => {
      window.removeEventListener("focus", handleRefresh);
    };
  }, [refreshVacancies]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const title = String(form.title || "").trim();
    const tenagaAhli = String(form.tenagaAhli || "").trim();
    const location = String(form.location || "").trim();
    const deskripsiLamaran = String(form.deskripsiLamaran || "").trim();
    const ruangLingkupPekerjaan = String(form.ruangLingkupPekerjaan || "").trim();
    const openDate = String(form.openDate || "").trim();
    const closeDate = String(form.closeDate || "").trim();
    const selectionFlow = form.selectionFlow === "langsung" ? "langsung" : "berurutan";
    const pendidikan = Array.from(
      new Set(
        (Array.isArray(form.pendidikan) ? form.pendidikan : [])
          .map((item) => String(item || "").trim())
          .filter((item) => item.length > 0)
      )
    );
    const pengalaman = splitLines(form.pengalamanText);
    const karakterDibutuhkan = splitLines(form.karakterDibutuhkanText);
    const kualifikasi = splitLines(form.kualifikasiText);
    const kompetensi = splitLines(form.kompetensiText);
    const requiredDocuments = splitLines(form.requiredDocumentsText);
    const rawSelectionStages = (Array.isArray(form.selectionStages) ? form.selectionStages : [])
      .map((item) => ({
        title: String(item?.title || "").trim(),
        description: String(item?.description || "").trim(),
        startDate: String(item?.startDate || "").trim(),
        endDate: String(item?.endDate || "").trim(),
        startTime: String(item?.startTime || "").trim(),
        endTime: String(item?.endTime || "").trim(),
      }))
      .filter((item) => item.title.length > 0 && !isAdministrationStage(item));
    const selectionStages =
      selectionFlow === "langsung"
        ? rawSelectionStages.slice(0, 1)
        : rawSelectionStages;
    const selectionScheduleMessage =
      validateSelectionStageSchedules(selectionStages);

    if (!title) {
      setFormStatus({ type: "error", message: "Judul posisi wajib diisi." });
      return;
    }

    if (!tenagaAhli) {
      setFormStatus({ type: "error", message: "Tenaga ahli wajib diisi." });
      return;
    }

    if (!location) {
      setFormStatus({ type: "error", message: "Lokasi penempatan wajib diisi." });
      return;
    }

    if (!deskripsiLamaran) {
      setFormStatus({ type: "error", message: "Deskripsi lamaran wajib diisi." });
      return;
    }

    if (pendidikan.length === 0) {
      setFormStatus({
        type: "error",
        message: "Minimal pilih satu pendidikan untuk lamaran.",
      });
      return;
    }

    if (!openDate || !closeDate) {
      setFormStatus({
        type: "error",
        message: "Tanggal mulai dan tanggal tutup lamaran wajib diisi.",
      });
      return;
    }

    if (closeDate < openDate) {
      setFormStatus({
        type: "error",
        message: "Tanggal tutup harus sama atau setelah tanggal mulai.",
      });
      return;
    }

    if (kualifikasi.length === 0) {
      setFormStatus({
        type: "error",
        message: "Minimal isi satu kualifikasi (baris terpisah).",
      });
      return;
    }

    if (requiredDocuments.length === 0) {
      setFormStatus({
        type: "error",
        message: "Minimal isi satu dokumen yang diperlukan.",
      });
      return;
    }

    if (selectionScheduleMessage) {
      setFormStatus({
        type: "error",
        message: selectionScheduleMessage,
      });
      return;
    }

    const editingLamaranId = String(editingVacancy?.id || "").trim();
    const duplicateTitle = masterVacancies.some(
      (vacancy) =>
        String(vacancy.id || "").trim() !== editingLamaranId &&
        String(vacancy.title || "").toLowerCase() === title.toLowerCase()
    );
    if (duplicateTitle) {
      setFormStatus({
        type: "error",
        message: "Judul posisi sudah ada. Gunakan judul yang berbeda.",
      });
      return;
    }

    const lamaranPayload = {
      title,
      tenagaAhli,
      department: tenagaAhli,
      location,
      type: form.type,
      deskripsiLamaran,
      description: deskripsiLamaran,
      ruangLingkupPekerjaan: ruangLingkupPekerjaan || deskripsiLamaran,
      summary: ruangLingkupPekerjaan || deskripsiLamaran,
      pendidikan,
      pengalaman,
      karakterDibutuhkan,
      kualifikasi,
      requirements: kualifikasi,
      kompetensi,
      qualifications: kompetensi,
      requiredDocuments,
      selectionFlow,
      selectionStages,
      openDate,
      closeDate,
      isActive: Boolean(form.isActive),
      createdBy: currentUser.userName || "Pengawas",
    };

    const confirmation = await Swal.fire({
      icon: "question",
      title: isEditMode ? "Simpan Perubahan Lamaran?" : "Tambah Lamaran Baru?",
      text: isEditMode
        ? `Perubahan posisi "${title}" akan disimpan.`
        : `Posisi "${title}" akan ditambahkan ke master lamaran.`,
      showCancelButton: true,
      confirmButtonText: isEditMode ? "Ya, Simpan" : "Ya, Tambah",
      cancelButtonText: "Tidak",
      confirmButtonColor: "#1d4ed8",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) {
      await Swal.fire({
        icon: "info",
        title: isEditMode ? "Perubahan Dibatalkan" : "Penambahan Dibatalkan",
        text: isEditMode
          ? "Perubahan lamaran belum disimpan."
          : "Data lamaran belum disimpan.",
        timer: 1500,
        showConfirmButton: false,
      });
      return;
    }

    Swal.fire({
      title: isEditMode ? "Menyimpan Perubahan..." : "Menyimpan Lamaran...",
      html: "Mohon tunggu, data lamaran sedang diproses.",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 900);
      });

      let createdLamaranId = "";
      if (isEditMode) {
        await updateLamaranApi(editingLamaranId, lamaranPayload);
      } else {
        const createResponse = await createLamaranApi(lamaranPayload);
        createdLamaranId = String(
          createResponse?.lamaran?.lamaranUUID || createResponse?.lamaran?.id || ""
        ).trim();
      }

      await refreshVacancies();
      resetForm();
      setEditingVacancy(null);
      setFormStatus({ type: "idle", message: "" });
      Swal.close();

      await Swal.fire({
        icon: "success",
        title: isEditMode
          ? "Lamaran Berhasil Diperbarui"
          : "Lamaran Berhasil Ditambahkan",
        text: isEditMode
          ? "Perubahan data lamaran sudah tersimpan dan akan dipakai di halaman peserta."
          : "Data lamaran sudah masuk dan siap ditampilkan ke peserta sesuai periode.",
        confirmButtonText: "Oke",
        confirmButtonColor: "#1d4ed8",
      });
      handleCloseCreateForm();

      if (!isEditMode) {
        const selectedLamaranId = createdLamaranId;

        const followUpPrompt = await Swal.fire({
          icon: "info",
          title: "Lanjutkan Setting Seleksi Biodata?",
          text: "Lamaran sudah tersimpan. Supaya proses administrasi lebih presisi, sebaiknya lanjut atur seleksi biodata sekarang.",
          showCancelButton: true,
          confirmButtonText: "Atur Sekarang",
          cancelButtonText: "Nanti Saja",
          confirmButtonColor: "#1d4ed8",
          cancelButtonColor: "#64748b",
          reverseButtons: true,
        });

        if (followUpPrompt.isConfirmed) {
          const targetPath = selectedLamaranId
            ? `/pengawas/master-data/seleksi1-biodata?vacancyId=${encodeURIComponent(
                selectedLamaranId
              )}&openModal=1`
            : "/pengawas/master-data/seleksi1-biodata?openModal=1";
          navigate(targetPath);
        }
      }
    } catch (error) {
      Swal.close();
      await Swal.fire({
        icon: "error",
        title: isEditMode
          ? "Gagal Memperbarui Lamaran"
          : "Gagal Menambahkan Lamaran",
        text:
          error instanceof Error
            ? error.message
            : "Terjadi kendala saat menyimpan data. Silakan coba lagi.",
        confirmButtonText: "Tutup",
        confirmButtonColor: "#dc2626",
      });
    }
  };

  const handleToggleStatus = async (vacancy) => {
    if (!vacancy?.id) return;
    if (processingVacancyActionId) return;

    const shouldActivate = !vacancy.isActive;
    const actionLabel = shouldActivate ? "Aktifkan" : "Nonaktifkan";

    const confirmation = await Swal.fire({
      icon: "question",
      title: `${actionLabel} Lamaran?`,
      text: `Apakah Anda yakin ingin ${actionLabel.toLowerCase()} lowongan "${vacancy.title}"?`,
      showCancelButton: true,
      confirmButtonText: `Ya, ${actionLabel}`,
      cancelButtonText: "Batal",
      confirmButtonColor: "#1d4ed8",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) return;

    setProcessingVacancyActionId(vacancy.id);

    Swal.fire({
      title: `${actionLabel} Lowongan...`,
      html: "Mohon tunggu, perubahan status sedang diproses.",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 900);
      });

      await updateLamaranStatusApi(vacancy.id, shouldActivate);
      await refreshVacancies();
      Swal.close();

      await Swal.fire({
        icon: "success",
        title: "Status Berhasil Diperbarui",
        text: shouldActivate
          ? `Lowongan "${vacancy.title}" berhasil diaktifkan.`
          : `Lowongan "${vacancy.title}" berhasil dinonaktifkan.`,
        confirmButtonText: "OK",
        confirmButtonColor: "#1d4ed8",
      });
    } catch (error) {
      Swal.close();
      await Swal.fire({
        icon: "error",
        title: "Gagal Memperbarui Status",
        text:
          error instanceof Error
            ? error.message
            : "Terjadi kendala saat mengubah status lowongan. Silakan coba lagi.",
        confirmButtonText: "Tutup",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setProcessingVacancyActionId("");
    }
  };

  const handleDeleteVacancy = async (vacancy) => {
    if (!vacancy?.id) return;
    if (processingVacancyActionId) return;

    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Hapus Lamaran?",
      text: `Lowongan "${vacancy.title}" akan dihapus dari Master Data.`,
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) return;

    setProcessingVacancyActionId(vacancy.id);

    Swal.fire({
      title: "Menghapus Lowongan...",
      html: "Mohon tunggu, data lowongan sedang dihapus.",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 900);
      });

      const response = await deleteLamaranApi(vacancy.id);
      removeDashboardApplicationsByVacancy(vacancy.id);
      await refreshVacancies();
      Swal.close();

      await Swal.fire({
        icon: "success",
        title: "Lamaran Berhasil Dihapus",
        text:
          String(response?.msg || "").trim() ||
          `Lowongan "${vacancy.title}" sudah dihapus dari Master Data.`,
        confirmButtonText: "OK",
        confirmButtonColor: "#1d4ed8",
      });
    } catch (error) {
      Swal.close();
      await Swal.fire({
        icon: "error",
        title: "Gagal Menghapus Lamaran",
        text:
          error instanceof Error
            ? error.message
            : "Terjadi kendala saat menghapus lowongan. Silakan coba lagi.",
        confirmButtonText: "Tutup",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setProcessingVacancyActionId("");
    }
  };

  const selectionStageItems = Array.isArray(form.selectionStages)
    ? form.selectionStages.filter(Boolean)
    : [];
  const isDirectSelectionFlow = form.selectionFlow === "langsung";

  return (
    <div className="bh-dashboard-shell min-h-screen bg-[#f7fbff] text-[#09275a] lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="bh-dashboard-sidebar-shell border-b border-[#dfe8f5] bg-white p-4 shadow-[12px_0_40px_rgba(20,57,96,0.05)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:border-b-0 lg:border-r lg:px-4 lg:py-8">
        <Sidebar role="pengawas" />
      </aside>

      <main className="bh-dashboard-main min-w-0 px-4 py-6 sm:px-6 lg:px-9 lg:py-10">
        <Header user={{ ...currentUser, role: "pengawas" }} />

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">Master Data</p>
              <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
                Tambah Lamaran Baru
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
                Gunakan form ini untuk menambahkan lowongan baru yang akan tampil ke
                peserta pada menu Lamaran.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Total Master Lamaran</p>
            <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">{summary.total}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Dibuka Saat Ini</p>
            <h3 className="mt-2 text-3xl font-bold text-green-700">{summary.openCount}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Akan Dibuka</p>
            <h3 className="mt-2 text-3xl font-bold text-blue-700">{summary.scheduledCount}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Ditutup / Nonaktif</p>
            <h3 className="mt-2 text-3xl font-bold text-orange-600">{summary.closedCount}</h3>
          </article>
        </section>

        <section className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FiPlusCircle className="text-[#17355e]" />
              <h3 className="text-lg font-bold text-[#102d5b]">Form Tambah Lamaran</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                void handleOpenCreateForm();
              }}
              disabled={isCreateFormVisible}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-4 text-sm font-bold text-[#17477d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiPlusCircle />
              {isCreateFormVisible
                ? isEditMode
                  ? "Form Edit Dibuka"
                  : "Form Sudah Dibuka"
                : "Tambah Lamaran"}
            </button>
          </div>

          {!isCreateFormVisible ? (
            <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
              <p className="text-sm font-semibold text-[#17355e]">
                Form tambah lamaran belum ditampilkan.
              </p>
              <p className="mt-1 text-xs text-[#607792]">
                Tekan tombol <span className="font-semibold">Tambah Lamaran</span> di atas untuk membuka form melalui popup.
              </p>
            </div>
          ) : (
            <>
              <div className="fixed inset-0 z-[80] bg-[rgba(9,28,54,0.45)] backdrop-blur-[2px]" />
              <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                <section className="w-full max-w-6xl max-h-[92vh] overflow-auto rounded-[12px] border border-[#dfe8f5] bg-white p-5 shadow-[0_30px_70px_rgba(10,42,86,0.35)] sm:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {isEditMode ? (
                        <FiEdit3 className="text-[#17355e]" />
                      ) : (
                        <FiPlusCircle className="text-[#17355e]" />
                      )}
                      <h4 className="text-lg font-bold text-[#102d5b]">
                        {isEditMode ? "Form Edit Lamaran" : "Form Tambah Lamaran"}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseCreateForm}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d6dfed] bg-white text-[#274776]"
                      aria-label={isEditMode ? "Tutup form edit lamaran" : "Tutup form tambah lamaran"}
                    >
                      <FiX />
                    </button>
                  </div>
              {formStatus.type !== "idle" && (
                <div
                  className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
                    formStatus.type === "success"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-orange-200 bg-orange-50 text-orange-700"
                  }`}
                >
                  {formStatus.message}
                </div>
              )}

              <form onSubmit={handleSubmit}>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                Judul Posisi
                <input
                  value={form.title}
                  onChange={(event) => handleFieldChange("title", event.target.value)}
                  type="text"
                  className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                  placeholder="Contoh: Relationship Manager"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                Tenaga Ahli
                <input
                  value={form.tenagaAhli}
                  onChange={(event) =>
                    handleFieldChange("tenagaAhli", event.target.value)
                  }
                  type="text"
                  className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                  placeholder="Contoh: Kredit Mikro, IT Core Banking, Legal Officer"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                Lokasi Penempatan
                <input
                  value={form.location}
                  onChange={(event) => handleFieldChange("location", event.target.value)}
                  type="text"
                  className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                  placeholder="Contoh: Mataram, NTB"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                Tipe Pekerjaan
                <select
                  value={form.type}
                  onChange={(event) => handleFieldChange("type", event.target.value)}
                  className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                >
                  {JOB_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                Tanggal Mulai Dibuka
                <input
                  value={form.openDate}
                  onChange={(event) =>
                    handleFieldChange("openDate", event.target.value)
                  }
                  type="date"
                  className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                Tanggal Ditutup
                <input
                  value={form.closeDate}
                  onChange={(event) =>
                    handleFieldChange("closeDate", event.target.value)
                  }
                  type="date"
                  className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b] lg:col-span-2">
                Deskripsi Lamaran
                <textarea
                  value={form.deskripsiLamaran}
                  onChange={(event) =>
                    handleFieldChange("deskripsiLamaran", event.target.value)
                  }
                  className="min-h-[88px] rounded-lg border border-[#d6dfed] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-blue-500"
                  placeholder="Jelaskan tujuan posisi dan konteks kebutuhan tenaga ahli."
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b] lg:col-span-2">
                Ruang Lingkup Pekerjaan
                <textarea
                  value={form.ruangLingkupPekerjaan}
                  onChange={(event) =>
                    handleFieldChange("ruangLingkupPekerjaan", event.target.value)
                  }
                  className="min-h-[88px] rounded-lg border border-[#d6dfed] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-blue-500"
                  placeholder="Uraikan tanggung jawab utama, area kerja, dan output yang diharapkan."
                />
              </label>
              <div className="grid gap-2 text-sm font-semibold text-[#102d5b] lg:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <span>Pendidikan (Bisa pilih lebih dari 1)</span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                    {Array.isArray(form.pendidikan) ? form.pendidikan.length : 0} dipilih
                  </span>
                </div>
                <div className="rounded-lg border border-[#d6dfed] bg-[#fbfdff] p-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {PENDIDIKAN_OPTIONS.map((option) => {
                      const isChecked = Array.isArray(form.pendidikan)
                        ? form.pendidikan.includes(option)
                        : false;

                      return (
                        <label
                          key={option}
                          className="flex items-center gap-2 rounded-md border border-[#e1e8f3] bg-white px-2.5 py-2 text-xs font-semibold text-[#17355e]"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePendidikan(option)}
                            className="h-4 w-4"
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                  <small className="mt-2 block text-xs font-normal text-[#5f7894]">
                    Pilih semua jenjang pendidikan yang diperbolehkan untuk posisi ini.
                  </small>
                </div>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                Kualifikasi
                <textarea
                  value={form.kualifikasiText}
                  onChange={(event) =>
                    handleFieldChange("kualifikasiText", event.target.value)
                  }
                  className="min-h-[130px] rounded-lg border border-[#d6dfed] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-blue-500"
                  placeholder={
                    "Satu kualifikasi per baris.\nContoh: Memahami analisis laporan keuangan."
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                Kompetensi
                <textarea
                  value={form.kompetensiText}
                  onChange={(event) =>
                    handleFieldChange("kompetensiText", event.target.value)
                  }
                  className="min-h-[130px] rounded-lg border border-[#d6dfed] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-blue-500"
                  placeholder={
                    "Satu kompetensi per baris.\nContoh: Negosiasi, problem solving, communication skill."
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                Pengalaman
                <textarea
                  value={form.pengalamanText}
                  onChange={(event) =>
                    handleFieldChange("pengalamanText", event.target.value)
                  }
                  className="min-h-[130px] rounded-lg border border-[#d6dfed] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-blue-500"
                  placeholder={
                    "Satu pengalaman per baris.\nContoh: Pengalaman 2 tahun di bidang audit internal."
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                Karakter yang Dibutuhkan
                <textarea
                  value={form.karakterDibutuhkanText}
                  onChange={(event) =>
                    handleFieldChange("karakterDibutuhkanText", event.target.value)
                  }
                  className="min-h-[130px] rounded-lg border border-[#d6dfed] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-blue-500"
                  placeholder={
                    "Satu karakter per baris.\nContoh: Jujur, teliti, berintegritas, kolaboratif."
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                Dokumen yang Diperlukan
                <textarea
                  value={form.requiredDocumentsText}
                  onChange={(event) =>
                    handleFieldChange("requiredDocumentsText", event.target.value)
                  }
                  className="min-h-[130px] rounded-lg border border-[#d6dfed] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-blue-500"
                  placeholder={"Satu dokumen per baris.\nContoh: Surat lamaran kerja"}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#102d5b] lg:col-span-2">
                Alur Seleksi
                <select
                  value={form.selectionFlow || "berurutan"}
                  onChange={(event) => handleSelectionFlowChange(event.target.value)}
                  className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                >
                  {SELECTION_FLOW_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small className="text-xs font-normal text-[#5f7894]">
                  {form.selectionFlow === "langsung"
                    ? "Mode langsung: hanya 1 tahap seleksi."
                    : "Mode berurutan: boleh tambah banyak tahap dan urutkan sesuai proses."}
                </small>
              </label>
              <div className="grid gap-2 text-sm font-semibold text-[#102d5b] lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Tahapan Seleksi</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                      {selectionStageItems.length} Tahap Tambahan
                    </span>
                    <span className="rounded-full bg-[#eef9ed] px-2.5 py-1 text-[11px] font-bold text-[#2c8f3f]">
                      {isDirectSelectionFlow ? "Mode Langsung" : "Mode Berurutan"}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-[#d6dfed] bg-gradient-to-b from-[#f7fbff] via-white to-[#fbfdff] p-4 sm:p-5">
                  <p className="mb-3 text-xs font-semibold text-[#5b7594]">
                    Tahap Administrasi otomatis menjadi tahap pertama. Isi bagian ini hanya untuk tahap lanjutan setelah Administrasi.
                  </p>

                  <div className="grid gap-3">
                    {selectionStageItems.length === 0 && (
                      <div className="rounded-lg border border-dashed border-[#cbd9ec] bg-white px-4 py-5 text-xs font-normal text-[#607792]">
                        Belum ada tahap lanjutan. Tracking tetap akan memiliki Tahap Administrasi sebagai tahap pertama.
                      </div>
                    )}

                    {selectionStageItems.map((stage, stageIndex, stageList) => (
                      <article
                        key={`stage-${stageIndex + 1}`}
                        className="relative rounded-xl border border-[#d9e3f1] bg-white p-3 sm:p-4"
                      >
                        <div className="grid gap-3 sm:grid-cols-[44px_minmax(0,1fr)]">
                          <div className="relative flex items-start justify-center">
                            {stageIndex < stageList.length - 1 && (
                              <span className="absolute top-10 h-[calc(100%+18px)] w-px bg-[#d7e4f5]" />
                            )}
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1c4f93] text-xs font-bold text-white shadow-[0_8px_16px_rgba(28,79,147,0.25)]">
                              {stageIndex + 1}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-xs font-bold text-[#12345e]">
                                  {isDirectSelectionFlow
                                    ? "Tahap Lanjutan Langsung"
                                    : `Tahap Lanjutan ${stageIndex + 1}`}
                                </p>
                                <p className="text-[11px] font-medium text-[#6b839f]">
                                  {isDirectSelectionFlow
                                    ? "Tahap ini berjalan setelah Administrasi."
                                    : "Tahap lanjutan ini dijalankan setelah Administrasi sesuai urutan nomor."}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                {!isDirectSelectionFlow && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveStage(stageIndex, "up")}
                                      disabled={stageIndex === 0}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#d4dfef] bg-white text-[#2b4f7b] disabled:cursor-not-allowed disabled:opacity-40"
                                      aria-label="Geser tahap ke atas"
                                    >
                                      <FiArrowUp />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveStage(stageIndex, "down")}
                                      disabled={stageIndex === stageList.length - 1}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#d4dfef] bg-white text-[#2b4f7b] disabled:cursor-not-allowed disabled:opacity-40"
                                      aria-label="Geser tahap ke bawah"
                                    >
                                      <FiArrowDown />
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStage(stageIndex)}
                                  className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700"
                                >
                                  <FiTrash2 />
                                  Hapus
                                </button>
                              </div>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="grid gap-1 text-xs font-semibold text-[#102d5b]">
                                Nama Seleksi (Main Form)
                                <input
                                  value={stage.title}
                                  onChange={(event) =>
                                    handleStageChange(stageIndex, "title", event.target.value)
                                  }
                                  type="text"
                                  className="h-10 rounded-md border border-[#d6dfed] bg-white px-2.5 text-xs font-normal outline-none focus:border-blue-500"
                                  placeholder="Contoh: Tes Kompetensi"
                                />
                              </label>
                              <label className="grid gap-1 text-xs font-semibold text-[#102d5b] sm:col-span-2">
                                Keterangan Seleksi (Sub Form)
                                <textarea
                                  value={stage.description}
                                  onChange={(event) =>
                                    handleStageChange(
                                      stageIndex,
                                      "description",
                                      event.target.value
                                    )
                                  }
                                  className="min-h-[70px] rounded-md border border-[#d6dfed] bg-white px-2.5 py-2 text-xs font-normal outline-none focus:border-blue-500"
                                  placeholder="Contoh: Pendalaman karakter, motivasi, dan budaya kerja."
                                />
                              </label>
                              <div className="grid gap-2 rounded-lg border border-[#dce6f3] bg-[#fbfdff] p-3 sm:col-span-2 sm:grid-cols-2 lg:grid-cols-4">
                                <label className="grid gap-1 text-xs font-semibold text-[#102d5b]">
                                  Tanggal Mulai
                                  <input
                                    value={stage.startDate || ""}
                                    onChange={(event) =>
                                      handleStageChange(
                                        stageIndex,
                                        "startDate",
                                        event.target.value
                                      )
                                    }
                                    type="date"
                                    className="h-10 rounded-md border border-[#d6dfed] bg-white px-2.5 text-xs font-normal outline-none focus:border-blue-500"
                                  />
                                </label>
                                <label className="grid gap-1 text-xs font-semibold text-[#102d5b]">
                                  Tanggal Selesai
                                  <input
                                    value={stage.endDate || ""}
                                    onChange={(event) =>
                                      handleStageChange(
                                        stageIndex,
                                        "endDate",
                                        event.target.value
                                      )
                                    }
                                    type="date"
                                    className="h-10 rounded-md border border-[#d6dfed] bg-white px-2.5 text-xs font-normal outline-none focus:border-blue-500"
                                  />
                                </label>
                                <label className="grid gap-1 text-xs font-semibold text-[#102d5b]">
                                  Jam Mulai
                                  <input
                                    value={stage.startTime || ""}
                                    onChange={(event) =>
                                      handleStageChange(
                                        stageIndex,
                                        "startTime",
                                        event.target.value
                                      )
                                    }
                                    type="time"
                                    className="h-10 rounded-md border border-[#d6dfed] bg-white px-2.5 text-xs font-normal outline-none focus:border-blue-500"
                                  />
                                </label>
                                <label className="grid gap-1 text-xs font-semibold text-[#102d5b]">
                                  Jam Selesai
                                  <input
                                    value={stage.endTime || ""}
                                    onChange={(event) =>
                                      handleStageChange(
                                        stageIndex,
                                        "endTime",
                                        event.target.value
                                      )
                                    }
                                    type="time"
                                    className="h-10 rounded-md border border-[#d6dfed] bg-white px-2.5 text-xs font-normal outline-none focus:border-blue-500"
                                  />
                                </label>
                                <small className="text-[11px] font-normal leading-relaxed text-[#607792] sm:col-span-2 lg:col-span-4">
                                  Isi lengkap jika tahap ini memiliki batas waktu pelaksanaan.
                                </small>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    {isDirectSelectionFlow ? (
                      <p className="text-xs font-normal text-[#607792]">
                        Mode langsung aktif. Jika dibutuhkan, gunakan satu tahap lanjutan setelah Administrasi.
                      </p>
                    ) : (
                      <p className="text-xs font-normal text-[#607792]">
                        Tambahkan tahap lanjutan sesuai kebutuhan, lalu atur urutannya.
                      </p>
                    )}

                    {(!isDirectSelectionFlow || selectionStageItems.length === 0) && (
                      <button
                        type="button"
                        onClick={handleAddStage}
                        className="inline-flex items-center gap-1 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-3 py-1.5 text-xs font-semibold text-[#17477d]"
                      >
                        <FiPlusCircle />
                        Tambah Tahap Seleksi
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-lg border border-[#d6dfed] bg-[#fbfdff] p-4 text-sm font-semibold text-[#102d5b]">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => handleFieldChange("isActive", event.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                Aktifkan lamaran ini setelah disimpan.
                <small className="mt-1 block text-xs font-normal leading-relaxed text-[#607792]">
                  Lamaran aktif yang masih dalam periode buka akan tampil di halaman Lamaran peserta.
                </small>
              </span>
            </label>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  if (isEditMode) {
                    handleCloseCreateForm();
                    return;
                  }
                  navigate("/dashboard");
                }}
                className="h-11 rounded-md border border-[#d6dfed] bg-white px-5 text-sm font-bold text-[#102d5b]"
              >
                {isEditMode ? "Batal Edit" : "Kembali ke Dashboard"}
              </button>
              <button
                type="submit"
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#347dec] to-[#0c3a78] px-6 text-sm font-bold text-white shadow-[0_14px_26px_rgba(19,77,153,0.25)]"
              >
                <FiSave />
                {isEditMode ? "Simpan Perubahan" : "Simpan Lamaran"}
              </button>
            </div>
              </form>
                </section>
              </div>
            </>
          )}
        </section>

        <section className="mt-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FiBriefcase className="text-[#17355e]" />
            <h3 className="text-lg font-bold text-[#102d5b]">Daftar Master Lamaran</h3>
          </div>

          {masterVacancies.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
              <FiFileText className="mx-auto text-2xl text-[#5b7390]" />
              <p className="mt-2 text-sm text-[#607792]">
                Belum ada lamaran yang ditambahkan oleh pengawas.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {masterVacancies.map((vacancy) => {
                const vacancyStatus = getVacancyOpenStatus(vacancy);
                const statusPresentation = getStatusPresentation(vacancyStatus);
                const isProcessingThisVacancy = processingVacancyActionId === vacancy.id;
                const isAnyVacancyActionRunning = Boolean(processingVacancyActionId);

                return (
                  <article
                    key={vacancy.id}
                    className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-[#102d5b]">{vacancy.title}</h4>
                        <p className="mt-1 text-xs text-[#607792]">
                          {(vacancy.tenagaAhli || vacancy.department || "-")} - {vacancy.location} - {vacancy.type}
                        </p>
                      </div>
                      <span
                        className={`w-max rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusPresentation.tone}`}
                      >
                        {statusPresentation.label}
                      </span>
                    </div>

                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-[#4e6885]">
                      <FiCalendar />
                      {formatDateLabel(vacancy.openDate)} - {formatDateLabel(vacancy.closeDate)}
                    </p>

                    <p className="mt-3 text-xs leading-relaxed text-[#506783]">
                      {vacancy.description}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditForm(vacancy)}
                        disabled={isAnyVacancyActionRunning || isCreateFormVisible}
                        className="inline-flex items-center gap-1 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-3 py-1.5 text-xs font-semibold text-[#17477d] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiEdit3 />
                        Edit Lamaran
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleToggleStatus(vacancy);
                        }}
                        disabled={isAnyVacancyActionRunning}
                        className="rounded-md border border-[#d4dfef] bg-white px-3 py-1.5 text-xs font-semibold text-[#20406a] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isProcessingThisVacancy
                          ? "Memproses..."
                          : vacancy.isActive
                            ? "Nonaktifkan"
                            : "Aktifkan"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/pengawas/master-data/seleksi1-biodata?vacancyId=${encodeURIComponent(
                              vacancy.id
                            )}&openModal=1`
                          )
                        }
                        className="rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-3 py-1.5 text-xs font-semibold text-[#17477d]"
                      >
                        Atur Seleksi Biodata
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDeleteVacancy(vacancy);
                        }}
                        disabled={isAnyVacancyActionRunning}
                        className="inline-flex items-center gap-1 rounded-md border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiTrash2 />
                        Hapus
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-[10px] border border-[#dfe8f5] bg-gradient-to-r from-[#eef9ed] via-white to-[#edf6ff] p-4 shadow-[0_12px_28px_rgba(21,54,92,0.05)] sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-green-600">
              <FiShield />
            </span>
            <div>
              <h4 className="text-sm font-bold text-[#10315f]">
                Rekomendasi Pengelolaan Lowongan
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-[#4c6685]">
                Gunakan deskripsi yang jelas, durasi realistis, dan persyaratan terukur
                agar kandidat yang mendaftar lebih sesuai dengan kebutuhan posisi.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default TambahLamaran;


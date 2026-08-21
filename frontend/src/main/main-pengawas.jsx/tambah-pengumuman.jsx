import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiBell,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiEdit3,
  FiSearch,
  FiSend,
  FiShield,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import Swal from "sweetalert2";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardUser } from "../../utils/authUser";
import { getAlertThemeConfig } from "../../utils/alertTheme";
import { getMasterVacancies, getVacancyOpenStatus } from "../../utils/masterVacancies";
import {
  activatePengawasAnnouncement,
  ANNOUNCEMENT_TARGET_MODE_ALL,
  ANNOUNCEMENT_TARGET_MODE_SELECTED,
  addPengawasAnnouncement,
  deletePengawasAnnouncement,
  getPengawasAnnouncements,
  updatePengawasAnnouncement,
} from "../../utils/notifications";

const ANNOUNCEMENT_TONE_OPTIONS = [
  { value: "blue", label: "Informasi" },
  { value: "green", label: "Positif" },
  { value: "orange", label: "Peringatan" },
  { value: "red", label: "Penting" },
];
const ANNOUNCEMENT_FORM_MODE_CREATE = "create";
const ANNOUNCEMENT_FORM_MODE_EDIT = "edit";

function cleanText(value) {
  return String(value || "").trim();
}

function formatDateTime(value) {
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

function getVacancyStatusLabel(vacancy) {
  const status = getVacancyOpenStatus(vacancy);
  if (status === "open") return "Dibuka";
  if (status === "scheduled") return "Terjadwal";
  if (status === "expired") return "Berakhir";
  return "Nonaktif";
}

function getAnnouncementToneBadge(tone) {
  if (tone === "green") {
    return "bg-green-100 text-green-700";
  }

  if (tone === "orange") {
    return "bg-orange-100 text-orange-700";
  }

  if (tone === "red") {
    return "bg-red-100 text-red-700";
  }

  return "bg-blue-100 text-blue-700";
}

function getDefaultForm() {
  return {
    title: "",
    message: "",
    tone: "blue",
    targetMode: ANNOUNCEMENT_TARGET_MODE_SELECTED,
    targetVacancyIds: [],
  };
}

function TambahPengumuman() {
  const currentUser = getDashboardUser();
  const [form, setForm] = useState(() => getDefaultForm());
  const [isCreateFormVisible, setIsCreateFormVisible] = useState(false);
  const [formMode, setFormMode] = useState(ANNOUNCEMENT_FORM_MODE_CREATE);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState("");
  const [masterVacancies, setMasterVacancies] = useState(() => getMasterVacancies());
  const [announcements, setAnnouncements] = useState(() => getPengawasAnnouncements());
  const [processingAnnouncementId, setProcessingAnnouncementId] = useState("");
  const [targetDropdownOpen, setTargetDropdownOpen] = useState(false);
  const [targetSearchKeyword, setTargetSearchKeyword] = useState("");
  const targetDropdownRef = useRef(null);

  const refreshData = () => {
    setMasterVacancies(getMasterVacancies());
    setAnnouncements(getPengawasAnnouncements());
  };

  useEffect(() => {
    const handleRefresh = () => {
      refreshData();
    };

    window.addEventListener("focus", handleRefresh);
    window.addEventListener("storage", handleRefresh);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("storage", handleRefresh);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!targetDropdownRef.current?.contains(event.target)) {
        setTargetDropdownOpen(false);
      }
    };

    if (targetDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [targetDropdownOpen]);

  useEffect(() => {
    if (!isCreateFormVisible) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      handleCloseCreateForm();
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isCreateFormVisible]);

  const activeVacancies = useMemo(
    () =>
      masterVacancies
        .filter((vacancy) => ["open", "scheduled"].includes(getVacancyOpenStatus(vacancy)))
        .sort((left, right) => {
          const leftTitle = cleanText(left.title).toLowerCase();
          const rightTitle = cleanText(right.title).toLowerCase();
          return leftTitle.localeCompare(rightTitle);
        }),
    [masterVacancies]
  );

  const filteredTargetVacancies = useMemo(() => {
    const keyword = cleanText(targetSearchKeyword).toLowerCase();
    if (!keyword) return activeVacancies;

    return activeVacancies.filter((vacancy) => {
      return (
        cleanText(vacancy.title).toLowerCase().includes(keyword) ||
        cleanText(vacancy.department).toLowerCase().includes(keyword) ||
        cleanText(vacancy.location).toLowerCase().includes(keyword)
      );
    });
  }, [activeVacancies, targetSearchKeyword]);

  const selectedTargetVacancies = useMemo(() => {
    const selectedIdSet = new Set(form.targetVacancyIds);
    return activeVacancies.filter((vacancy) => selectedIdSet.has(vacancy.id));
  }, [activeVacancies, form.targetVacancyIds]);

  const summary = useMemo(() => {
    const total = announcements.length;
    const active = announcements.filter((item) => item.isActive).length;
    const draft = total - active;

    return {
      total,
      active,
      draft,
    };
  }, [announcements]);

  const editingAnnouncement = useMemo(() => {
    if (!editingAnnouncementId) return null;
    return (
      announcements.find((announcement) => announcement.id === editingAnnouncementId) || null
    );
  }, [announcements, editingAnnouncementId]);

  const isEditingForm = formMode === ANNOUNCEMENT_FORM_MODE_EDIT;

  const toggleTargetVacancy = (vacancyId) => {
    setForm((prevForm) => {
      const currentSet = new Set(prevForm.targetVacancyIds);

      if (currentSet.has(vacancyId)) {
        currentSet.delete(vacancyId);
      } else {
        currentSet.add(vacancyId);
      }

      return {
        ...prevForm,
        targetVacancyIds: activeVacancies
          .map((vacancy) => vacancy.id)
          .filter((id) => currentSet.has(id)),
      };
    });
  };

  const resetForm = () => {
    setForm(getDefaultForm());
    setTargetSearchKeyword("");
    setTargetDropdownOpen(false);
  };

  const resolveVacancyTitlesByIds = (vacancyIds) => {
    const safeIds = Array.isArray(vacancyIds) ? vacancyIds.map((item) => cleanText(item)) : [];
    const idSet = new Set(safeIds.filter(Boolean));
    if (idSet.size === 0) return [];

    return masterVacancies
      .filter((vacancy) => idSet.has(cleanText(vacancy.id)))
      .map((vacancy) => cleanText(vacancy.title))
      .filter(Boolean);
  };

  const handleCloseCreateForm = () => {
    setIsCreateFormVisible(false);
    setFormMode(ANNOUNCEMENT_FORM_MODE_CREATE);
    setEditingAnnouncementId("");
    resetForm();
  };

  const handleOpenCreateForm = () => {
    resetForm();
    setFormMode(ANNOUNCEMENT_FORM_MODE_CREATE);
    setEditingAnnouncementId("");
    setIsCreateFormVisible(true);
  };

  const handleOpenEditForm = (announcement) => {
    const safeAnnouncement =
      announcement && typeof announcement === "object" ? announcement : null;
    if (!safeAnnouncement?.id) return;

    setForm({
      title: cleanText(safeAnnouncement.title),
      message: cleanText(safeAnnouncement.message),
      tone: cleanText(safeAnnouncement.tone) || "blue",
      targetMode:
        cleanText(safeAnnouncement.targetMode) === ANNOUNCEMENT_TARGET_MODE_SELECTED
          ? ANNOUNCEMENT_TARGET_MODE_SELECTED
          : ANNOUNCEMENT_TARGET_MODE_ALL,
      targetVacancyIds: Array.isArray(safeAnnouncement.targetVacancyIds)
        ? safeAnnouncement.targetVacancyIds.map((item) => cleanText(item)).filter(Boolean)
        : [],
    });
    setTargetSearchKeyword("");
    setTargetDropdownOpen(false);
    setFormMode(ANNOUNCEMENT_FORM_MODE_EDIT);
    setEditingAnnouncementId(safeAnnouncement.id);
    setIsCreateFormVisible(true);
  };

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault();

    const title = cleanText(form.title);
    const message = cleanText(form.message);

    if (!title) {
      const warningTheme = getAlertThemeConfig("publishWarning");
      await Swal.fire({
        icon: "warning",
        title: "Judul Belum Diisi",
        text: "Judul pengumuman wajib diisi.",
        confirmButtonText: "Tutup",
        background: warningTheme.background,
        color: warningTheme.color,
        iconColor: warningTheme.iconColor,
        confirmButtonColor: warningTheme.confirmButtonColor,
      });
      return;
    }

    if (!message) {
      const warningTheme = getAlertThemeConfig("publishWarning");
      await Swal.fire({
        icon: "warning",
        title: "Isi Pengumuman Belum Lengkap",
        text: "Isi pengumuman wajib diisi agar peserta menerima informasi yang jelas.",
        confirmButtonText: "Tutup",
        background: warningTheme.background,
        color: warningTheme.color,
        iconColor: warningTheme.iconColor,
        confirmButtonColor: warningTheme.confirmButtonColor,
      });
      return;
    }

    if (
      form.targetMode === ANNOUNCEMENT_TARGET_MODE_SELECTED &&
      form.targetVacancyIds.length === 0
    ) {
      const warningTheme = getAlertThemeConfig("publishWarning");
      await Swal.fire({
        icon: "warning",
        title: "Tujuan Pengumuman Belum Dipilih",
        text: "Pilih minimal satu lamaran tujuan agar pengumuman tepat sasaran.",
        confirmButtonText: "Tutup",
        background: warningTheme.background,
        color: warningTheme.color,
        iconColor: warningTheme.iconColor,
        confirmButtonColor: warningTheme.confirmButtonColor,
      });
      return;
    }

    const targetTitles =
      form.targetMode === ANNOUNCEMENT_TARGET_MODE_ALL
        ? []
        : resolveVacancyTitlesByIds(form.targetVacancyIds);
    const targetDescription =
      form.targetMode === ANNOUNCEMENT_TARGET_MODE_ALL
        ? "Semua peserta yang sudah melamar"
        : `${form.targetVacancyIds.length} lamaran terpilih`;

    const confirmTheme = getAlertThemeConfig("publishConfirm");
    const confirmation = await Swal.fire({
      icon: "question",
      title: isEditingForm ? "Simpan Perubahan Pengumuman?" : "Simpan Draft Pengumuman?",
      text: isEditingForm
        ? `Perubahan pengumuman akan disimpan dengan target: ${targetDescription}.`
        : `Pengumuman akan disimpan sebagai draft dengan target: ${targetDescription}.`,
      showCancelButton: true,
      confirmButtonText: isEditingForm ? "Ya, Simpan Perubahan" : "Ya, Simpan Draft",
      cancelButtonText: "Batal",
      background: confirmTheme.background,
      color: confirmTheme.color,
      iconColor: confirmTheme.iconColor,
      confirmButtonColor: confirmTheme.confirmButtonColor,
      cancelButtonColor: confirmTheme.cancelButtonColor,
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) return;

    const loadingTheme = getAlertThemeConfig("publishLoading");

    Swal.fire({
      title: isEditingForm ? "Menyimpan Perubahan..." : "Menyimpan Draft...",
      text: "Mohon tunggu, data pengumuman sedang diproses.",
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

    const announcementPayload = {
      title,
      message,
      tone: form.tone,
      targetMode: form.targetMode,
      targetVacancyIds:
        form.targetMode === ANNOUNCEMENT_TARGET_MODE_ALL ? [] : form.targetVacancyIds,
      targetVacancyTitles:
        form.targetMode === ANNOUNCEMENT_TARGET_MODE_ALL ? [] : targetTitles,
    };

    let nextAnnouncements = [];
    if (isEditingForm && editingAnnouncement?.id) {
      const updateResult = updatePengawasAnnouncement(editingAnnouncement.id, {
        ...announcementPayload,
        isActive: Boolean(editingAnnouncement.isActive),
      });
      nextAnnouncements = updateResult.announcements;
    } else {
      nextAnnouncements = addPengawasAnnouncement({
        ...announcementPayload,
        createdBy: currentUser.userName || "pengawas",
        isActive: false,
      });
    }

    setAnnouncements(nextAnnouncements);
    Swal.close();

    const successTheme = getAlertThemeConfig("publishSuccess");
    await Swal.fire({
      icon: "success",
      title: isEditingForm ? "Perubahan Berhasil Disimpan" : "Draft Berhasil Disimpan",
      text: isEditingForm
        ? "Pengumuman berhasil diperbarui."
        : "Pengumuman sudah masuk daftar draft. Tekan tombol Aktifkan untuk langsung kirim ke peserta.",
      confirmButtonText: "OK",
      background: successTheme.background,
      color: successTheme.color,
      iconColor: successTheme.iconColor,
      confirmButtonColor: successTheme.confirmButtonColor,
    });

    handleCloseCreateForm();
  };

  const handleActivateAnnouncement = async (announcement) => {
    if (!announcement?.id) return;
    if (processingAnnouncementId) return;

    const confirmTheme = getAlertThemeConfig("publishConfirm");
    const confirmation = await Swal.fire({
      icon: "question",
      title: "Aktifkan Pengumuman?",
      html: `Pengumuman <b>${announcement.title}</b> akan langsung dikirim ke peserta sesuai tujuan lamaran.<br/><br/>Lanjutkan aktivasi sekarang?`,
      showCancelButton: true,
      confirmButtonText: "Ya, Aktifkan & Kirim",
      cancelButtonText: "Batal",
      background: confirmTheme.background,
      color: confirmTheme.color,
      iconColor: confirmTheme.iconColor,
      confirmButtonColor: confirmTheme.confirmButtonColor,
      cancelButtonColor: confirmTheme.cancelButtonColor,
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) return;

    setProcessingAnnouncementId(announcement.id);

    const loadingTheme = getAlertThemeConfig("publishLoading");

    Swal.fire({
      title: "Mengirim Pengumuman...",
      text: "Sistem sedang mengaktifkan dan mengirim pengumuman ke peserta.",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      background: loadingTheme.background,
      color: loadingTheme.color,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 900);
      });

      const result = activatePengawasAnnouncement(announcement.id);
      setAnnouncements(result.announcements);
      Swal.close();

      const successTheme = getAlertThemeConfig("publishSuccess");
      await Swal.fire({
        icon: "success",
        title: "Pengumuman Aktif",
        text: "Pengumuman berhasil diaktifkan dan sudah dikirim ke peserta sesuai target lamaran.",
        confirmButtonText: "OK",
        background: successTheme.background,
        color: successTheme.color,
        iconColor: successTheme.iconColor,
        confirmButtonColor: successTheme.confirmButtonColor,
      });
    } finally {
      setProcessingAnnouncementId("");
    }
  };

  const handleDeleteAnnouncement = async (announcement) => {
    if (!announcement?.id) return;
    if (processingAnnouncementId) return;

    const confirmTheme = getAlertThemeConfig("publishConfirm");
    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Hapus Pengumuman?",
      html: `Pengumuman <b>${announcement.title}</b> akan dihapus permanen dari daftar.<br/><br/>Lanjutkan hapus sekarang?`,
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",
      background: confirmTheme.background,
      color: confirmTheme.color,
      iconColor: confirmTheme.iconColor,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: confirmTheme.cancelButtonColor,
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) return;

    const loadingTheme = getAlertThemeConfig("publishLoading");

    Swal.fire({
      title: "Menghapus Pengumuman...",
      text: "Mohon tunggu, data pengumuman sedang dihapus.",
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
      window.setTimeout(resolve, 700);
    });

    const result = deletePengawasAnnouncement(announcement.id);
    setAnnouncements(result.announcements);
    Swal.close();

    if (editingAnnouncementId === announcement.id) {
      handleCloseCreateForm();
    }

    const successTheme = getAlertThemeConfig("publishSuccess");
    await Swal.fire({
      icon: "success",
      title: "Pengumuman Dihapus",
      text: "Pengumuman berhasil dihapus dari daftar.",
      confirmButtonText: "OK",
      background: successTheme.background,
      color: successTheme.color,
      iconColor: successTheme.iconColor,
      confirmButtonColor: successTheme.confirmButtonColor,
    });
  };

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
                Tambah Pengumuman Peserta
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
                Pengawas dapat membuat pengumuman lalu menargetkan ke peserta sesuai
                lamaran yang dipilih. Pengumuman baru akan terkirim saat tombol aktifkan
                ditekan.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateForm}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#347dec] to-[#0c3a78] px-4 text-sm font-bold text-white shadow-[0_14px_26px_rgba(19,77,153,0.25)]"
            >
              <FiBell />
              Tambah Pengumuman
            </button>
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Total Pengumuman</p>
            <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">{summary.total}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Draft</p>
            <h3 className="mt-2 text-3xl font-bold text-orange-700">{summary.draft}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Aktif & Terkirim</p>
            <h3 className="mt-2 text-3xl font-bold text-green-700">{summary.active}</h3>
          </article>
        </section>

        {isCreateFormVisible && (
          <div
            className="fixed inset-0 z-[90] bg-[rgba(8,27,53,0.52)] p-3 backdrop-blur-[3px] sm:p-5"
            onMouseDown={handleCloseCreateForm}
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
                    <FiEdit3 className="text-[#17355e]" />
                    <h3 className="text-lg font-bold text-[#102d5b]">
                      {isEditingForm ? "Form Edit Pengumuman" : "Form Tambah Pengumuman"}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-[#5f7894]">
                    {isEditingForm
                      ? "Perbarui isi pengumuman dan simpan perubahan."
                      : "Susun draft pengumuman, pilih target peserta, lalu simpan."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseCreateForm}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d6dfed] bg-white text-[#17355e] transition hover:bg-[#f4f8ff]"
                  aria-label={
                    isEditingForm
                      ? "Tutup modal edit pengumuman"
                      : "Tutup modal tambah pengumuman"
                  }
                >
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleCreateAnnouncement} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold text-[#102d5b] lg:col-span-2">
                      Judul Pengumuman
                      <input
                        value={form.title}
                        onChange={(event) =>
                          setForm((prevForm) => ({ ...prevForm, title: event.target.value }))
                        }
                        type="text"
                        className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                        placeholder="Contoh: Pengumuman Tes Psikotes Gelombang 1"
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                      Tone Pengumuman
                      <select
                        value={form.tone}
                        onChange={(event) =>
                          setForm((prevForm) => ({ ...prevForm, tone: event.target.value }))
                        }
                        className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                      >
                        {ANNOUNCEMENT_TONE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                      Tujuan Pengumuman
                      <div className="grid gap-2 rounded-lg border border-[#d6dfed] bg-[#fbfdff] p-3 text-sm font-normal text-[#203b63]">
                        <label className="inline-flex items-start gap-2">
                          <input
                            type="radio"
                            name="targetMode"
                            value={ANNOUNCEMENT_TARGET_MODE_SELECTED}
                            checked={form.targetMode === ANNOUNCEMENT_TARGET_MODE_SELECTED}
                            onChange={(event) =>
                              setForm((prevForm) => ({
                                ...prevForm,
                                targetMode: event.target.value,
                              }))
                            }
                            className="mt-1 h-4 w-4"
                          />
                          <span>Peserta berdasarkan lamaran tertentu</span>
                        </label>
                        <label className="inline-flex items-start gap-2">
                          <input
                            type="radio"
                            name="targetMode"
                            value={ANNOUNCEMENT_TARGET_MODE_ALL}
                            checked={form.targetMode === ANNOUNCEMENT_TARGET_MODE_ALL}
                            onChange={(event) =>
                              setForm((prevForm) => ({
                                ...prevForm,
                                targetMode: event.target.value,
                                targetVacancyIds: [],
                              }))
                            }
                            className="mt-1 h-4 w-4"
                          />
                          <span>Semua peserta yang sudah melamar</span>
                        </label>
                      </div>
                    </div>

                    {form.targetMode === ANNOUNCEMENT_TARGET_MODE_SELECTED && (
                      <div className="grid gap-2 text-sm font-semibold text-[#102d5b] lg:col-span-2">
                        Pilih Lamaran Tujuan

                        <div className="relative" ref={targetDropdownRef}>
                          <button
                            type="button"
                            onClick={() => setTargetDropdownOpen((prevOpen) => !prevOpen)}
                            className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[#d6dfed] bg-white px-3 text-left text-sm font-normal text-[#203b63]"
                          >
                            <span className="truncate">
                              {selectedTargetVacancies.length === 0
                                ? "Pilih lamaran tujuan"
                                : selectedTargetVacancies.length <= 2
                                  ? selectedTargetVacancies.map((item) => item.title).join(", ")
                                  : `${selectedTargetVacancies.length} lamaran dipilih`}
                            </span>
                            <FiChevronDown
                              className={`shrink-0 transition ${
                                targetDropdownOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          {targetDropdownOpen && (
                            <div className="absolute z-40 mt-2 w-full rounded-lg border border-[#d6dfed] bg-white shadow-[0_18px_38px_rgba(18,53,95,0.13)]">
                              <div className="border-b border-[#e4ebf7] p-2">
                                <div className="flex h-9 items-center gap-2 rounded-md border border-[#d6dfed] px-2.5">
                                  <FiSearch className="text-[#5f7894]" />
                                  <input
                                    value={targetSearchKeyword}
                                    onChange={(event) =>
                                      setTargetSearchKeyword(event.target.value)
                                    }
                                    type="text"
                                    className="h-full w-full border-0 bg-transparent text-sm font-normal outline-none"
                                    placeholder="Cari judul/departemen/lokasi"
                                  />
                                </div>
                              </div>

                              <div className="max-h-56 overflow-auto p-1.5">
                                {filteredTargetVacancies.length === 0 ? (
                                  <p className="px-2.5 py-2 text-xs text-[#6f87a3]">
                                    Data lamaran tidak ditemukan.
                                  </p>
                                ) : (
                                  filteredTargetVacancies.map((vacancy) => {
                                    const isChecked = form.targetVacancyIds.includes(vacancy.id);

                                    return (
                                      <button
                                        key={vacancy.id}
                                        type="button"
                                        onClick={() => toggleTargetVacancy(vacancy.id)}
                                        className={`mb-1 w-full rounded-md px-2.5 py-2 text-left text-xs ${
                                          isChecked
                                            ? "bg-blue-50 text-blue-700"
                                            : "text-[#1d406d] hover:bg-[#f5f9ff]"
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <p className="font-semibold">{vacancy.title}</p>
                                            <p className="mt-0.5 text-[11px] text-[#637d99]">
                                              {vacancy.department} - {vacancy.location}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="rounded-full bg-[#e9eff9] px-2 py-0.5 text-[10px] font-semibold text-[#4f6886]">
                                              {getVacancyStatusLabel(vacancy)}
                                            </span>
                                            {isChecked && <FiCheck className="text-blue-600" />}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {selectedTargetVacancies.length > 0 && (
                          <div className="flex flex-wrap gap-2 rounded-lg border border-[#e4ebf7] bg-[#fbfdff] p-2.5">
                            {selectedTargetVacancies.map((vacancy) => (
                              <span
                                key={`chip-${vacancy.id}`}
                                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700"
                              >
                                {vacancy.title}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <label className="grid gap-2 text-sm font-semibold text-[#102d5b] lg:col-span-2">
                      Isi Pengumuman
                      <textarea
                        value={form.message}
                        onChange={(event) =>
                          setForm((prevForm) => ({ ...prevForm, message: event.target.value }))
                        }
                        className="min-h-[130px] rounded-lg border border-[#d6dfed] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-blue-500"
                        placeholder="Tulis isi pengumuman untuk peserta..."
                      />
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-[#e4ebf7] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <button
                    type="button"
                    onClick={handleCloseCreateForm}
                    className="h-11 rounded-md border border-[#d6dfed] bg-white px-5 text-sm font-bold text-[#102d5b]"
                  >
                    Tutup Form
                  </button>
                  <button
                    type="submit"
                    className="flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#347dec] to-[#0c3a78] px-6 text-sm font-bold text-white shadow-[0_14px_26px_rgba(19,77,153,0.25)]"
                  >
                    <FiClock />
                    {isEditingForm ? "Simpan Perubahan" : "Simpan Draft Pengumuman"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        <section className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FiBell className="text-[#17355e]" />
            <h3 className="text-lg font-bold text-[#102d5b]">Daftar Pengumuman</h3>
          </div>

          {announcements.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
              <FiShield className="mx-auto text-2xl text-[#5b7390]" />
              <p className="mt-2 text-sm text-[#607792]">
                Belum ada pengumuman. Gunakan tombol Tambah Pengumuman untuk membuat
                draft baru.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {announcements.map((announcement) => {
                const isProcessingThisItem = processingAnnouncementId === announcement.id;
                const isAnyItemProcessing = Boolean(processingAnnouncementId);
                const targetLabel =
                  announcement.targetMode === ANNOUNCEMENT_TARGET_MODE_ALL
                    ? "Semua peserta yang sudah melamar"
                    : announcement.targetVacancyTitles.length > 0
                      ? announcement.targetVacancyTitles.join(", ")
                      : `${announcement.targetVacancyIds.length} lamaran terpilih`;

                return (
                  <article
                    key={announcement.id}
                    className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-[#102d5b]">{announcement.title}</h4>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getAnnouncementToneBadge(
                              announcement.tone
                            )}`}
                          >
                            {ANNOUNCEMENT_TONE_OPTIONS.find(
                              (option) => option.value === announcement.tone
                            )?.label || "Informasi"}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              announcement.isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {announcement.isActive ? "Aktif" : "Draft"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-[#4f6886]">
                          {announcement.message}
                        </p>
                        <p className="mt-2 text-[11px] text-[#607792]">
                          Tujuan: {targetLabel}
                        </p>
                        <p className="mt-1 text-[11px] text-[#607792]">
                          Dibuat: {formatDateTime(announcement.createdAt)}
                          {announcement.isActive && announcement.activatedAt
                            ? ` | Aktif sejak: ${formatDateTime(announcement.activatedAt)}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditForm(announcement)}
                        disabled={isAnyItemProcessing}
                        className="inline-flex items-center gap-1 rounded-md border border-[#d4e0f3] bg-white px-3 py-1.5 text-xs font-semibold text-[#17477d] hover:bg-[#f5f9ff] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiEdit3 />
                        Edit Pengumuman
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDeleteAnnouncement(announcement);
                        }}
                        disabled={isAnyItemProcessing}
                        className="inline-flex items-center gap-1 rounded-md border border-[#f4d2d2] bg-[#fff5f5] px-3 py-1.5 text-xs font-semibold text-[#b42323] hover:bg-[#ffe9e9] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiTrash2 />
                        Hapus Pengumuman
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleActivateAnnouncement(announcement);
                        }}
                        disabled={announcement.isActive || isAnyItemProcessing}
                        className="inline-flex items-center gap-1 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-3 py-1.5 text-xs font-semibold text-[#17477d] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiSend />
                        {isProcessingThisItem
                          ? "Mengirim..."
                          : announcement.isActive
                            ? "Sudah Aktif"
                            : "Aktifkan Pengumuman"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default TambahPengumuman;

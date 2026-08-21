import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiEye,
  FiFilter,
  FiLock,
  FiPlusCircle,
  FiSave,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUsers,
  FiX,
} from "react-icons/fi";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardApplications } from "../../utils/applications";
import { getAlertThemeConfig } from "../../utils/alertTheme";
import { getDashboardUser, updateDashboardUser } from "../../utils/authUser";
import { PROFILE_LAYER_FIELDS } from "../../utils/profileCriteria";
import {
  createUserApi,
  deleteUserApi,
  getPegawaiLookupApi,
  getUsersApi,
  updateUserPasswordApi,
  updateUserProfileApi,
} from "../../utils/authApi";

const LAMARAN_FILTER_ALL = "all";
const LAMARAN_FILTER_NONE = "without-application";
const ROLE_WITH_OFFICE_META = new Set(["superadmin", "pengawas"]);
const PEGAWAI_LOOKUP_LIMIT = 2000;
const JABATAN_OPTIONS = [
  "Direktur Utama",
  "Direktur",
  "Kepala Divisi",
  "Kepala Bagian",
  "Supervisor",
  "Pengawas Rekrutmen",
  "Staf SDM",
  "Staf Operasional",
  "Staf Kredit",
  "Staf IT",
  "Admin",
];
const UNIT_KERJA_OPTIONS = [
  "Direksi",
  "Divisi SDM",
  "Divisi Operasional",
  "Divisi Bisnis",
  "Divisi Kredit",
  "Divisi Kepatuhan",
  "Divisi TI",
  "Divisi Audit Internal",
  "Divisi Legal",
  "Divisi Keuangan",
  "Kantor Pusat",
  "Kantor Cabang Mataram",
  "Kantor Cabang Bima",
  "Kantor Cabang Sumbawa",
  "Kantor Cabang Dompu",
];
const BIODATA_FIELD_KEYS =
  PROFILE_LAYER_FIELDS.find((layer) => layer.id === "biodata")?.fields?.map(
    (field) => cleanText(field?.key)
  ).filter(Boolean) || [
    "fullName",
    "nik",
    "birthPlace",
    "birthDate",
    "gender",
    "email",
    "phone",
    "address",
  ];
const BIODATA_TOTAL_FIELDS = Math.max(BIODATA_FIELD_KEYS.length, 1);

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return cleanText(value).toLowerCase();
}

function roleRequiresOfficeMeta(roleValue) {
  return ROLE_WITH_OFFICE_META.has(normalizeText(roleValue));
}

function formatPegawaiLookupLabel(row) {
  const namaPegawai = cleanText(row?.namaPegawai);
  const kodePegawai = cleanText(row?.kodePegawai);
  if (!namaPegawai && !kodePegawai) return "";
  if (!kodePegawai) return namaPegawai;
  return `${namaPegawai} (${kodePegawai})`;
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

function getRoleBadgeTone(role) {
  const normalizedRole = normalizeText(role);
  if (normalizedRole === "superadmin") return "bg-purple-100 text-purple-700";
  if (normalizedRole === "pengawas") return "bg-blue-100 text-blue-700";
  return "bg-green-100 text-green-700";
}

function getRoleLabel(role) {
  const normalizedRole = normalizeText(role);
  if (normalizedRole === "superadmin") return "Superadmin";
  if (normalizedRole === "pengawas") return "Pengawas";
  return "Peserta";
}

function getBiodataCompletionTone(percentage) {
  const safePercentage = Number(percentage) || 0;
  if (safePercentage < 50) {
    return {
      textClass: "text-red-700",
      trackClass: "bg-red-100",
      barClass: "from-[#fb923c] to-[#dc2626]",
    };
  }
  if (safePercentage < 80) {
    return {
      textClass: "text-amber-700",
      trackClass: "bg-amber-100",
      barClass: "from-[#fde047] to-[#f59e0b]",
    };
  }
  return {
    textClass: "text-green-700",
    trackClass: "bg-green-100",
    barClass: "from-[#4ade80] to-[#16a34a]",
  };
}

function isProfileValueFilled(value) {
  if (typeof value === "boolean") return value;
  return cleanText(value).length > 0;
}

function calculateBiodataCompletion(source) {
  const safeSource = source && typeof source === "object" ? source : {};
  const filledFields = BIODATA_FIELD_KEYS.reduce((total, key) => {
    return total + (isProfileValueFilled(safeSource[key]) ? 1 : 0);
  }, 0);

  const percentage = Math.round((filledFields / BIODATA_TOTAL_FIELDS) * 100);
  return {
    filled: filledFields,
    total: BIODATA_TOTAL_FIELDS,
    percentage: Math.max(0, Math.min(percentage, 100)),
  };
}

function buildUserLamaranMap(applications) {
  const map = new Map();

  applications.forEach((application) => {
    const username =
      cleanText(application?.candidateUsername) ||
      cleanText(application?.applicant?.username);

    if (!username) return;

    const lamaran = cleanText(application?.role || "Posisi belum tersedia");

    if (!map.has(username.toLowerCase())) {
      map.set(username.toLowerCase(), {
        lamaranSet: new Set(),
        latestApplicantSnapshot: application?.applicant || {},
        latestAppliedAt: application?.appliedAt || "",
      });
    }

    const current = map.get(username.toLowerCase());
    current.lamaranSet.add(lamaran);

    const currentAppliedAtTime = Date.parse(current.latestAppliedAt || "") || 0;
    const nextAppliedAtTime = Date.parse(application?.appliedAt || "") || 0;
    if (nextAppliedAtTime >= currentAppliedAtTime) {
      current.latestApplicantSnapshot = application?.applicant || {};
      current.latestAppliedAt = application?.appliedAt || "";
    }
  });

  return map;
}

function buildProfileView(user, lamaranMapValue) {
  const applicant =
    lamaranMapValue && typeof lamaranMapValue.latestApplicantSnapshot === "object"
      ? lamaranMapValue.latestApplicantSnapshot
      : {};
  const fullName =
    cleanText(user.fullName) ||
    cleanText(user.displayName) ||
    cleanText(user.username);
  const email = cleanText(user.email) || cleanText(applicant.email);
  const phone = cleanText(user.phone) || cleanText(applicant.phone);
  const address = cleanText(user.address) || cleanText(applicant.address);
  const jabatan = cleanText(user.jabatan) || cleanText(applicant.jabatan);
  const unitKerja = cleanText(user.unitKerja) || cleanText(applicant.unitKerja);
  const biodataSource = {
    fullName:
      cleanText(user.fullName) ||
      cleanText(user.displayName) ||
      cleanText(applicant.fullName),
    nik: cleanText(user.nik) || cleanText(applicant.nik),
    birthPlace: cleanText(user.birthPlace) || cleanText(applicant.birthPlace),
    birthDate: cleanText(user.birthDate) || cleanText(applicant.birthDate),
    gender: cleanText(user.gender) || cleanText(applicant.gender),
    email: cleanText(user.email) || cleanText(applicant.email),
    phone: cleanText(user.phone) || cleanText(applicant.phone),
    address: cleanText(user.address) || cleanText(applicant.address),
  };

  return {
    userUUID: cleanText(user.userUUID),
    username: cleanText(user.username),
    role: cleanText(user.role),
    statusUser: cleanText(user.statusUser) || "Aktif",
    displayName: fullName,
    fullName,
    email,
    phone,
    address,
    jabatan,
    unitKerja,
    registeredAt: cleanText(user.createdAt) || cleanText(user.registeredAt),
    profileComplete:
      Boolean(user.documentReady) || Boolean(fullName && email && (phone || address)),
    nik: cleanText(user.nik) || cleanText(applicant.nik),
    gender: cleanText(user.gender) || cleanText(applicant.gender),
    birthPlace: cleanText(user.birthPlace) || cleanText(applicant.birthPlace),
    birthDate: cleanText(user.birthDate) || cleanText(applicant.birthDate),
    lastEducation:
      cleanText(user.lastEducation) || cleanText(applicant.lastEducation),
    major: cleanText(user.major) || cleanText(applicant.major),
    institution: cleanText(user.institution) || cleanText(applicant.institution),
    graduationYear:
      cleanText(user.graduationYear) || cleanText(applicant.graduationYear),
    gpa: cleanText(user.gpa) || cleanText(applicant.gpa),
    mainSkill: cleanText(user.mainSkill) || cleanText(applicant.mainSkill),
    computerSkillLevel:
      cleanText(user.computerSkillLevel) || cleanText(applicant.computerSkillLevel),
    workExperience:
      cleanText(user.workExperience) || cleanText(applicant.workExperience),
    documentReady: Boolean(user.documentReady || applicant.documentReady),
    biodataCompletion: calculateBiodataCompletion(biodataSource),
    lamaran: Array.from(lamaranMapValue?.lamaranSet || []),
    latestAppliedAt: cleanText(lamaranMapValue?.latestAppliedAt),
  };
}

function DashboardUserSuperadmin() {
  const navigate = useNavigate();
  const currentUser = getDashboardUser();
  const isSuperadmin = normalizeText(currentUser.role) === "superadmin";

  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState(() => getDashboardApplications());
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersLoadError, setUsersLoadError] = useState("");

  const [searchKeyword, setSearchKeyword] = useState("");
  const [lamaranFilter, setLamaranFilter] = useState(LAMARAN_FILTER_ALL);
  const [detailUser, setDetailUser] = useState(null);

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    username: "",
    fullName: "",
    email: "",
    phone: "",
    address: "",
    jabatan: "",
    unitKerja: "",
    role: "peserta",
    statusUser: "Aktif",
    nextPassword: "",
    confirmNextPassword: "",
  });
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: "",
    fullName: "",
    selectedPegawaiKey: "",
    email: "",
    phone: "",
    address: "",
    jabatan: "",
    unitKerja: "",
    role: "peserta",
    statusUser: "Aktif",
    password: "",
    confirmPassword: "",
  });
  const [createError, setCreateError] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isDeletingUserUUID, setIsDeletingUserUUID] = useState("");
  const [pegawaiLookupRows, setPegawaiLookupRows] = useState([]);
  const [pegawaiLookupError, setPegawaiLookupError] = useState("");
  const [isLoadingPegawaiLookup, setIsLoadingPegawaiLookup] = useState(false);
  const [isPegawaiDropdownOpen, setIsPegawaiDropdownOpen] = useState(false);
  const [isEditPegawaiDropdownOpen, setIsEditPegawaiDropdownOpen] = useState(false);

  const isCurrentIdentity = useCallback(
    (user) => {
      const loginIdentity = normalizeText(currentUser.loginIdentity);
      if (!loginIdentity) return false;
      return (
        loginIdentity === normalizeText(user?.username) ||
        loginIdentity === normalizeText(user?.email)
      );
    },
    [currentUser.loginIdentity]
  );

  const loadUsers = useCallback(
    async ({ silent = false } = {}) => {
      if (!isSuperadmin) return;
      if (!silent) setIsLoadingUsers(true);
      setUsersLoadError("");

      try {
        const response = await getUsersApi();
        setUsers(Array.isArray(response?.users) ? response.users : []);
      } catch (error) {
        setUsers([]);
        setUsersLoadError(
          error instanceof Error
            ? error.message
            : "Gagal mengambil data user dari server."
        );
      } finally {
        if (!silent) setIsLoadingUsers(false);
      }
    },
    [isSuperadmin]
  );

  const refreshData = useCallback(
    async ({ silentUsers = false } = {}) => {
      setApplications(getDashboardApplications());
      await loadUsers({ silent: silentUsers });
    },
    [loadUsers]
  );

  const loadPegawaiLookup = useCallback(
    async ({ search = "", silent = false, limit = PEGAWAI_LOOKUP_LIMIT } = {}) => {
      if (!isSuperadmin) return;
      if (!silent) setIsLoadingPegawaiLookup(true);
      setPegawaiLookupError("");

      try {
        const response = await getPegawaiLookupApi({
          search,
          limit,
        });
        setPegawaiLookupRows(Array.isArray(response?.rows) ? response.rows : []);
      } catch (error) {
        setPegawaiLookupRows([]);
        setPegawaiLookupError(
          error instanceof Error
            ? error.message
            : "Gagal memuat data pegawai untuk form user."
        );
      } finally {
        if (!silent) setIsLoadingPegawaiLookup(false);
      }
    },
    [isSuperadmin]
  );

  useEffect(() => {
    if (!isSuperadmin) {
      navigate("/dashboard", { replace: true });
      return;
    }

    refreshData();
  }, [isSuperadmin, navigate, refreshData]);

  useEffect(() => {
    const handleRefresh = () => {
      refreshData({ silentUsers: true });
    };

    window.addEventListener("focus", handleRefresh);
    window.addEventListener("storage", handleRefresh);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("storage", handleRefresh);
    };
  }, [refreshData]);

  useEffect(() => {
    if (!isCreateModalOpen) return;
    if (!roleRequiresOfficeMeta(createForm.role)) return;
    if (pegawaiLookupRows.length > 0 || isLoadingPegawaiLookup) return;
    loadPegawaiLookup();
  }, [
    createForm.role,
    isCreateModalOpen,
    isLoadingPegawaiLookup,
    loadPegawaiLookup,
    pegawaiLookupRows.length,
  ]);

  useEffect(() => {
    if (!isCreateModalOpen) return;
    if (!roleRequiresOfficeMeta(createForm.role)) return;

    const keyword = cleanText(createForm.fullName);
    if (keyword.length < 2) return;

    const timeoutId = window.setTimeout(() => {
      loadPegawaiLookup({
        search: keyword,
        silent: true,
        limit: 200,
      });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [createForm.fullName, createForm.role, isCreateModalOpen, loadPegawaiLookup]);

  useEffect(() => {
    if (!editingUser) return;
    if (!roleRequiresOfficeMeta(editForm.role)) return;
    if (pegawaiLookupRows.length > 0 || isLoadingPegawaiLookup) return;
    loadPegawaiLookup();
  }, [
    editForm.role,
    editingUser,
    isLoadingPegawaiLookup,
    loadPegawaiLookup,
    pegawaiLookupRows.length,
  ]);

  useEffect(() => {
    if (!editingUser) return;
    if (!roleRequiresOfficeMeta(editForm.role)) return;

    const keyword = cleanText(editForm.fullName);
    if (keyword.length < 2) return;

    const timeoutId = window.setTimeout(() => {
      loadPegawaiLookup({
        search: keyword,
        silent: true,
        limit: 200,
      });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [editForm.fullName, editForm.role, editingUser, loadPegawaiLookup]);

  const lamaranMap = useMemo(() => buildUserLamaranMap(applications), [applications]);

  const userRows = useMemo(() => {
    return users
      .map((user) => {
        const mapValue = lamaranMap.get(normalizeText(user.username));
        const profile = buildProfileView(user, mapValue);

        return {
          ...profile,
          lamaranCount: profile.lamaran.length,
        };
      })
      .sort((left, right) => {
        const leftRole = normalizeText(left.role);
        const rightRole = normalizeText(right.role);
        if (leftRole !== rightRole) return leftRole.localeCompare(rightRole);

        return normalizeText(left.displayName).localeCompare(
          normalizeText(right.displayName)
        );
      });
  }, [users, lamaranMap]);

  const lamaranOptions = useMemo(() => {
    const optionSet = new Set();

    userRows.forEach((user) => {
      user.lamaran.forEach((lamaran) => {
        optionSet.add(lamaran);
      });
    });

    return Array.from(optionSet).sort((left, right) =>
      normalizeText(left).localeCompare(normalizeText(right))
    );
  }, [userRows]);

  const filteredUsers = useMemo(() => {
    const keyword = normalizeText(searchKeyword);

    return userRows.filter((user) => {
      const matchesSearch =
        !keyword ||
        normalizeText(user.displayName).includes(keyword) ||
        normalizeText(user.username).includes(keyword);

      if (!matchesSearch) return false;

      if (lamaranFilter === LAMARAN_FILTER_ALL) return true;
      if (lamaranFilter === LAMARAN_FILTER_NONE) return user.lamaran.length === 0;

      return user.lamaran.includes(lamaranFilter);
    });
  }, [userRows, searchKeyword, lamaranFilter]);

  const summary = useMemo(() => {
    const totalUser = userRows.length;
    const totalPeserta = userRows.filter(
      (user) => normalizeText(user.role) === "peserta"
    ).length;
    const totalPengawas = userRows.filter(
      (user) => normalizeText(user.role) === "pengawas"
    ).length;
    const totalSuperadmin = userRows.filter(
      (user) => normalizeText(user.role) === "superadmin"
    ).length;

    return {
      totalUser,
      totalPeserta,
      totalPengawas,
      totalSuperadmin,
      totalLamaranAktif: lamaranOptions.length,
    };
  }, [userRows, lamaranOptions]);

  const findPegawaiByLookupInput = useCallback(
    (value) => {
      const needle = normalizeText(value);
      if (!needle) return null;

      return (
        pegawaiLookupRows.find(
          (item) => normalizeText(formatPegawaiLookupLabel(item)) === needle
        ) ||
        pegawaiLookupRows.find(
          (item) => normalizeText(item?.namaPegawai) === needle
        ) ||
        pegawaiLookupRows.find(
          (item) => normalizeText(item?.kodePegawai) === needle
        ) ||
        null
      );
    },
    [pegawaiLookupRows]
  );

  const createJabatanOptions = useMemo(() => {
    const options = new Set(JABATAN_OPTIONS.map((item) => cleanText(item)).filter(Boolean));
    pegawaiLookupRows.forEach((item) => {
      const value = cleanText(item?.jabatan) || "Pegawai";
      if (value) options.add(value);
    });
    const currentValue = cleanText(createForm.jabatan);
    if (currentValue) options.add(currentValue);
    return Array.from(options).sort((left, right) =>
      normalizeText(left).localeCompare(normalizeText(right))
    );
  }, [createForm.jabatan, pegawaiLookupRows]);

  const createUnitKerjaOptions = useMemo(() => {
    const options = new Set(
      UNIT_KERJA_OPTIONS.map((item) => cleanText(item)).filter(Boolean)
    );
    pegawaiLookupRows.forEach((item) => {
      const value = cleanText(item?.namaUnitKerja);
      if (value) options.add(value);
    });
    const currentValue = cleanText(createForm.unitKerja);
    if (currentValue) options.add(currentValue);
    return Array.from(options).sort((left, right) =>
      normalizeText(left).localeCompare(normalizeText(right))
    );
  }, [createForm.unitKerja, pegawaiLookupRows]);

  const editJabatanOptions = useMemo(() => {
    const options = new Set(JABATAN_OPTIONS.map((item) => cleanText(item)).filter(Boolean));
    pegawaiLookupRows.forEach((item) => {
      const value = cleanText(item?.jabatan) || "Pegawai";
      if (value) options.add(value);
    });
    const currentValue = cleanText(editForm.jabatan);
    if (currentValue) options.add(currentValue);
    return Array.from(options).sort((left, right) =>
      normalizeText(left).localeCompare(normalizeText(right))
    );
  }, [editForm.jabatan, pegawaiLookupRows]);

  const editUnitKerjaOptions = useMemo(() => {
    const options = new Set(
      UNIT_KERJA_OPTIONS.map((item) => cleanText(item)).filter(Boolean)
    );
    pegawaiLookupRows.forEach((item) => {
      const value = cleanText(item?.namaUnitKerja);
      if (value) options.add(value);
    });
    const currentValue = cleanText(editForm.unitKerja);
    if (currentValue) options.add(currentValue);
    return Array.from(options).sort((left, right) =>
      normalizeText(left).localeCompare(normalizeText(right))
    );
  }, [editForm.unitKerja, pegawaiLookupRows]);

  const pegawaiSuggestions = useMemo(() => {
    if (!roleRequiresOfficeMeta(createForm.role)) return [];

    const keyword = normalizeText(createForm.fullName);
    const baseRows = Array.isArray(pegawaiLookupRows) ? pegawaiLookupRows : [];
    if (!keyword) return baseRows.slice(0, 30);

    return baseRows
      .filter((item) => {
        const namaPegawai = normalizeText(item?.namaPegawai);
        const kodePegawai = normalizeText(item?.kodePegawai);
        const jabatan = normalizeText(item?.jabatan);
        const namaUnitKerja = normalizeText(item?.namaUnitKerja);

        return (
          namaPegawai.includes(keyword) ||
          kodePegawai.includes(keyword) ||
          jabatan.includes(keyword) ||
          namaUnitKerja.includes(keyword)
        );
      })
      .slice(0, 30);
  }, [createForm.fullName, createForm.role, pegawaiLookupRows]);

  const editPegawaiSuggestions = useMemo(() => {
    if (!roleRequiresOfficeMeta(editForm.role)) return [];

    const keyword = normalizeText(editForm.fullName);
    const baseRows = Array.isArray(pegawaiLookupRows) ? pegawaiLookupRows : [];
    if (!keyword) return baseRows.slice(0, 30);

    return baseRows
      .filter((item) => {
        const namaPegawai = normalizeText(item?.namaPegawai);
        const kodePegawai = normalizeText(item?.kodePegawai);
        const jabatan = normalizeText(item?.jabatan);
        const namaUnitKerja = normalizeText(item?.namaUnitKerja);

        return (
          namaPegawai.includes(keyword) ||
          kodePegawai.includes(keyword) ||
          jabatan.includes(keyword) ||
          namaUnitKerja.includes(keyword)
        );
      })
      .slice(0, 30);
  }, [editForm.fullName, editForm.role, pegawaiLookupRows]);

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      jabatan: user.jabatan || "",
      unitKerja: user.unitKerja || "",
      role: user.role || "peserta",
      statusUser: user.statusUser || "Aktif",
      nextPassword: "",
      confirmNextPassword: "",
    });
    setIsEditPegawaiDropdownOpen(false);
    setEditError("");
  };

  const closeEditModal = () => {
    if (isSavingEdit) return;
    setEditingUser(null);
    setEditError("");
    setIsEditPegawaiDropdownOpen(false);
    setEditForm({
      username: "",
      fullName: "",
      email: "",
      phone: "",
      address: "",
      jabatan: "",
      unitKerja: "",
      role: "peserta",
      statusUser: "Aktif",
      nextPassword: "",
      confirmNextPassword: "",
    });
  };

  const handleEditFullNameChange = (event) => {
    const nextInput = event.target.value;

    setEditForm((prevForm) => ({
      ...prevForm,
      fullName: nextInput,
    }));
    setIsEditPegawaiDropdownOpen(roleRequiresOfficeMeta(editForm.role));
  };

  const handleSelectEditPegawai = (pegawai) => {
    const selected = pegawai || findPegawaiByLookupInput(editForm.fullName);
    if (!selected) return;

    setEditForm((prevForm) => ({
      ...prevForm,
      fullName: cleanText(selected.namaPegawai),
      jabatan: cleanText(selected.jabatan) || "Pegawai",
      unitKerja: cleanText(selected.namaUnitKerja),
    }));
    setIsEditPegawaiDropdownOpen(false);
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();

    if (!editingUser?.userUUID || isSavingEdit) return;

    const username = normalizeText(editForm.username);
    const fullName = cleanText(editForm.fullName);
    const email = cleanText(editForm.email);
    const phone = cleanText(editForm.phone);
    const address = cleanText(editForm.address);
    const jabatan = cleanText(editForm.jabatan);
    const unitKerja = cleanText(editForm.unitKerja);
    const role = cleanText(editForm.role || "peserta").toLowerCase();
    const statusUser = cleanText(editForm.statusUser || "Aktif");
    const nextPassword = String(editForm.nextPassword || "");
    const confirmNextPassword = String(editForm.confirmNextPassword || "");

    if (!username) {
      setEditError("Username wajib diisi.");
      return;
    }
    if (!fullName) {
      setEditError("Nama user wajib diisi.");
      return;
    }
    if (roleRequiresOfficeMeta(role) && !jabatan) {
      setEditError("Jabatan wajib dipilih untuk role pengawas/superadmin.");
      return;
    }
    if (roleRequiresOfficeMeta(role) && !unitKerja) {
      setEditError("Unit kerja wajib dipilih untuk role pengawas/superadmin.");
      return;
    }

    if (nextPassword || confirmNextPassword) {
      if (nextPassword.length < 8) {
        setEditError("Password baru minimal 8 karakter.");
        return;
      }
      if (nextPassword !== confirmNextPassword) {
        setEditError("Konfirmasi password baru tidak sama.");
        return;
      }
      if (isCurrentIdentity(editingUser)) {
        setEditError(
          "Reset password akun sendiri dilakukan dari menu Setting akun."
        );
        return;
      }
    }

    const confirmTheme = getAlertThemeConfig("publishConfirm");

    const confirmation = await Swal.fire({
      icon: "question",
      title: "Simpan Perubahan User?",
      text: `Perubahan data user ${editingUser.displayName} akan diterapkan sekarang.`,
      showCancelButton: true,
      confirmButtonText: "Ya, Simpan",
      cancelButtonText: "Batal",
      background: confirmTheme.background,
      color: confirmTheme.color,
      iconColor: confirmTheme.iconColor,
      confirmButtonColor: confirmTheme.confirmButtonColor,
      cancelButtonColor: confirmTheme.cancelButtonColor,
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) return;

    setIsSavingEdit(true);
    setEditError("");

    const loadingTheme = getAlertThemeConfig("publishLoading");

    Swal.fire({
      title: "Menyimpan Perubahan...",
      text: "Mohon tunggu, data user sedang diperbarui.",
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
      const updateResult = await updateUserProfileApi(editingUser.userUUID, {
        username,
        fullName,
        email,
        phone,
        address,
        jabatan,
        unitKerja,
        role,
        statusUser,
      });
      const updatedUser = updateResult?.user || {};
      const profileUpdateMessage = cleanText(updateResult?.msg);
      let passwordUpdateMessage = "";

      if (nextPassword) {
        const passwordUpdateResult = await updateUserPasswordApi(editingUser.userUUID, {
          newPassword: nextPassword,
        });
        passwordUpdateMessage = cleanText(passwordUpdateResult?.msg);
      }

      if (isCurrentIdentity(editingUser)) {
        const previousLoginIdentity = normalizeText(currentUser.loginIdentity);
        const previousUsername = normalizeText(editingUser.username);
        const previousEmail = normalizeText(editingUser.email);
        const nextUsername = cleanText(updatedUser.username);
        const nextEmail = cleanText(updatedUser.email);

        const nextLoginIdentity =
          previousLoginIdentity === previousUsername
            ? nextUsername || currentUser.loginIdentity
            : previousLoginIdentity === previousEmail
            ? nextEmail || nextUsername || currentUser.loginIdentity
            : currentUser.loginIdentity;

        updateDashboardUser({
          userName:
            cleanText(updatedUser.fullName) ||
            cleanText(updatedUser.username) ||
            currentUser.userName,
          role: cleanText(updatedUser.role) || currentUser.role,
          loginIdentity: nextLoginIdentity,
        });
      }

      await refreshData({ silentUsers: true });
      Swal.close();

      const successTheme = getAlertThemeConfig("publishSuccess");

      await Swal.fire({
        icon: "success",
        title: "Data User Berhasil Diperbarui",
        text: nextPassword
          ? passwordUpdateMessage || profileUpdateMessage || "Profil dan password user berhasil diperbarui."
          : profileUpdateMessage || "Profil user berhasil diperbarui.",
        confirmButtonText: "OK",
        background: successTheme.background,
        color: successTheme.color,
        iconColor: successTheme.iconColor,
        confirmButtonColor: successTheme.confirmButtonColor,
      });

      closeEditModal();
    } catch (error) {
      Swal.close();
      setEditError(
        error instanceof Error
          ? error.message
          : "Terjadi kendala saat menyimpan perubahan user."
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openCreateModal = () => {
    setIsCreateModalOpen(true);
    setCreateError("");
    setIsPegawaiDropdownOpen(false);

    if (!isLoadingPegawaiLookup && pegawaiLookupRows.length === 0) {
      loadPegawaiLookup();
    }
  };

  const closeCreateModal = () => {
    if (isCreatingUser) return;
    setIsCreateModalOpen(false);
    setCreateError("");
    setIsPegawaiDropdownOpen(false);
    setCreateForm({
      username: "",
      fullName: "",
      selectedPegawaiKey: "",
      email: "",
      phone: "",
      address: "",
      jabatan: "",
      unitKerja: "",
      role: "peserta",
      statusUser: "Aktif",
      password: "",
      confirmPassword: "",
    });
  };

  const handleCreateFullNameChange = (event) => {
    const nextInput = event.target.value;

    setCreateForm((prevForm) => {
      if (!roleRequiresOfficeMeta(prevForm.role)) {
        return {
          ...prevForm,
          fullName: nextInput,
        };
      }

      return {
        ...prevForm,
        fullName: nextInput,
        selectedPegawaiKey: "",
      };
    });
    setIsPegawaiDropdownOpen(roleRequiresOfficeMeta(createForm.role));
  };

  const handleSelectPegawai = (pegawai) => {
    const selected = pegawai || findPegawaiByLookupInput(createForm.fullName);
    if (!selected) return;

    setCreateForm((prevForm) => ({
      ...prevForm,
      fullName: cleanText(selected.namaPegawai),
      selectedPegawaiKey: cleanText(selected.kodePegawai),
      jabatan: cleanText(selected.jabatan) || "Pegawai",
      unitKerja: cleanText(selected.namaUnitKerja),
    }));
    setIsPegawaiDropdownOpen(false);
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    if (isCreatingUser) return;

    const username = normalizeText(createForm.username);
    const fullName = cleanText(createForm.fullName);
    const email = normalizeText(createForm.email);
    const phone = cleanText(createForm.phone);
    const address = cleanText(createForm.address);
    let jabatan = cleanText(createForm.jabatan);
    let unitKerja = cleanText(createForm.unitKerja);
    let selectedPegawaiKey = cleanText(createForm.selectedPegawaiKey);
    const role = normalizeText(createForm.role) || "peserta";
    const statusUser = cleanText(createForm.statusUser) || "Aktif";
    const password = String(createForm.password || "");
    const confirmPassword = String(createForm.confirmPassword || "");

    if (roleRequiresOfficeMeta(role) && !selectedPegawaiKey) {
      const matchedPegawai = findPegawaiByLookupInput(fullName);
      if (matchedPegawai) {
        selectedPegawaiKey = cleanText(matchedPegawai.kodePegawai);
        jabatan = jabatan || cleanText(matchedPegawai.jabatan) || "Pegawai";
        unitKerja = unitKerja || cleanText(matchedPegawai.namaUnitKerja);
      }
    }

    if (!username) {
      setCreateError("Username wajib diisi.");
      return;
    }
    if (!fullName) {
      setCreateError("Nama lengkap wajib diisi.");
      return;
    }
    if (!email) {
      setCreateError("Email wajib diisi.");
      return;
    }
    if (roleRequiresOfficeMeta(role) && !selectedPegawaiKey) {
      setCreateError(
        "Pilih Nama Lengkap dari data pegawai terlebih dahulu untuk role pengawas/superadmin."
      );
      return;
    }
    if (roleRequiresOfficeMeta(role) && !jabatan) {
      setCreateError("Jabatan wajib dipilih untuk role pengawas/superadmin.");
      return;
    }
    if (roleRequiresOfficeMeta(role) && !unitKerja) {
      setCreateError("Unit kerja wajib dipilih untuk role pengawas/superadmin.");
      return;
    }
    if (password.length < 8) {
      setCreateError("Password minimal 8 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setCreateError("Konfirmasi password tidak sama.");
      return;
    }

    const confirmTheme = getAlertThemeConfig("publishConfirm");

    const confirmation = await Swal.fire({
      icon: "question",
      title: "Tambahkan User Baru?",
      text: `User ${fullName} (${role}) akan dibuat sekarang.`,
      showCancelButton: true,
      confirmButtonText: "Ya, Tambah",
      cancelButtonText: "Batal",
      background: confirmTheme.background,
      color: confirmTheme.color,
      iconColor: confirmTheme.iconColor,
      confirmButtonColor: confirmTheme.confirmButtonColor,
      cancelButtonColor: confirmTheme.cancelButtonColor,
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) return;

    setIsCreatingUser(true);
    setCreateError("");

    const loadingTheme = getAlertThemeConfig("publishLoading");

    Swal.fire({
      title: "Membuat User...",
      text: "Mohon tunggu, user baru sedang diproses.",
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
      await createUserApi({
        username,
        password,
        fullName,
        email,
        phone,
        address,
        jabatan,
        unitKerja,
        role,
        statusUser,
      });

      await refreshData({ silentUsers: true });
      Swal.close();

      const successTheme = getAlertThemeConfig("publishSuccess");
      await Swal.fire({
        icon: "success",
        title: "User Berhasil Ditambahkan",
        text: "Data user baru sudah masuk ke monitoring user.",
        confirmButtonText: "OK",
        background: successTheme.background,
        color: successTheme.color,
        iconColor: successTheme.iconColor,
        confirmButtonColor: successTheme.confirmButtonColor,
      });

      closeCreateModal();
    } catch (error) {
      Swal.close();
      setCreateError(
        error instanceof Error ? error.message : "Gagal menambahkan user baru."
      );
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!user?.userUUID || isDeletingUserUUID) return;

    if (isCurrentIdentity(user)) {
      await Swal.fire({
        icon: "warning",
        title: "Aksi Ditolak",
        text: "Akun superadmin yang sedang digunakan tidak dapat dihapus.",
        confirmButtonText: "OK",
      });
      return;
    }

    const confirmTheme = getAlertThemeConfig("publishConfirm");
    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Hapus User Ini?",
      text: `User ${user.displayName} (@${user.username}) akan dihapus permanen.`,
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",
      background: confirmTheme.background,
      color: confirmTheme.color,
      iconColor: confirmTheme.iconColor,
      confirmButtonColor: "#c62828",
      cancelButtonColor: confirmTheme.cancelButtonColor,
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) return;

    setIsDeletingUserUUID(user.userUUID);
    const loadingTheme = getAlertThemeConfig("publishLoading");
    Swal.fire({
      title: "Menghapus User...",
      text: "Mohon tunggu, data user sedang dihapus.",
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
      await deleteUserApi(user.userUUID);
      if (detailUser?.userUUID === user.userUUID) {
        setDetailUser(null);
      }
      if (editingUser?.userUUID === user.userUUID) {
        closeEditModal();
      }

      await refreshData({ silentUsers: true });
      Swal.close();

      const successTheme = getAlertThemeConfig("publishSuccess");
      await Swal.fire({
        icon: "success",
        title: "User Berhasil Dihapus",
        text: "Data user sudah dihapus dari monitoring.",
        confirmButtonText: "OK",
        background: successTheme.background,
        color: successTheme.color,
        iconColor: successTheme.iconColor,
        confirmButtonColor: successTheme.confirmButtonColor,
      });
    } catch (error) {
      Swal.close();
      await Swal.fire({
        icon: "error",
        title: "Gagal Menghapus User",
        text:
          error instanceof Error
            ? error.message
            : "Terjadi kendala saat menghapus user.",
        confirmButtonText: "Tutup",
      });
    } finally {
      setIsDeletingUserUUID("");
    }
  };

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
                Monitoring Seluruh User
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
                Data user ditarik langsung dari server. Superadmin dapat melihat
                biodata, edit profil, reset password, dan menambahkan user baru.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/superadmin/logs-activity")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#c9d7ed] bg-white px-4 text-sm font-bold text-[#17355e]"
              >
                <FiClock />
                Logs Riwayat
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#347dec] to-[#0c3a78] px-4 text-sm font-bold text-white shadow-[0_14px_26px_rgba(19,77,153,0.25)]"
              >
                <FiPlusCircle />
                Tambahkan User
              </button>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Total User</p>
            <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">{summary.totalUser}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Peserta</p>
            <h3 className="mt-2 text-3xl font-bold text-green-700">{summary.totalPeserta}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Pengawas</p>
            <h3 className="mt-2 text-3xl font-bold text-blue-700">{summary.totalPengawas}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Superadmin</p>
            <h3 className="mt-2 text-3xl font-bold text-purple-700">{summary.totalSuperadmin}</h3>
          </article>
          <article className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]">
            <p className="text-[13px] text-[#213b63]">Filter Lamaran</p>
            <h3 className="mt-2 text-3xl font-bold text-[#0d2c59]">{summary.totalLamaranAktif}</h3>
          </article>
        </section>

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
              <span className="inline-flex items-center gap-1">
                <FiSearch />
                Searching by Name
              </span>
              <input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                type="text"
                className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                placeholder="Cari nama user atau username"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
              <span className="inline-flex items-center gap-1">
                <FiFilter />
                Filter Per Lamaran
              </span>
              <select
                value={lamaranFilter}
                onChange={(event) => setLamaranFilter(event.target.value)}
                className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
              >
                <option value={LAMARAN_FILTER_ALL}>Semua Lamaran</option>
                <option value={LAMARAN_FILTER_NONE}>Belum Memilih Lamaran</option>
                {lamaranOptions.map((lamaran) => (
                  <option key={lamaran} value={lamaran}>
                    {lamaran}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FiUsers className="text-[#17355e]" />
            <h3 className="text-lg font-bold text-[#102d5b]">Tabel User Monitoring</h3>
          </div>

          {isLoadingUsers ? (
            <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
              <p className="text-sm text-[#607792]">Memuat data user dari server...</p>
            </div>
          ) : usersLoadError ? (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-6 text-center">
              <p className="text-sm text-orange-700">{usersLoadError}</p>
              <button
                type="button"
                onClick={() => refreshData()}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-orange-300 bg-white px-4 text-xs font-semibold text-orange-700"
              >
                Coba Muat Ulang
              </button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
              <p className="text-sm text-[#607792]">
                Data user tidak ditemukan dengan filter saat ini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#f3f8ff] text-left text-xs font-bold uppercase tracking-[0.06em] text-[#274777]">
                    <th className="rounded-l-md px-3 py-3">No</th>
                    <th className="px-3 py-3">Nama User</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Email / HP</th>
                    <th className="px-3 py-3">Lamaran</th>
                    <th className="px-3 py-3">Biodata</th>
                    <th className="rounded-r-md px-3 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, index) => (
                    <tr
                      key={user.userUUID || user.username}
                      className="border-b border-[#e6eef9] text-[#1b3b66] hover:bg-[#f9fbff]"
                    >
                      <td className="px-3 py-3 text-xs text-[#5e7692]">{index + 1}</td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-bold text-[#102d5b]">{user.displayName}</p>
                        <p className="text-xs text-[#607792]">@{user.username}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getRoleBadgeTone(
                            user.role
                          )}`}
                        >
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            normalizeText(user.statusUser) === "tidak aktif"
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {user.statusUser || "Aktif"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <p>{user.email || "-"}</p>
                        <p className="mt-1 text-[#607792]">{user.phone || "-"}</p>
                      </td>
                      <td className="px-3 py-3">
                        {user.lamaran.length === 0 ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                            Belum ada lamaran
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {user.lamaran.slice(0, 2).map((lamaran) => (
                              <span
                                key={`${user.username}-${lamaran}`}
                                className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700"
                              >
                                {lamaran}
                              </span>
                            ))}
                            {user.lamaran.length > 2 && (
                              <span className="rounded-full bg-[#e9eff9] px-2.5 py-1 text-[11px] font-semibold text-[#4f6886]">
                                +{user.lamaran.length - 2} lainnya
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {normalizeText(user.role) === "peserta" ? (() => {
                          const completionPercentage =
                            user.biodataCompletion?.percentage ?? 0;
                          const completionTone =
                            getBiodataCompletionTone(completionPercentage);

                          return (
                            <div className="min-w-[132px]">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`text-sm font-bold ${completionTone.textClass}`}
                                >
                                  {completionPercentage}%
                                </span>
                                <span className="text-[11px] text-[#607792]">
                                  {user.biodataCompletion?.filled ?? 0}/
                                  {user.biodataCompletion?.total ?? BIODATA_TOTAL_FIELDS}
                                </span>
                              </div>
                              <div
                                className={`mt-1 h-2 overflow-hidden rounded-full ${completionTone.trackClass}`}
                              >
                                <div
                                  className={`h-full rounded-full bg-gradient-to-r ${completionTone.barClass}`}
                                  style={{
                                    width: `${completionPercentage}%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })() : (
                          <span className="text-[#7a90aa]">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {normalizeText(user.role) === "peserta" && (
                            <button
                              type="button"
                              onClick={() => setDetailUser(user)}
                              className="inline-flex items-center gap-1 rounded-md border border-[#d6dfed] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#294973]"
                            >
                              <FiEye />
                              Biodata
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-2.5 py-1.5 text-[11px] font-semibold text-[#17477d]"
                          >
                            <FiEdit3 />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={
                              isDeletingUserUUID === user.userUUID || isCurrentIdentity(user)
                            }
                          >
                            <FiTrash2 />
                            {isDeletingUserUUID === user.userUUID ? "Menghapus..." : "Hapus"}
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

        {detailUser && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(9,28,54,0.45)] p-4 backdrop-blur-[2px]">
            <section className="w-full max-w-3xl max-h-[92vh] overflow-auto rounded-[12px] border border-[#dfe8f5] bg-white p-5 shadow-[0_30px_70px_rgba(10,42,86,0.35)] sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FiShield className="text-[#17355e]" />
                  <h4 className="text-lg font-bold text-[#102d5b]">Biodata User</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailUser(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d6dfed] bg-white text-[#274776]"
                  aria-label="Tutup biodata user"
                >
                  <FiX />
                </button>
              </div>

              <div className="mb-4 rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-4">
                <p className="text-sm font-bold text-[#102d5b]">{detailUser.displayName}</p>
                <p className="mt-1 text-xs text-[#607792]">@{detailUser.username}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getRoleBadgeTone(
                      detailUser.role
                    )}`}
                  >
                    {getRoleLabel(detailUser.role)}
                  </span>
                  <span className="inline-flex rounded-full bg-[#e9eff9] px-2.5 py-1 text-[11px] font-semibold text-[#4f6886]">
                    Profile {detailUser.profileComplete ? "Lengkap" : "Belum Lengkap"}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      normalizeText(detailUser.statusUser) === "tidak aktif"
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {detailUser.statusUser || "Aktif"}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <article className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3 text-xs">
                  <p className="font-semibold text-[#102d5b]">Email</p>
                  <p className="mt-1 text-[#607792]">{detailUser.email || "-"}</p>
                </article>
                <article className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3 text-xs">
                  <p className="font-semibold text-[#102d5b]">Nomor HP</p>
                  <p className="mt-1 text-[#607792]">{detailUser.phone || "-"}</p>
                </article>
                <article className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3 text-xs sm:col-span-2">
                  <p className="font-semibold text-[#102d5b]">Alamat</p>
                  <p className="mt-1 text-[#607792]">{detailUser.address || "-"}</p>
                </article>
                <article className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3 text-xs">
                  <p className="font-semibold text-[#102d5b]">NIK</p>
                  <p className="mt-1 text-[#607792]">{detailUser.nik || "-"}</p>
                </article>
                <article className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3 text-xs">
                  <p className="font-semibold text-[#102d5b]">Jenis Kelamin</p>
                  <p className="mt-1 text-[#607792]">{detailUser.gender || "-"}</p>
                </article>
                <article className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3 text-xs">
                  <p className="font-semibold text-[#102d5b]">Tempat, Tanggal Lahir</p>
                  <p className="mt-1 text-[#607792]">
                    {detailUser.birthPlace || "-"}
                    {detailUser.birthDate ? `, ${detailUser.birthDate}` : ""}
                  </p>
                </article>
                <article className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3 text-xs">
                  <p className="font-semibold text-[#102d5b]">Pendidikan Terakhir</p>
                  <p className="mt-1 text-[#607792]">{detailUser.lastEducation || "-"}</p>
                </article>
                <article className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3 text-xs">
                  <p className="font-semibold text-[#102d5b]">Jurusan</p>
                  <p className="mt-1 text-[#607792]">{detailUser.major || "-"}</p>
                </article>
                <article className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3 text-xs">
                  <p className="font-semibold text-[#102d5b]">Institusi</p>
                  <p className="mt-1 text-[#607792]">{detailUser.institution || "-"}</p>
                </article>
                <article className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3 text-xs">
                  <p className="font-semibold text-[#102d5b]">Tahun Lulus</p>
                  <p className="mt-1 text-[#607792]">{detailUser.graduationYear || "-"}</p>
                </article>
                <article className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3 text-xs">
                  <p className="font-semibold text-[#102d5b]">IPK</p>
                  <p className="mt-1 text-[#607792]">{detailUser.gpa || "-"}</p>
                </article>
                <article className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3 text-xs">
                  <p className="font-semibold text-[#102d5b]">Keahlian Utama</p>
                  <p className="mt-1 text-[#607792]">{detailUser.mainSkill || "-"}</p>
                </article>
                <article className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3 text-xs">
                  <p className="font-semibold text-[#102d5b]">Level Komputer</p>
                  <p className="mt-1 text-[#607792]">{detailUser.computerSkillLevel || "-"}</p>
                </article>
                <article className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3 text-xs sm:col-span-2">
                  <p className="font-semibold text-[#102d5b]">Pengalaman Kerja</p>
                  <p className="mt-1 whitespace-pre-line text-[#607792]">
                    {detailUser.workExperience || "-"}
                  </p>
                </article>
                <article className="rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3 text-xs sm:col-span-2">
                  <p className="font-semibold text-[#102d5b]">Lamaran Dipilih</p>
                  {detailUser.lamaran.length === 0 ? (
                    <p className="mt-1 text-[#607792]">Belum ada lamaran.</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {detailUser.lamaran.map((lamaran) => (
                        <span
                          key={`${detailUser.username}-${lamaran}-detail`}
                          className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700"
                        >
                          {lamaran}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-[#7a90aa]">
                    Lamaran terakhir: {formatDateTime(detailUser.latestAppliedAt)}
                  </p>
                  <p className="mt-1 text-[11px] text-[#7a90aa]">
                    Terdaftar: {formatDateTime(detailUser.registeredAt)}
                  </p>
                </article>
              </div>
            </section>
          </div>
        )}

        {editingUser && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(9,28,54,0.45)] p-4 backdrop-blur-[2px]">
            <section className="w-full max-w-3xl max-h-[92vh] overflow-auto rounded-[12px] border border-[#dfe8f5] bg-white p-5 shadow-[0_30px_70px_rgba(10,42,86,0.35)] sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FiEdit3 className="text-[#17355e]" />
                  <h4 className="text-lg font-bold text-[#102d5b]">Edit User</h4>
                </div>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d6dfed] bg-white text-[#274776]"
                  aria-label="Tutup edit user"
                  disabled={isSavingEdit}
                >
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleSaveEdit}>
                <div className="mb-4 rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-4 text-xs text-[#607792]">
                  Mengubah user: <b className="text-[#102d5b]">{editingUser.displayName}</b> (@
                  {editingUser.username})
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                    Username
                    <input
                      value={editForm.username}
                      onChange={(event) =>
                        setEditForm((prevForm) => ({
                          ...prevForm,
                          username: event.target.value,
                        }))
                      }
                      type="text"
                      className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                      required
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                    Nama Lengkap
                    <div className="relative">
                      <input
                        value={editForm.fullName}
                        onChange={handleEditFullNameChange}
                        onFocus={() => {
                          if (!roleRequiresOfficeMeta(editForm.role)) return;
                          setIsEditPegawaiDropdownOpen(true);
                          if (
                            pegawaiLookupRows.length === 0 &&
                            !isLoadingPegawaiLookup
                          ) {
                            loadPegawaiLookup();
                          }
                        }}
                        onBlur={() => {
                          window.setTimeout(() => {
                            setIsEditPegawaiDropdownOpen(false);
                          }, 120);
                        }}
                        type="text"
                        className="h-11 w-full rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                        placeholder={
                          roleRequiresOfficeMeta(editForm.role)
                            ? "Cari nama pegawai dari master data..."
                            : ""
                        }
                        autoComplete="off"
                        required
                      />
                      {roleRequiresOfficeMeta(editForm.role) &&
                        isEditPegawaiDropdownOpen && (
                          <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[#d6dfed] bg-white shadow-[0_12px_25px_rgba(16,45,91,0.14)]">
                            {isLoadingPegawaiLookup && editPegawaiSuggestions.length === 0 ? (
                              <p className="px-3 py-2 text-xs font-normal text-[#6e85a3]">
                                Memuat master pegawai...
                              </p>
                            ) : editPegawaiSuggestions.length === 0 ? (
                              <p className="px-3 py-2 text-xs font-normal text-[#6e85a3]">
                                Data pegawai tidak ditemukan.
                              </p>
                            ) : (
                              editPegawaiSuggestions.map((item) => (
                                <button
                                  key={`edit-pegawai-suggestion-${item.kodePegawai}`}
                                  type="button"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    handleSelectEditPegawai(item);
                                  }}
                                  className="flex w-full flex-col items-start gap-0.5 border-b border-[#edf2fb] px-3 py-2 text-left text-xs text-[#1f3e69] last:border-b-0 hover:bg-[#f5f9ff]"
                                >
                                  <span className="font-semibold text-[#102d5b]">
                                    {cleanText(item.namaPegawai) || "-"}
                                  </span>
                                  <span className="text-[#5f7795]">
                                    {cleanText(item.kodePegawai) || "-"} |{" "}
                                    {cleanText(item.jabatan) || "Pegawai"} |{" "}
                                    {cleanText(item.namaUnitKerja) || "-"}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                    </div>
                    {roleRequiresOfficeMeta(editForm.role) && (
                      <span className="text-[11px] font-normal text-[#6e85a3]">
                        Ketik lalu pilih nama pegawai. Jabatan dan Unit Kerja akan
                        terisi otomatis.
                      </span>
                    )}
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                    Email
                    <input
                      value={editForm.email}
                      onChange={(event) =>
                        setEditForm((prevForm) => ({
                          ...prevForm,
                          email: event.target.value,
                        }))
                      }
                      type="email"
                      className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                    Nomor HP
                    <input
                      value={editForm.phone}
                      onChange={(event) =>
                        setEditForm((prevForm) => ({
                          ...prevForm,
                          phone: event.target.value,
                        }))
                      }
                      type="text"
                      className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                    Role
                    <select
                      value={editForm.role}
                      onChange={(event) => {
                        const nextRole = event.target.value;
                        setEditForm((prevForm) => ({
                          ...prevForm,
                          role: nextRole,
                          jabatan: roleRequiresOfficeMeta(nextRole)
                            ? prevForm.jabatan
                            : "",
                          unitKerja: roleRequiresOfficeMeta(nextRole)
                            ? prevForm.unitKerja
                            : "",
                        }));
                      }}
                      className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                    >
                      <option value="peserta">Peserta</option>
                      <option value="pengawas">Pengawas</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </label>

                  {roleRequiresOfficeMeta(editForm.role) && (
                    <>
                      <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                        Jabatan
                        <select
                          value={editForm.jabatan}
                          onChange={(event) =>
                            setEditForm((prevForm) => ({
                              ...prevForm,
                              jabatan: event.target.value,
                            }))
                          }
                          className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                          required
                        >
                          <option value="">Pilih jabatan</option>
                          {editJabatanOptions.map((option) => (
                            <option key={`edit-jabatan-${option}`} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                        Unit Kerja
                        <select
                          value={editForm.unitKerja}
                          onChange={(event) =>
                            setEditForm((prevForm) => ({
                              ...prevForm,
                              unitKerja: event.target.value,
                            }))
                          }
                          className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                          required
                        >
                          <option value="">Pilih unit kerja</option>
                          {editUnitKerjaOptions.map((option) => (
                            <option key={`edit-unitkerja-${option}`} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}

                  <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                    Status User
                    <select
                      value={editForm.statusUser}
                      onChange={(event) =>
                        setEditForm((prevForm) => ({
                          ...prevForm,
                          statusUser: event.target.value,
                        }))
                      }
                      className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Tidak Aktif">Tidak Aktif</option>
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-[#102d5b] sm:col-span-2">
                    Alamat
                    <textarea
                      value={editForm.address}
                      onChange={(event) =>
                        setEditForm((prevForm) => ({
                          ...prevForm,
                          address: event.target.value,
                        }))
                      }
                      className="min-h-[84px] rounded-lg border border-[#d6dfed] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-blue-500"
                    />
                  </label>
                </div>

                <div className="mt-5 rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#102d5b]">
                    <FiLock />
                    Reset Password User (Opsional)
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                      Password Baru
                      <input
                        value={editForm.nextPassword}
                        onChange={(event) =>
                          setEditForm((prevForm) => ({
                            ...prevForm,
                            nextPassword: event.target.value,
                          }))
                        }
                        type="password"
                        className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                        placeholder="Minimal 8 karakter"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                      Konfirmasi Password Baru
                      <input
                        value={editForm.confirmNextPassword}
                        onChange={(event) =>
                          setEditForm((prevForm) => ({
                            ...prevForm,
                            confirmNextPassword: event.target.value,
                          }))
                        }
                        type="password"
                        className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                        placeholder="Ulangi password baru"
                      />
                    </label>
                  </div>
                </div>

                {editError && (
                  <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                    {editError}
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="h-11 rounded-md border border-[#d6dfed] bg-white px-5 text-sm font-bold text-[#102d5b]"
                    disabled={isSavingEdit}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#347dec] to-[#0c3a78] px-6 text-sm font-bold text-white shadow-[0_14px_26px_rgba(19,77,153,0.25)]"
                    disabled={isSavingEdit}
                  >
                    {isSavingEdit ? <FiCheckCircle /> : <FiSave />}
                    {isSavingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[90] overflow-y-auto bg-[rgba(9,28,54,0.45)] p-4 backdrop-blur-[2px]">
            <section className="mx-auto my-4 w-full max-w-3xl rounded-[12px] border border-[#dfe8f5] bg-white p-5 shadow-[0_30px_70px_rgba(10,42,86,0.35)] sm:my-6 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FiPlusCircle className="text-[#17355e]" />
                  <h4 className="text-lg font-bold text-[#102d5b]">Tambahkan User</h4>
                </div>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d6dfed] bg-white text-[#274776]"
                  aria-label="Tutup tambah user"
                  disabled={isCreatingUser}
                >
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleCreateUser}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                    Username
                    <input
                      value={createForm.username}
                      onChange={(event) =>
                        setCreateForm((prevForm) => ({
                          ...prevForm,
                          username: event.target.value,
                        }))
                      }
                      type="text"
                      className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                      placeholder="username.login"
                      required
                    />
                  </label>

	                  <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
	                    Nama Lengkap
	                    <div className="relative">
	                      <input
	                        value={createForm.fullName}
	                        onChange={handleCreateFullNameChange}
	                        onFocus={() => {
	                          if (!roleRequiresOfficeMeta(createForm.role)) return;
	                          setIsPegawaiDropdownOpen(true);
	                          if (
	                            pegawaiLookupRows.length === 0 &&
	                            !isLoadingPegawaiLookup
	                          ) {
	                            loadPegawaiLookup();
	                          }
	                        }}
	                        onBlur={() => {
	                          window.setTimeout(() => {
	                            setIsPegawaiDropdownOpen(false);
	                          }, 120);
	                        }}
	                        type="text"
	                        className="h-11 w-full rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
	                        placeholder={
	                          roleRequiresOfficeMeta(createForm.role)
	                            ? "Cari nama pegawai dari master data..."
	                            : ""
	                        }
	                        autoComplete="off"
	                        required
	                      />
	                      {roleRequiresOfficeMeta(createForm.role) &&
	                        isPegawaiDropdownOpen && (
	                          <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[#d6dfed] bg-white shadow-[0_12px_25px_rgba(16,45,91,0.14)]">
	                            {isLoadingPegawaiLookup && pegawaiSuggestions.length === 0 ? (
	                              <p className="px-3 py-2 text-xs font-normal text-[#6e85a3]">
	                                Memuat master pegawai...
	                              </p>
	                            ) : pegawaiSuggestions.length === 0 ? (
	                              <p className="px-3 py-2 text-xs font-normal text-[#6e85a3]">
	                                Data pegawai tidak ditemukan.
	                              </p>
	                            ) : (
	                              pegawaiSuggestions.map((item) => (
	                                <button
	                                  key={`pegawai-suggestion-${item.kodePegawai}`}
	                                  type="button"
	                                  onMouseDown={(event) => {
	                                    event.preventDefault();
	                                    handleSelectPegawai(item);
	                                  }}
	                                  className="flex w-full flex-col items-start gap-0.5 border-b border-[#edf2fb] px-3 py-2 text-left text-xs text-[#1f3e69] last:border-b-0 hover:bg-[#f5f9ff]"
	                                >
	                                  <span className="font-semibold text-[#102d5b]">
	                                    {cleanText(item.namaPegawai) || "-"}
	                                  </span>
	                                  <span className="text-[#5f7795]">
	                                    {cleanText(item.kodePegawai) || "-"} |{" "}
	                                    {cleanText(item.jabatan) || "Pegawai"} |{" "}
	                                    {cleanText(item.namaUnitKerja) || "-"}
	                                  </span>
	                                </button>
	                              ))
	                            )}
	                          </div>
	                        )}
	                    </div>
                    {roleRequiresOfficeMeta(createForm.role) && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-normal text-[#6e85a3]">
                          Ketik lalu pilih nama pegawai. Jabatan dan Unit Kerja akan
                          terisi otomatis.
                        </p>
                        <div className="min-h-[16px]">
                          {pegawaiLookupError && (
                            <p className="text-[11px] font-normal text-red-600">
                              {pegawaiLookupError}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                    Email
                    <input
                      value={createForm.email}
                      onChange={(event) =>
                        setCreateForm((prevForm) => ({
                          ...prevForm,
                          email: event.target.value,
                        }))
                      }
                      type="email"
                      className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                      required
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                    Nomor HP
                    <input
                      value={createForm.phone}
                      onChange={(event) =>
                        setCreateForm((prevForm) => ({
                          ...prevForm,
                          phone: event.target.value,
                        }))
                      }
                      type="text"
                      className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                    Role
                    <select
                      value={createForm.role}
                      onChange={(event) => {
                        const nextRole = event.target.value;
                        const requiresOfficeMeta = roleRequiresOfficeMeta(nextRole);
                        setIsPegawaiDropdownOpen(requiresOfficeMeta);
                        setCreateForm((prevForm) => ({
                          ...prevForm,
                          role: nextRole,
                          selectedPegawaiKey: requiresOfficeMeta
                            ? prevForm.selectedPegawaiKey
                            : "",
                          jabatan: requiresOfficeMeta ? prevForm.jabatan : "",
                          unitKerja: requiresOfficeMeta ? prevForm.unitKerja : "",
                        }));

                        if (
                          requiresOfficeMeta &&
                          pegawaiLookupRows.length === 0 &&
                          !isLoadingPegawaiLookup
                        ) {
                          loadPegawaiLookup();
                        }
                      }}
                      className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                    >
                      <option value="peserta">Peserta</option>
                      <option value="pengawas">Pengawas</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </label>

                  {roleRequiresOfficeMeta(createForm.role) && (
                    <>
                      <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                        Jabatan
                        <select
                          value={createForm.jabatan}
                          onChange={(event) =>
                            setCreateForm((prevForm) => ({
                              ...prevForm,
                              jabatan: event.target.value,
                            }))
                          }
                          className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                          required
                        >
                          <option value="">Pilih jabatan</option>
                          {createJabatanOptions.map((option) => (
                            <option key={`create-jabatan-${option}`} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                        Unit Kerja
                        <select
                          value={createForm.unitKerja}
                          onChange={(event) =>
                            setCreateForm((prevForm) => ({
                              ...prevForm,
                              unitKerja: event.target.value,
                            }))
                          }
                          className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                          required
                        >
                          <option value="">Pilih unit kerja</option>
                          {createUnitKerjaOptions.map((option) => (
                            <option key={`create-unitkerja-${option}`} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}

                  <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                    Status User
                    <select
                      value={createForm.statusUser}
                      onChange={(event) =>
                        setCreateForm((prevForm) => ({
                          ...prevForm,
                          statusUser: event.target.value,
                        }))
                      }
                      className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Tidak Aktif">Tidak Aktif</option>
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-[#102d5b] sm:col-span-2">
                    Alamat
                    <textarea
                      value={createForm.address}
                      onChange={(event) =>
                        setCreateForm((prevForm) => ({
                          ...prevForm,
                          address: event.target.value,
                        }))
                      }
                      className="min-h-[84px] rounded-lg border border-[#d6dfed] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-blue-500"
                    />
                  </label>
                </div>

                <div className="mt-5 rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#102d5b]">
                    <FiLock />
                    Credential User
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                      Password
                      <input
                        value={createForm.password}
                        onChange={(event) =>
                          setCreateForm((prevForm) => ({
                            ...prevForm,
                            password: event.target.value,
                          }))
                        }
                        type="password"
                        className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                        placeholder="Minimal 8 karakter"
                        required
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                      Konfirmasi Password
                      <input
                        value={createForm.confirmPassword}
                        onChange={(event) =>
                          setCreateForm((prevForm) => ({
                            ...prevForm,
                            confirmPassword: event.target.value,
                          }))
                        }
                        type="password"
                        className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                        placeholder="Ulangi password"
                        required
                      />
                    </label>
                  </div>
                </div>

                {createError && (
                  <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                    {createError}
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="h-11 rounded-md border border-[#d6dfed] bg-white px-5 text-sm font-bold text-[#102d5b]"
                    disabled={isCreatingUser}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#347dec] to-[#0c3a78] px-6 text-sm font-bold text-white shadow-[0_14px_26px_rgba(19,77,153,0.25)]"
                    disabled={isCreatingUser}
                  >
                    {isCreatingUser ? <FiCheckCircle /> : <FiPlusCircle />}
                    {isCreatingUser ? "Menyimpan..." : "Simpan User Baru"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default DashboardUserSuperadmin;

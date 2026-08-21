import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import {
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiLock,
  FiSearch,
  FiSave,
  FiShield,
  FiUser,
} from "react-icons/fi";
import Header from "./header";
import Sidebar from "./sidebar";
import { getDashboardUser, updateDashboardUser } from "../utils/authUser";
import {
  getOwnProfileApi,
  updateUserPasswordApi,
  updateUserProfileApi,
} from "../utils/authApi";

const BPR_HIRE_PROFILE_STORAGE_KEY = "bpr-hire-profile-data";
const BPR_HIRE_PASSWORD_STORAGE_KEY = "bpr-hire-password-data";

const SETTING_LAYERS = [
  {
    id: "editProfile",
    label: "Edit Profile",
    description: "Perbarui data utama akun Anda.",
    icon: FiUser,
  },
  {
    id: "editPassword",
    label: "Edit Password",
    description: "Amankan akun dengan password baru.",
    icon: FiLock,
  },
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

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return cleanText(value).toLowerCase();
}

function roleRequiresOfficeMeta(roleValue) {
  const role = normalizeText(roleValue);
  return role === "pengawas" || role === "superadmin";
}

function SearchableUnitKerjaDropdown({
  value,
  onChange,
  options,
  isOpen,
  setIsOpen,
  searchKeyword,
  setSearchKeyword,
  disabled = false,
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
      Unit Kerja
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            setIsOpen((prev) => !prev);
          }}
          className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[#d6dfed] bg-white px-3 text-left text-sm font-normal text-[#143764]"
          disabled={disabled}
        >
          <span className="truncate">{value || "Pilih unit kerja"}</span>
          <FiChevronDown className={`shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute z-30 mt-2 w-full rounded-lg border border-[#d6dfed] bg-white shadow-[0_18px_38px_rgba(18,53,95,0.13)]">
            <div className="border-b border-[#e4ebf7] p-2">
              <div className="flex h-9 items-center gap-2 rounded-md border border-[#d6dfed] px-2.5">
                <FiSearch className="text-[#5f7894]" />
                <input
                  disabled={disabled}
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  type="text"
                  className="h-full w-full border-0 bg-transparent text-xs font-normal outline-none"
                  placeholder="Cari unit kerja..."
                />
              </div>
            </div>

            <div className="max-h-56 overflow-auto p-1.5">
              {filteredOptions.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-[#6f87a3]">Data tidak ditemukan.</p>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = option === value;

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        if (disabled) return;
                        onChange(option);
                        setIsOpen(false);
                      }}
                      className={`mb-1 flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs ${
                        isSelected
                          ? "bg-blue-50 font-semibold text-blue-700"
                          : "text-[#1d406d] hover:bg-[#f5f9ff]"
                      }`}
                    >
                      <span>{option}</span>
                      {isSelected && <FiCheck className="text-blue-600" />}
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

SearchableUnitKerjaDropdown.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  isOpen: PropTypes.bool.isRequired,
  setIsOpen: PropTypes.func.isRequired,
  searchKeyword: PropTypes.string.isRequired,
  setSearchKeyword: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

function getDefaultProfile(currentUser) {
  return {
    fullName: currentUser.userName || "",
    email: currentUser.loginIdentity?.includes("@") ? currentUser.loginIdentity : "",
    phone: "",
    jabatan: "",
    unitKerja: "",
    address: "",
  };
}

function getSavedProfile(currentUser) {
  const defaultProfile = getDefaultProfile(currentUser);

  if (typeof window === "undefined") return defaultProfile;

  try {
    const savedProfile = JSON.parse(
      window.localStorage.getItem(BPR_HIRE_PROFILE_STORAGE_KEY)
    );

    return {
      ...defaultProfile,
      ...savedProfile,
    };
  } catch {
    return defaultProfile;
  }
}

function getSavedPasswordState() {
  if (typeof window === "undefined") {
    return {
      updatedAt: "",
    };
  }

  try {
    const savedPasswordState = JSON.parse(
      window.localStorage.getItem(BPR_HIRE_PASSWORD_STORAGE_KEY)
    );

    return {
      updatedAt: String(savedPasswordState?.updatedAt || ""),
    };
  } catch {
    return {
      updatedAt: "",
    };
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function formatUpdatedAt(value) {
  if (!value) return "Belum pernah diperbarui";

  try {
    return new Date(value).toLocaleString("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return "Belum pernah diperbarui";
  }
}

function Setting() {
  const navigate = useNavigate();
  const currentUser = getDashboardUser();
  const normalizedRole = normalizeText(currentUser.role);
  const isPeserta = normalizedRole === "peserta";
  const requiresOfficeMeta = roleRequiresOfficeMeta(normalizedRole);
  const [activeLayer, setActiveLayer] = useState("editProfile");
  const [profileForm, setProfileForm] = useState(() => getSavedProfile(currentUser));
  const [unitKerjaDropdownOpen, setUnitKerjaDropdownOpen] = useState(false);
  const [unitKerjaSearchKeyword, setUnitKerjaSearchKeyword] = useState("");
  const [profileStatus, setProfileStatus] = useState({ type: "idle", message: "" });
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [currentUserUUID, setCurrentUserUUID] = useState(() =>
    cleanText(currentUser.userUUID)
  );
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordStatus, setPasswordStatus] = useState({
    type: "idle",
    message: "",
  });
  const [passwordState, setPasswordState] = useState(() => getSavedPasswordState());

  const profileCompletion = useMemo(() => {
    const requiredFields = requiresOfficeMeta
      ? [
          profileForm.fullName,
          profileForm.email,
          profileForm.phone,
          profileForm.jabatan,
          profileForm.unitKerja,
          profileForm.address,
        ]
      : [
          profileForm.fullName,
          profileForm.email,
          profileForm.phone,
          profileForm.address,
        ];
    const completedCount = requiredFields.filter(
      (field) => String(field || "").trim().length > 0
    ).length;

    return Math.round((completedCount / requiredFields.length) * 100);
  }, [requiresOfficeMeta, profileForm]);

  useEffect(() => {
    let isMounted = true;

    const syncOwnProfileFromServer = async () => {
      setIsLoadingProfile(true);
      setProfileStatus({ type: "idle", message: "" });

      try {
        const response = await getOwnProfileApi();
        const ownProfile = response?.user || {};
        if (!isMounted) return;

        const serverProfile = {
          fullName: cleanText(ownProfile.fullName) || currentUser.userName || "",
          email:
            cleanText(ownProfile.email) ||
            (cleanText(currentUser.loginIdentity).includes("@")
              ? cleanText(currentUser.loginIdentity)
              : ""),
          phone: cleanText(ownProfile.phone),
          jabatan: cleanText(ownProfile.jabatan),
          unitKerja: cleanText(ownProfile.unitKerja),
          address: cleanText(ownProfile.address),
        };

        setCurrentUserUUID(cleanText(ownProfile.userUUID) || cleanText(currentUser.userUUID));
        setProfileForm((prevProfile) => {
          const nextProfile = {
            ...prevProfile,
            ...serverProfile,
          };
          window.localStorage.setItem(
            BPR_HIRE_PROFILE_STORAGE_KEY,
            JSON.stringify(nextProfile)
          );
          return nextProfile;
        });

        setPasswordState((prevState) => ({
          ...prevState,
          updatedAt: cleanText(prevState.updatedAt || ownProfile.updatedAt),
        }));

        updateDashboardUser({
          userUUID: cleanText(ownProfile.userUUID) || cleanText(currentUser.userUUID),
          username: cleanText(ownProfile.username) || cleanText(currentUser.username),
          userName: serverProfile.fullName || currentUser.userName,
          email: cleanText(ownProfile.email) || cleanText(currentUser.email),
          role: cleanText(ownProfile.role) || currentUser.role,
          statusUser: cleanText(ownProfile.statusUser) || currentUser.statusUser,
          profileComplete:
            typeof ownProfile.profileComplete === "boolean"
              ? ownProfile.profileComplete
              : currentUser.profileComplete,
          loginIdentity:
            cleanText(currentUser.loginIdentity) &&
            !cleanText(currentUser.loginIdentity).includes("@")
              ? cleanText(currentUser.loginIdentity)
              : cleanText(ownProfile.email) || cleanText(currentUser.loginIdentity),
        });
      } catch (error) {
        if (!isMounted) return;
        setProfileStatus({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Gagal memuat profil akun dari server.",
        });
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    syncOwnProfileFromServer();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleProfileFieldChange = (field, value) => {
    setProfileStatus({ type: "idle", message: "" });
    setProfileForm((prevProfile) => ({
      ...prevProfile,
      [field]: value,
    }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    if (isSavingProfile) return;

    const fullName = String(profileForm.fullName || "").trim();
    const email = String(profileForm.email || "").trim();
    const phone = String(profileForm.phone || "").trim();
    const jabatan = String(profileForm.jabatan || "").trim();
    const unitKerja = String(profileForm.unitKerja || "").trim();
    const address = String(profileForm.address || "").trim();

    if (!fullName) {
      setProfileStatus({
        type: "error",
        message: "Nama lengkap wajib diisi.",
      });
      return;
    }

    if (!email) {
      setProfileStatus({
        type: "error",
        message: "Email wajib diisi.",
      });
      return;
    }

    if (!isValidEmail(email)) {
      setProfileStatus({
        type: "error",
        message: "Format email belum valid.",
      });
      return;
    }

    if (requiresOfficeMeta && !jabatan) {
      setProfileStatus({
        type: "error",
        message: "Jabatan wajib diisi untuk role pengawas/superadmin.",
      });
      return;
    }

    if (requiresOfficeMeta && !unitKerja) {
      setProfileStatus({
        type: "error",
        message: "Unit kerja wajib dipilih untuk role pengawas/superadmin.",
      });
      return;
    }

    if (!cleanText(currentUserUUID)) {
      setProfileStatus({
        type: "error",
        message: "Sesi akun tidak valid. Silakan login ulang.",
      });
      return;
    }

    const nextProfile = {
      ...profileForm,
      fullName,
      email,
      phone,
      jabatan,
      unitKerja,
      address,
    };

    try {
      setIsSavingProfile(true);
      setProfileStatus({ type: "idle", message: "" });

      const previousProfileEmail = cleanText(profileForm.email).toLowerCase();
      const previousLoginIdentity = cleanText(currentUser.loginIdentity).toLowerCase();
      const updateResult = await updateUserProfileApi(cleanText(currentUserUUID), {
        fullName,
        email,
        phone,
        jabatan,
        unitKerja,
        address,
      });
      const updatedUser = updateResult?.user || {};

      window.localStorage.setItem(
        BPR_HIRE_PROFILE_STORAGE_KEY,
        JSON.stringify(nextProfile)
      );

      const nextEmail = cleanText(updatedUser.email || email);
      const nextLoginIdentity =
        previousLoginIdentity === previousProfileEmail && nextEmail
          ? nextEmail
          : cleanText(currentUser.loginIdentity);

      updateDashboardUser({
        userUUID: cleanText(updatedUser.userUUID) || cleanText(currentUserUUID),
        username: cleanText(updatedUser.username) || cleanText(currentUser.username),
        userName: cleanText(updatedUser.fullName) || fullName,
        email: nextEmail || cleanText(currentUser.email),
        role: cleanText(updatedUser.role) || currentUser.role,
        statusUser: cleanText(updatedUser.statusUser) || currentUser.statusUser,
        loginIdentity: nextLoginIdentity || cleanText(currentUser.loginIdentity),
      });

      setCurrentUserUUID(
        cleanText(updatedUser.userUUID) || cleanText(currentUserUUID)
      );
      setProfileForm(nextProfile);
      setProfileStatus({
        type: "success",
        message:
          cleanText(updateResult?.msg) ||
          "Perubahan profile berhasil disimpan.",
      });
    } catch (error) {
      setProfileStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Gagal menyimpan perubahan profile.",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordFieldChange = (field, value) => {
    setPasswordStatus({ type: "idle", message: "" });
    setPasswordForm((prevPasswordForm) => ({
      ...prevPasswordForm,
      [field]: value,
    }));
  };

  const handleSavePassword = async (event) => {
    event.preventDefault();
    if (isSavingPassword) return;

    const currentPassword = String(passwordForm.currentPassword || "").trim();
    const newPassword = String(passwordForm.newPassword || "").trim();
    const confirmPassword = String(passwordForm.confirmPassword || "").trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordStatus({
        type: "error",
        message: "Semua kolom password wajib diisi.",
      });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordStatus({
        type: "error",
        message: "Password baru minimal 8 karakter.",
      });
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordStatus({
        type: "error",
        message: "Password baru harus berbeda dari password saat ini.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({
        type: "error",
        message: "Konfirmasi password tidak sama.",
      });
      return;
    }

    if (!cleanText(currentUserUUID)) {
      setPasswordStatus({
        type: "error",
        message: "Sesi akun tidak valid. Silakan login ulang.",
      });
      return;
    }

    try {
      setIsSavingPassword(true);
      setPasswordStatus({ type: "idle", message: "" });

      const updateResult = await updateUserPasswordApi(cleanText(currentUserUUID), {
        currentPassword,
        newPassword,
      });
      const nextPasswordState = {
        updatedAt: new Date().toISOString(),
      };

      window.localStorage.setItem(
        BPR_HIRE_PASSWORD_STORAGE_KEY,
        JSON.stringify(nextPasswordState)
      );
      setPasswordState(nextPasswordState);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordStatus({
        type: "success",
        message:
          cleanText(updateResult?.msg) ||
          "Password berhasil diperbarui.",
      });
    } catch (error) {
      setPasswordStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Gagal memperbarui password.",
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div
      className={`bh-dashboard-shell min-h-screen bg-[#f7fbff] text-[#09275a] ${
        isPeserta ? "lg:grid lg:grid-cols-[256px_minmax(0,1fr)]" : ""
      }`}
    >
      {isPeserta && (
        <aside className="bh-dashboard-sidebar-shell border-b border-[#dfe8f5] bg-white p-4 shadow-[12px_0_40px_rgba(20,57,96,0.05)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:border-b-0 lg:border-r lg:px-4 lg:py-8">
          <Sidebar role={currentUser.role} />
        </aside>
      )}

      <main className="bh-dashboard-main min-w-0 px-4 py-6 sm:px-6 lg:px-9 lg:py-10">
        <Header user={{ ...currentUser, userName: profileForm.fullName || currentUser.userName }} />

        <section className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">Setting Akun</p>
              <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
                Kelola Akun BPR HIRE
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#506783]">
                Atur data profile dan keamanan akun Anda pada layer yang tersedia.
              </p>
            </div>

            <div className="w-full max-w-sm rounded-lg border border-[#dfe8f5] bg-[#fbfdff] p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#102d5b]">
                <span>Kelengkapan Profile Utama</span>
                <span>{profileCompletion}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e8edf5]">
                <span
                  className="block h-full rounded-full bg-green-600"
                  style={{ width: `${profileCompletion}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-2 md:grid-cols-2">
            {SETTING_LAYERS.map((layer) => {
              const Icon = layer.icon;
              const isActive = activeLayer === layer.id;

              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setActiveLayer(layer.id)}
                  className={`rounded-lg border p-3 text-left transition ${
                    isActive
                      ? "border-blue-200 bg-blue-50 text-blue-700 shadow-[0_12px_24px_rgba(47,114,211,0.08)]"
                      : "border-[#dfe8f5] bg-[#fbfdff] text-[#203b63] hover:bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Icon />
                    {layer.label}
                  </div>
                  <p className="mt-2 text-xs text-[#607792]">{layer.description}</p>
                </button>
              );
            })}
          </div>

          {activeLayer === "editProfile" &&
            (isLoadingProfile ? (
              <div className="rounded-lg border border-dashed border-[#cddbf0] bg-[#fbfdff] px-4 py-8 text-center">
                <p className="text-sm text-[#607792]">Memuat profil akun dari server...</p>
              </div>
            ) : (
            <form onSubmit={handleSaveProfile}>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-xl text-blue-600">
                  <FiUser />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-[#102d5b]">Edit Profile</h3>
                  <p className="text-xs text-[#607792]">
                    Perbarui informasi utama agar data akun selalu relevan.
                  </p>
                </div>
              </div>

              {profileStatus.type !== "idle" && (
                <div
                  className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
                    profileStatus.type === "success"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-orange-200 bg-orange-50 text-orange-700"
                  }`}
                >
                  {profileStatus.message}
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                  Nama Lengkap
                  <input
                    disabled={isSavingProfile}
                    value={profileForm.fullName}
                    onChange={(event) =>
                      handleProfileFieldChange("fullName", event.target.value)
                    }
                    type="text"
                    className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                    placeholder="Masukkan nama lengkap"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                  Email
                  <input
                    disabled={isSavingProfile}
                    value={profileForm.email}
                    onChange={(event) =>
                      handleProfileFieldChange("email", event.target.value)
                    }
                    type="email"
                    className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                    placeholder="Masukkan email aktif"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                  Nomor HP
                  <input
                    disabled={isSavingProfile}
                    value={profileForm.phone}
                    onChange={(event) =>
                      handleProfileFieldChange("phone", event.target.value)
                    }
                    type="text"
                    className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                    placeholder="Masukkan nomor HP"
                  />
                </label>
                {requiresOfficeMeta ? (
                  <>
                    <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                      Jabatan
                      <input
                        disabled={isSavingProfile}
                        value={profileForm.jabatan}
                        onChange={(event) =>
                          handleProfileFieldChange("jabatan", event.target.value)
                        }
                        type="text"
                        className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                        placeholder="Contoh: Pengawas Rekrutmen"
                      />
                    </label>
                    <SearchableUnitKerjaDropdown
                      value={profileForm.unitKerja}
                      onChange={(nextValue) => {
                        handleProfileFieldChange("unitKerja", nextValue);
                        setUnitKerjaSearchKeyword("");
                      }}
                      options={UNIT_KERJA_OPTIONS}
                      isOpen={unitKerjaDropdownOpen}
                      setIsOpen={setUnitKerjaDropdownOpen}
                      searchKeyword={unitKerjaSearchKeyword}
                      setSearchKeyword={setUnitKerjaSearchKeyword}
                      disabled={isSavingProfile}
                    />
                  </>
                ) : null}
                <label className="grid gap-2 text-sm font-semibold text-[#102d5b] lg:col-span-2">
                  Alamat Domisili
                  <textarea
                    disabled={isSavingProfile}
                    value={profileForm.address}
                    onChange={(event) =>
                      handleProfileFieldChange("address", event.target.value)
                    }
                    className="min-h-[96px] rounded-lg border border-[#d6dfed] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-blue-500"
                    placeholder="Masukkan alamat domisili"
                  />
                </label>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => navigate(isPeserta ? "/profile" : "/dashboard")}
                  className="h-11 rounded-md border border-[#d6dfed] bg-white px-5 text-sm font-bold text-[#102d5b]"
                  disabled={isSavingProfile}
                >
                  {isPeserta ? "Buka Halaman Biodata" : "Kembali ke Dashboard"}
                </button>
                <button
                  type="submit"
                  className="flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#347dec] to-[#0c3a78] px-6 text-sm font-bold text-white shadow-[0_14px_26px_rgba(19,77,153,0.25)]"
                  disabled={isSavingProfile}
                >
                  <FiSave />
                  {isSavingProfile ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          ))}

          {activeLayer === "editPassword" && (
            <form onSubmit={handleSavePassword}>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-xl text-green-600">
                  <FiShield />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-[#102d5b]">Edit Password</h3>
                  <p className="text-xs text-[#607792]">
                    Terakhir diubah: {formatUpdatedAt(passwordState.updatedAt)}
                  </p>
                </div>
              </div>

              {passwordStatus.type !== "idle" && (
                <div
                  className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
                    passwordStatus.type === "success"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-orange-200 bg-orange-50 text-orange-700"
                  }`}
                >
                  {passwordStatus.message}
                </div>
              )}

              <div className="grid gap-4">
                <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                  Password Saat Ini
                  <input
                    disabled={isSavingPassword}
                    value={passwordForm.currentPassword}
                    onChange={(event) =>
                      handlePasswordFieldChange("currentPassword", event.target.value)
                    }
                    type="password"
                    className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-green-500"
                    placeholder="Masukkan password saat ini"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                  Password Baru
                  <input
                    disabled={isSavingPassword}
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      handlePasswordFieldChange("newPassword", event.target.value)
                    }
                    type="password"
                    className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-green-500"
                    placeholder="Minimal 8 karakter"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-[#102d5b]">
                  Konfirmasi Password Baru
                  <input
                    disabled={isSavingPassword}
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      handlePasswordFieldChange("confirmPassword", event.target.value)
                    }
                    type="password"
                    className="h-11 rounded-lg border border-[#d6dfed] bg-white px-3 text-sm font-normal outline-none focus:border-green-500"
                    placeholder="Ulangi password baru"
                  />
                </label>
              </div>

              <div className="mt-6 rounded-lg border border-[#dfe8f5] bg-[#fbfdff] px-4 py-3 text-xs leading-relaxed text-[#506783]">
                Gunakan kombinasi huruf besar, huruf kecil, angka, dan karakter khusus
                agar password lebih kuat.
              </div>

              <div className="mt-7 flex justify-end">
                <button
                  type="submit"
                  className="flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#43bd32] to-[#158a3b] px-6 text-sm font-bold text-white shadow-[0_14px_26px_rgba(35,149,47,0.24)]"
                  disabled={isSavingPassword}
                >
                  <FiCheckCircle />
                  {isSavingPassword ? "Memproses..." : "Perbarui Password"}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

export default Setting;


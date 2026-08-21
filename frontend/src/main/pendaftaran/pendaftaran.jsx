import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiMapPin,
  FiXCircle,
} from "react-icons/fi";
import Header from "../../component/header";
import Sidebar from "../../component/sidebar";
import { getDashboardUser, updateDashboardUser } from "../../utils/authUser";
import {
  getVacancyOpenStatus,
  saveMasterVacancies,
} from "../../utils/masterVacancies";
import {
  createApplicationId,
  fetchDashboardApplicationsFromBackend,
  getApplicantMinimumCriteriaEligibility,
  normalizeDashboardApplication,
  saveDashboardApplication,
} from "../../utils/applications";
import { applyLamaranApi, getLamaranApi, getOwnProfileApi } from "../../utils/authApi";

const BPR_HIRE_PROFILE_STORAGE_KEY = "bpr-hire-profile-data";
const PROFILE_CAN_APPLY_LABEL = "Dapat Melamar";
const PROFILE_CANNOT_APPLY_LABEL = "Profile Belum Lengkap, Tidak bisa melamar";

const vacancyTones = [
  {
    card: "from-green-50 via-white to-[#f3fbff]",
    icon: "bg-green-50 text-green-600",
    pill: "bg-green-50 text-green-700",
    button: "from-[#45bd32] to-[#0d7c3b]",
  },
  {
    card: "from-blue-50 via-white to-[#f6fbff]",
    icon: "bg-blue-50 text-blue-600",
    pill: "bg-blue-50 text-blue-700",
    button: "from-[#347dec] to-[#0c3a78]",
  },
  {
    card: "from-[#eef9ed] via-white to-[#f8fbff]",
    icon: "bg-green-50 text-green-600",
    pill: "bg-green-50 text-green-700",
    button: "from-[#45bd32] to-[#0d7c3b]",
  },
];

function cleanText(value) {
  return String(value || "").trim();
}

function buildProfileEligibility(user, isLoading = false, loadError = "") {
  return {
    isLoading,
    isComplete: Boolean(user?.profileComplete),
    loadError,
  };
}

function syncProfileStorageFromUser(user = {}) {
  if (typeof window === "undefined") return;

  const profileSnapshot = {
    fullName: cleanText(user.fullName),
    nik: cleanText(user.nik),
    birthPlace: cleanText(user.birthPlace),
    birthDate: cleanText(user.birthDate),
    gender: cleanText(user.gender),
    email: cleanText(user.email),
    phone: cleanText(user.phone),
    address: cleanText(user.address),
    lastEducation: cleanText(user.lastEducation),
    major: cleanText(user.major),
    institution: cleanText(user.institution),
    graduationYear: cleanText(user.graduationYear),
    gpa: cleanText(user.gpa),
    mainSkill: cleanText(user.mainSkill),
    computerSkill: cleanText(user.computerSkill),
    computerSkillLevel: cleanText(user.computerSkillLevel),
    languageSkill: cleanText(user.languageSkill),
    workExperience: cleanText(user.workExperience),
    cvFileName: cleanText(user.cvFileName),
    certificateFileName: cleanText(user.certificateFileName),
    experienceLetterFileName: cleanText(user.experienceLetterFileName),
    ktpFileName: cleanText(user.ktpFileName),
    ijazahFileName: cleanText(user.ijazahFileName),
    documentReady: Boolean(user.documentReady),
  };

  window.localStorage.setItem(
    BPR_HIRE_PROFILE_STORAGE_KEY,
    JSON.stringify(profileSnapshot)
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

function normalizeSelectionStages(stages = []) {
  return (Array.isArray(stages) ? stages : [])
    .map((stage) => {
      const title = String(stage?.title || "").trim();
      if (!title || isAdministrationStage(stage)) return null;

      return {
        title,
        description: String(stage?.description || "").trim(),
        startDate: String(stage?.startDate || "").trim(),
        endDate: String(stage?.endDate || "").trim(),
        startTime: String(stage?.startTime || "").trim(),
        endTime: String(stage?.endTime || "").trim(),
      };
    })
    .filter(Boolean);
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

  return {
    id: lamaranUUID,
    vacancyId: lamaranUUID,
    title: String(item?.title || "").trim(),
    department: tenagaAhli,
    tenagaAhli,
    location: String(item?.location || "").trim(),
    type: String(item?.type || "Full Time").trim(),
    description: deskripsiLamaran,
    deskripsiLamaran,
    summary: ruangLingkupPekerjaan,
    ruangLingkupPekerjaan,
    openDate: String(item?.openDate || "").trim(),
    closeDate: String(item?.closeDate || "").trim(),
    requirements: kualifikasi,
    kualifikasi,
    qualifications: kompetensi,
    kompetensi,
    pendidikan: Array.isArray(item?.pendidikan) ? item.pendidikan : [],
    pengalaman: Array.isArray(item?.pengalaman) ? item.pengalaman : [],
    karakterDibutuhkan: Array.isArray(item?.karakterDibutuhkan)
      ? item.karakterDibutuhkan
      : [],
    requiredDocuments: Array.isArray(item?.requiredDocuments)
      ? item.requiredDocuments
      : [],
    biodataCriteria:
      item?.biodataCriteria && typeof item.biodataCriteria === "object"
        ? item.biodataCriteria
        : {},
    selectionFlow: item?.selectionFlow === "langsung" ? "langsung" : "berurutan",
    selectionStages: normalizeSelectionStages(item?.selectionStages),
  };
}

function Pendaftaran() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => getDashboardUser());
  const isPeserta = currentUser.role === "peserta";
  const [profileEligibility, setProfileEligibility] = useState(() =>
    buildProfileEligibility(currentUser, isPeserta)
  );
  const [registeredApplications, setRegisteredApplications] = useState([]);
  const [masterVacancies, setMasterVacancies] = useState([]);
  const [selectedVacancy, setSelectedVacancy] = useState(null);
  const [registrationStatus, setRegistrationStatus] = useState("idle");
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [registrationDetailMessages, setRegistrationDetailMessages] = useState(
    []
  );
  const registrationTimerRef = useRef(null);

  const refreshMasterVacancies = useCallback(async () => {
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

  const refreshRegisteredApplications = useCallback(async () => {
    try {
      const backendApplications = await fetchDashboardApplicationsFromBackend();
      setRegisteredApplications(backendApplications);
    } catch {
      setRegisteredApplications([]);
    }
  }, []);

  const refreshOwnProfile = useCallback(async () => {
    const storedUser = getDashboardUser();
    if (storedUser.role !== "peserta") {
      setCurrentUser(storedUser);
      setProfileEligibility(buildProfileEligibility(storedUser, false));
      return storedUser;
    }

    setProfileEligibility((prevState) => ({
      ...prevState,
      isLoading: true,
      loadError: "",
    }));

    try {
      const response = await getOwnProfileApi();
      const ownProfile = response?.user || {};
      syncProfileStorageFromUser(ownProfile);

      const nextUser = updateDashboardUser({
        userUUID: cleanText(ownProfile.userUUID) || cleanText(storedUser.userUUID),
        username: cleanText(ownProfile.username) || cleanText(storedUser.username),
        userName:
          cleanText(ownProfile.fullName) ||
          cleanText(storedUser.userName) ||
          "Peserta",
        email: cleanText(ownProfile.email) || cleanText(storedUser.email),
        role: cleanText(ownProfile.role) || storedUser.role,
        statusUser: cleanText(ownProfile.statusUser) || storedUser.statusUser,
        loginIdentity:
          cleanText(storedUser.loginIdentity) ||
          cleanText(ownProfile.email) ||
          cleanText(ownProfile.username),
        profileComplete: Boolean(ownProfile.profileComplete),
      });

      setCurrentUser(nextUser);
      setProfileEligibility(buildProfileEligibility(nextUser, false));
      return {
        ...ownProfile,
        profileComplete: Boolean(ownProfile.profileComplete),
      };
    } catch (error) {
      const fallbackUser = {
        ...getDashboardUser(),
        profileComplete: false,
      };
      setCurrentUser(fallbackUser);
      setProfileEligibility(
        buildProfileEligibility(
          fallbackUser,
          false,
          cleanText(error?.message) || "Gagal memuat status profile dari database."
        )
      );
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshMasterVacancies();
    void refreshRegisteredApplications();
    void refreshOwnProfile();

    const handleRefresh = () => {
      void refreshMasterVacancies();
      void refreshRegisteredApplications();
      void refreshOwnProfile();
    };

    window.addEventListener("focus", handleRefresh);
    window.addEventListener("storage", handleRefresh);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("storage", handleRefresh);
      window.clearTimeout(registrationTimerRef.current);
    };
  }, [refreshMasterVacancies, refreshOwnProfile, refreshRegisteredApplications]);

  const mergedVacancies = masterVacancies
    .filter((vacancy) => getVacancyOpenStatus(vacancy) === "open")
    .map((vacancy) => ({
      id: vacancy.id,
      vacancyId: vacancy.id,
      title: vacancy.title,
      department: vacancy.tenagaAhli || vacancy.department,
      tenagaAhli: vacancy.tenagaAhli || vacancy.department,
      location: vacancy.location,
      type: vacancy.type || "Full Time",
      description: vacancy.deskripsiLamaran || vacancy.description,
      summary: vacancy.ruangLingkupPekerjaan || vacancy.summary,
      openDate: vacancy.openDate,
      closeDate: vacancy.closeDate,
      periodLabel: `${formatDateLabel(vacancy.openDate)} - ${formatDateLabel(vacancy.closeDate)}`,
      biodataCriteria:
        vacancy?.biodataCriteria && typeof vacancy.biodataCriteria === "object"
          ? vacancy.biodataCriteria
          : {},
      selectionFlow: vacancy.selectionFlow === "langsung" ? "langsung" : "berurutan",
      selectionStages: normalizeSelectionStages(vacancy.selectionStages),
      requirements:
        Array.isArray(vacancy.kualifikasi) && vacancy.kualifikasi.length > 0
          ? vacancy.kualifikasi
          : Array.isArray(vacancy.requirements) && vacancy.requirements.length > 0
            ? vacancy.requirements
          : ["Kualifikasi akan diinfokan lebih lanjut oleh pengawas."],
      qualifications:
        Array.isArray(vacancy.kompetensi) && vacancy.kompetensi.length > 0
          ? vacancy.kompetensi
          : Array.isArray(vacancy.qualifications) && vacancy.qualifications.length > 0
            ? vacancy.qualifications
          : [],
    }));

  const registeredIds = new Set(
    registeredApplications.flatMap((item) =>
      [
        item.id,
        item.vacancyId,
        item.lamaranUUID,
        createApplicationId(item.role || item.title),
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

  const openApplyConfirmation = (vacancy, tone) => {
    if (registrationStatus !== "idle") return;

    setSelectedVacancy({ ...vacancy, tone });
    setRegistrationMessage("");
    setRegistrationDetailMessages([]);
    setRegistrationStatus("confirm");
  };

  const verifyApplication = async () => {
    if (registrationStatus !== "confirm" || !selectedVacancy) return;

    setRegistrationStatus("loading");
    setRegistrationMessage("");
    setRegistrationDetailMessages([]);

    const latestProfile = await refreshOwnProfile();
    if (!latestProfile?.profileComplete) {
      const profileIncompleteMessage = latestProfile
        ? PROFILE_CANNOT_APPLY_LABEL
        : "Gagal memuat status profile dari database. Silakan coba kembali.";
      setRegistrationMessage(profileIncompleteMessage);
      setRegistrationDetailMessages([profileIncompleteMessage]);
      setRegistrationStatus("failed");
      return;
    }

    const criteriaEligibility =
      getApplicantMinimumCriteriaEligibility(selectedVacancy, latestProfile);
    if (!criteriaEligibility.isEligible) {
      const fallbackCriteriaMessage =
        "Data pendidikan Anda belum memenuhi syarat minimal lamaran ini.";
      const criteriaMessages = Array.isArray(criteriaEligibility.messages)
        ? criteriaEligibility.messages
            .map((item) => String(item || "").trim())
            .filter(Boolean)
        : [];
      setRegistrationMessage(
        criteriaEligibility.message || fallbackCriteriaMessage
      );
      setRegistrationDetailMessages(
        criteriaMessages.length > 0
          ? criteriaMessages
          : [criteriaEligibility.message || fallbackCriteriaMessage]
      );
      setRegistrationStatus("failed");
      return;
    }

    try {
      const response = await applyLamaranApi(
        selectedVacancy.vacancyId || selectedVacancy.id
      );
      const application = response?.application || {};
      const localApplications = saveDashboardApplication(selectedVacancy, {
        appliedAt: application.appliedAt,
        stage: application.stage,
        status: application.status,
        verificationId: application.verificationId,
      });

      try {
        const backendApplications = await fetchDashboardApplicationsFromBackend();
        setRegisteredApplications(backendApplications);
      } catch {
        const normalizedApplication = normalizeDashboardApplication({
          ...application,
          vacancyId: selectedVacancy.vacancyId || selectedVacancy.id,
          lamaranUUID: selectedVacancy.vacancyId || selectedVacancy.id,
          role: selectedVacancy.title,
          title: selectedVacancy.title,
          branch: selectedVacancy.location,
          selectionFlow: selectedVacancy.selectionFlow,
          selectionStages: selectedVacancy.selectionStages,
        });
        setRegisteredApplications(
          normalizedApplication.vacancyId
            ? [normalizedApplication, ...localApplications]
            : localApplications
        );
      }
      setRegistrationMessage(
        String(response?.msg || "").trim() ||
          "Lamaran berhasil dikirim. ID verifikasi telah dikirim ke email Anda."
      );
      setRegistrationDetailMessages([]);
      setRegistrationStatus("success");
    } catch (error) {
      const failedMessages = Array.isArray(error?.payload?.errors)
        ? error.payload.errors
            .map((item) => String(item || "").trim())
            .filter(Boolean)
        : [];
      const fallbackErrorMessage =
        String(error?.message || "").trim() ||
        "Gagal memproses lamaran. Silakan coba kembali.";
      setRegistrationMessage(
        fallbackErrorMessage
      );
      setRegistrationDetailMessages(
        failedMessages.length > 0 ? failedMessages : [fallbackErrorMessage]
      );
      setRegistrationStatus("failed");
    }
  };

  const closePopup = () => {
    if (registrationStatus === "loading") return;
    setRegistrationStatus("idle");
    setSelectedVacancy(null);
    setRegistrationMessage("");
    setRegistrationDetailMessages([]);
  };

  const profileStatusLabel = profileEligibility.isLoading
    ? "Memuat Profile..."
    : profileEligibility.isComplete
      ? PROFILE_CAN_APPLY_LABEL
      : PROFILE_CANNOT_APPLY_LABEL;
  const profileStatusClass = profileEligibility.isLoading
    ? "bg-blue-50 text-blue-700"
    : profileEligibility.isComplete
      ? "bg-green-50 text-green-700"
      : "bg-red-50 text-red-700";

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
        <Header user={currentUser} />

        <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-green-600">Lamaran BPR HIRE</p>
              <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">Pilih Posisi Lamaran</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#506783]">
                Pilih salah satu posisi yang tersedia. Pendaftaran hanya berhasil jika seluruh data profile Anda sudah lengkap.
              </p>
            </div>
            <span
              className={`w-max rounded-full px-3 py-1 text-xs font-bold ${profileStatusClass}`}
            >
              {profileStatusLabel}
            </span>
          </div>
          {profileEligibility.loadError && (
            <p className="mt-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {profileEligibility.loadError}
            </p>
          )}
        </section>

        <section className="grid gap-5 xl:grid-cols-3">
          {mergedVacancies.length > 0 ? (
            mergedVacancies.map((vacancy, index) => {
              const Icon = vacancy.icon || FiBriefcase;
              const tone = vacancyTones[index % vacancyTones.length];
              const isRegistered =
                registeredIds.has(vacancy.id) ||
                registeredIds.has(vacancy.vacancyId) ||
                registeredIds.has(createApplicationId(vacancy.title));
              const isProfileBlocked =
                isPeserta &&
                (profileEligibility.isLoading || !profileEligibility.isComplete);
              const applyButtonLabel = isRegistered
                ? "Sudah Terdaftar"
                : profileEligibility.isLoading
                  ? "Memuat Profile"
                  : isProfileBlocked
                    ? "Profile Belum Lengkap"
                    : "Pilih Lamaran";

              return (
                <article
                  key={vacancy.title}
                  className={`relative overflow-hidden rounded-[10px] border border-[#dfe8f5] bg-gradient-to-br ${tone.card} p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)]`}
                >
                  <span className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-green-100/70" />
                  <div className="relative flex items-start justify-between gap-4">
                    <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] text-2xl ${tone.icon}`}>
                      <Icon />
                    </span>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${tone.pill}`}>
                      {vacancy.type}
                    </span>
                  </div>

                  <div className="relative mt-5">
                    <h3 className="text-xl font-bold leading-tight text-[#102d5b]">{vacancy.title}</h3>
                    <p className="mt-3 min-h-[52px] text-sm leading-relaxed text-[#496181]">{vacancy.description}</p>

                    <div className="mt-4 grid gap-2 text-xs text-[#5b7390]">
                      <span className="inline-flex items-center gap-2">
                        <FiBriefcase />
                        {vacancy.tenagaAhli || vacancy.department}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <FiMapPin />
                        {vacancy.location}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <FiClock />
                        {vacancy.type}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <FiCalendar />
                        {vacancy.periodLabel || "Dibuka sepanjang tahun"}
                      </span>
                    </div>

                    <div className="mt-5 rounded-lg border border-white/80 bg-white/70 p-3">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold text-[#102d5b]">
                        <FiFileText />
                        Kualifikasi utama
                      </p>
                      <ul className="grid gap-1.5 text-xs leading-relaxed text-[#536983]">
                        {vacancy.requirements.slice(0, 3).map((item) => (
                          <li key={item} className="flex gap-2">
                            <FiCheckCircle className="mt-0.5 shrink-0 text-green-600" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => openApplyConfirmation(vacancy, index === 1 ? "blue" : "green")}
                      disabled={isRegistered || isProfileBlocked || registrationStatus === "loading"}
                      className={`mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r ${tone.button} text-sm font-bold text-white shadow-[0_14px_26px_rgba(35,149,47,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70`}
                    >
                      {applyButtonLabel}
                      {!isRegistered && !isProfileBlocked && <FiArrowRight />}
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <article className="xl:col-span-3 rounded-[10px] border border-dashed border-[#cddbf0] bg-white px-5 py-10 text-center shadow-[0_12px_28px_rgba(21,54,92,0.04)]">
              <FiBriefcase className="mx-auto text-2xl text-[#5b7390]" />
              <p className="mt-3 text-sm text-[#607792]">
                Belum ada lamaran aktif yang dipublikasikan.
              </p>
            </article>
          )}
        </section>
      </main>

      {registrationStatus !== "idle" && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[rgba(12,31,58,0.28)] p-5 backdrop-blur-[8px]">
          <div className="w-full max-w-[390px] rounded-[18px] border border-[#d6dfed] bg-white/95 px-7 py-8 text-center text-[#0f2f5d] shadow-[0_28px_70px_rgba(9,39,90,0.2)]">
            {registrationStatus === "confirm" && (
              <>
                <span className="mx-auto mb-5 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-green-50 text-[30px] text-green-600">
                  <FiBriefcase />
                </span>
                <h3 className="m-0 text-[19px] font-bold leading-tight">Konfirmasi Lamaran</h3>
                <p className="mx-auto mt-2.5 max-w-[300px] text-[13.5px] leading-relaxed text-[#506783]">
                  Apakah Anda yakin ingin melamar posisi {selectedVacancy?.title}?
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={closePopup}
                    className="h-10 rounded-md border border-[#d6dfed] bg-white text-sm font-bold text-[#102d5b]"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={verifyApplication}
                    className="h-10 rounded-md bg-gradient-to-r from-[#43bd32] to-[#158a3b] text-sm font-bold text-white"
                  >
                    Iya, Lamar
                  </button>
                </div>
              </>
            )}

            {registrationStatus === "loading" && (
              <>
                <span className="mx-auto mb-5 block h-[54px] w-[54px] animate-spin rounded-full border-[5px] border-[#e5f2df] border-r-[#0d2f60] border-t-[#46b02f]" />
                <h3 className="m-0 text-[19px] font-bold leading-tight">Memproses Verifikasi</h3>
                <p className="mx-auto mt-2.5 max-w-[290px] text-[13.5px] leading-relaxed text-[#506783]">
                  Sistem sedang memproses lamaran dan mengirim ID verifikasi ke email Anda.
                </p>
              </>
            )}

            {registrationStatus === "success" && (
              <>
                <span className="mx-auto mb-5 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-green-50 text-[30px] text-green-600">
                  <FiCheckCircle />
                </span>
                <h3 className="m-0 text-[19px] font-bold leading-tight">Berhasil Daftar</h3>
                <p className="mx-auto mt-2.5 max-w-[290px] text-[13.5px] leading-relaxed text-[#506783]">
                  {registrationMessage ||
                    `Lamaran untuk posisi ${selectedVacancy?.title} berhasil dikirim dan ID verifikasi telah dikirim ke email Anda.`}
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="mt-6 h-10 w-full rounded-md bg-gradient-to-r from-[#43bd32] to-[#158a3b] text-sm font-bold text-white"
                >
                  Lihat Dashboard
                </button>
              </>
            )}

            {registrationStatus === "failed" && (
              <>
                <span className="mx-auto mb-5 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-orange-50 text-[30px] text-orange-500">
                  <FiXCircle />
                </span>
                <h3 className="m-0 text-[19px] font-bold leading-tight">Gagal Daftar</h3>
                <ul className="mx-auto mt-2.5 flex max-w-[300px] list-disc flex-col gap-1.5 pl-5 text-left text-[13.5px] leading-relaxed text-[#506783]">
                  {(registrationDetailMessages.length > 0
                    ? registrationDetailMessages
                    : [
                        registrationMessage ||
                          "Profile Anda belum lengkap. Lengkapi seluruh data profile terlebih dahulu sebelum memilih lamaran.",
                      ]
                  ).map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={closePopup}
                  className="mt-6 h-10 w-full rounded-md border border-[#d6dfed] bg-white text-sm font-bold text-[#102d5b]"
                >
                  Tutup
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Pendaftaran;


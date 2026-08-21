import { getDashboardApplications } from "./applications";
import { getDashboardUser } from "./authUser";

export const BPR_HIRE_PROFILE_STORAGE_KEY = "bpr-hire-profile-data";
export const BPR_HIRE_PASSWORD_STORAGE_KEY = "bpr-hire-password-data";
export const BPR_HIRE_NOTIFICATION_READ_STORAGE_KEY =
  "bpr-hire-notification-read-map";
export const BPR_HIRE_PENGAWAS_ANNOUNCEMENT_STORAGE_KEY =
  "bpr-hire-pengawas-announcements";

export const ANNOUNCEMENT_TARGET_MODE_ALL = "all-applications";
export const ANNOUNCEMENT_TARGET_MODE_SELECTED = "selected-vacancies";

const DEFAULT_NOTIFICATION_TIME = "2026-05-01T08:00:00.000Z";
const DEFAULT_ANNOUNCEMENT_ACTION_PATH = "/hasil-pengumuman";
const DEFAULT_ANNOUNCEMENT_TONE = "blue";
const SUPPORTED_ANNOUNCEMENT_TONES = new Set(["blue", "green", "orange", "red"]);

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeStringArray(values) {
  const rawValues = Array.isArray(values) ? values : [values];

  return Array.from(
    new Set(
      rawValues
        .map((item) => cleanText(item))
        .filter(Boolean)
    )
  );
}

function normalizeAnnouncementTone(value) {
  const normalizedTone = normalizeText(value);
  if (SUPPORTED_ANNOUNCEMENT_TONES.has(normalizedTone)) {
    return normalizedTone;
  }

  return DEFAULT_ANNOUNCEMENT_TONE;
}

function normalizeAnnouncementTargetMode(value) {
  return normalizeText(value) === ANNOUNCEMENT_TARGET_MODE_SELECTED
    ? ANNOUNCEMENT_TARGET_MODE_SELECTED
    : ANNOUNCEMENT_TARGET_MODE_ALL;
}

function toAnnouncementId(title, seed) {
  const base = cleanText(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${base || "pengumuman"}-${seed}`;
}

function parseDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoOrDefault(value, defaultValue = DEFAULT_NOTIFICATION_TIME) {
  const parsedDate = parseDateTime(value);
  return parsedDate ? parsedDate.toISOString() : defaultValue;
}

function normalizePengawasAnnouncement(rawAnnouncement, index = 0) {
  const safeAnnouncement =
    rawAnnouncement && typeof rawAnnouncement === "object" ? rawAnnouncement : {};
  const createdAt = toIsoOrDefault(safeAnnouncement.createdAt);
  const updatedAt = toIsoOrDefault(safeAnnouncement.updatedAt, createdAt);
  const activatedAtText = cleanText(safeAnnouncement.activatedAt);
  const title = cleanText(safeAnnouncement.title) || `Pengumuman ${index + 1}`;

  return {
    id:
      cleanText(safeAnnouncement.id) ||
      toAnnouncementId(title, `${Date.now()}-${index + 1}`),
    title,
    message:
      cleanText(safeAnnouncement.message) ||
      "Informasi terbaru rekrutmen PT. BPR NTB (Perseroda).",
    tone: normalizeAnnouncementTone(safeAnnouncement.tone),
    targetMode: normalizeAnnouncementTargetMode(safeAnnouncement.targetMode),
    targetVacancyIds: normalizeStringArray(safeAnnouncement.targetVacancyIds),
    targetVacancyTitles: normalizeStringArray(safeAnnouncement.targetVacancyTitles),
    isActive: Boolean(safeAnnouncement.isActive),
    actionPath:
      cleanText(safeAnnouncement.actionPath) || DEFAULT_ANNOUNCEMENT_ACTION_PATH,
    createdAt,
    updatedAt,
    activatedAt: activatedAtText ? toIsoOrDefault(activatedAtText, createdAt) : "",
    createdBy: cleanText(safeAnnouncement.createdBy) || "pengawas",
  };
}

function sortNewestFirst(notifications) {
  return [...notifications].sort((left, right) => {
    const leftTime = parseDateTime(left.createdAt)?.getTime() || 0;
    const rightTime = parseDateTime(right.createdAt)?.getTime() || 0;
    return rightTime - leftTime;
  });
}

function normalizeReadMap(rawValue) {
  if (!rawValue || typeof rawValue !== "object") return {};

  const entries = Object.entries(rawValue).filter(
    ([key, value]) => String(key || "").trim() && Boolean(value)
  );

  return Object.fromEntries(entries);
}

function readPengawasAnnouncements() {
  if (typeof window === "undefined") return [];

  try {
    const parsedAnnouncements = JSON.parse(
      window.localStorage.getItem(BPR_HIRE_PENGAWAS_ANNOUNCEMENT_STORAGE_KEY)
    );

    if (!Array.isArray(parsedAnnouncements)) return [];

    return parsedAnnouncements
      .map((item, index) => normalizePengawasAnnouncement(item, index))
      .sort((left, right) => {
        const leftTime = parseDateTime(left.updatedAt)?.getTime() || 0;
        const rightTime = parseDateTime(right.updatedAt)?.getTime() || 0;
        return rightTime - leftTime;
      });
  } catch {
    return [];
  }
}

function savePengawasAnnouncements(announcements) {
  if (typeof window === "undefined") return [];

  const normalizedList = Array.isArray(announcements)
    ? announcements.map((item, index) => normalizePengawasAnnouncement(item, index))
    : [];

  const uniqueMap = new Map();
  normalizedList.forEach((item) => {
    uniqueMap.set(item.id, item);
  });

  const dedupedAnnouncements = Array.from(uniqueMap.values()).sort((left, right) => {
    const leftTime = parseDateTime(left.updatedAt)?.getTime() || 0;
    const rightTime = parseDateTime(right.updatedAt)?.getTime() || 0;
    return rightTime - leftTime;
  });

  window.localStorage.setItem(
    BPR_HIRE_PENGAWAS_ANNOUNCEMENT_STORAGE_KEY,
    JSON.stringify(dedupedAnnouncements)
  );

  return dedupedAnnouncements;
}

export function getPengawasAnnouncements() {
  return readPengawasAnnouncements();
}

export function addPengawasAnnouncement(payload) {
  const nowIso = new Date().toISOString();
  const safePayload = payload && typeof payload === "object" ? payload : {};
  const title = cleanText(safePayload.title) || "Pengumuman Baru";

  const nextAnnouncement = normalizePengawasAnnouncement(
    {
      id: `pengawas-${toAnnouncementId(title, Date.now())}`,
      title,
      message: cleanText(safePayload.message),
      tone: safePayload.tone,
      targetMode: safePayload.targetMode,
      targetVacancyIds: safePayload.targetVacancyIds,
      targetVacancyTitles: safePayload.targetVacancyTitles,
      isActive: Boolean(safePayload.isActive),
      actionPath: cleanText(safePayload.actionPath) || DEFAULT_ANNOUNCEMENT_ACTION_PATH,
      createdAt: safePayload.createdAt || nowIso,
      updatedAt: safePayload.updatedAt || nowIso,
      activatedAt: safePayload.activatedAt,
      createdBy: safePayload.createdBy,
    },
    0
  );

  const announcements = readPengawasAnnouncements();
  return savePengawasAnnouncements([nextAnnouncement, ...announcements]);
}

export function updatePengawasAnnouncement(announcementId, payload) {
  const safeAnnouncementId = cleanText(announcementId);
  if (!safeAnnouncementId) {
    return { announcements: readPengawasAnnouncements(), updatedAnnouncement: null };
  }

  const nowIso = new Date().toISOString();
  const safePayload = payload && typeof payload === "object" ? payload : {};
  const hasIsActiveKey = Object.prototype.hasOwnProperty.call(safePayload, "isActive");
  let updatedAnnouncement = null;

  const nextAnnouncements = readPengawasAnnouncements().map((announcement) => {
    if (announcement.id !== safeAnnouncementId) return announcement;

    updatedAnnouncement = normalizePengawasAnnouncement(
      {
        ...announcement,
        title: cleanText(safePayload.title) || announcement.title,
        message: cleanText(safePayload.message) || announcement.message,
        tone: safePayload.tone || announcement.tone,
        targetMode: safePayload.targetMode || announcement.targetMode,
        targetVacancyIds: Array.isArray(safePayload.targetVacancyIds)
          ? safePayload.targetVacancyIds
          : announcement.targetVacancyIds,
        targetVacancyTitles: Array.isArray(safePayload.targetVacancyTitles)
          ? safePayload.targetVacancyTitles
          : announcement.targetVacancyTitles,
        isActive: hasIsActiveKey ? Boolean(safePayload.isActive) : announcement.isActive,
        actionPath:
          cleanText(safePayload.actionPath) ||
          announcement.actionPath ||
          DEFAULT_ANNOUNCEMENT_ACTION_PATH,
        updatedAt: safePayload.updatedAt || nowIso,
      },
      0
    );

    return updatedAnnouncement;
  });

  return {
    announcements: savePengawasAnnouncements(nextAnnouncements),
    updatedAnnouncement,
  };
}

export function deletePengawasAnnouncement(announcementId) {
  const safeAnnouncementId = cleanText(announcementId);
  if (!safeAnnouncementId) {
    return { announcements: readPengawasAnnouncements(), removedAnnouncement: null };
  }

  const announcements = readPengawasAnnouncements();
  const removedAnnouncement =
    announcements.find((announcement) => announcement.id === safeAnnouncementId) || null;
  const nextAnnouncements = announcements.filter(
    (announcement) => announcement.id !== safeAnnouncementId
  );

  return {
    announcements: savePengawasAnnouncements(nextAnnouncements),
    removedAnnouncement,
  };
}

export function activatePengawasAnnouncement(announcementId) {
  const safeAnnouncementId = cleanText(announcementId);
  if (!safeAnnouncementId) {
    return { announcements: readPengawasAnnouncements(), updatedAnnouncement: null };
  }

  const nowIso = new Date().toISOString();
  let updatedAnnouncement = null;

  const nextAnnouncements = readPengawasAnnouncements().map((announcement) => {
    if (announcement.id !== safeAnnouncementId) return announcement;

    updatedAnnouncement = {
      ...announcement,
      isActive: true,
      updatedAt: nowIso,
      activatedAt: nowIso,
    };

    return updatedAnnouncement;
  });

  return {
    announcements: savePengawasAnnouncements(nextAnnouncements),
    updatedAnnouncement,
  };
}

export function deactivatePengawasAnnouncement(announcementId) {
  const safeAnnouncementId = cleanText(announcementId);
  if (!safeAnnouncementId) {
    return { announcements: readPengawasAnnouncements(), updatedAnnouncement: null };
  }

  const nowIso = new Date().toISOString();
  let updatedAnnouncement = null;

  const nextAnnouncements = readPengawasAnnouncements().map((announcement) => {
    if (announcement.id !== safeAnnouncementId) return announcement;

    updatedAnnouncement = {
      ...announcement,
      isActive: false,
      updatedAt: nowIso,
    };

    return updatedAnnouncement;
  });

  return {
    announcements: savePengawasAnnouncements(nextAnnouncements),
    updatedAnnouncement,
  };
}

function readProfileSnapshot() {
  if (typeof window === "undefined") return {};

  try {
    const savedProfile = JSON.parse(
      window.localStorage.getItem(BPR_HIRE_PROFILE_STORAGE_KEY)
    );

    return savedProfile && typeof savedProfile === "object" ? savedProfile : {};
  } catch {
    return {};
  }
}

function readPasswordSnapshot() {
  if (typeof window === "undefined") return {};

  try {
    const savedPassword = JSON.parse(
      window.localStorage.getItem(BPR_HIRE_PASSWORD_STORAGE_KEY)
    );

    return savedPassword && typeof savedPassword === "object"
      ? savedPassword
      : {};
  } catch {
    return {};
  }
}

function buildApplicationNotification(application, index) {
  const statusText = String(application?.status || "").trim();
  const normalizedStatus = normalizeText(statusText);
  const roleName = String(application?.role || "Posisi belum tersedia").trim();
  const stage = String(application?.stage || "Seleksi Administrasi").trim();

  let tone = "blue";
  let title = `Lamaran ${roleName} Sedang Diproses`;
  let message = `Lamaran Anda sedang berada pada tahap ${stage}. Silakan pantau progres secara berkala.`;
  let actionPath = "/tahapan-seleksi";

  if (normalizedStatus.includes("ditolak")) {
    tone = "red";
    title = `Lamaran ${roleName} Ditolak`;
    message =
      "Mohon maaf, lamaran Anda belum lolos pada tahap ini. Anda masih dapat melamar pada posisi lain yang tersedia.";
    actionPath = "/hasil-pengumuman";
  } else if (
    normalizedStatus.includes("diterima") ||
    normalizedStatus.includes("lolos")
  ) {
    tone = "green";
    title = `Lamaran ${roleName} Diterima`;
    message =
      "Selamat, lamaran Anda dinyatakan lolos tahap akhir. Cek halaman hasil pengumuman untuk detail lanjutannya.";
    actionPath = "/hasil-pengumuman";
  } else if (
    normalizedStatus.includes("berhasil mendaftar") ||
    normalizedStatus.includes("menunggu")
  ) {
    tone = "green";
    title = `Lamaran ${roleName} Berhasil Dikirim`;
    message =
      "Lamaran Anda telah masuk ke sistem dan menunggu proses verifikasi tim rekrutmen.";
    actionPath = "/tahapan-seleksi";
  } else if (normalizedStatus.includes("diverifikasi")) {
    tone = "orange";
    title = `Lamaran ${roleName} Sedang Diverifikasi`;
    message =
      "Tim rekrutmen sedang melakukan pengecekan data dan berkas Anda. Mohon tunggu informasi berikutnya.";
    actionPath = "/tahapan-seleksi";
  }

  return {
    id: `application-${application?.id || index + 1}`,
    kind: "application",
    tone,
    title,
    message,
    createdAt: toIsoOrDefault(application?.appliedAt),
    actionPath,
  };
}

function buildAccountNotifications(applications) {
  const profile = readProfileSnapshot();
  const passwordState = readPasswordSnapshot();

  const email = String(profile?.email || "").trim();
  const phone = String(profile?.phone || "").trim();
  const fullName = String(profile?.fullName || "").trim();
  const address = String(profile?.address || "").trim();
  const missingFields = [];

  if (!email) missingFields.push("email");
  if (!phone) missingFields.push("nomor HP");
  if (!fullName) missingFields.push("nama lengkap");
  if (!address) missingFields.push("alamat domisili");

  const latestApplicationTime = toIsoOrDefault(
    applications?.[0]?.appliedAt,
    DEFAULT_NOTIFICATION_TIME
  );

  const profileNotification =
    missingFields.length > 0
      ? {
          id: "account-profile-warning",
          kind: "account",
          tone: "orange",
          title: "Data Profil Belum Lengkap",
          message: `Lengkapi ${missingFields.join(
            ", "
          )} agar proses seleksi akun Anda lebih optimal.`,
          createdAt: latestApplicationTime,
          actionPath: "/setting",
        }
      : {
          id: "account-profile-complete",
          kind: "account",
          tone: "green",
          title: "Data Profil Sudah Lengkap",
          message:
            "Data akun utama Anda sudah lengkap. Pastikan selalu diperbarui jika ada perubahan.",
          createdAt: latestApplicationTime,
          actionPath: "/profile",
        };

  const passwordUpdatedAt = toIsoOrDefault(
    passwordState?.updatedAt,
    DEFAULT_NOTIFICATION_TIME
  );

  const passwordNotification = passwordState?.updatedAt
    ? {
        id: "account-password-updated",
        kind: "account",
        tone: "blue",
        title: "Password Akun Telah Diperbarui",
        message:
          "Keamanan akun Anda meningkat karena password telah diperbarui. Simpan password baru dengan aman.",
        createdAt: passwordUpdatedAt,
        actionPath: "/setting",
      }
    : {
        id: "account-password-reminder",
        kind: "account",
        tone: "orange",
        title: "Pengingat Keamanan Password",
        message:
          "Untuk keamanan akun, lakukan pembaruan password secara berkala melalui menu Setting.",
        createdAt: DEFAULT_NOTIFICATION_TIME,
        actionPath: "/setting",
      };

  return [profileNotification, passwordNotification];
}

function hasAppliedToAnnouncementTarget(announcement, applications) {
  if (!Array.isArray(applications) || applications.length === 0) {
    return false;
  }

  if (announcement.targetMode === ANNOUNCEMENT_TARGET_MODE_ALL) {
    return true;
  }

  const targetVacancyIdSet = new Set(announcement.targetVacancyIds.map((item) => cleanText(item)));
  const targetVacancyTitleSet = new Set(
    announcement.targetVacancyTitles.map((item) => normalizeText(item))
  );

  if (targetVacancyIdSet.size === 0 && targetVacancyTitleSet.size === 0) {
    return false;
  }

  return applications.some((application) => {
    const vacancyId = cleanText(application?.vacancyId);
    const vacancyTitle = normalizeText(application?.role);

    return targetVacancyIdSet.has(vacancyId) || targetVacancyTitleSet.has(vacancyTitle);
  });
}

function buildPengawasAnnouncementNotifications(applications) {
  const activeAnnouncements = readPengawasAnnouncements().filter(
    (announcement) => announcement.isActive
  );

  return activeAnnouncements
    .filter((announcement) => hasAppliedToAnnouncementTarget(announcement, applications))
    .map((announcement) => ({
      id: `pengawas-announcement-${announcement.id}`,
      kind: "announcement",
      tone: announcement.tone,
      title: announcement.title,
      message: announcement.message,
      createdAt:
        announcement.activatedAt || announcement.updatedAt || announcement.createdAt,
      actionPath: announcement.actionPath || DEFAULT_ANNOUNCEMENT_ACTION_PATH,
    }));
}

export function getPesertaAnnouncementItems() {
  const currentUser = getDashboardUser();
  if (normalizeText(currentUser.role) !== "peserta") return [];

  const applications = getDashboardApplications();

  return sortNewestFirst(buildPengawasAnnouncementNotifications(applications));
}

export function getPesertaNotifications() {
  const currentUser = getDashboardUser();
  if (normalizeText(currentUser.role) !== "peserta") return [];

  const applications = getDashboardApplications();
  const applicationNotifications = applications.map((application, index) =>
    buildApplicationNotification(application, index)
  );
  const accountNotifications = buildAccountNotifications(applications);

  return sortNewestFirst([
    ...applicationNotifications,
    ...getPesertaAnnouncementItems(),
    ...accountNotifications,
  ]);
}

export function getPesertaNotificationCount() {
  return getPesertaNotifications().length;
}

export function getPesertaNotificationReadMap() {
  if (typeof window === "undefined") return {};

  try {
    const parsedMap = JSON.parse(
      window.localStorage.getItem(BPR_HIRE_NOTIFICATION_READ_STORAGE_KEY)
    );
    return normalizeReadMap(parsedMap);
  } catch {
    return {};
  }
}

export function markPesertaNotificationAsRead(notificationId) {
  const safeId = String(notificationId || "").trim();
  if (!safeId || typeof window === "undefined") {
    return getPesertaNotificationReadMap();
  }

  const currentMap = getPesertaNotificationReadMap();
  const nextMap = {
    ...currentMap,
    [safeId]: true,
  };

  window.localStorage.setItem(
    BPR_HIRE_NOTIFICATION_READ_STORAGE_KEY,
    JSON.stringify(nextMap)
  );

  return nextMap;
}

export function getPesertaUnreadNotificationCount() {
  const notifications = getPesertaNotifications();
  const readMap = getPesertaNotificationReadMap();

  return notifications.reduce(
    (total, notification) => total + (readMap[notification.id] ? 0 : 1),
    0
  );
}

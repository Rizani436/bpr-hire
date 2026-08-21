const toPathParam = (value) => encodeURIComponent(String(value ?? "").trim());
const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();

const withSlash = (value) => {
  const path = String(value ?? "").trim();
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
};

export const API_ENDPOINTS = {
  baseUrl: apiBaseUrl,
  uploads: (path = "") => `/uploads${withSlash(path)}`,

  auth: {
    login: () => "/auth/login",
    logout: () => "/auth/logout",
    token: () => "/auth/token",
    register: () => "/auth/register",
    sendRegisterOtp: () => "/auth/otp/register/send",
    sendForgotPasswordOtp: () => "/auth/otp/forgot-password/send",
    verifyForgotPasswordOtp: () => "/auth/otp/forgot-password/verify",
    resetForgotPassword: () => "/auth/forgot-password/reset",
    loginAttempt: () => "/auth/login-attempt",
    sessionEvents: (token = "") =>
      `/auth/session-events?token=${toPathParam(token)}`,
  },

  reports: {
    error: () => "/reports/error",
  },

  users: {
    list: () => "/users",
    create: () => "/users",
    me: () => "/users/me",
    activityLogs: () => "/users/activity-logs",
    detail: (userUUID = "") => `/users/${toPathParam(userUUID)}`,
    updateProfile: (userUUID = "") => `/users/${toPathParam(userUUID)}`,
    editPassword: (userUUID = "") =>
      `/users/${toPathParam(userUUID)}/password`,
    forgotPassword: (userUUID = "") =>
      `/users/${toPathParam(userUUID)}/forgot-password`,
    gpsTrack: () => "/users/gps-track",
  },

  lamaran: {
    list: () => "/lamaran",
    applications: () => "/lamaran/applications",
    myApplications: () => "/lamaran/applications/me",
    removeApplication: (applicationUUID = "") =>
      `/lamaran/applications/${toPathParam(applicationUUID)}`,
    create: () => "/lamaran",
    detail: (lamaranUUID = "") => `/lamaran/${toPathParam(lamaranUUID)}`,
    apply: (lamaranUUID = "") =>
      `/lamaran/${toPathParam(lamaranUUID)}/apply`,
    update: (lamaranUUID = "") => `/lamaran/${toPathParam(lamaranUUID)}`,
    updateStatus: (lamaranUUID = "") =>
      `/lamaran/${toPathParam(lamaranUUID)}/status`,
    remove: (lamaranUUID = "") => `/lamaran/${toPathParam(lamaranUUID)}`,
  },

  cabangKantor: {
    list: () => "/cabang-kantor",
  },

  masterData: {
    unitKerjaList: () => "/master-data/unit-kerja",
    unitKerjaImport: () => "/master-data/unit-kerja/import",
    pegawaiList: () => "/master-data/pegawai",
    pegawaiLookup: () => "/master-data/pegawai/lookup",
    pegawaiImport: () => "/master-data/pegawai/import",
  },

  generate: {
    noPermohonan: () => "/generate/no-permohonan",
    noPermohonanDetail: (noPermohonan = "") =>
      `/generate/no-permohonan/${toPathParam(noPermohonan)}`,
  },

  datanasabah: {
    dashboard: () => "/datanasabah/dashboard",
    dataDiri: {
      list: () => "/datanasabah/data-diri",
      detail: (noPermohonan = "") =>
        `/datanasabah/data-diri/${toPathParam(noPermohonan)}`,
    },
    dataPermohonan: {
      list: () => "/datanasabah/data-permohonan",
    },
    dataUsaha: {
      list: () => "/datanasabah/data-usaha",
    },
    dataInstansi: {
      list: () => "/datanasabah/data-instansi",
    },
    dataJaminan: {
      list: () => "/datanasabah/data-jaminan",
    },
    dataAnalisis: {
      list: () => "/datanasabah/data-analisis",
    },
  },
};

import { API_ENDPOINTS } from "../config/apiEndpoints";
import { handleAuthRedirect } from "./authRedirect";

const buildUrl = (path) => `${API_ENDPOINTS.baseUrl}${path}`;
const getAccessToken = () =>
  typeof window !== "undefined"
    ? String(window.localStorage.getItem("accessToken") || "").trim()
    : "";

function buildHeaders(includeAuth = false) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (includeAuth) {
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  return headers;
}

function buildFormHeaders(includeAuth = false) {
  const headers = {};

  if (includeAuth) {
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  return headers;
}

async function parseResponseOrThrow(response) {
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const errorMessage =
      String(payload?.msg || payload?.message || "").trim() ||
      `Request gagal (${response.status}).`;
    handleAuthRedirect({
      status: response.status,
      message: errorMessage,
    });
    const requestError = new Error(errorMessage);
    requestError.status = response.status;
    requestError.payload = payload;
    throw requestError;
  }

  return payload;
}

async function requestJson(path, { method = "GET", body, includeAuth = false } = {}) {
  const requestOptions = {
    method,
    credentials: "include",
    headers: buildHeaders(includeAuth),
  };

  if (body !== undefined) {
    requestOptions.body = JSON.stringify(body || {});
  }

  const response = await fetch(buildUrl(path), requestOptions);
  return parseResponseOrThrow(response);
}

async function postJson(path, body, includeAuth = false) {
  return requestJson(path, {
    method: "POST",
    body,
    includeAuth,
  });
}

async function postForm(path, formData, includeAuth = false) {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    credentials: "include",
    headers: buildFormHeaders(includeAuth),
    body: formData,
  });
  return parseResponseOrThrow(response);
}

async function putForm(path, formData, includeAuth = false) {
  const response = await fetch(buildUrl(path), {
    method: "PUT",
    credentials: "include",
    headers: buildFormHeaders(includeAuth),
    body: formData,
  });
  return parseResponseOrThrow(response);
}

async function putJson(path, body, includeAuth = false) {
  return requestJson(path, {
    method: "PUT",
    body,
    includeAuth,
  });
}

function isFormDataPayload(value) {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

async function patchJson(path, body, includeAuth = false) {
  return requestJson(path, {
    method: "PATCH",
    body,
    includeAuth,
  });
}

async function deleteJson(path, includeAuth = false) {
  return requestJson(path, {
    method: "DELETE",
    includeAuth,
  });
}

async function getJson(path, includeAuth = false) {
  const response = await fetch(buildUrl(path), {
    method: "GET",
    credentials: "include",
    headers: buildHeaders(includeAuth),
  });
  return parseResponseOrThrow(response);
}

export const loginApi = (identity, password) =>
  postJson(
    API_ENDPOINTS.auth.login(),
    {
      identity,
      password,
    },
    false
  );

export const logoutApi = () =>
  deleteJson(API_ENDPOINTS.auth.logout(), true);

export const sendRegisterOtpApi = (email) =>
  postJson(API_ENDPOINTS.auth.sendRegisterOtp(), { email }, false);

export const registerPesertaApi = (payload) =>
  postJson(API_ENDPOINTS.auth.register(), payload, false);

export const sendForgotPasswordOtpApi = (identity) =>
  postJson(API_ENDPOINTS.auth.sendForgotPasswordOtp(), { identity }, false);

export const verifyForgotPasswordOtpApi = (identity, otpCode) =>
  postJson(
    API_ENDPOINTS.auth.verifyForgotPasswordOtp(),
    {
      identity,
      otpCode,
    },
    false
  );

export const resetForgotPasswordApi = (resetProofToken, newPassword) =>
  postJson(
    API_ENDPOINTS.auth.resetForgotPassword(),
    {
      resetProofToken,
      newPassword,
    },
    false
  );

export const getUsersApi = ({ search = "", role = "" } = {}) => {
  const params = new URLSearchParams();
  const safeSearch = String(search || "").trim();
  const safeRole = String(role || "").trim();

  if (safeSearch) params.set("search", safeSearch);
  if (safeRole) params.set("role", safeRole);

  const query = params.toString();
  const endpoint = `${API_ENDPOINTS.users.list()}${query ? `?${query}` : ""}`;
  return getJson(endpoint, true);
};

export const getOwnProfileApi = () => getJson(API_ENDPOINTS.users.me(), true);

export const createUserApi = (payload) =>
  postJson(API_ENDPOINTS.users.create(), payload, true);

export const updateUserProfileApi = (userUUID, payload) =>
  isFormDataPayload(payload)
    ? putForm(API_ENDPOINTS.users.updateProfile(userUUID), payload, true)
    : putJson(API_ENDPOINTS.users.updateProfile(userUUID), payload, true);

export const updateUserPasswordApi = (userUUID, payload) =>
  putJson(API_ENDPOINTS.users.editPassword(userUUID), payload, true);

export const deleteUserApi = (userUUID) =>
  deleteJson(API_ENDPOINTS.users.detail(userUUID), true);

export const createUserActivityLogApi = (payload) =>
  postJson(API_ENDPOINTS.users.activityLogs(), payload, true);

export const getUserActivityLogsApi = ({
  eventType = "",
  search = "",
  limit = 200,
} = {}) => {
  const params = new URLSearchParams();
  const safeEventType = String(eventType || "").trim().toLowerCase();
  const safeSearch = String(search || "").trim();
  const safeLimit = Number(limit);

  if (safeEventType) params.set("eventType", safeEventType);
  if (safeSearch) params.set("search", safeSearch);
  if (Number.isFinite(safeLimit)) params.set("limit", String(Math.trunc(safeLimit)));

  const query = params.toString();
  const endpoint = `${API_ENDPOINTS.users.activityLogs()}${query ? `?${query}` : ""}`;
  return getJson(endpoint, true);
};

export const getLamaranApi = ({ search = "", status = "", title = "" } = {}) => {
  const params = new URLSearchParams();
  const safeSearch = String(search || "").trim();
  const safeStatus = String(status || "").trim().toLowerCase();
  const safeTitle = String(title || "").trim();

  if (safeSearch) params.set("search", safeSearch);
  if (safeStatus) params.set("status", safeStatus);
  if (safeTitle) params.set("title", safeTitle);

  const query = params.toString();
  const endpoint = `${API_ENDPOINTS.lamaran.list()}${query ? `?${query}` : ""}`;
  return getJson(endpoint, true);
};

export const getMyLamaranApplicationsApi = () =>
  getJson(API_ENDPOINTS.lamaran.myApplications(), true);

export const getLamaranApplicationsApi = () =>
  getJson(API_ENDPOINTS.lamaran.applications(), true);

export const deleteLamaranApplicationApi = (applicationUUID) =>
  deleteJson(API_ENDPOINTS.lamaran.removeApplication(applicationUUID), true);

export const createLamaranApi = (payload) =>
  postJson(API_ENDPOINTS.lamaran.create(), payload, true);

export const updateLamaranApi = (lamaranUUID, payload) =>
  putJson(API_ENDPOINTS.lamaran.update(lamaranUUID), payload, true);

export const applyLamaranApi = (lamaranUUID) =>
  postJson(API_ENDPOINTS.lamaran.apply(lamaranUUID), {}, true);

export const updateLamaranStatusApi = (lamaranUUID, isActive) =>
  patchJson(API_ENDPOINTS.lamaran.updateStatus(lamaranUUID), { isActive }, true);

export const deleteLamaranApi = (lamaranUUID) =>
  deleteJson(API_ENDPOINTS.lamaran.remove(lamaranUUID), true);

export const getMasterDataUnitKerjaApi = () =>
  getJson(API_ENDPOINTS.masterData.unitKerjaList(), true);

export const importMasterDataUnitKerjaExcelApi = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return postForm(API_ENDPOINTS.masterData.unitKerjaImport(), formData, true);
};

export const getMasterDataPegawaiApi = ({ search = "" } = {}) => {
  const params = new URLSearchParams();
  const safeSearch = String(search || "").trim();
  if (safeSearch) params.set("search", safeSearch);
  const query = params.toString();
  const endpoint = `${API_ENDPOINTS.masterData.pegawaiList()}${
    query ? `?${query}` : ""
  }`;
  return getJson(endpoint, true);
};

export const getPegawaiLookupApi = ({ search = "", limit = 500 } = {}) => {
  const params = new URLSearchParams();
  const safeSearch = String(search || "").trim();
  const safeLimit = Number(limit);

  if (safeSearch) params.set("search", safeSearch);
  if (Number.isFinite(safeLimit)) {
    params.set("limit", String(Math.max(1, Math.trunc(safeLimit))));
  }

  const query = params.toString();
  const endpoint = `${API_ENDPOINTS.masterData.pegawaiLookup()}${
    query ? `?${query}` : ""
  }`;
  return getJson(endpoint, true);
};

export const importMasterDataPegawaiExcelApi = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return postForm(API_ENDPOINTS.masterData.pegawaiImport(), formData, true);
};

import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { API_ENDPOINTS } from "./config/apiEndpoints";
import { handleAuthRedirect, redirectToLoginPage } from "./utils/authRedirect";

const useAxios = () => {
  const navigate = useNavigate();
  const axiosInstance = useRef(
    axios.create({
      baseURL: API_ENDPOINTS.baseUrl,
      withCredentials: true,
    })
  ).current;

  const [, setIsRefreshing] = useState(false);
  const [failedRequests, setFailedRequests] = useState([]);

  const processQueue = (error, token = null) => {
    failedRequests.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });
    setFailedRequests([]);
  };

  const getNewAccessToken = async () => {
    setIsRefreshing(true);
    try {
      const response = await axiosInstance.post(API_ENDPOINTS.auth.token());
      const { accessToken } = response.data;

      localStorage.setItem("accessToken", accessToken);
      axiosInstance.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${accessToken}`;
      processQueue(null, accessToken);
      return accessToken;
    } catch (error) {
      redirectToLoginPage(navigate);
      processQueue(error, null);
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  };

  const requestInterceptor = (config) => {
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      config.headers["Authorization"] = `Bearer ${accessToken}`;
    }
    return config;
  };

  const responseInterceptor = async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;
    const message =
      error?.response?.data?.msg ||
      error?.response?.data?.message ||
      error?.message;

    if (handleAuthRedirect({ status, message, navigate })) {
      return Promise.reject(error);
    }

    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const newAccessToken = await getNewAccessToken();
        originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
        return axiosInstance(originalRequest);
      } catch (err) {
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  };

  useEffect(() => {
    const reqInterceptor = axiosInstance.interceptors.request.use(
      requestInterceptor,
      (error) => Promise.reject(error)
    );

    const resInterceptor = axiosInstance.interceptors.response.use(
      (response) => response,
      responseInterceptor
    );

    return () => {
      axiosInstance.interceptors.request.eject(reqInterceptor);
      axiosInstance.interceptors.response.eject(resInterceptor);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  return axiosInstance;
};

export default useAxios;

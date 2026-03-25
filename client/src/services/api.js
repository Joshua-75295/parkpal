import axios from "axios";
import {
  API_BASE_URL,
  AUTH_SESSION_EXPIRED_EVENT,
} from "../utils/constants.js";

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let refreshPromise = null;

const notifySessionExpired = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
  }
};

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config ?? {};
    const responseStatus = error.response?.status;

    if (
      responseStatus !== 401 ||
      originalRequest._retry ||
      originalRequest.skipAuthRefresh
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshClient
          .post("/auth/refresh", {})
          .finally(() => {
            refreshPromise = null;
          });
      }

      await refreshPromise;
      return API(originalRequest);
    } catch (refreshError) {
      notifySessionExpired();
      return Promise.reject(refreshError);
    }
  }
);

export const getApiErrorMessage = (
  error,
  fallback = "Something went wrong. Please try again."
) => error?.response?.data?.message || error?.message || fallback;

export default API;

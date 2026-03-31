import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 60_000,
});

// Store for the auth store reference (set by App.jsx to avoid circular imports)
let authStoreRef = null;
export const setAuthStoreRef = (ref) => { authStoreRef = ref; };

// Track if we're currently refreshing to prevent loops
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// Request interceptor — attach Bearer token
api.interceptors.request.use((config) => {
  const token = authStoreRef?.getState?.()?.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    window.__accessToken = token;
  }
  return config;
});

// Response interceptor — auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/refresh')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }).catch((err) => Promise.reject(err));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const newToken = await authStoreRef?.getState?.()?.refresh?.();
        if (!newToken) throw new Error('Refresh failed');

        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        authStoreRef?.getState?.()?.logout?.();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

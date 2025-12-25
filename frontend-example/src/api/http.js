import axios from 'axios';

let getAuthStore = null;

export const registerAuthStore = (getter) => {
  getAuthStore = getter;
};

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

let refreshPromise = null;

apiClient.interceptors.request.use((config) => {
  const store = typeof getAuthStore === 'function' ? getAuthStore() : null;
  if (store?.accessToken) {
    config.headers.Authorization = `Bearer ${store.accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const store = typeof getAuthStore === 'function' ? getAuthStore() : null;
    const originalRequest = error.config;

    if (error.response?.status === 401 && store && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = store
          .refresh()
          .catch((err) => {
            refreshPromise = null;
            throw err;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${store.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        await store.logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;

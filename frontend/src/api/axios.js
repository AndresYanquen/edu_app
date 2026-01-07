import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import router from '../router'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
})

let refreshPromise = null

// REQUEST INTERCEPTOR
api.interceptors.request.use(
  (config) => {
    const auth = useAuthStore()

    if (auth.accessToken) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${auth.accessToken}`
    }

    return config
  },
  (error) => Promise.reject(error),
)

// RESPONSE INTERCEPTOR
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const auth = useAuthStore()
    const originalRequest = error.config || {}

    const isAuthRoute =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/logout')

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthRoute &&
      !auth.isLoggingOut
    ) {
      originalRequest._retry = true

      try {
        if (!refreshPromise) {
          refreshPromise = auth
            .refresh()
            .finally(() => {
              refreshPromise = null
            })
        }

        await refreshPromise

        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${auth.accessToken}`

        return api(originalRequest)
      } catch (refreshError) {
        await auth.logout()
        router.push('/login')
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)

export default api

import { defineStore } from 'pinia'
import api from '../api/axios'

const STAFF_ROLES = ['admin', 'instructor', 'content_editor', 'enrollment_manager']

const normalizeRoles = (roles) => {
  if (!Array.isArray(roles)) {
    return []
  }
  return [...new Set(roles.filter(Boolean))]
}

const ME_CACHE_KEY = 'academy:me'
const ME_CACHE_TTL_MS = Number(import.meta.env.VITE_ME_CACHE_TTL_MS) || 30 * 1000

const getStorage = () => {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

const readCachedProfile = () => {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(ME_CACHE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
      storage.removeItem(ME_CACHE_KEY)
      return null
    }

    return parsed.payload
  } catch (err) {
    console.warn('Failed to read cached profile', err)
    return null
  }
}

const writeCachedProfile = (payload = {}) => {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(
      ME_CACHE_KEY,
      JSON.stringify({
        payload,
        expiresAt: Date.now() + ME_CACHE_TTL_MS,
      }),
    )
  } catch (err) {
    console.warn('Failed to cache profile payload', err)
  }
}

const clearCachedProfile = () => {
  const storage = getStorage()
  if (!storage) return
  storage.removeItem(ME_CACHE_KEY)
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: null, // MEMORY ONLY
    user: null,
    globalRoles: [],
    loading: false,
    initialized: false,
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken),
    hasRole: (state) => (role) => state.globalRoles.includes(role),
    hasAnyRole: (state) => (roles = []) => roles.some((role) => state.globalRoles.includes(role)),
    isAdmin: (state) => state.globalRoles.includes('admin'),
    isStaff: (state) => state.globalRoles.some((role) => STAFF_ROLES.includes(role)),
  },

  actions: {
    setRoles(roles = []) {
      this.globalRoles = normalizeRoles(roles)
    },

    async login(email, password) {
      this.loading = true
      try {
        const { data } = await api.post('/auth/login', { email, password })

        this.accessToken = data.accessToken
        this.user = data.user || null
        this.setRoles(data.globalRoles || [])
        writeCachedProfile({
          user: this.user,
          globalRoles: data.globalRoles || [],
        })
      } finally {
        this.loading = false
      }
    },

    async refresh() {
      const { data } = await api.post('/auth/refresh')
      this.accessToken = data.accessToken

      const cached = readCachedProfile()
      if (cached) {
        this.user = cached.user || null
        this.setRoles(cached.globalRoles || [])
        return
      }

      try {
        const profile = await api.get('/me')
        const payload = profile.data || {}
        if (payload.user) {
          this.user = payload.user
        } else {
          this.user = {
            id: payload.id,
            email: payload.email,
            fullName: payload.fullName,
            status: payload.status,
          }
        }
        this.setRoles(payload.globalRoles || [])
        writeCachedProfile({
          user: this.user,
          globalRoles: payload.globalRoles || [],
        })
      } catch (err) {
        console.warn('Profile fetch failed during refresh')
        throw err
      }
    },

    async logout() {
      try {
        await api.post('/auth/logout')
      } catch (err) {
        console.warn('Logout request failed')
      } finally {
        this.accessToken = null
        this.user = null
        this.globalRoles = []
        clearCachedProfile()
        this.initialized = true
      }
    },

    async bootstrap() {
      try {
        await this.refresh()
      } catch (err) {
        await this.logout()
      } finally {
        this.initialized = true
      }
    },

    getDefaultRoute() {
      if (this.hasRole('admin')) {
        return '/admin'
      }
      if (this.hasRole('instructor')) {
        return '/instructor'
      }
      if (this.hasAnyRole(['content_editor', 'enrollment_manager'])) {
        return '/cms/courses'
      }
      if (this.hasRole('student')) {
        return '/student'
      }
      return '/login'
    },
  },
})

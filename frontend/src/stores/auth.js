import { defineStore } from 'pinia'
import api from '../api/axios'

const STAFF_ROLES = ['admin', 'instructor', 'content_editor', 'enrollment_manager']

const normalizeRoles = (roles) => {
  if (!Array.isArray(roles)) {
    return []
  }
  return [...new Set(roles.filter(Boolean))]
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
      } finally {
        this.loading = false
      }
    },

    async refresh() {
      const { data } = await api.post('/auth/refresh')
      this.accessToken = data.accessToken

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

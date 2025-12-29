import { defineStore } from 'pinia'
import api from '../api/axios'

const PRIMARY_ROLE_ORDER = ['admin', 'instructor', 'content_editor', 'enrollment_manager', 'student']

const buildRoleList = (roles, fallbackRole) => {
  const base = Array.isArray(roles) ? roles.filter(Boolean) : []
  if (fallbackRole) {
    base.push(fallbackRole)
  }
  return [...new Set(base)]
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: null, // MEMORY ONLY
    user: null,
    role: null,
    globalRoles: [],
    loading: false,
    initialized: false,
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken),
    hasRole: (state) => (role) => state.globalRoles.includes(role),
    hasAnyRole: (state) => (roles = []) => roles.some((role) => state.globalRoles.includes(role)),
    primaryRole: (state) => state.role,
  },

  actions: {
    setRoles(roles = [], fallbackRole = null) {
      const normalized = buildRoleList(roles, fallbackRole)
      this.globalRoles = normalized
      const primary =
        PRIMARY_ROLE_ORDER.find((role) => normalized.includes(role)) || normalized[0] || null
      this.role = primary || null
    },

    async login(email, password) {
      this.loading = true
      try {
        const { data } = await api.post('/auth/login', { email, password })

        this.accessToken = data.accessToken
        this.user = data.user
        this.setRoles(data.user?.globalRoles || [], data.user?.role ?? null)
      } finally {
        this.loading = false
      }
    },

    async refresh() {
      const { data } = await api.post('/auth/refresh')
      this.accessToken = data.accessToken

      // Hydrate user if missing (safe)
      if (!this.user) {
        try {
          const profile = await api.get('/me')
          this.user = {
            id: profile.data.id,
            email: profile.data.email,
            fullName: profile.data.fullName,
          }
          this.setRoles(profile.data.globalRoles || [], profile.data.role)
        } catch (err) {
          // Profile can be fetched later; token is valid
          console.warn('Profile fetch failed during refresh')
        }
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
        this.role = null
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

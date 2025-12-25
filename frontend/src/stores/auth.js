import { defineStore } from 'pinia'
import api from '../api/axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: null, // MEMORY ONLY
    user: null,
    role: null,
    loading: false,
    initialized: false,
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken),
  },

  actions: {
    async login(email, password) {
      this.loading = true
      try {
        const { data } = await api.post('/auth/login', { email, password })

        this.accessToken = data.accessToken
        this.user = data.user
        this.role = data.user?.role ?? null
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
          this.role = profile.data.role
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
  },
})

import { defineStore } from 'pinia';
import apiClient, { registerAuthStore } from '../api/http';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: null,
    user: null,
  }),
  getters: {
    role: (state) => state.user?.role ?? null,
    isAuthenticated: (state) => Boolean(state.accessToken),
  },
  actions: {
    async login(email, password) {
      const { data } = await apiClient.post('/auth/login', { email, password });
      this.accessToken = data.accessToken;
      this.user = data.user;
    },
    async refresh() {
      const { data } = await apiClient.post('/auth/refresh');
      this.accessToken = data.accessToken;

      if (!this.user && this.accessToken) {
        const profile = await apiClient.get('/me');
        this.user = {
          id: profile.data.id,
          email: profile.data.email,
          fullName: profile.data.fullName,
          role: profile.data.role,
        };
      }

      return data.accessToken;
    },
    async logout() {
      try {
        await apiClient.post('/auth/logout');
      } finally {
        this.clearSession();
      }
    },
    clearSession() {
      this.accessToken = null;
      this.user = null;
    },
  },
});

registerAuthStore(() => useAuthStore());

// Call useAuthStore().refresh() during app bootstrap (e.g. in main.js) to restore sessions.

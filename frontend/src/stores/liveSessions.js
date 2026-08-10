import { defineStore } from 'pinia';
import {
  getSessionAttendance,
  importZoomAttendance,
  previewZoomAttendanceImport,
  saveSessionAttendance,
} from '../api/liveSessions';

export const useLiveSessionsStore = defineStore('liveSessions', {
  state: () => ({
    attendanceBySession: {},
    loadingAttendanceBySession: {},
    savingAttendanceBySession: {},
    importingAttendanceBySession: {},
  }),
  actions: {
    async fetchAttendance(sessionId) {
      if (!sessionId) {
        throw new Error('sessionId is required');
      }
      this.loadingAttendanceBySession = {
        ...this.loadingAttendanceBySession,
        [sessionId]: true,
      };
      try {
        const payload = await getSessionAttendance(sessionId);
        this.attendanceBySession = {
          ...this.attendanceBySession,
          [sessionId]: payload,
        };
        return payload;
      } finally {
        this.loadingAttendanceBySession = {
          ...this.loadingAttendanceBySession,
          [sessionId]: false,
        };
      }
    },

    async saveAttendance(sessionId, items = []) {
      if (!sessionId) {
        throw new Error('sessionId is required');
      }
      this.savingAttendanceBySession = {
        ...this.savingAttendanceBySession,
        [sessionId]: true,
      };
      try {
        return await saveSessionAttendance(sessionId, { items });
      } finally {
        this.savingAttendanceBySession = {
          ...this.savingAttendanceBySession,
          [sessionId]: false,
        };
      }
    },

    async previewZoomAttendance(sessionId, payload = {}) {
      if (!sessionId) {
        throw new Error('sessionId is required');
      }
      this.importingAttendanceBySession = {
        ...this.importingAttendanceBySession,
        [sessionId]: true,
      };
      try {
        return await previewZoomAttendanceImport(sessionId, payload);
      } finally {
        this.importingAttendanceBySession = {
          ...this.importingAttendanceBySession,
          [sessionId]: false,
        };
      }
    },

    async importZoomAttendance(sessionId, payload = {}) {
      if (!sessionId) {
        throw new Error('sessionId is required');
      }
      this.importingAttendanceBySession = {
        ...this.importingAttendanceBySession,
        [sessionId]: true,
      };
      try {
        return await importZoomAttendance(sessionId, payload);
      } finally {
        this.importingAttendanceBySession = {
          ...this.importingAttendanceBySession,
          [sessionId]: false,
        };
      }
    },
  },
});

export default useLiveSessionsStore;

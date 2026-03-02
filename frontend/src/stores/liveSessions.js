import { defineStore } from 'pinia';
import { getSessionAttendance, saveSessionAttendance } from '../api/liveSessions';

export const useLiveSessionsStore = defineStore('liveSessions', {
  state: () => ({
    attendanceBySession: {},
    loadingAttendanceBySession: {},
    savingAttendanceBySession: {},
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
  },
});

export default useLiveSessionsStore;

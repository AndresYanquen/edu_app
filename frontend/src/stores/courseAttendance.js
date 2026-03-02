import { defineStore } from 'pinia';
import {
  getCourseWeekAttendance,
  saveCourseWeekAttendance,
  saveAttendanceCellFallback,
} from '../api/courseAttendance';

const toKey = (courseId, groupId, weekStart) =>
  `${courseId || ''}:${groupId || 'all'}:${weekStart || ''}`;

export const useCourseAttendanceStore = defineStore('courseAttendance', {
  state: () => ({
    weekCache: {},
    loadingWeek: false,
    savingCell: false,
    error: '',
    weeklyBatchSupported: true,
  }),
  actions: {
    async fetchCourseWeekAttendance(courseId, groupId, weekStart) {
      this.loadingWeek = true;
      this.error = '';
      try {
        const payload = await getCourseWeekAttendance(courseId, {
          ...(groupId ? { groupId } : {}),
          weekStart,
        });
        this.weekCache = {
          ...this.weekCache,
          [toKey(courseId, groupId, weekStart)]: payload,
        };
        return payload;
      } catch (err) {
        this.error = err?.response?.data?.error || 'Failed to load attendance';
        throw err;
      } finally {
        this.loadingWeek = false;
      }
    },

    getCachedWeek(courseId, groupId, weekStart) {
      return this.weekCache[toKey(courseId, groupId, weekStart)] || null;
    },

    async saveCourseWeekAttendance(courseId, groupId, weekStart, updates = []) {
      if (!updates.length) {
        return { updated: 0 };
      }
      this.savingCell = true;
      try {
        if (this.weeklyBatchSupported) {
          try {
            return await saveCourseWeekAttendance(courseId, {
              groupId: groupId || null,
              weekStart,
              updates,
            });
          } catch (err) {
            const status = err?.response?.status;
            if (status !== 404 && status !== 405) {
              throw err;
            }
            this.weeklyBatchSupported = false;
          }
        }

        let updated = 0;
        for (const item of updates) {
          await saveAttendanceCellFallback(item);
          updated += 1;
        }
        return { updated, mode: 'fallback' };
      } finally {
        this.savingCell = false;
      }
    },
  },
});

export default useCourseAttendanceStore;

import { defineStore } from 'pinia';
import {
  getCourseWeekAttendance,
  getCourseMonthAttendance,
  saveCourseWeekAttendance,
  saveAttendanceCellFallback,
} from '../api/courseAttendance';

const toKey = (courseId, groupId, weekStart) =>
  `${courseId || ''}:${groupId || 'all'}:${weekStart || ''}`;
const toSummaryKey = (courseId, groupId, periodMode, periodAnchor) =>
  `${courseId || ''}:${groupId || 'all'}:${periodMode || 'week'}:${periodAnchor || ''}`;

export const useCourseAttendanceStore = defineStore('courseAttendance', {
  state: () => ({
    weekCache: {},
    summaryCache: {},
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

    getCachedSummary(courseId, groupId, periodMode, periodAnchor) {
      return this.summaryCache[toSummaryKey(courseId, groupId, periodMode, periodAnchor)] || null;
    },

    async fetchCourseAttendanceSummary(courseId, groupId, periodMode, periodAnchor) {
      if (periodMode === 'week') {
        return this.fetchCourseWeekAttendance(courseId, groupId, periodAnchor);
      }

      const cacheKey = toSummaryKey(courseId, groupId, periodMode, periodAnchor);
      if (this.summaryCache[cacheKey]) {
        return this.summaryCache[cacheKey];
      }

      this.loadingWeek = true;
      this.error = '';
      try {
        if (periodMode !== 'month') {
          return null;
        }
        const summary = await getCourseMonthAttendance(courseId, {
          ...(groupId ? { groupId } : {}),
          month: periodAnchor,
        });
        this.summaryCache = {
          ...this.summaryCache,
          [cacheKey]: summary,
        };
        return summary;
      } catch (err) {
        this.error = err?.response?.data?.error || 'Failed to load attendance';
        throw err;
      } finally {
        this.loadingWeek = false;
      }
    },

    async saveCourseWeekAttendance(courseId, groupId, weekStart, updates = []) {
      if (!updates.length) {
        return { updated: 0 };
      }
      this.savingCell = true;
      try {
        let result;
        if (this.weeklyBatchSupported) {
          try {
            result = await saveCourseWeekAttendance(courseId, {
              groupId: groupId || null,
              weekStart,
              updates,
            });
            this.weekCache = {};
            this.summaryCache = {};
            return result;
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
        this.weekCache = {};
        this.summaryCache = {};
        return { updated, mode: 'fallback' };
      } finally {
        this.savingCell = false;
      }
    },
  },
});

export default useCourseAttendanceStore;

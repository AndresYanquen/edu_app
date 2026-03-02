import { defineStore } from 'pinia';
import {
  getCourseWeekAttendance,
  saveCourseWeekAttendance,
  saveAttendanceCellFallback,
} from '../api/courseAttendance';

const toKey = (courseId, groupId, weekStart) =>
  `${courseId || ''}:${groupId || 'all'}:${weekStart || ''}`;
const toSummaryKey = (courseId, groupId, periodMode, periodAnchor) =>
  `${courseId || ''}:${groupId || 'all'}:${periodMode || 'week'}:${periodAnchor || ''}`;

const isoDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const mondayOf = (input = new Date()) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return new Date();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const monthWeekStarts = (anchor) => {
  const anchorDate = new Date(`${anchor}T00:00:00`);
  if (Number.isNaN(anchorDate.getTime())) {
    return [];
  }
  const firstDay = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const lastDay = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  const cursor = mondayOf(firstDay);
  const weeks = [];
  while (cursor <= lastDay) {
    weeks.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
};

const buildWeekRangeLabel = (weekStart) => {
  const start = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(start.getTime())) return '';
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};

const aggregateMonthPayload = (anchor, weeks = []) => {
  const anchorDate = new Date(`${anchor}T00:00:00`);
  if (Number.isNaN(anchorDate.getTime())) {
    return {
      periodMode: 'month',
      periodAnchor: anchor,
      days: [],
      students: [],
      stats: {
        totalStudents: 0,
        totalSessions: 0,
        takenSessions: 0,
        presentPct: null,
        atRiskCount: 0,
        hasAttendanceRecords: false,
      },
      segments: [],
    };
  }
  const month = anchorDate.getMonth();
  const year = anchorDate.getFullYear();
  const studentsMap = new Map();
  const days = [];
  const segments = [];

  weeks.forEach((payload, index) => {
    const payloadDays = Array.isArray(payload?.days) ? payload.days : [];
    const visibleDays = payloadDays.filter((day) => {
      const raw = day?.date || day?.day || day?.isoDate;
      if (!raw) return false;
      const date = new Date(`${raw}T00:00:00`);
      if (Number.isNaN(date.getTime())) return false;
      const weekday = date.getDay();
      return date.getMonth() === month && date.getFullYear() === year && weekday >= 1 && weekday <= 5;
    });
    if (!visibleDays.length) {
      return;
    }
    days.push(...visibleDays);
    segments.push({
      id: payload?.weekStart || `w-${index + 1}`,
      label: `Semana ${index + 1}`,
      subLabel: buildWeekRangeLabel(payload?.weekStart || visibleDays[0]?.date || ''),
      days: visibleDays,
    });

    const payloadStudents = Array.isArray(payload?.students) ? payload.students : [];
    payloadStudents.forEach((student) => {
      const userId = student?.userId || student?.user_id;
      if (!userId) return;
      const current = studentsMap.get(userId) || {
        userId,
        fullName: student?.fullName || student?.full_name || '',
        email: student?.email || '',
        bySession: {},
      };
      const bySessionRaw = student?.bySession || student?.by_session || {};
      current.bySession = {
        ...current.bySession,
        ...Object.entries(bySessionRaw).reduce((acc, [sessionId, value]) => {
          acc[sessionId] = {
            status: value?.status || null,
            note: value?.note || '',
          };
          return acc;
        }, {}),
      };
      studentsMap.set(userId, current);
    });
  });

  const students = Array.from(studentsMap.values()).sort((a, b) =>
    String(a.fullName || a.email).localeCompare(String(b.fullName || b.email)),
  );

  const sessionEntries = days.flatMap((day) =>
    (Array.isArray(day?.sessions) ? day.sessions : []).map((session) => ({
      day,
      sessionId: session?.sessionId || session?.id || session?.session_id,
      isTaken: Boolean(session?.isTaken ?? session?.is_taken),
    })),
  );

  let totalSlots = 0;
  let presentCount = 0;
  let atRiskCount = 0;

  students.forEach((student) => {
    let studentAbsences = 0;
    sessionEntries.forEach((entry) => {
      if (!entry.sessionId || !entry.isTaken) {
        return;
      }
      totalSlots += 1;
      const status = student.bySession?.[entry.sessionId]?.status || 'present';
      if (status === 'present') {
        presentCount += 1;
      }
      if (status === 'absent') {
        studentAbsences += 1;
      }
    });
    if (studentAbsences >= 3) {
      atRiskCount += 1;
    }
  });

  return {
    periodMode: 'month',
    periodAnchor: anchor,
    weekStart: days[0]?.date || anchor,
    days,
    students,
    segments,
    stats: {
      totalStudents: students.length,
      totalSessions: sessionEntries.length,
      takenSessions: sessionEntries.filter((entry) => entry.isTaken).length,
      presentPct: totalSlots ? (presentCount / totalSlots) * 100 : null,
      atRiskCount,
      hasAttendanceRecords: sessionEntries.some((entry) => entry.isTaken),
    },
  };
};

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
        const weekStarts = monthWeekStarts(periodAnchor);
        const payloads = await Promise.all(
          weekStarts.map(async (weekStart) => {
            const existing = this.getCachedWeek(courseId, groupId, weekStart);
            if (existing) {
              return existing;
            }
            const payload = await getCourseWeekAttendance(courseId, {
              ...(groupId ? { groupId } : {}),
              weekStart,
            });
            this.weekCache = {
              ...this.weekCache,
              [toKey(courseId, groupId, weekStart)]: payload,
            };
            return payload;
          }),
        );
        const summary = aggregateMonthPayload(periodAnchor, payloads);
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

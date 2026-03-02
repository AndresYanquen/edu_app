<template>
  <div class="cms-course-attendance-tab">
    <AttendanceWeekHeader
      :week-start="weekStart"
      :week-label="weekLabel"
      :week-sub-label="weekSubLabel"
      :week-progress-label="weekProgressLabel"
      :stats="computedStats"
      :group-options="groupOptions"
      :selected-group-id="selectedGroupId"
      @prev-week="goPreviousWeek"
      @next-week="goNextWeek"
      @current-week="goCurrentWeek"
      @prev-month="goPreviousMonth"
      @next-month="goNextMonth"
      @jump-week="handleJumpWeek"
      @update:groupId="handleGroupChange"
      @export="handleExport"
    />

    <AttendanceLegend />

    <Card class="attendance-content-card">
      <template #content>
        <div v-if="loading" class="attendance-loading-state">
          <Skeleton height="2.8rem" class="mb-2" />
          <Skeleton height="2.8rem" class="mb-2" />
          <Skeleton height="14rem" />
        </div>
        <div v-else-if="errorMessage" class="attendance-error-state">
          <p>{{ errorMessage }}</p>
          <Button label="Reintentar" icon="pi pi-refresh" class="p-button-text" @click="loadWeek" />
        </div>
        <div v-else-if="!hasAnySessions" class="attendance-empty-state">
          <i class="pi pi-calendar-times" />
          <p>No hay sesiones en esta semana.</p>
        </div>
        <AttendanceWeekGrid
          v-else
          :days="displayDays"
          :students="students"
          :saving="saving"
          :focus-user-id="focusedUserId"
          @save-cell="handleSaveCell"
        />
      </template>
    </Card>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import AttendanceWeekHeader from './components/AttendanceWeekHeader.vue';
import AttendanceLegend from './components/AttendanceLegend.vue';
import AttendanceWeekGrid from './components/AttendanceWeekGrid.vue';
import { useCourseAttendanceStore } from '../../../../stores/courseAttendance';

const props = defineProps({
  courseId: {
    type: String,
    default: '',
  },
  groups: {
    type: Array,
    default: () => [],
  },
});

const route = useRoute();
const toast = useToast();
const attendanceStore = useCourseAttendanceStore();

const resolvedCourseId = computed(() => props.courseId || String(route.params.id || ''));
const selectedGroupId = ref(null);
const weekStart = ref('');
const weekData = ref(null);
const localError = ref('');
const focusedUserId = ref('');

const loading = computed(() => attendanceStore.loadingWeek);
const saving = computed(() => attendanceStore.savingCell);
const errorMessage = computed(() => localError.value || attendanceStore.error || '');

const groupOptions = computed(() =>
  (props.groups || []).map((group) => ({
    label: group.scheduleText ? `${group.name} (${group.scheduleText})` : group.name,
    value: group.id,
  })),
);

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

const shiftWeek = (iso, days) => {
  const base = new Date(`${iso}T00:00:00`);
  base.setDate(base.getDate() + days);
  return isoDate(base);
};

const shiftMonth = (iso, months) => {
  const base = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(base.getTime())) {
    return isoDate(mondayOf(new Date()));
  }
  base.setMonth(base.getMonth() + months);
  return isoDate(mondayOf(base));
};

const getIsoWeekNumber = (iso) => {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
};

const formatWeekLabel = (iso) => {
  if (!iso) return 'Semana';
  const start = new Date(`${iso}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  return `Semana del ${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
};

const weekLabel = computed(() => formatWeekLabel(weekStart.value));
const weekSubLabel = computed(() => {
  if (!weekStart.value) return '';
  const start = new Date(`${weekStart.value}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
});

const selectedGroup = computed(() => {
  const groups = Array.isArray(props.groups) ? props.groups : [];
  if (!groups.length) return null;
  if (selectedGroupId.value) {
    return groups.find((group) => group.id === selectedGroupId.value) || null;
  }
  return groups[0] || null;
});

const weekProgressLabel = computed(() => {
  if (!weekStart.value) return '';
  const group = selectedGroup.value;
  const currentWeekDate = mondayOf(new Date(`${weekStart.value}T00:00:00`));
  const startRaw = group?.startDate || group?.start_date || null;
  const endRaw = group?.endDate || group?.end_date || null;
  if (startRaw && endRaw) {
    const start = mondayOf(new Date(`${startRaw}T00:00:00`));
    const end = mondayOf(new Date(`${endRaw}T00:00:00`));
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
      const totalWeeks = Math.max(1, Math.floor((end - start) / (7 * 24 * 60 * 60 * 1000)) + 1);
      const relativeWeek = Math.floor((currentWeekDate - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
      const currentWeek = Math.min(totalWeeks, Math.max(1, relativeWeek));
      return `Semana ${currentWeek} de ${totalWeeks}`;
    }
  }
  const weekNumber = getIsoWeekNumber(weekStart.value);
  return weekNumber ? `Semana ${weekNumber}` : '';
});

const normalizeSession = (session, sessionIndex = 0) => ({
  sessionId: session.sessionId || session.id || session.session_id,
  startsAt: session.startsAt || session.starts_at || null,
  title: session.title || `Sesión ${sessionIndex + 1}`,
  isTaken: Boolean(session.isTaken ?? session.is_taken),
  attendanceTakenAt: session.attendanceTakenAt || session.attendance_taken_at || null,
  attendanceTakenBy: session.attendanceTakenBy || session.attendance_taken_by || null,
  timeLabel: (() => {
    const value = session.startsAt || session.starts_at;
    if (!value) return '';
    try {
      return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  })(),
});

const normalizeDays = (days = []) =>
  days
    .map((day, idx) => {
      const dateValue = day.date || day.day || day.isoDate;
      const dateObj = dateValue ? new Date(`${dateValue}T00:00:00`) : null;
      const weekday = dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.getDay() : null;
      return {
        date: dateValue,
        weekday,
        shortLabel: dateObj
          ? dateObj.toLocaleDateString(undefined, { weekday: 'short' })
          : `D${idx + 1}`,
        dateLabel: dateObj
          ? dateObj.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
          : '',
        sessions: Array.isArray(day.sessions) ? day.sessions.map(normalizeSession) : [],
      };
    })
    .filter((day) => day.weekday === null || (day.weekday >= 1 && day.weekday <= 5));

const normalizeStudents = (students = []) =>
  students.map((student) => {
    const bySessionRaw = student.bySession || student.by_session || {};
    const bySession = Object.entries(bySessionRaw).reduce((acc, [sessionId, value]) => {
      acc[sessionId] = {
        status: value?.status || null,
        note: value?.note || '',
      };
      return acc;
    }, {});
    return {
      userId: student.userId || student.user_id,
      fullName: student.fullName || student.full_name || '',
      email: student.email || '',
      bySession,
    };
  });

const displayDays = computed(() => normalizeDays(weekData.value?.days || []));
const students = computed(() => normalizeStudents(weekData.value?.students || []));
const hasAnySessions = computed(() => displayDays.value.some((day) => day.sessions.length));

const computedStats = computed(() => {
  const stats = weekData.value?.stats || {};
  if (stats.presentPct !== undefined) {
    return stats;
  }
  let total = 0;
  let present = 0;
  let atRiskCount = 0;
  students.value.forEach((student) => {
    let studentAbsences = 0;
    Object.values(student.bySession || {}).forEach((cell) => {
      if (!cell?.status) return;
      total += 1;
      if (cell.status === 'present') present += 1;
      if (cell.status === 'absent') studentAbsences += 1;
    });
    if (studentAbsences >= 2) {
      atRiskCount += 1;
    }
  });
  return {
    presentPct: total ? (present / total) * 100 : null,
    atRiskCount,
  };
});

const loadWeek = async () => {
  if (!resolvedCourseId.value || !weekStart.value) return;
  if (Array.isArray(props.groups) && props.groups.length > 0 && !selectedGroupId.value) return;
  localError.value = '';
  try {
    const payload = await attendanceStore.fetchCourseWeekAttendance(
      resolvedCourseId.value,
      selectedGroupId.value,
      weekStart.value,
    );
    weekData.value = payload || null;
    await nextTick();
    focusStudentRow();
  } catch (err) {
    localError.value = err?.response?.data?.error || 'No se pudo cargar la asistencia semanal';
  }
};

const focusStudentRow = () => {
  if (!focusedUserId.value) return;
  const escapedId =
    typeof globalThis.CSS !== 'undefined' && typeof globalThis.CSS.escape === 'function'
      ? globalThis.CSS.escape(focusedUserId.value)
      : focusedUserId.value;
  const target = document.querySelector(`[data-attendance-student-id="${escapedId}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
};

const updateLocalCell = ({ sessionId, userId, status, note }) => {
  const source = weekData.value || {};
  const next = {
    ...source,
    days: Array.isArray(source.days)
      ? source.days.map((day) => ({
          ...day,
          sessions: Array.isArray(day.sessions)
            ? day.sessions.map((session) => ({ ...session }))
            : [],
        }))
      : [],
    students: Array.isArray(source.students)
      ? source.students.map((student) => ({
          ...student,
          bySession: { ...(student.bySession || {}) },
          by_session: { ...(student.by_session || {}) },
        }))
      : [],
  };
  if (Array.isArray(next.days)) {
    next.days.forEach((day) => {
      day.sessions = (day.sessions || []).map((session) =>
        (session.sessionId || session.id || session.session_id) === sessionId
          ? {
              ...session,
              isTaken: true,
              attendanceTakenAt: new Date().toISOString(),
            }
          : session,
      );
    });
  }
  const row = next.students.find((student) => (student.userId || student.user_id) === userId);
  if (!row) return;
  const target = row.bySession || row.by_session || {};
  if (status === 'present') {
    delete target[sessionId];
  } else {
    target[sessionId] = { ...(target[sessionId] || {}), status, note: note || '' };
  }
  if (row.bySession) {
    row.bySession = target;
  } else {
    row.by_session = target;
  }
  weekData.value = next;
};

const handleSaveCell = async ({ sessionId, userId, status, note }) => {
  try {
    await attendanceStore.saveCourseWeekAttendance(
      resolvedCourseId.value,
      selectedGroupId.value,
      weekStart.value,
      [{ sessionId, userId, status, note }],
    );
    updateLocalCell({ sessionId, userId, status, note });
    toast.add({ severity: 'success', summary: 'Asistencia guardada', life: 1800 });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'No se pudo guardar la asistencia',
      life: 3000,
    });
    throw err;
  }
};

const goPreviousWeek = async () => {
  weekStart.value = shiftWeek(weekStart.value, -7);
  await loadWeek();
};
const goNextWeek = async () => {
  weekStart.value = shiftWeek(weekStart.value, 7);
  await loadWeek();
};
const goCurrentWeek = async () => {
  weekStart.value = isoDate(mondayOf(new Date()));
  await loadWeek();
};
const goPreviousMonth = async () => {
  weekStart.value = shiftMonth(weekStart.value, -1);
  await loadWeek();
};
const goNextMonth = async () => {
  weekStart.value = shiftMonth(weekStart.value, 1);
  await loadWeek();
};

const handleJumpWeek = async (value) => {
  if (!value) return;
  const nextWeek = isoDate(mondayOf(value));
  if (!nextWeek) return;
  weekStart.value = nextWeek;
  await loadWeek();
};

const handleGroupChange = async (groupId) => {
  selectedGroupId.value = groupId || null;
  await loadWeek();
};

const handleExport = () => {
  toast.add({ severity: 'info', summary: 'Próximamente', detail: 'Exportar CSV estará disponible pronto', life: 2200 });
};

watch(
  () => props.groups,
  (groups) => {
    if (!Array.isArray(groups) || !groups.length) {
      selectedGroupId.value = null;
      return;
    }
    const requestedGroupId =
      typeof route.query.groupId === 'string' && groups.some((group) => group.id === route.query.groupId)
        ? route.query.groupId
        : null;
    if (requestedGroupId) {
      selectedGroupId.value = requestedGroupId;
      if (weekStart.value) {
        loadWeek();
      }
      return;
    }
    if (selectedGroupId.value && groups.some((group) => group.id === selectedGroupId.value)) {
      return;
    }
    selectedGroupId.value = groups[0]?.id || null;
    if (weekStart.value) {
      loadWeek();
    }
  },
  { immediate: true },
);

watch(
  () => route.query.focusUser,
  (value) => {
    focusedUserId.value = typeof value === 'string' ? value : '';
    if (focusedUserId.value) {
      nextTick(() => {
        focusStudentRow();
      });
    }
  },
  { immediate: true },
);

onMounted(async () => {
  const queryWeekStart = typeof route.query.weekStart === 'string' ? route.query.weekStart : '';
  const initialWeek = queryWeekStart ? isoDate(mondayOf(queryWeekStart)) : '';
  weekStart.value = initialWeek || isoDate(mondayOf(new Date()));
  if (selectedGroupId.value) {
    await loadWeek();
  }
});
</script>

<style scoped>
.cms-course-attendance-tab {
  display: grid;
  gap: 0.9rem;
}
.attendance-content-card {
  border-radius: 20px;
}
.attendance-loading-state,
.attendance-error-state,
.attendance-empty-state {
  padding: 0.4rem 0;
}
.attendance-empty-state {
  min-height: 180px;
  display: grid;
  place-content: center;
  gap: 0.35rem;
  color: #64748b;
  text-align: center;
}
.attendance-empty-state i {
  font-size: 1.6rem;
  justify-self: center;
}
</style>

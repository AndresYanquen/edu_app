<template>
  <div class="cms-course-summary-tab">
    <AttendanceWeekHeader
      :week-start="periodAnchor"
      :week-label="weekLabel"
      :week-sub-label="weekSubLabel"
      :week-progress-label="weekProgressLabel"
      :period-mode="periodMode"
      :period-options="periodOptions"
      :show-period-selector="true"
      :risk-metric-label="riskMetricLabel"
      :stats="computedStats"
      :group-options="groupOptions"
      :selected-group-id="selectedGroupId"
      @prev-week="goPreviousWeek"
      @next-week="goNextWeek"
      @current-week="goCurrentWeek"
      @prev-month="goPreviousMonth"
      @next-month="goNextMonth"
      @jump-week="handleJumpWeek"
      @update:periodMode="handlePeriodModeChange"
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
          <i class="pi pi-chart-bar" />
          <p>No hay datos de asistencia en esta semana.</p>
        </div>
        <AttendanceOverviewCharts
          v-else
          :days="displayDays"
          :segments="displaySegments"
          :students="students"
          :period-mode="periodMode"
          :stats="computedStats"
          @open-student="openStudentInAttendance"
        />
      </template>
    </Card>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import AttendanceWeekHeader from '../attendance/components/AttendanceWeekHeader.vue';
import AttendanceLegend from '../attendance/components/AttendanceLegend.vue';
import AttendanceOverviewCharts from '../attendance/components/AttendanceOverviewCharts.vue';
import { useCourseAttendanceStore } from '../../../../stores/courseAttendance';
import { cmsCourseBuilderContextKey } from '../cmsCourseBuilderContext';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const attendanceStore = useCourseAttendanceStore();
const builder = inject(cmsCourseBuilderContextKey, null);

const groups = computed(() => builder?.courseGroups?.value || []);
const resolvedCourseId = computed(() => String(builder?.courseId || route.params.id || ''));
const selectedGroupId = ref(null);
const periodMode = ref('week');
const periodAnchor = ref('');
const summaryData = ref(null);
const localError = ref('');

const loading = computed(() => attendanceStore.loadingWeek);
const errorMessage = computed(() => localError.value || attendanceStore.error || '');
const periodOptions = [
  { label: 'Semana', value: 'week', disabled: false },
  { label: 'Mes', value: 'month', disabled: false },
  { label: 'Año', value: 'year', disabled: true },
];
const riskMetricLabel = computed(() =>
  periodMode.value === 'month' ? 'En riesgo (mes)' : 'En riesgo (semana)',
);

const groupOptions = computed(() =>
  groups.value.map((group) => ({
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

const monthStartOf = (input = new Date()) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const yearStartOf = (input = new Date()) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return new Date();
  date.setMonth(0, 1);
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
  return isoDate(periodMode.value === 'month' ? monthStartOf(base) : mondayOf(base));
};

const shiftYear = (iso, years) => {
  const base = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(base.getTime())) {
    return isoDate(yearStartOf(new Date()));
  }
  base.setFullYear(base.getFullYear() + years);
  return isoDate(yearStartOf(base));
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

const weekLabel = computed(() => {
  if (!periodAnchor.value) return 'Resumen';
  const start = new Date(`${periodAnchor.value}T00:00:00`);
  if (periodMode.value === 'month') {
    return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  if (periodMode.value === 'year') {
    return `Año ${start.getFullYear()}`;
  }
  return `Semana del ${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
});

const weekSubLabel = computed(() => {
  if (!periodAnchor.value) return '';
  const start = new Date(`${periodAnchor.value}T00:00:00`);
  if (periodMode.value === 'month') {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  }
  if (periodMode.value === 'year') {
    const end = new Date(start.getFullYear(), 11, 31);
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  }
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
});

const selectedGroup = computed(() => {
  if (!groups.value.length) return null;
  if (selectedGroupId.value) {
    return groups.value.find((group) => group.id === selectedGroupId.value) || null;
  }
  return groups.value[0] || null;
});

const weekProgressLabel = computed(() => {
  if (!periodAnchor.value) return '';
  const group = selectedGroup.value;
  const currentWeekDate =
    periodMode.value === 'month'
      ? monthStartOf(new Date(`${periodAnchor.value}T00:00:00`))
      : mondayOf(new Date(`${periodAnchor.value}T00:00:00`));
  const startRaw = group?.startDate || group?.start_date || null;
  const endRaw = group?.endDate || group?.end_date || null;
  if (startRaw && endRaw) {
    const start =
      periodMode.value === 'month'
        ? monthStartOf(new Date(`${startRaw}T00:00:00`))
        : mondayOf(new Date(`${startRaw}T00:00:00`));
    const end =
      periodMode.value === 'month'
        ? monthStartOf(new Date(`${endRaw}T00:00:00`))
        : mondayOf(new Date(`${endRaw}T00:00:00`));
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
      if (periodMode.value === 'month') {
        const totalMonths =
          (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
        const relativeMonth =
          (currentWeekDate.getFullYear() - start.getFullYear()) * 12 +
          (currentWeekDate.getMonth() - start.getMonth()) +
          1;
        const currentMonth = Math.min(totalMonths, Math.max(1, relativeMonth));
        return `Mes ${currentMonth} de ${totalMonths}`;
      }
      const totalWeeks = Math.max(1, Math.floor((end - start) / 604800000) + 1);
      const relativeWeek = Math.floor((currentWeekDate - start) / 604800000) + 1;
      const currentWeek = Math.min(totalWeeks, Math.max(1, relativeWeek));
      return `Semana ${currentWeek} de ${totalWeeks}`;
    }
  }
  if (periodMode.value === 'month') {
    return startRaw ? '' : startOfMonthLabel.value;
  }
  const weekNumber = getIsoWeekNumber(periodAnchor.value);
  return weekNumber ? `Semana ${weekNumber}` : '';
});

const startOfMonthLabel = computed(() => {
  if (!periodAnchor.value || periodMode.value !== 'month') return '';
  const start = new Date(`${periodAnchor.value}T00:00:00`);
  return start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
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

const displayDays = computed(() =>
  (summaryData.value?.days || [])
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
    .filter((day) => day.weekday === null || (day.weekday >= 1 && day.weekday <= 5)),
);

const displaySegments = computed(() =>
  Array.isArray(summaryData.value?.segments) ? summaryData.value.segments : [],
);

const students = computed(() =>
  (summaryData.value?.students || []).map((student) => {
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
  }),
);

const hasAnySessions = computed(() => displayDays.value.some((day) => day.sessions.length));

const computedStats = computed(() => {
  const stats = summaryData.value?.stats || {};
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
    if (studentAbsences >= 2) atRiskCount += 1;
  });
  return {
    presentPct: total ? (present / total) * 100 : null,
    atRiskCount,
  };
});

const attendanceWeekAnchor = computed(() => {
  if (!periodAnchor.value) return '';
  if (periodMode.value === 'month') {
    return isoDate(mondayOf(new Date(`${periodAnchor.value}T00:00:00`)));
  }
  return periodAnchor.value;
});

const loadSummary = async () => {
  if (!resolvedCourseId.value || !periodAnchor.value) return;
  if (Array.isArray(groups.value) && groups.value.length > 0 && !selectedGroupId.value) return;
  localError.value = '';
  try {
    const payload = await attendanceStore.fetchCourseAttendanceSummary(
      resolvedCourseId.value,
      selectedGroupId.value,
      periodMode.value,
      periodAnchor.value,
    );
    summaryData.value = payload || null;
  } catch (err) {
    localError.value = err?.response?.data?.error || 'No se pudo cargar el resumen semanal';
  }
};

const goPreviousWeek = async () => {
  if (periodMode.value === 'month') {
    periodAnchor.value = shiftMonth(periodAnchor.value, -1);
  } else {
    periodAnchor.value = shiftWeek(periodAnchor.value, -7);
  }
  await loadSummary();
};
const goNextWeek = async () => {
  if (periodMode.value === 'month') {
    periodAnchor.value = shiftMonth(periodAnchor.value, 1);
  } else {
    periodAnchor.value = shiftWeek(periodAnchor.value, 7);
  }
  await loadSummary();
};
const goCurrentWeek = async () => {
  periodAnchor.value =
    periodMode.value === 'month'
      ? isoDate(monthStartOf(new Date()))
      : isoDate(mondayOf(new Date()));
  await loadSummary();
};
const goPreviousMonth = async () => {
  if (periodMode.value === 'month') {
    periodAnchor.value = shiftYear(periodAnchor.value, -1);
  } else {
    periodAnchor.value = shiftMonth(periodAnchor.value, -1);
  }
  await loadSummary();
};
const goNextMonth = async () => {
  if (periodMode.value === 'month') {
    periodAnchor.value = shiftYear(periodAnchor.value, 1);
  } else {
    periodAnchor.value = shiftMonth(periodAnchor.value, 1);
  }
  await loadSummary();
};

const handleJumpWeek = async (value) => {
  if (!value) return;
  const nextAnchor =
    periodMode.value === 'month' ? isoDate(monthStartOf(value)) : isoDate(mondayOf(value));
  if (!nextAnchor) return;
  periodAnchor.value = nextAnchor;
  await loadSummary();
};

const handlePeriodModeChange = async (nextMode) => {
  if (!nextMode || nextMode === periodMode.value || nextMode === 'year') {
    if (nextMode === 'year') {
      toast.add({
        severity: 'info',
        summary: 'Próximamente',
        detail: 'El resumen anual quedará habilitado cuando tengamos agregado backend.',
        life: 2400,
      });
    }
    return;
  }
  periodMode.value = nextMode;
  periodAnchor.value =
    nextMode === 'month'
      ? isoDate(monthStartOf(new Date(`${attendanceWeekAnchor.value || isoDate(new Date())}T00:00:00`)))
      : isoDate(mondayOf(new Date(`${periodAnchor.value || isoDate(new Date())}T00:00:00`)));
  await loadSummary();
};

const handleGroupChange = async (groupId) => {
  selectedGroupId.value = groupId || null;
  await loadSummary();
};

const handleExport = () => {
  toast.add({ severity: 'info', summary: 'Próximamente', detail: 'Exportar CSV estará disponible pronto', life: 2200 });
};

const openStudentInAttendance = async (userId) => {
  await router.push({
    name: 'cms-course-attendance',
    params: { id: resolvedCourseId.value },
    query: {
      ...(attendanceWeekAnchor.value ? { weekStart: attendanceWeekAnchor.value } : {}),
      ...(selectedGroupId.value ? { groupId: selectedGroupId.value } : {}),
      ...(userId ? { focusUser: userId } : {}),
    },
  });
};

watch(
  groups,
  (nextGroups) => {
    if (!Array.isArray(nextGroups) || !nextGroups.length) {
      selectedGroupId.value = null;
      return;
    }
    if (selectedGroupId.value && nextGroups.some((group) => group.id === selectedGroupId.value)) {
      return;
    }
    selectedGroupId.value = nextGroups[0]?.id || null;
    if (periodAnchor.value) {
      loadSummary();
    }
  },
  { immediate: true },
);

onMounted(async () => {
  periodAnchor.value = isoDate(mondayOf(new Date()));
  if (selectedGroupId.value) {
    await loadSummary();
  }
});
</script>

<style scoped>
.cms-course-summary-tab {
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

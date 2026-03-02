<template>
  <div class="attendance-overview">
    <div class="overview-grid">
      <Card class="overview-card">
        <template #title>
          <div class="overview-card__title">{{ attendanceCardTitle }}</div>
        </template>
        <template #content>
          <div class="hero-stat">
            <strong>{{ averageAttendanceLabel }}</strong>
            <span>promedio general</span>
          </div>
          <div class="status-stack" :aria-label="distributionAriaLabel">
            <div
              v-for="item in statusDistribution"
              :key="item.status"
              class="status-stack__segment"
              :class="`is-${item.status}`"
              :style="{ width: `${item.pct}%` }"
            />
          </div>
          <div class="status-legend">
            <div v-for="item in statusDistribution" :key="`legend-${item.status}`" class="status-legend__item">
              <span class="dot" :class="`is-${item.status}`" />
              <span>{{ item.label }}</span>
              <strong>{{ item.count }}</strong>
            </div>
          </div>
        </template>
      </Card>

      <Card class="overview-card">
        <template #title>
          <div class="overview-card__title">Riesgo academico</div>
        </template>
        <template #content>
          <div class="risk-summary">
            <button
              type="button"
              class="risk-pill risk-pill--action"
              :disabled="!atRiskStudents.length"
              @click="showRiskDialog = true"
            >
              <strong>{{ stats?.atRiskCount ?? 0 }}</strong>
              <span>{{ riskPeriodCopy }}</span>
              <small v-if="atRiskStudents.length">Ver estudiantes</small>
            </button>
            <div class="risk-pill muted">
              <strong>{{ totalStudents }}</strong>
              <span>estudiantes evaluados</span>
            </div>
          </div>
          <div class="risk-copy">
            <p>
              {{ riskDefinitionCopy }}
            </p>
          </div>
        </template>
      </Card>
    </div>

    <Card class="overview-card">
      <template #title>
        <div class="overview-card__title">{{ trendCardTitle }}</div>
      </template>
      <template #content>
        <div v-if="!trendBars.length" class="empty-chart">
          {{ trendEmptyCopy }}
        </div>
        <div v-else class="day-bars">
          <div v-for="day in trendBars" :key="day.id" class="day-bar-row">
            <div class="day-bar-row__meta">
              <strong>{{ day.label }}</strong>
              <small>{{ day.sessionsLabel }}</small>
            </div>
            <div class="day-bar-row__bar">
              <div
                class="day-bar-row__fill"
                :class="{ 'is-pending-fill': day.isPending }"
                :style="{ width: `${day.pct}%` }"
              />
            </div>
            <div class="day-bar-row__value">{{ day.pctLabel }}</div>
          </div>
        </div>
      </template>
    </Card>

    <Card class="overview-card">
      <template #title>
        <div class="overview-card__title">{{ detailCardTitle }}</div>
      </template>
      <template #content>
        <div v-if="!detailCards.length" class="empty-chart">
          {{ detailEmptyCopy }}
        </div>
        <div v-else class="session-cards">
          <div v-for="session in detailCards" :key="session.sessionId" class="session-card">
            <div class="session-card__head">
              <strong>{{ session.title }}</strong>
              <span>{{ session.code }}</span>
            </div>
            <small>
              {{ session.dayLabel }}
              <template v-if="session.timeLabel"> · {{ session.timeLabel }}</template>
              <template v-else-if="periodMode !== 'month'"> · Sin hora</template>
            </small>
            <div class="session-card__meter">
              <div
                class="session-card__meter-fill"
                :class="{ 'is-pending-fill': session.isPending }"
                :style="{ width: `${session.pct}%` }"
              />
            </div>
            <div class="session-card__footer">
              <span>
                {{
                  session.isPending
                    ? 'Lista pendiente'
                    : `${session.presentCount}/${totalStudents} presentes`
                }}
              </span>
              <strong>{{ session.pctLabel }}</strong>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="showRiskDialog"
      :header="riskDialogTitle"
      modal
      :style="{ width: '42rem', maxWidth: '92vw' }"
    >
      <div v-if="!atRiskStudents.length" class="risk-dialog-empty">
        No hay estudiantes en riesgo en la semana visible.
      </div>
      <div v-else class="risk-dialog-list">
        <p class="risk-dialog-copy">
          {{ riskDialogCopy }}
        </p>
        <div
          v-for="student in atRiskStudents"
          :key="student.userId"
          class="risk-dialog-item"
        >
          <div class="risk-dialog-item__main">
            <span class="risk-dialog-avatar">{{ initials(student.fullName || student.email) }}</span>
            <div>
              <strong>{{ student.fullName || student.email }}</strong>
              <small>{{ student.email }}</small>
              <div class="risk-dialog-meta">
                <span>{{ student.absences }} ausencias</span>
                <span>{{ student.takenSessions }} sesiones tomadas</span>
                <span v-if="student.pendingSessions">{{ student.pendingSessions }} pendientes</span>
              </div>
            </div>
          </div>
          <div class="risk-dialog-item__sessions">
            <span
              v-for="session in student.sessions"
              :key="`${student.userId}-${session.sessionId}`"
              class="risk-session-chip"
              :class="`is-${session.status}`"
            >
              {{ session.label }} · {{ session.code }}
            </span>
          </div>
          <div class="risk-dialog-item__actions">
            <Button
              label="Ir a asistencia"
              class="p-button-text"
              @click="openStudentInAttendance(student.userId)"
            />
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  days: { type: Array, default: () => [] },
  students: { type: Array, default: () => [] },
  stats: { type: Object, default: () => ({}) },
  periodMode: { type: String, default: 'week' },
  segments: { type: Array, default: () => [] },
});
const emit = defineEmits(['open-student']);
const showRiskDialog = ref(false);

const totalStudents = computed(() => props.students.length);
const initials = (name = '') =>
  String(name || '')
    .split(' ')
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

const attendanceFor = (student, session) => {
  const raw = student?.bySession?.[session.sessionId];
  if (raw?.status) {
    return raw.status;
  }
  return session?.isTaken ? 'present' : 'pending';
};

const sessionEntries = computed(() =>
  (props.days || []).flatMap((day) =>
    (day.sessions || []).map((session, index) => ({
      day,
      session,
      index,
    })),
  ),
);

const totalSlots = computed(() => sessionEntries.value.length * totalStudents.value);

const statusCounts = computed(() => {
  const counts = { present: 0, absent: 0, late: 0, excused: 0, pending: 0 };
  sessionEntries.value.forEach(({ session }) => {
    props.students.forEach((student) => {
      const status = attendanceFor(student, session);
      if (counts[status] === undefined) {
        counts.present += 1;
      } else {
        counts[status] += 1;
      }
    });
  });
  return counts;
});

const statusMeta = {
  present: { label: 'Presente' },
  absent: { label: 'Ausente' },
  late: { label: 'Tarde' },
  excused: { label: 'Justificado' },
  pending: { label: 'Pendiente' },
};

const statusDistribution = computed(() =>
  Object.entries(statusCounts.value).map(([status, count]) => ({
    status,
    label: statusMeta[status].label,
    count,
    pct: totalSlots.value ? (count / totalSlots.value) * 100 : 0,
  })),
);
const attendanceCardTitle = computed(() =>
  props.periodMode === 'month' ? 'Asistencia mensual' : 'Asistencia semanal',
);
const distributionAriaLabel = computed(() =>
  props.periodMode === 'month' ? 'Distribucion mensual de estados' : 'Distribucion semanal de estados',
);
const riskPeriodCopy = computed(() =>
  props.periodMode === 'month' ? 'en riesgo este mes' : 'en riesgo esta semana',
);
const riskDefinitionCopy = computed(() =>
  props.periodMode === 'month'
    ? 'Este resumen usa el mes visible. Un estudiante se considera en riesgo cuando acumula 3 o mas ausencias.'
    : 'Este resumen usa la semana visible. Un estudiante se considera en riesgo cuando acumula 2 o mas ausencias.',
);
const trendCardTitle = computed(() =>
  props.periodMode === 'month' ? 'Tendencia por semana' : 'Tendencia por dia',
);
const detailCardTitle = computed(() =>
  props.periodMode === 'month' ? 'Semanas del mes' : 'Sesiones de la semana',
);
const trendEmptyCopy = computed(() =>
  props.periodMode === 'month'
    ? 'No hay semanas con sesiones en este mes para graficar.'
    : 'No hay sesiones en esta semana para graficar.',
);
const detailEmptyCopy = computed(() =>
  props.periodMode === 'month' ? 'No hay semanas con clases programadas.' : 'No hay sesiones programadas.',
);
const riskDialogTitle = computed(() =>
  props.periodMode === 'month' ? 'Estudiantes en riesgo este mes' : 'Estudiantes en riesgo esta semana',
);
const riskDialogCopy = computed(() =>
  props.periodMode === 'month'
    ? 'Este listado muestra solo el mes visible, no el historial acumulado del curso.'
    : 'Este listado muestra solo la semana visible, no el historial acumulado del curso.',
);

const averageAttendanceLabel = computed(() => {
  if (props.stats?.hasAttendanceRecords === false && sessionEntries.value.length) {
    return 'Sin registrar';
  }
  const pct = props.stats?.presentPct;
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) {
    const takenSlots = totalSlots.value - statusCounts.value.pending;
    if (!takenSlots) return '—';
    return `${Math.round((statusCounts.value.present / takenSlots) * 100)}%`;
  }
  return `${Math.round(Number(pct))}%`;
});

const dayBars = computed(() =>
  (props.days || [])
    .filter((day) => Array.isArray(day.sessions) && day.sessions.length)
    .map((day) => {
      const takenSessions = day.sessions.filter((session) => session.isTaken);
      const slotCount = takenSessions.length * totalStudents.value;
      let presentCount = 0;
      takenSessions.forEach((session) => {
        props.students.forEach((student) => {
          if (attendanceFor(student, session) === 'present') {
            presentCount += 1;
          }
        });
      });
      const pct = slotCount ? (presentCount / slotCount) * 100 : 0;
      return {
        date: day.date,
        label: day.shortLabel,
        sessionsLabel: `${day.sessions.length} sesion${day.sessions.length === 1 ? '' : 'es'}`,
        isPending: !takenSessions.length,
        pct,
        pctLabel: takenSessions.length ? `${Math.round(pct)}%` : 'Pend.',
      };
    }),
);

const segmentBars = computed(() =>
  (props.segments || [])
    .filter((segment) => Array.isArray(segment.days) && segment.days.some((day) => Array.isArray(day.sessions) && day.sessions.length))
    .map((segment) => {
      const sessions = (segment.days || []).flatMap((day) => day.sessions || []);
      const takenSessions = sessions.filter((session) => session.isTaken);
      const slotCount = takenSessions.length * totalStudents.value;
      let presentCount = 0;
      takenSessions.forEach((session) => {
        props.students.forEach((student) => {
          if (attendanceFor(student, session) === 'present') {
            presentCount += 1;
          }
        });
      });
      const pct = slotCount ? (presentCount / slotCount) * 100 : 0;
      return {
        id: segment.id,
        label: segment.label,
        sessionsLabel: `${sessions.length} sesion${sessions.length === 1 ? '' : 'es'}`,
        isPending: !takenSessions.length,
        pct,
        pctLabel: takenSessions.length ? `${Math.round(pct)}%` : 'Pend.',
      };
    }),
);

const trendBars = computed(() => (props.periodMode === 'month' ? segmentBars.value : dayBars.value));

const sessionCards = computed(() =>
  sessionEntries.value.map(({ day, session, index }) => {
    let presentCount = 0;
    if (session.isTaken) {
      props.students.forEach((student) => {
        if (attendanceFor(student, session) === 'present') {
          presentCount += 1;
        }
      });
    }
    const pct = session.isTaken && totalStudents.value ? (presentCount / totalStudents.value) * 100 : 0;
    return {
      sessionId: session.sessionId,
      title: session.title || `Sesion ${index + 1}`,
      code: `S${index + 1}`,
      dayLabel: `${day.shortLabel} ${day.dateLabel}`,
      timeLabel: session.timeLabel,
      isPending: !session.isTaken,
      presentCount,
      pct,
      pctLabel: session.isTaken ? `${Math.round(pct)}%` : 'Pend.',
    };
  }),
);

const segmentCards = computed(() =>
  (props.segments || []).map((segment, index) => {
    const sessions = (segment.days || []).flatMap((day) => day.sessions || []);
    const takenSessions = sessions.filter((session) => session.isTaken);
    const totalTakenSlots = takenSessions.length * totalStudents.value;
    let presentCount = 0;
    takenSessions.forEach((session) => {
      props.students.forEach((student) => {
        if (attendanceFor(student, session) === 'present') {
          presentCount += 1;
        }
      });
    });
    const pct = totalTakenSlots ? (presentCount / totalTakenSlots) * 100 : 0;
    return {
      sessionId: segment.id || `segment-${index + 1}`,
      title: segment.label || `Semana ${index + 1}`,
      code: `W${index + 1}`,
      dayLabel: segment.subLabel || '',
      timeLabel: '',
      isPending: !takenSessions.length,
      presentCount,
      pct,
      pctLabel: takenSessions.length ? `${Math.round(pct)}%` : 'Pend.',
    };
  }),
);

const detailCards = computed(() => (props.periodMode === 'month' ? segmentCards.value : sessionCards.value));

const atRiskStudents = computed(() =>
  props.students
    .map((student) => {
      const sessions = sessionEntries.value.map(({ day, session, index }) => ({
        sessionId: session.sessionId,
        status: attendanceFor(student, session),
        code: `S${index + 1}`,
        label: day.shortLabel,
      }));
      const absences = sessions.filter((session) => session.status === 'absent').length;
      const takenSessions = sessions.filter((session) => session.status !== 'pending').length;
      const pendingSessions = sessions.filter((session) => session.status === 'pending').length;
      return {
        userId: student.userId,
        fullName: student.fullName,
        email: student.email,
        absences,
        takenSessions,
        pendingSessions,
        sessions,
      };
    })
    .filter((student) => (props.periodMode === 'month' ? student.absences >= 3 : student.absences >= 2))
    .sort((a, b) => {
      if (b.absences !== a.absences) {
        return b.absences - a.absences;
      }
      return String(a.fullName || a.email).localeCompare(String(b.fullName || b.email));
    }),
);

const openStudentInAttendance = (userId) => {
  showRiskDialog.value = false;
  emit('open-student', userId);
};
</script>

<style scoped>
.attendance-overview {
  display: grid;
  gap: 1rem;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.overview-card {
  border-radius: 18px;
}

.overview-card__title {
  font-size: 1rem;
  font-weight: 700;
}

.hero-stat {
  display: grid;
  gap: 0.15rem;
  margin-bottom: 1rem;
}

.hero-stat strong {
  font-size: 2rem;
  line-height: 1;
  color: #0f172a;
}

.hero-stat span,
.risk-pill span,
.risk-copy p,
.day-bar-row__meta small,
.session-card small {
  color: #64748b;
}

.status-stack {
  display: flex;
  overflow: hidden;
  min-height: 0.7rem;
  border-radius: 999px;
  background: #f1f5f9;
  margin-bottom: 0.85rem;
}

.status-stack__segment {
  min-width: 0;
}

.status-legend {
  display: grid;
  gap: 0.45rem;
}

.status-legend__item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.45rem;
  align-items: center;
}

.dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 999px;
}

.is-present { background: #bbf7d0; }
.is-absent { background: #fecaca; }
.is-late { background: #fde68a; }
.is-excused { background: #c7d2fe; }
.is-pending { background: #e2e8f0; }

.risk-summary {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.85rem;
}

.risk-pill {
  display: grid;
  gap: 0.15rem;
  padding: 0.8rem 0.9rem;
  border-radius: 14px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
}
.risk-pill--action {
  cursor: pointer;
  text-align: left;
}
.risk-pill--action small {
  color: #c2410c;
  font-size: 0.76rem;
  font-weight: 700;
}
.risk-pill--action:disabled {
  cursor: default;
}

.risk-pill.muted {
  background: #f8fafc;
  border-color: #e2e8f0;
}

.risk-pill strong {
  font-size: 1.35rem;
  line-height: 1;
}

.day-bars,
.session-cards {
  display: grid;
  gap: 0.85rem;
}

.day-bar-row {
  display: grid;
  grid-template-columns: 92px 1fr 56px;
  gap: 0.8rem;
  align-items: center;
}

.day-bar-row__meta {
  display: grid;
  gap: 0.1rem;
}

.day-bar-row__bar,
.session-card__meter {
  position: relative;
  overflow: hidden;
  height: 0.75rem;
  border-radius: 999px;
  background: #e2e8f0;
}

.day-bar-row__fill,
.session-card__meter-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #86efac 0%, #22c55e 100%);
}
.day-bar-row__fill.is-pending-fill,
.session-card__meter-fill.is-pending-fill {
  width: 100% !important;
  background: linear-gradient(90deg, #e2e8f0 0%, #cbd5e1 100%);
}

.session-cards {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.session-card {
  padding: 0.9rem;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fcfdff;
  display: grid;
  gap: 0.55rem;
}

.day-bar-row__fill,
.session-card__meter-fill {
  min-width: 0;
}

.session-card__head,
.session-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.session-card__head span {
  font-size: 0.75rem;
  font-weight: 700;
  color: #3b82f6;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  padding: 0.15rem 0.45rem;
}

.empty-chart {
  color: #64748b;
}

.risk-dialog-empty {
  color: #64748b;
}

.risk-dialog-copy {
  margin: 0 0 0.85rem;
  color: #64748b;
  font-size: 0.92rem;
}

.risk-dialog-list {
  display: grid;
  gap: 0.85rem;
}

.risk-dialog-item {
  display: grid;
  gap: 0.6rem;
  padding: 0.9rem;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fcfdff;
}

.risk-dialog-item__main {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.risk-dialog-avatar {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fee2e2;
  color: #b91c1c;
  font-weight: 700;
}

.risk-dialog-item__main small {
  display: block;
}

.risk-dialog-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.35rem;
  font-size: 0.78rem;
  color: #64748b;
}

.risk-dialog-item__sessions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.risk-session-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  border: 1px solid #e2e8f0;
  font-size: 0.74rem;
  font-weight: 700;
}

.risk-session-chip.is-present {
  background: #ecfdf5;
  border-color: #bbf7d0;
  color: #166534;
}

.risk-session-chip.is-absent {
  background: #fef2f2;
  border-color: #fecaca;
  color: #991b1b;
}

.risk-session-chip.is-late {
  background: #fffbeb;
  border-color: #fde68a;
  color: #92400e;
}

.risk-session-chip.is-excused {
  background: #eef2ff;
  border-color: #c7d2fe;
  color: #3730a3;
}

.risk-session-chip.is-pending {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #64748b;
}

.risk-dialog-item__actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 900px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }

  .day-bar-row {
    grid-template-columns: 1fr;
  }
}
</style>

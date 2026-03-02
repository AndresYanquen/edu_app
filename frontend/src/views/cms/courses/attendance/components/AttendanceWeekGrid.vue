<template>
  <div class="attendance-grid-wrap">
    <div class="attendance-grid-scroll">
      <table class="attendance-grid-table">
        <thead>
          <tr>
            <th class="student-col sticky-col" rowspan="2">Estudiante</th>
            <th
              v-for="day in displayDays"
              :key="`day-${day.date}`"
              class="day-group"
              :colspan="Math.max(1, day.sessions.length)"
            >
              <div class="day-header">
                <strong>{{ day.shortLabel }}</strong>
                <small>{{ day.dateLabel }}</small>
              </div>
            </th>
          </tr>
          <tr>
            <template v-for="day in displayDays" :key="`sessions-${day.date}`">
              <th v-if="!day.sessions.length" class="session-subhead empty">—</th>
              <th
                v-for="(session, sessionIndex) in day.sessions"
                :key="session.sessionId"
                class="session-subhead"
              >
                <div class="session-subhead__inner">
                  <span>S{{ sessionIndex + 1 }}</span>
                  <small>{{ session.timeLabel }}</small>
                </div>
              </th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr v-for="student in students" :key="student.userId" class="student-row">
            <td class="student-col sticky-col">
              <div class="student-meta">
                <span class="student-avatar">{{ initials(student.fullName) }}</span>
                <div>
                  <strong>{{ student.fullName || student.email }}</strong>
                  <small>{{ student.email }}</small>
                </div>
              </div>
            </td>
            <template v-for="day in displayDays" :key="`cell-${student.userId}-${day.date}`">
              <td v-if="!day.sessions.length" class="session-cell empty">—</td>
              <td
                v-for="session in day.sessions"
                :key="`${student.userId}-${session.sessionId}`"
                class="session-cell"
              >
                <div class="attendance-inline-options" role="radiogroup" aria-label="Estado de asistencia">
                  <label
                    v-for="opt in statusOptions"
                    :key="`${student.userId}-${session.sessionId}-${opt.value}`"
                    class="attendance-inline-option"
                    :class="[
                      statusClass(opt.value),
                      { 'is-selected': currentStatus(cellData(student, session).status) === opt.value, 'is-disabled': saving },
                    ]"
                  >
                    <input
                      type="radio"
                      class="attendance-inline-option__input"
                      :name="`att-${student.userId}-${session.sessionId}`"
                      :value="opt.value"
                      :checked="currentStatus(cellData(student, session).status) === opt.value"
                      :disabled="saving"
                      @change="selectStatus(student, session, opt.value)"
                    />
                    <span class="attendance-inline-option__label">{{ opt.code }}</span>
                  </label>
                </div>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  days: { type: Array, default: () => [] },
  students: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
});

const emit = defineEmits(['save-cell']);

const displayDays = computed(() => props.days || []);
const statusOptions = [
  { value: 'present', code: 'P' },
  { value: 'absent', code: 'A' },
  { value: 'late', code: 'T' },
  { value: 'excused', code: 'J' },
];

const initials = (name = '') =>
  String(name || '')
    .split(' ')
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

const cellData = (student, session) => {
  const bySession = student?.bySession || {};
  return bySession[session.sessionId] || { status: null, note: '' };
};

const currentStatus = (status) => status || 'present';

const statusClass = (status) => {
  switch (status) {
    case 'present': return 'is-present';
    case 'absent': return 'is-absent';
    case 'late': return 'is-late';
    case 'excused': return 'is-excused';
    default: return 'is-empty';
  }
};

const selectStatus = async (student, session, status) => {
  const current = cellData(student, session);
  if (currentStatus(current.status) === status) {
    return;
  }
  await emit('save-cell', {
    sessionId: session.sessionId,
    userId: student.userId,
    status,
    note: current.note || '',
  });
};
</script>

<style scoped>
.attendance-grid-wrap { display: grid; gap: 0.5rem; }
.attendance-grid-scroll {
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
}
.attendance-grid-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 880px;
}
.attendance-grid-table th,
.attendance-grid-table td {
  border-bottom: 1px solid #eef2f7;
  border-right: 1px solid #f1f5f9;
  padding: 0.55rem;
  vertical-align: middle;
  background: #fff;
}
.attendance-grid-table thead th {
  background: #f8fafc;
  position: sticky;
  top: 0;
  z-index: 2;
}
.student-col {
  min-width: 260px;
  width: 260px;
}
.sticky-col {
  position: sticky;
  left: 0;
  z-index: 3;
  background: #fff;
}
.attendance-grid-table thead .sticky-col { background: #f8fafc; z-index: 4; }
.day-header { display: grid; gap: 0.1rem; }
.day-header small { color: #64748b; }
.session-subhead { min-width: 92px; text-align: center; }
.session-subhead.empty { color: #94a3b8; }
.session-subhead__inner { display: grid; gap: 0.1rem; }
.session-subhead__inner small { color: #64748b; font-weight: 500; }
.student-row:hover td { background: #fbfdff; }
.student-row:hover .sticky-col { background: #fbfdff; }
.student-meta { display: flex; align-items: center; gap: 0.65rem; }
.student-meta strong { display: block; }
.student-meta small { color: #64748b; display: block; }
.student-avatar {
  width: 2rem; height: 2rem; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: #dbeafe; color: #1d4ed8; font-weight: 700;
}
.session-cell { text-align: center; }
.session-cell.empty { color: #94a3b8; }
.attendance-inline-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.25rem;
}
.attendance-inline-option {
  position: relative;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  min-width: 1.85rem;
  min-height: 1.85rem;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #f8fafc;
  color: #64748b;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
}
.attendance-inline-option:hover { transform: translateY(-1px); }
.attendance-inline-option.is-disabled { opacity: 0.65; cursor: not-allowed; }
.attendance-inline-option__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}
.attendance-inline-option__label {
  font-weight: 700;
  font-size: 0.82rem;
  line-height: 1;
}
.attendance-inline-option.is-selected.is-present { background: #ecfdf5; border-color: #bbf7d0; color: #166534; }
.attendance-inline-option.is-selected.is-absent { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
.attendance-inline-option.is-selected.is-late { background: #fffbeb; border-color: #fde68a; color: #92400e; }
.attendance-inline-option.is-selected.is-excused { background: #eef2ff; border-color: #c7d2fe; color: #3730a3; }
.attendance-inline-option:not(.is-selected) { background: #f8fafc; border-color: #e2e8f0; color: #94a3b8; }
.attendance-inline-option:focus-within {
  outline: 2px solid rgba(59, 130, 246, 0.25);
  outline-offset: 1px;
}
</style>

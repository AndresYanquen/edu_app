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
                  <em v-if="!session.isTaken" class="session-state-pill">Pend.</em>
                </div>
              </th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="student in students"
            :key="student.userId"
            class="student-row"
            :class="{ 'is-focused': focusUserId && focusUserId === student.userId }"
            :data-attendance-student-id="student.userId"
          >
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
                :class="{ 'is-pending': !session.isTaken && !cellSelection(student, session) }"
              >
                <div class="attendance-inline-options" role="radiogroup" aria-label="Estado de asistencia">
                  <label
                    v-for="opt in statusOptions"
                    :key="`${student.userId}-${session.sessionId}-${opt.value}`"
                    class="attendance-inline-option"
                    :class="[
                      statusClass(opt.value),
                      {
                        'is-selected': cellSelection(student, session) === opt.value,
                        'is-disabled': saving || readOnly,
                      },
                    ]"
                  >
                    <input
                      type="radio"
                      class="attendance-inline-option__input"
                      :name="`att-${student.userId}-${session.sessionId}`"
                      :value="opt.value"
                      :checked="cellSelection(student, session) === opt.value"
                      :disabled="saving || readOnly"
                      @change="selectStatus(student, session, opt.value)"
                    />
                    <span class="attendance-inline-option__label">{{ opt.code }}</span>
                  </label>
                </div>
                <small v-if="!session.isTaken && !cellSelection(student, session)" class="pending-note">
                  Pendiente
                </small>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="attendance-mobile-list">
      <article
        v-for="student in students"
        :key="`mobile-${student.userId}`"
        class="attendance-student-card"
        :class="{ 'is-focused': focusUserId && focusUserId === student.userId }"
        :data-attendance-student-id="student.userId"
      >
        <div class="attendance-student-card__head">
          <span class="student-avatar">{{ initials(student.fullName) }}</span>
          <div>
            <strong>{{ student.fullName || student.email }}</strong>
            <small>{{ student.email }}</small>
          </div>
        </div>

        <div class="attendance-day-cards">
          <section
            v-for="day in displayDays"
            :key="`mobile-day-${student.userId}-${day.date}`"
            class="attendance-day-card"
          >
            <header class="attendance-day-card__head">
              <strong>{{ day.shortLabel }}</strong>
              <small>{{ day.dateLabel }}</small>
            </header>

            <div v-if="!day.sessions.length" class="attendance-session-card is-empty">
              Sin sesiones
            </div>

            <div
              v-for="(session, sessionIndex) in day.sessions"
              :key="`mobile-session-${student.userId}-${session.sessionId}`"
              class="attendance-session-card"
            >
              <div class="attendance-session-card__meta">
                <span>Sesion {{ sessionIndex + 1 }}</span>
                <small>{{ session.timeLabel }}</small>
                <em v-if="!session.isTaken" class="session-state-pill">Pend.</em>
              </div>

              <div class="attendance-inline-options" role="radiogroup" aria-label="Estado de asistencia">
                <label
                  v-for="opt in statusOptions"
                  :key="`mobile-${student.userId}-${session.sessionId}-${opt.value}`"
                  class="attendance-inline-option"
                  :class="[
                    statusClass(opt.value),
                    {
                      'is-selected': cellSelection(student, session) === opt.value,
                      'is-disabled': saving || readOnly,
                    },
                  ]"
                >
                  <input
                    type="radio"
                    class="attendance-inline-option__input"
                    :name="`mobile-att-${student.userId}-${session.sessionId}`"
                    :value="opt.value"
                    :checked="cellSelection(student, session) === opt.value"
                    :disabled="saving || readOnly"
                    @change="selectStatus(student, session, opt.value)"
                  />
                  <span class="attendance-inline-option__label">{{ opt.code }}</span>
                </label>
              </div>
            </div>
          </section>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  days: { type: Array, default: () => [] },
  students: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
  readOnly: { type: Boolean, default: false },
  focusUserId: { type: String, default: '' },
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

const cellSelection = (student, session) => {
  const current = cellData(student, session);
  if (current.status) {
    return current.status;
  }
  return session?.isTaken ? 'present' : null;
};

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
  if (props.readOnly) return;
  const current = cellData(student, session);
  if (cellSelection(student, session) === status) {
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

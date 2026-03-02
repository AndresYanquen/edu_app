<template>
  <Card class="attendance-header-card">
    <template #content>
      <div class="attendance-header">
        <div class="week-controls">
          <div v-if="showPeriodSelector" class="period-toggle" role="tablist" aria-label="Periodo de resumen">
            <button
              v-for="option in periodOptions"
              :key="option.value"
              type="button"
              class="period-toggle__item"
              :class="{ 'is-active': periodMode === option.value }"
              :disabled="option.disabled"
              @click="$emit('update:periodMode', option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <div class="week-nav-row">
            <Button
              :label="primaryPrevLabel"
              icon="pi pi-chevron-left"
              class="p-button-text"
              @click="$emit('prev-week')"
            />
            <Button :label="primaryCurrentLabel" class="p-button-text" @click="$emit('current-week')" />
            <Button
              :label="primaryNextLabel"
              icon="pi pi-chevron-right"
              iconPos="right"
              class="p-button-text"
              @click="$emit('next-week')"
            />
          </div>
          <div v-if="showSecondaryRangeControls" class="jump-controls">
            <Button
              :label="secondaryPrevLabel"
              icon="pi pi-angle-double-left"
              class="p-button-text p-button-sm"
              @click="$emit('prev-month')"
            />
            <div class="week-jump-picker">
              <label for="attendance-week-jump">{{ jumpLabel }}</label>
              <Calendar
                id="attendance-week-jump"
                :modelValue="calendarValue"
                dateFormat="M d, yy"
                showIcon
                inputClass="week-jump-input"
                @update:modelValue="$emit('jump-week', $event)"
              />
            </div>
            <Button
              :label="secondaryNextLabel"
              icon="pi pi-angle-double-right"
              iconPos="right"
              class="p-button-text p-button-sm"
              @click="$emit('next-month')"
            />
          </div>
          <div class="week-copy">
            <strong>{{ weekLabel }}</strong>
            <small>{{ weekSubLabel }}</small>
            <span v-if="weekProgressLabel" class="week-progress-pill">{{ weekProgressLabel }}</span>
          </div>
        </div>

        <div class="header-side">
          <div class="metrics-row">
            <span class="metric-pill">
              <small>{{ averageMetricLabel }}</small>
              <strong>{{ averageAttendanceLabel }}</strong>
            </span>
            <span class="metric-pill" v-if="stats?.atRiskCount !== undefined">
              <small>{{ riskMetricLabel }}</small>
              <strong>{{ stats.atRiskCount }}</strong>
            </span>
          </div>

          <div class="header-actions">
            <div v-if="showGroupSelector" class="group-selector">
              <label>Grupo</label>
              <Dropdown
                :modelValue="selectedGroupId"
                :options="groupOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Todos"
                showClear
                @update:modelValue="$emit('update:groupId', $event)"
              />
            </div>
            <Button label="Exportar CSV" icon="pi pi-download" outlined disabled @click="$emit('export')" />
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  weekStart: { type: String, default: '' },
  weekLabel: { type: String, default: '' },
  weekSubLabel: { type: String, default: '' },
  weekProgressLabel: { type: String, default: '' },
  periodMode: { type: String, default: 'week' },
  periodOptions: { type: Array, default: () => [] },
  showPeriodSelector: { type: Boolean, default: false },
  averageMetricLabel: { type: String, default: 'Asistencia promedio' },
  riskMetricLabel: { type: String, default: 'En riesgo (semana)' },
  stats: { type: Object, default: () => ({}) },
  groupOptions: { type: Array, default: () => [] },
  selectedGroupId: { type: String, default: null },
});

defineEmits([
  'prev-week',
  'next-week',
  'current-week',
  'prev-month',
  'next-month',
  'jump-week',
  'update:periodMode',
  'update:groupId',
  'export',
]);

const showGroupSelector = computed(() => props.groupOptions.length > 1);
const showSecondaryRangeControls = computed(() => props.periodMode !== 'year');
const calendarValue = computed(() => {
  if (!props.weekStart) return null;
  const parsed = new Date(`${props.weekStart}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
});
const primaryPrevLabel = computed(() =>
  props.periodMode === 'month'
    ? 'Mes anterior'
    : props.periodMode === 'year'
    ? 'Año anterior'
    : 'Semana anterior',
);
const primaryCurrentLabel = computed(() =>
  props.periodMode === 'month'
    ? 'Mes actual'
    : props.periodMode === 'year'
    ? 'Año actual'
    : 'Semana actual',
);
const primaryNextLabel = computed(() =>
  props.periodMode === 'month'
    ? 'Mes siguiente'
    : props.periodMode === 'year'
    ? 'Año siguiente'
    : 'Semana siguiente',
);
const secondaryPrevLabel = computed(() => (props.periodMode === 'month' ? 'Año anterior' : 'Mes anterior'));
const secondaryNextLabel = computed(() => (props.periodMode === 'month' ? 'Año siguiente' : 'Mes siguiente'));
const jumpLabel = computed(() => {
  if (props.periodMode === 'month') return 'Ir a mes';
  if (props.periodMode === 'year') return 'Ir a año';
  return 'Ir a fecha';
});
const averageAttendanceLabel = computed(() => {
  if (props.stats?.hasAttendanceRecords === false && Number(props.stats?.totalSessions || 0) > 0) {
    return 'Sin registrar';
  }
  const pct = props.stats?.presentPct;
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) {
    return '—';
  }
  return `${Math.round(Number(pct))}%`;
});
</script>

<style scoped>
.attendance-header-card { border-radius: 20px; }
.attendance-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.week-controls {
  display: grid;
  gap: 0.55rem;
}
.period-toggle {
  display: inline-flex;
  gap: 0.3rem;
  padding: 0.2rem;
  border: 1px solid #dbe3f1;
  border-radius: 999px;
  background: #f8fbff;
  width: fit-content;
}
.period-toggle__item {
  border: 0;
  background: transparent;
  color: #516079;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.period-toggle__item.is-active {
  background: #ffffff;
  color: #173a63;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
}
.period-toggle__item:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.week-nav-row,
.jump-controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.week-copy {
  display: grid;
  gap: 0.15rem;
}
.week-copy small { color: #64748b; }
.week-progress-pill {
  display: inline-flex;
  width: fit-content;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  font-size: 0.76rem;
  font-weight: 700;
}
.week-jump-picker {
  display: grid;
  gap: 0.2rem;
}
.week-jump-picker label {
  font-size: 0.72rem;
  color: #64748b;
}
.header-side {
  display: grid;
  gap: 0.6rem;
  justify-items: end;
}
.metrics-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.metric-pill {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.4rem 0.6rem;
  display: inline-grid;
}
.metric-pill small { color: #64748b; font-size: 0.72rem; }
.metric-pill strong { font-size: 0.95rem; }
.header-actions {
  display: flex;
  align-items: end;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.group-selector {
  display: grid;
  gap: 0.25rem;
  min-width: 210px;
}
.group-selector label { font-size: 0.8rem; color: #64748b; }
@media (max-width: 900px) {
  .header-side { justify-items: start; width: 100%; }
  .metrics-row { justify-content: flex-start; }
  .jump-controls {
    align-items: stretch;
  }
}
</style>

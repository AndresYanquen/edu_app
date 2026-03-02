<template>
  <Card class="attendance-header-card">
    <template #content>
      <div class="attendance-header">
        <div class="week-controls">
          <Button icon="pi pi-chevron-left" class="p-button-text" @click="$emit('prev-week')" />
          <Button label="Semana actual" class="p-button-text" @click="$emit('current-week')" />
          <Button icon="pi pi-chevron-right" class="p-button-text" @click="$emit('next-week')" />
          <div class="week-copy">
            <strong>{{ weekLabel }}</strong>
            <small>{{ weekSubLabel }}</small>
          </div>
        </div>

        <div class="header-side">
          <div class="metrics-row">
            <span class="metric-pill">
              <small>Asistencia promedio</small>
              <strong>{{ averageAttendanceLabel }}</strong>
            </span>
            <span class="metric-pill" v-if="stats?.atRiskCount !== undefined">
              <small>En riesgo</small>
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
  weekLabel: { type: String, default: '' },
  weekSubLabel: { type: String, default: '' },
  stats: { type: Object, default: () => ({}) },
  groupOptions: { type: Array, default: () => [] },
  selectedGroupId: { type: String, default: null },
});

defineEmits(['prev-week', 'next-week', 'current-week', 'update:groupId', 'export']);

const showGroupSelector = computed(() => props.groupOptions.length > 1);
const averageAttendanceLabel = computed(() => {
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
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.week-copy {
  display: grid;
  margin-left: 0.35rem;
}
.week-copy small { color: #64748b; }
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
}
</style>

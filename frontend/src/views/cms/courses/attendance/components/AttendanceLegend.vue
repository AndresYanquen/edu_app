<template>
  <div class="attendance-legend">
    <span v-for="item in items" :key="item.code" class="legend-chip" :class="`is-${item.code}`">
      <strong>{{ item.code }}</strong>
      <small>{{ item.label }}</small>
    </span>
  </div>
</template>

<script setup>
const items = [
  { code: 'P', label: 'Presente' },
  { code: 'A', label: 'Ausente' },
  { code: 'T', label: 'Tarde' },
  { code: 'J', label: 'Justificado' },
];
</script>

<style scoped>
.attendance-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.legend-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 999px;
  padding: 0.35rem 0.65rem;
  border: 1px solid #e5e7eb;
  background: #fff;
}

.legend-chip strong { font-size: 0.8rem; }
.legend-chip small { color: #64748b; font-size: 0.75rem; }
.legend-chip.is-P { background: #ecfdf5; border-color: #bbf7d0; }
.legend-chip.is-A { background: #fef2f2; border-color: #fecaca; }
.legend-chip.is-T { background: #fffbeb; border-color: #fde68a; }
.legend-chip.is-J { background: #eef2ff; border-color: #c7d2fe; }
</style>

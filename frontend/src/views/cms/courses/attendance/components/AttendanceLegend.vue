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

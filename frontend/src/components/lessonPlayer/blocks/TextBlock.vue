<template>
  <div class="block-card text-block">
    <h3 v-if="block.title">{{ block.title }}</h3>
    <p v-if="block.content">{{ block.content }}</p>
  </div>
</template>

<script setup>
defineProps({
  block: {
    type: Object,
    required: true,
  },
});
</script>

<style scoped>
.block-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 1rem;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.text-block h3 {
  margin: 0 0 0.6rem;
  color: #0f172a;
}

.text-block p {
  margin: 0;
  color: #334155;
  line-height: 1.7;
  white-space: pre-wrap;
}
</style>
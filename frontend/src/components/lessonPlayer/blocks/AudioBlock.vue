<template>
  <div class="block-card audio-block">
    <h3 v-if="block.title">{{ block.title }}</h3>
    <audio controls :src="block.src"></audio>
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

.audio-block h3 {
  margin: 0 0 0.75rem;
}

.audio-block audio {
  width: 100%;
}
</style>
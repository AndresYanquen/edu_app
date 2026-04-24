<template>
  <figure class="block-card image-block">
    <img :src="block.src" :alt="block.alt || 'Lesson image'" />
    <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
  </figure>
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
  padding: 0.75rem;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.image-block {
  margin: 0;
}

.image-block img {
  width: 100%;
  display: block;
  border-radius: 14px;
  height: auto;
  object-fit: contain;
}

.image-block figcaption {
  margin-top: 0.65rem;
  color: #64748b;
  font-size: 0.92rem;
}
</style>
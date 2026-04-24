<template>
  <div class="block-card video-block">
    <h3 v-if="block.title">{{ block.title }}</h3>

    <div class="video-wrapper" v-if="block.src">
      <iframe
        :src="block.src"
        frameborder="0"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>
    </div>
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

.video-block h3 {
  margin: 0 0 0.75rem;
}

.video-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 14px;
  background: #000;
}

.video-wrapper iframe {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
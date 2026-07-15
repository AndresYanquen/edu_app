<template>
  <div class="block-card audio-block">
    <h3 v-if="block.title">{{ block.title }}</h3>
    <iframe
      v-if="soundCloudEmbedUrl"
      :src="soundCloudEmbedUrl"
      allow="autoplay"
      loading="lazy"
      frameborder="0"
    />
    <audio v-else-if="block.src" controls :src="block.src"></audio>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  block: {
    type: Object,
    required: true,
  },
});

const isSoundCloudUrl = (value = '') =>
  /(^https?:\/\/)?([^/]+\.)?soundcloud\.com\//i.test(String(value || '').trim());

const normalizeSoundCloudEmbedUrl = (value = '') => {
  const raw = String(value || '')
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/visual=true/gi, 'visual=false')
    .replace(/show_comments=true/gi, 'show_comments=false')
    .replace(/show_user=true/gi, 'show_user=false')
    .replace(/show_reposts=true/gi, 'show_reposts=false')
    .replace(/show_teaser=true/gi, 'show_teaser=false');

  if (!raw) return '';
  if (/w\.soundcloud\.com\/player/i.test(raw)) return raw;
  if (!isSoundCloudUrl(raw)) return '';

  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(raw)}&visual=false&show_comments=false&show_user=false&show_reposts=false&show_teaser=false`;
};

const soundCloudEmbedUrl = computed(() => normalizeSoundCloudEmbedUrl(props.block.embedUrl));
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

.audio-block audio,
.audio-block iframe {
  width: 100%;
}

.audio-block iframe {
  display: block;
  height: 166px;
  border: 0;
  border-radius: 16px;
  background: #fff;
}
</style>

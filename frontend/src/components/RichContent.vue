<template>
  <div class="rich-content" v-if="sanitizedContent" v-html="sanitizedContent"></div>
</template>

<script setup>
import { computed } from 'vue';
import DOMPurify from 'dompurify';

const props = defineProps({
  content: {
    type: String,
    default: '',
  },
});

const purifierConfig = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['allow', 'allowfullscreen', 'referrerpolicy', 'controls', 'muted', 'playsinline', 'data-mce-*', 'class', 'style'],
  ADD_TAGS: ['iframe', 'video', 'audio', 'source', 'picture', 'track'],
};

const sanitizedContent = computed(() => {
  if (!props.content) return '';
  return DOMPurify.sanitize(props.content, purifierConfig);
});
</script>

<style scoped>
.rich-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  /* ✅ evita que algo se salga horizontalmente */
  max-width: 100%;
  overflow-x: hidden;
}

/* ✅ fallback general: cualquier media embebida debe respetar el ancho del contenedor */
.rich-content :deep(img),
.rich-content :deep(video),
.rich-content :deep(iframe),
.rich-content :deep(embed),
.rich-content :deep(object) {
  max-width: 100%;
}

/* ✅ si Quill/pegado mete iframes “sueltos”, fuerzalos a no desbordar */
.rich-content :deep(iframe) {
  display: block;
  width: 100%;
  border: 0;

  /* fallback de altura si NO viene envuelto en .embed-wrapper */
  height: 360px;
  border-radius: 0.75rem;
}

/* ✅ imágenes sueltas (sin .image-wrapper) */
.rich-content :deep(img) {
  display: block;
  height: auto;
}

/* ✅ párrafos y texto */
.rich-content p {
  margin: 0;
  line-height: 1.6;
  color: #0f172a;

  /* evita que URLs enormes rompan el layout */
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* ✅ tu wrapper ideal para embeds (mantener) */
.embed-wrapper {
  position: relative;
  width: 100%;
  max-width: 640px; /* 🔥 limita tamaño máximo */
  margin: 0 auto;   /* 🔥 centra horizontalmente */
  aspect-ratio: 16 / 9; /* moderno y más limpio que padding hack */
  border-radius: 0.75rem;
  background: #000;
  overflow: hidden;
}

.embed-wrapper iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  border-radius: 0.75rem;
}

/* ✅ evita que un iframe “suelto” se pelee con el wrapper cuando sí existe */
.embed-wrapper :deep(iframe) {
  height: 100%;
}

/* ✅ tu wrapper de imágenes (mantener) */
.image-wrapper {
  width: 100%;
  max-width: 640px;      /* 🔥 límite visual elegante */
  margin: 0 auto;        /* 🔥 centrado */
  border-radius: 0.75rem;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  background: #fff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06); /* suave */
}

.image-wrapper img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
}

/* ✅ audio (mantener) */
.audio-wrapper {
  width: 100%;
}

.audio-wrapper audio {
  width: 100%;
  border-radius: 0.75rem;
}

/* ✅ links */
.rich-link a {
  color: #2563eb;
  text-decoration: underline;
  word-break: break-all;
}

.rich-file a {
  color: #0f172a;
  text-decoration: none;
  font-weight: 600;
}
</style>

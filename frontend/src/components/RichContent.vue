<template>
  <div ref="rootRef" class="rich-content" v-if="sanitizedContent" v-html="sanitizedContent"></div>
</template>

<script setup>
import { computed, createApp, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import DOMPurify from 'dompurify';
import InlineQuiz from './InlineQuiz.vue';

const props = defineProps({
  content: {
    type: String,
    default: '',
  },
  quizQuestions: {
    type: Array,
    default: () => [],
  },
  answersByQuestionId: {
    type: Object,
    default: () => ({}),
  },
});
const emit = defineEmits(['inline-quiz-attempted']);

const purifierConfig = {
  USE_PROFILES: { html: true },
  ADD_ATTR: [
    'allow',
    'allowfullscreen',
    'referrerpolicy',
    'controls',
    'muted',
    'playsinline',
    'data-mce-*',
    'data-lesson-id',
    'data-question-id',
    'class',
    'style',
  ],
  ADD_TAGS: ['iframe', 'video', 'audio', 'source', 'picture', 'track'],
};

const rootRef = ref(null);
const mountedQuizApps = ref([]);
const questionIdentifier = (item) => item?.id || item?.questionId || item?.question_id || null;

const sanitizedContent = computed(() => {
  if (!props.content) return '';
  return DOMPurify.sanitize(props.content, purifierConfig);
});

const cleanupInlineQuizzes = () => {
  mountedQuizApps.value.forEach(({ app, marker }) => {
    app.unmount();
    if (marker) marker.innerHTML = '';
  });
  mountedQuizApps.value = [];
};

const mountInlineQuizzes = async () => {
  await nextTick();
  cleanupInlineQuizzes();

  const root = rootRef.value;
  if (!root) return;

  const markers = root.querySelectorAll('.cms-quiz[data-lesson-id][data-question-id]');
  markers.forEach((marker) => {
    const lessonId = marker.getAttribute('data-lesson-id');
    const questionId = marker.getAttribute('data-question-id');
    marker.innerHTML = '';

    if (!lessonId || !String(questionId || '').trim()) {
      marker.innerHTML = '<small class="cms-quiz-warning">Missing questionId for inline quiz.</small>';
      return;
    }

    const mountEl = document.createElement('div');
    marker.appendChild(mountEl);
    const question =
      props.quizQuestions.find(
        (item) => String(questionIdentifier(item) || '').trim() === String(questionId || '').trim(),
      ) || null;
    const normalizedQuestionId = String(questionId || '').trim();
    const initialAnswer = props.answersByQuestionId[normalizedQuestionId] || null;
    const app = createApp(InlineQuiz, {
      lessonId,
      questionId,
      question,
      initialAnswer,
      onAttempted: (payload) => {
        emit('inline-quiz-attempted', payload);
      },
    });
    app.mount(mountEl);
    mountedQuizApps.value.push({ app, marker, mountEl });
  });
};

watch(
  [() => sanitizedContent.value, () => props.quizQuestions, () => props.answersByQuestionId],
  async () => {
    await mountInlineQuizzes();
  },
  { immediate: true, deep: true },
);

onBeforeUnmount(() => {
  cleanupInlineQuizzes();
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

/* Respeta alineación centrada generada por TinyMCE (p con text-align:center) */
.rich-content :deep(p[style*='text-align:center'] img),
.rich-content :deep(p[style*='text-align: center'] img) {
  display: inline-block;
}

/* Fallback para figuras centradas por TinyMCE */
.rich-content :deep(figure.image) {
  margin-left: auto;
  margin-right: auto;
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

.rich-content :deep(.cms-quiz-warning) {
  color: #b45309;
}
</style>

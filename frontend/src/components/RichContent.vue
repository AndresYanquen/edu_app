<template>
  <div
    ref="rootRef"
    class="rich-content"
    v-if="sanitizedContent"
    v-html="sanitizedContent"
  ></div>
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
    'width',
    'height',
    'target',
    'rel',
    'src',
    'href',
    'alt',
  ],
  ADD_TAGS: ['iframe', 'video', 'audio', 'source', 'picture', 'track', 'figure', 'figcaption'],
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

const unwrapSingleMediaParents = (root) => {
  if (!root) return;

  const selectors = ['img', 'iframe', 'audio', 'video'];

  selectors.forEach((selector) => {
    root.querySelectorAll(selector).forEach((node) => {
      const parent = node.parentElement;
      if (!parent) return;

      const isPlainParagraph =
        parent.tagName === 'P' &&
        parent.attributes.length <= 1 &&
        parent.textContent?.trim() === '';

      if (isPlainParagraph) {
        parent.parentNode?.insertBefore(node, parent);
        parent.remove();
      }
    });
  });
};

const normalizeWrapperClasses = (figure, classes = []) => {
  if (!figure) return;
  figure.classList.add('lesson-media');
  classes.forEach((className) => figure.classList.add(className));
};

const enhanceMediaLayout = () => {
  const root = rootRef.value;
  if (!root) return;

  unwrapSingleMediaParents(root);

  const iframes = root.querySelectorAll('iframe');
  iframes.forEach((iframe) => {
    const src = String(iframe.getAttribute('src') || '').toLowerCase();
    const parent = iframe.parentElement;
    const figure = iframe.closest('figure');

    if (src.includes('soundcloud.com')) {
      normalizeWrapperClasses(figure, ['lesson-media-audio']);

      if (
        parent?.classList.contains('audio-embed-wrapper') ||
        parent?.classList.contains('lesson-media-audio-inner')
      ) {
        return;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'audio-embed-wrapper lesson-media-audio-inner';
      iframe.parentNode?.insertBefore(wrapper, iframe);
      wrapper.appendChild(iframe);
      return;
    }

    normalizeWrapperClasses(figure, ['lesson-media-video']);

    if (
      parent?.classList.contains('embed-wrapper') ||
      parent?.classList.contains('lesson-media-video-inner')
    ) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'embed-wrapper lesson-media-video-inner';
    iframe.parentNode?.insertBefore(wrapper, iframe);
    wrapper.appendChild(iframe);
  });

  const images = root.querySelectorAll('img');
  images.forEach((img) => {
    const parent = img.parentElement;
    const figure = img.closest('figure');

    if (figure) {
      normalizeWrapperClasses(figure, ['lesson-media-image']);
      return;
    }

    if (parent?.classList.contains('image-wrapper')) return;

    const wrapper = document.createElement('figure');
    wrapper.className = 'image-wrapper lesson-media lesson-media-image';
    img.parentNode?.insertBefore(wrapper, img);
    wrapper.appendChild(img);
  });

  const audios = root.querySelectorAll('audio');
  audios.forEach((audio) => {
    const parent = audio.parentElement;
    const figure = audio.closest('figure');

    normalizeWrapperClasses(figure, ['lesson-media-audio']);

    if (parent?.classList.contains('audio-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'audio-wrapper';
    audio.parentNode?.insertBefore(wrapper, audio);
    wrapper.appendChild(audio);
  });

  const fileLinks = root.querySelectorAll('a[href]');
  fileLinks.forEach((link) => {
    const href = String(link.getAttribute('href') || '').toLowerCase();
    const alreadyWrapped =
      link.parentElement?.classList.contains('rich-file') ||
      link.parentElement?.classList.contains('rich-link');

    if (alreadyWrapped) return;

    const isFile =
      href.endsWith('.pdf') ||
      href.endsWith('.doc') ||
      href.endsWith('.docx') ||
      href.endsWith('.ppt') ||
      href.endsWith('.pptx') ||
      href.endsWith('.zip');

    const wrapper = document.createElement('p');
    wrapper.className = isFile ? 'rich-file' : 'rich-link';
    link.parentNode?.insertBefore(wrapper, link);
    wrapper.appendChild(link);
  });
};

const mountInlineQuizzes = async () => {
  await nextTick();
  cleanupInlineQuizzes();

  const root = rootRef.value;
  if (!root) return;

  enhanceMediaLayout();

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
  --content-width: 780px;
  --media-width: 760px;
  --audio-width: 760px;
  --content-side-padding: 0px;
  --radius-lg: 20px;
  --radius-md: 16px;
  --shadow-soft: 0 10px 28px rgba(15, 23, 42, 0.08);
  --shadow-media: 0 14px 34px rgba(15, 23, 42, 0.12);

  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 920px;
  margin: 0 auto;
  padding: 0.5rem var(--content-side-padding) 0;
  overflow-x: clip;
  color: #0f172a;
  font-size: 15px;
  line-height: 1.8;
  box-sizing: border-box;
}

.rich-content,
.rich-content :deep(*),
.embed-wrapper,
.audio-embed-wrapper,
.image-wrapper,
.audio-wrapper,
.rich-link,
.rich-file {
  box-sizing: border-box;
}

.rich-content > :deep(*) {
  width: 100%;
  min-width: 0;
}

.rich-content :deep(h1),
.rich-content :deep(h2),
.rich-content :deep(h3),
.rich-content :deep(h4),
.rich-content :deep(p),
.rich-content :deep(ul),
.rich-content :deep(ol),
.rich-content :deep(blockquote),
.rich-content :deep(table),
.rich-content :deep(.rich-link),
.rich-content :deep(.rich-file),
.rich-content :deep(.cms-quiz) {
  width: min(100%, var(--content-width));
  max-width: var(--content-width);
  margin-left: auto;
  margin-right: auto;
}

.rich-content :deep(h1),
.rich-content :deep(h2),
.rich-content :deep(h3),
.rich-content :deep(h4) {
  color: #0f172a;
  font-weight: 700;
  line-height: 1.2;
  margin-top: 1.4rem;
  margin-bottom: 0.8rem;
  overflow-wrap: anywhere;
}

.rich-content :deep(h1) {
  font-size: clamp(1.8rem, 2.5vw, 2.3rem);
}

.rich-content :deep(h2) {
  font-size: clamp(1.45rem, 2vw, 1.8rem);
}

.rich-content :deep(h3) {
  font-size: clamp(1.2rem, 1.6vw, 1.4rem);
}

.rich-content :deep(h4) {
  font-size: 1.05rem;
}

.rich-content :deep(p) {
  margin-top: 0;
  margin-bottom: 1rem;
  line-height: 1.8;
  color: #1e293b;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.rich-content :deep(ul),
.rich-content :deep(ol) {
  margin-top: 0;
  margin-bottom: 1rem;
  padding-left: 1.35rem;
  color: #1e293b;
}

.rich-content :deep(li) {
  margin-bottom: 0.45rem;
}

.rich-content :deep(blockquote) {
  margin-top: 1.4rem;
  margin-bottom: 1.4rem;
  padding: 1rem 1.2rem;
  border-left: 4px solid #6366f1;
  background: #f8fafc;
  border-radius: 0 16px 16px 0;
  color: #475569;
}

.rich-content :deep(hr) {
  width: min(100%, var(--content-width));
  max-width: var(--content-width);
  border: 0;
  border-top: 1px solid #e2e8f0;
  margin: 2rem auto;
}

.rich-content :deep(figure) {
  margin: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
}

.rich-content :deep(img),
.rich-content :deep(video),
.rich-content :deep(iframe),
.rich-content :deep(embed),
.rich-content :deep(object) {
  max-width: 100%;
}

.embed-wrapper,
.audio-embed-wrapper,
.image-wrapper,
.rich-content :deep(figure.lesson-media-video),
.rich-content :deep(figure.lesson-media-audio),
.rich-content :deep(figure.lesson-media-image),
.audio-wrapper {
  width: min(100%, var(--media-width)) !important;
  max-width: var(--media-width) !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

.embed-wrapper,
.rich-content :deep(figure.lesson-media-video) {
  margin-top: 1.5rem !important;
  margin-bottom: 1.5rem !important;
}

.embed-wrapper {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-lg);
  background: #000;
  overflow: hidden;
  box-shadow: var(--shadow-media);
}

.embed-wrapper iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  border-radius: var(--radius-lg);
}

.rich-content :deep(figure.lesson-media-video) {
  text-align: center;
}

.rich-content :deep(figure.lesson-media-video > iframe) {
  display: block;
  width: 100% !important;
  max-width: var(--media-width) !important;
  aspect-ratio: 16 / 9;
  margin: 0 auto !important;
  border: 0;
  border-radius: var(--radius-lg);
  background: #000;
  box-shadow: var(--shadow-media);
}

.audio-embed-wrapper,
.rich-content :deep(figure.lesson-media-audio) {
  width: min(100%, var(--audio-width)) !important;
  max-width: var(--audio-width) !important;
  margin-top: 1.25rem !important;
  margin-bottom: 1.5rem !important;
}

.audio-embed-wrapper {
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-soft);
  background: #fff;
}

.audio-embed-wrapper iframe {
  display: block;
  width: 100%;
  height: 180px;
  border: 0;
}

.rich-content :deep(figure.lesson-media-audio) {
  text-align: center;
}

.rich-content :deep(figure.lesson-media-audio > iframe) {
  display: block;
  width: 100% !important;
  max-width: var(--audio-width) !important;
  height: 180px;
  margin: 0 auto !important;
  border: 0;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
  background: #fff;
}

.image-wrapper,
.rich-content :deep(figure.lesson-media-image) {
  margin-top: 1.4rem !important;
  margin-bottom: 1.4rem !important;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  background: #fff;
  box-shadow: var(--shadow-soft);
}

.image-wrapper img,
.rich-content :deep(figure.lesson-media-image img) {
  display: block;
  width: 100% !important;
  max-width: 100% !important;
  height: auto;
  object-fit: contain;
  margin: 0 auto !important;
}

.rich-content :deep(img) {
  display: block;
  height: auto;
}

.audio-wrapper {
  margin-top: 1rem !important;
  margin-bottom: 1rem !important;
}

.audio-wrapper audio {
  width: 100%;
  border-radius: 14px;
}

.rich-content :deep(iframe) {
  display: block;
  width: 100%;
  max-width: 100%;
  border: 0;
  border-radius: 18px;
}

.rich-content :deep(table) {
  border-collapse: collapse;
  overflow: hidden;
  border-radius: 14px;
  background: #fff;
}

.rich-content :deep(th),
.rich-content :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 0.8rem;
  text-align: left;
  vertical-align: top;
}

.rich-content :deep(th) {
  background: #f8fafc;
  color: #334155;
  font-weight: 700;
}

.rich-link {
  margin-top: 0;
  margin-bottom: 1rem;
}

.rich-link a {
  color: #2563eb;
  text-decoration: underline;
  word-break: break-word;
  font-weight: 600;
}

.rich-file {
  margin-top: 1rem;
  margin-bottom: 1rem;
  text-align: center;
}

.rich-file a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  padding: 0.8rem 1rem;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #0f172a;
  text-decoration: none;
  font-weight: 600;
  word-break: break-word;
}

.rich-content :deep(p[style*='text-align:center'] img),
.rich-content :deep(p[style*='text-align: center'] img) {
  display: inline-block;
}

.rich-content :deep(figure.image) {
  margin-left: auto;
  margin-right: auto;
}

.rich-content :deep(.cms-quiz) {
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 1rem;
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
}

.rich-content :deep(.cms-quiz-warning) {
  color: #b45309;
}

@media (max-width: 900px) {
  .rich-content {
    --content-width: 100%;
    --media-width: 100%;
    --audio-width: 100%;
    --content-side-padding: 0px;
    max-width: 100%;
    padding: 0;
  }

  .rich-content :deep(h1),
  .rich-content :deep(h2),
  .rich-content :deep(h3),
  .rich-content :deep(h4),
  .rich-content :deep(p),
  .rich-content :deep(ul),
  .rich-content :deep(ol),
  .rich-content :deep(blockquote),
  .rich-content :deep(table),
  .rich-content :deep(.rich-link),
  .rich-content :deep(.rich-file),
  .rich-content :deep(.cms-quiz),
  .embed-wrapper,
  .audio-embed-wrapper,
  .image-wrapper,
  .audio-wrapper,
  .rich-content :deep(figure.lesson-media-video),
  .rich-content :deep(figure.lesson-media-audio),
  .rich-content :deep(figure.lesson-media-image) {
    width: 100% !important;
    max-width: 100% !important;
  }
}

@media (max-width: 640px) {
  .rich-content {
    --content-width: 100%;
    --media-width: 100%;
    --audio-width: 100%;
    --content-side-padding: 0px;
    gap: 0.85rem;
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: 0;
    font-size: 14px;
  }

  .rich-content > :deep(*) {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }

  .rich-content :deep(h1),
  .rich-content :deep(h2),
  .rich-content :deep(h3),
  .rich-content :deep(h4),
  .rich-content :deep(p),
  .rich-content :deep(ul),
  .rich-content :deep(ol),
  .rich-content :deep(blockquote),
  .rich-content :deep(table),
  .rich-content :deep(.rich-link),
  .rich-content :deep(.rich-file),
  .rich-content :deep(.cms-quiz),
  .embed-wrapper,
  .audio-embed-wrapper,
  .image-wrapper,
  .audio-wrapper,
  .rich-content :deep(figure),
  .rich-content :deep(figure.lesson-media-video),
  .rich-content :deep(figure.lesson-media-audio),
  .rich-content :deep(figure.lesson-media-image) {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  .rich-content :deep(ul),
  .rich-content :deep(ol) {
    padding-left: 1.15rem;
  }

  .embed-wrapper,
  .audio-embed-wrapper,
  .image-wrapper,
  .audio-wrapper,
  .rich-content :deep(figure.lesson-media-video),
  .rich-content :deep(figure.lesson-media-audio),
  .rich-content :deep(figure.lesson-media-image) {
    margin-top: 1rem !important;
    margin-bottom: 1rem !important;
  }

  .embed-wrapper,
  .rich-content :deep(figure.lesson-media-video > iframe),
  .image-wrapper,
  .rich-content :deep(figure.lesson-media-image),
  .audio-embed-wrapper,
  .rich-content :deep(figure.lesson-media-audio > iframe) {
    border-radius: 14px;
  }

  .audio-embed-wrapper iframe,
  .rich-content :deep(figure.lesson-media-audio > iframe) {
    height: 152px;
  }

  .rich-content :deep(img),
  .rich-content :deep(iframe),
  .rich-content :deep(video),
  .rich-content :deep(audio) {
    width: 100% !important;
    max-width: 100% !important;
  }

  .rich-file a {
    width: 100%;
  }
}
</style>

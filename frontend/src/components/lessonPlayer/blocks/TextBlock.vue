<template>
  <div class="block-card text-block">
    <h3 v-if="block.title">{{ block.title }}</h3>
    <p v-if="block.content" v-html="contentHtml" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import DOMPurify from 'dompurify';

const props = defineProps({
  block: {
    type: Object,
    required: true,
  },
});

const escapeHtmlText = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isSafeLinkUrl = (value = '') => {
  const url = String(value || '').trim();
  if (!url) return false;
  if (/^(https?:|mailto:|tel:)/i.test(url)) return true;
  return url.startsWith('/') || url.startsWith('#');
};

const renderTextMarkdownLinks = (value = '') =>
  escapeHtmlText(value).replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (fullMatch, label, url) => {
      if (!isSafeLinkUrl(url)) return fullMatch;
      return `<a href="${escapeHtmlText(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    },
  );

const contentHtml = computed(() =>
  DOMPurify.sanitize(renderTextMarkdownLinks(props.block.content).replace(/\n/g, '<br>'), {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  }),
);
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

.text-block :deep(a) {
  color: #2563eb;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>

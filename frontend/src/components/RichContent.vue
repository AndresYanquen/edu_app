<template>
  <div class="rich-content" v-if="blocks.length">
    <template v-for="(block, index) in blocks" :key="`block-${index}`">
      <template v-if="block.type === 'text'">
        <p v-for="(lines, idx) in paragraphs(block.value)" :key="`text-${index}-${idx}`">
          <template v-for="(line, lineIdx) in lines" :key="`line-${index}-${idx}-${lineIdx}`">
            <span>{{ line }}</span>
            <br v-if="lineIdx < lines.length - 1" />
          </template>
        </p>
      </template>

      <div v-else-if="block.type === 'embed'" class="embed-wrapper">
        <iframe
          :src="block.embedUrl"
          title="Embedded media"
          loading="lazy"
          allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        ></iframe>
      </div>

      <div v-else-if="block.type === 'image'" class="image-wrapper">
        <img :src="block.url" alt="" loading="lazy" referrerpolicy="no-referrer" />
      </div>

      <div v-else-if="block.type === 'audio'" class="audio-wrapper">
        <audio controls :src="block.url" preload="none"></audio>
      </div>

      <p v-else-if="block.type === 'file'" class="rich-file">
        <a :href="block.url" target="_blank" rel="noopener noreferrer nofollow">
          {{ block.label || 'Download file' }}
        </a>
      </p>

      <p v-else-if="block.type === 'link'" class="rich-link">
        <a :href="block.url" target="_blank" rel="noopener noreferrer nofollow">{{ block.url }}</a>
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { parseRichContent } from '../utils/richContent';

const props = defineProps({
  content: {
    type: String,
    default: '',
  },
  renderMarkdown: {
    type: Boolean,
    default: true,
  },
});

const blocks = computed(() => parseRichContent(props.content || ''));

const paragraphs = (value) =>
  value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length)
    .map((paragraph) => paragraph.split(/\n/));
</script>

<style scoped>
.rich-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rich-content p {
  margin: 0;
  line-height: 1.6;
  color: #0f172a;
}

.embed-wrapper {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
  overflow: hidden;
  border-radius: 0.75rem;
  background: #000;
}

.embed-wrapper iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 0.75rem;
}

.image-wrapper {
  border-radius: 0.75rem;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.image-wrapper img {
  display: block;
  width: 100%;
  height: auto;
}

.audio-wrapper {
  width: 100%;
}

.audio-wrapper audio {
  width: 100%;
  border-radius: 0.75rem;
}

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

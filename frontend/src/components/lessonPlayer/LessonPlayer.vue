<template>
  <div class="lesson-player" v-if="lessonData?.pages?.length">
    <div class="lesson-book-shell">
      <div class="lesson-book-header">
        <div>
          <small class="lesson-book-kicker">{{ lessonData.title }}</small>
          <h2 class="lesson-book-page-title">{{ currentPage.title }}</h2>
        </div>

        <div class="lesson-book-counter">
          {{ pageIndex + 1 }} / {{ lessonData.pages.length }}
        </div>
      </div>

      <div :class="['lesson-book-page', `layout-${currentPage.layout || 'single-column'}`]">
        <component
          v-for="(block, index) in currentPage.blocks"
          :key="index"
          :is="resolveBlockComponent(block.type)"
          :block="block"
        />
      </div>

      <div class="lesson-book-actions">
        <Button
          label="Anterior"
          icon="pi pi-arrow-left"
          class="p-button-outlined"
          :disabled="pageIndex === 0"
          @click="prevPage"
        />

        <Button
          label="Siguiente"
          icon="pi pi-arrow-right"
          iconPos="right"
          :disabled="pageIndex === lessonData.pages.length - 1"
          @click="nextPage"
        />
      </div>
    </div>
  </div>

  <div v-else class="lesson-player-empty">
    No hay páginas configuradas para esta lección.
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import Button from 'primevue/button';

import TextBlock from './blocks/TextBlock.vue';
import ImageBlock from './blocks/ImageBlock.vue';
import AudioBlock from './blocks/AudioBlock.vue';
import VideoBlock from './blocks/VideoBlock.vue';

const props = defineProps({
  lessonData: {
    type: Object,
    required: true,
  },
});

const pageIndex = ref(0);

const currentPage = computed(() => props.lessonData.pages?.[pageIndex.value] || { blocks: [] });

const prevPage = () => {
  if (pageIndex.value > 0) pageIndex.value--;
};

const nextPage = () => {
  if (pageIndex.value < props.lessonData.pages.length - 1) pageIndex.value++;
};

const resolveBlockComponent = (type) => {
  switch (type) {
    case 'text':
      return TextBlock;
    case 'image':
      return ImageBlock;
    case 'audio':
      return AudioBlock;
    case 'video':
      return VideoBlock;
    default:
      return TextBlock;
  }
};
</script>

<style scoped>
.lesson-player {
  width: 100%;
}

.lesson-book-shell {
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  padding: 1.25rem;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
}

.lesson-book-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.lesson-book-kicker {
  display: block;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.lesson-book-page-title {
  margin: 0;
  font-size: clamp(1.4rem, 2.5vw, 2rem);
  color: #0f172a;
  line-height: 1.15;
}

.lesson-book-counter {
  flex-shrink: 0;
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 700;
  padding: 0.55rem 0.8rem;
  border-radius: 999px;
}

.lesson-book-page {
  display: grid;
  gap: 1rem;
  min-height: 420px;
  align-items: start;
}

.layout-single-column {
  grid-template-columns: 1fr;
}

.layout-two-columns {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.layout-hero-left {
  grid-template-columns: 1.2fr 0.8fr;
}

.lesson-book-actions {
  margin-top: 1.25rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.lesson-player-empty {
  color: #64748b;
}

@media (max-width: 768px) {
  .lesson-book-shell {
    padding: 1rem;
    border-radius: 18px;
  }

  .lesson-book-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .layout-two-columns,
  .layout-hero-left {
    grid-template-columns: 1fr;
  }

  .lesson-book-page {
    min-height: auto;
  }

  .lesson-book-actions {
    flex-direction: column;
  }

  .lesson-book-actions :deep(.p-button) {
    width: 100%;
  }
}
</style>
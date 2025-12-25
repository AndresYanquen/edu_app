<template>
  <div class="page">
    <Breadcrumb class="mb-2" :home="breadcrumbHome" :model="breadcrumbItems" />
    <Card v-if="loading">
      <template #content>
        <Skeleton height="2rem" class="mb-2" />
        <Skeleton height="6rem" class="mb-2" />
        <Skeleton height="4rem" />
      </template>
    </Card>

    <Card v-else-if="error">
      <template #content>
        <p>{{ errorMessage }}</p>
        <Button label="Reload" icon="pi pi-refresh" class="p-button-text" @click="loadLesson" />
        <Button label="Back to course" icon="pi pi-arrow-left" class="p-button-text" @click="goBack" />
      </template>
    </Card>

    <Card v-else>
      <template #title>
        <div class="lesson-header">
          <div>
            <small class="breadcrumb-text">{{ course?.title }} / {{ moduleInfo?.title }}</small>
            <h2>{{ lesson?.title }}</h2>
          </div>
          <div class="actions">
            <Button label="Back to course" icon="pi pi-arrow-left" class="p-button-text" @click="goBack" />
          </div>
        </div>
      </template>

      <template #content>
        <div class="meta">
          <Tag :value="lesson?.contentType || 'lesson'" severity="info" />
          <Tag
            v-if="lesson?.estimatedMinutes"
            :value="`${lesson.estimatedMinutes} min`"
            severity="secondary"
          />
          <span v-if="lesson?.durationSeconds">{{ formatDuration(lesson.durationSeconds) }}</span>
        </div>

        <Divider />

        <div class="content-area">
          <Card v-if="lesson?.contentText" class="lesson-card">
            <template #title>Lesson text</template>
            <template #content>
              <p class="lesson-text">{{ lesson.contentText }}</p>
              <a v-if="lesson?.contentUrl" :href="lesson.contentUrl" target="_blank" rel="noopener">
                Reference link
              </a>
            </template>
          </Card>

          <Card v-else-if="lesson?.contentUrl" class="lesson-card">
            <template #title>Reference</template>
            <template #content>
              <a :href="lesson.contentUrl" target="_blank" rel="noopener">{{ lesson.contentUrl }}</a>
            </template>
          </Card>

          <Card v-if="lesson?.videoUrl" class="lesson-card">
            <template #title>Video</template>
            <template #content>
              <div v-if="isYoutube(lesson.videoUrl)" class="video-embed">
                <iframe
                  :src="youtubeEmbed(lesson.videoUrl)"
                  title="Lesson video"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen
                ></iframe>
              </div>
              <div v-else>
                <Button label="Open video" icon="pi pi-external-link" @click="openVideo(lesson.videoUrl)" />
              </div>
            </template>
          </Card>

          <div v-if="!lesson?.contentText && !lesson?.videoUrl" class="empty-state">
            Lesson content coming soon.
          </div>
        </div>

        <div v-if="assets.length" class="assets">
          <h4>Assets</h4>
          <ul>
            <li v-for="asset in assets" :key="asset.id">
              <i class="pi pi-paperclip"></i>
              <span>{{ asset.path }} ({{ asset.mimeType }})</span>
            </li>
          </ul>
        </div>

        <Divider />

        <div class="progress-actions">
          <Button
            label="Mark in progress"
            icon="pi pi-play"
            class="p-button-outlined"
            :loading="updating === 'progress'"
            @click="updateStatus('in_progress', 35, 'progress')"
          />
          <Button
            label="Mark done"
            icon="pi pi-check"
            :loading="updating === 'done'"
            @click="updateStatus('done', 100, 'done')"
          />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import api from '../api/axios';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const course = ref(null);
const moduleInfo = ref(null);
const lesson = ref(null);
const assets = ref([]);
const loading = ref(true);
const error = ref(false);
const errorMessage = ref('Failed to load lesson.');
const updating = ref(null);

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

const locateLesson = (courseData, targetLessonId) => {
  for (const mod of courseData.modules || []) {
    const found = mod.lessons.find((l) => l.id === targetLessonId);
    if (found) {
      return { module: mod, lesson: found };
    }
  }
  return null;
};

const loadLesson = async (silent = false) => {
  if (!silent) {
    loading.value = true;
  }
  error.value = false;
  try {
    const { courseId, lessonId } = route.params;
    const { data } = await api.get(`/courses/${courseId}`);
    course.value = data;
    const found = locateLesson(data, lessonId);
    if (!found) {
      error.value = true;
      errorMessage.value = 'Lesson not found in this course.';
      toast.add({ severity: 'error', summary: 'Error', detail: 'Lesson not found', life: 3000 });
      return;
    }
    moduleInfo.value = found.module;
    lesson.value = found.lesson;
    assets.value = found.lesson.assets || [];
  } catch (err) {
    error.value = true;
    const detail = err.response?.data?.error || 'Failed to load lesson';
    errorMessage.value = detail;
    toast.add({ severity: 'error', summary: 'Error', detail, life: 3000 });
  } finally {
    if (!silent) {
      loading.value = false;
    }
  }
};

const goBack = () => {
  router.push(`/student/course/${route.params.courseId}`);
};

const isYoutube = (url) => /youtu(\.be|be\.com)/i.test(url || '');

const youtubeEmbed = (url) => {
  if (!url) return '';
  const match = url.match(/(?:v=|\/)([\w-]{11})/);
  const videoId = match ? match[1] : '';
  return videoId ? `https://www.youtube.com/embed/${videoId}?rel=0` : url;
};

const openVideo = (url) => {
  if (url) window.open(url, '_blank', 'noopener');
};

const updateStatus = async (status, percent, key) => {
  updating.value = key;
  try {
    await api.post(`/lessons/${route.params.lessonId}/progress`, {
      status,
      progressPercent: percent,
    });
    toast.add({ severity: 'success', summary: 'Updated', detail: 'Progress saved', life: 2000 });
    await loadLesson(true);
  } catch (err) {
    const detail = err.response?.data?.error || 'Failed to update progress';
    toast.add({ severity: 'error', summary: 'Error', detail, life: 3000 });
  } finally {
    updating.value = null;
  }
};

loadLesson();

watch(
  () => [route.params.courseId, route.params.lessonId],
  () => {
    loadLesson();
  },
);

const breadcrumbHome = { label: 'Student', to: '/student' };
const breadcrumbItems = computed(() => {
  const items = [];
  const courseId = route.params.courseId;
  if (course.value) {
    items.push({ label: course.value.title, to: `/student/course/${courseId}` });
  }
  if (lesson.value) {
    items.push({ label: lesson.value.title });
  }
  return items;
});
</script>

<style scoped>
.lesson-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.breadcrumb-text {
  color: #94a3b8;
  text-transform: uppercase;
  font-size: 0.75rem;
}

.meta {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.content-block {
  margin: 1rem 0;
  line-height: 1.6;
}

.embed {
  margin-top: 1rem;
}

.assets ul {
  list-style: none;
  padding: 0;
}

.assets li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.progress-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.content-area {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.lesson-text {
  white-space: pre-wrap;
  line-height: 1.6;
}

.video-embed iframe {
  width: 100%;
  min-height: 315px;
  border: none;
  border-radius: 0.5rem;
}

.mb-2 {
  margin-bottom: 0.75rem;
}
</style>

<template>
  <div class="page">
    <PreviewBanner v-if="showPreviewBanner" />
    <Breadcrumb class="mb-2" :home="breadcrumbHome" :model="breadcrumbItems" />
    <Card v-if="loading">
      <template #content>
        <Skeleton height="2rem" class="mb-2" />
        <Skeleton height="8rem" />
      </template>
    </Card>
    <Card v-else-if="error">
      <template #content>
        <p>{{ t('course.errorLoad') }}</p>
        <Button
          :label="t('common.reload')"
          icon="pi pi-refresh"
          class="p-button-text"
          @click="reload"
        />
      </template>
    </Card>
    <Card v-else>
      <template #title>
        <div class="course-header">
          <div>
            <h2>{{ course.title }}</h2>
            <p class="description">{{ course.description }}</p>
          </div>
          <div class="progress">
            <span>{{ t('course.progressLabel') }}</span>
            <ProgressBar :value="progress?.percent ?? 0" />
            <small>{{ progressSummaryText }}</small>
            <small v-if="progress?.nextLessonTitle">
              {{ nextLessonText }}
            </small>
          </div>
        </div>
      </template>
      <template #content>
        <div class="continue-card">
          <template v-if="!isCourseCompleted">
            <p>{{ t('course.continueLabel') }}</p>
            <h4>{{ progress?.nextLessonTitle }}</h4>
            <Button
              :label="t('course.continueButton')"
              icon="pi pi-arrow-right"
              :disabled="!progress?.nextLessonId"
              @click="openLesson(progress?.nextLessonId)"
            />
          </template>
          <template v-else>
            <p>{{ t('course.courseCompleted') }}</p>
            <Tag :value="t('course.completedTag')" severity="success" />
          </template>
        </div>
        <div class="modules">
          <Panel v-for="module in course.modules" :key="module.id" :header="module.title">
            <ul class="lessons">
              <li v-for="lesson in module.lessons" :key="lesson.id">
                <div>
                  <div class="lesson-title">{{ lesson.title }}</div>
                  <small class="badge">{{ lesson.contentType }}</small>
                </div>
                <div class="lesson-actions">
                  <Button
                    :label="t('course.lessonOpen')"
                    icon="pi pi-external-link"
                    class="p-button-text"
                    @click="openLesson(lesson.id)"
                  />
                  <Button
                    :label="t('course.markDone')"
                    icon="pi pi-check"
                    class="p-button-sm"
                    :disabled="isLessonCompleted(lesson.id) || isPreview"
                    :loading="updatingLesson === lesson.id"
                    @click="markDone(lesson.id)"
                  />
                  <Tag
                    v-if="isLessonCompleted(lesson.id)"
                    :value="t('course.doneTag')"
                    severity="success"
                  />
                </div>
              </li>
            </ul>
          </Panel>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '../stores/auth';
import { useI18n } from 'vue-i18n';
import PreviewBanner from '../components/PreviewBanner.vue';
import api from '../api/axios';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const { t } = useI18n();

const course = ref(null);
const progress = ref(null);
const loading = ref(true);
const error = ref(false);
const updatingLesson = ref(null);
const completedLessons = ref(new Set());
const isPreview = computed(
  () => route.query.preview === '1' || route.query.preview === 'true',
);
const showPreviewBanner = computed(
  () => isPreview.value && auth.hasAnyRole(['admin', 'instructor', 'content_editor']),
);

const defaultProgress = {
  percent: 0,
  completedLessons: 0,
  totalLessons: 0,
  nextLessonId: null,
  nextLessonTitle: null,
};

const fetchProgress = async (id) => {
  if (isPreview.value) {
    progress.value = { ...defaultProgress };
    return;
  }
  const { data } = await api.get(`/courses/${id}/progress`);
  progress.value = data;
};

const fetchData = async (id) => {
  loading.value = true;
  error.value = false;
  try {
    const url = isPreview.value ? `/courses/${id}?preview=1` : `/courses/${id}`;
    const courseRes = await api.get(url);
    course.value = courseRes.data;
    completedLessons.value = new Set();
    await fetchProgress(id);
  } catch (err) {
    error.value = true;
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: t('course.toastLoadError'),
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const reload = () => fetchData(route.params.id);

const openLesson = (lessonId) => {
  const query = isPreview.value ? { preview: '1' } : {};
  router.push({ path: `/student/course/${route.params.id}/lesson/${lessonId}`, query });
};

const markLessonCompleted = (lessonId) => {
  const nextSet = new Set(completedLessons.value);
  nextSet.add(lessonId);
  completedLessons.value = nextSet;
};

const isLessonCompleted = (lessonId) => completedLessons.value.has(lessonId);

const markDone = async (lessonId) => {
  if (isPreview.value) {
    toast.add({
      severity: 'info',
      summary: t('course.previewToastTitle'),
      detail: t('course.previewToastMessage'),
      life: 2500,
    });
    return;
  }
  updatingLesson.value = lessonId;
  try {
    await api.post(`/lessons/${lessonId}/progress`, {
      status: 'done',
      progressPercent: 100,
    });
    toast.add({
      severity: 'success',
      summary: t('common.notifications.success'),
      detail: t('course.updatedToast'),
      life: 2000,
    });
    await fetchProgress(route.params.id);
    markLessonCompleted(lessonId);
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: t('course.updateError'),
      life: 3000,
    });
  } finally {
    updatingLesson.value = null;
  }
};

onMounted(() => {
  fetchData(route.params.id);
});

watch(
  [() => route.params.id, () => route.query.preview],
  ([newId]) => {
    if (newId) {
      fetchData(newId);
    }
  },
);

const isCourseCompleted = computed(
  () => !!(progress.value && !progress.value.nextLessonId),
);

const previewQuery = computed(() => {
  if (!isPreview.value) {
    return null;
  }
  const previewValue = route.query.preview === 'true' ? 'true' : '1';
  return { preview: previewValue };
});

const breadcrumbHome = computed(() => ({
  label: t('course.breadcrumbHome'),
  command: (event) => {
    event?.originalEvent?.preventDefault();
    const query = previewQuery.value;
    const destination = query ? { path: '/student', query } : { path: '/student' };
    router.push(destination);
  },
}));

const breadcrumbItems = computed(() => [
  {
    label: course.value?.title || t('course.breadcrumbFallback'),
  },
]);

const progressSummaryText = computed(() =>
  t('course.progressSummary', {
    done: progress.value?.completedLessons ?? 0,
    total: progress.value?.totalLessons ?? 0,
  }),
);

const nextLessonText = computed(() =>
  t('course.nextLesson', { title: progress.value?.nextLessonTitle || '' }),
);
</script>

<style scoped>

.course-header {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
}

.description {
  color: #6b7280;
}

.progress {
  min-width: 250px;
}

.modules {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.continue-card {
  background: #f8fafc;
  padding: 1rem;
  border-radius: 0.75rem;
  margin-bottom: 1rem;
}

.lessons {
  list-style: none;
  padding: 0;
  margin: 0;
}

.lessons li {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.lesson-actions {
  display: flex;
  gap: 0.5rem;
}

.lesson-title {
  font-weight: 500;
}

.badge {
  text-transform: capitalize;
  font-size: 0.85rem;
  color: #64748b;
}

.mb-2 {
  margin-bottom: 0.75rem;
}
</style>

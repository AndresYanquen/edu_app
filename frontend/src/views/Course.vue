<template>
  <div class="page">
    <Breadcrumb class="mb-2" :home="breadcrumbHome" :model="breadcrumbItems" />
    <Card v-if="loading">
      <template #content>
        <Skeleton height="2rem" class="mb-2" />
        <Skeleton height="8rem" />
      </template>
    </Card>
    <Card v-else-if="error">
      <template #content>
        <p>Could not load course.</p>
        <Button label="Reload" icon="pi pi-refresh" class="p-button-text" @click="reload" />
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
            <span>Progress</span>
            <ProgressBar :value="progress?.percent ?? 0" />
            <small>Completed {{ progress?.completedLessons ?? 0 }} / {{ progress?.totalLessons ?? 0 }}</small>
            <small v-if="progress?.nextLessonTitle">Next: {{ progress.nextLessonTitle }}</small>
          </div>
        </div>
      </template>
      <template #content>
        <div class="continue-card">
          <template v-if="!isCourseCompleted">
            <p>Continue with</p>
            <h4>{{ progress.nextLessonTitle }}</h4>
            <Button
              label="Continue"
              icon="pi pi-arrow-right"
              :disabled="!progress?.nextLessonId"
              @click="openLesson(progress.nextLessonId)"
            />
          </template>
          <template v-else>
            <p>Course completed</p>
            <Tag value="Completed" severity="success" />
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
                  <Button label="Open" icon="pi pi-external-link" class="p-button-text" @click="openLesson(lesson.id)" />
                  <Button
                    label="Mark done"
                    icon="pi pi-check"
                    class="p-button-sm"
                    :disabled="isLessonCompleted(lesson.id)"
                    :loading="updatingLesson === lesson.id"
                    @click="markDone(lesson.id)"
                  />
                  <Tag v-if="isLessonCompleted(lesson.id)" value="Done" severity="success" />
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
import api from '../api/axios';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const course = ref(null);
const progress = ref(null);
const loading = ref(true);
const error = ref(false);
const updatingLesson = ref(null);
const completedLessons = ref(new Set());

const fetchProgress = async (id) => {
  const { data } = await api.get(`/courses/${id}/progress`);
  progress.value = data;
};

const fetchData = async (id) => {
  loading.value = true;
  error.value = false;
  try {
    const courseRes = await api.get(`/courses/${id}`);
    course.value = courseRes.data;
    completedLessons.value = new Set();
    await fetchProgress(id);
  } catch (err) {
    error.value = true;
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load course', life: 3000 });
  } finally {
    loading.value = false;
  }
};

const reload = () => fetchData(route.params.id);

const openLesson = (lessonId) => {
  router.push(`/student/course/${route.params.id}/lesson/${lessonId}`);
};

const markLessonCompleted = (lessonId) => {
  const nextSet = new Set(completedLessons.value);
  nextSet.add(lessonId);
  completedLessons.value = nextSet;
};

const isLessonCompleted = (lessonId) => completedLessons.value.has(lessonId);

const markDone = async (lessonId) => {
  updatingLesson.value = lessonId;
  try {
    await api.post(`/lessons/${lessonId}/progress`, {
      status: 'done',
      progressPercent: 100,
    });
    toast.add({ severity: 'success', summary: 'Updated', detail: 'Lesson marked as done', life: 2000 });
    await fetchProgress(route.params.id);
    markLessonCompleted(lessonId);
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to update progress', life: 3000 });
  } finally {
    updatingLesson.value = null;
  }
};

onMounted(() => {
  fetchData(route.params.id);
});

watch(
  () => route.params.id,
  (newId) => newId && fetchData(newId),
);

const isCourseCompleted = computed(() => progress.value && !progress.value.nextLessonId);

const breadcrumbHome = { label: 'Student', to: '/student' };
const breadcrumbItems = computed(() => [
  {
    label: course.value?.title || 'Course',
  },
]);
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

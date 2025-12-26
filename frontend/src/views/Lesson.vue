<template>
  <div class="page">
    <PreviewBanner v-if="showPreviewBanner" />
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
                <Button
                  label="Open video"
                  icon="pi pi-external-link"
                  @click="openVideo(lesson.videoUrl)"
                />
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

    <!-- Quiz section -->
    <Card v-if="showQuizSection" class="quiz-card">
      <template #title>
        <div class="quiz-header">
          <span>Lesson Quiz</span>
          <Tag v-if="quizPassed" value="Passed" severity="success" />
        </div>
      </template>

      <template #content>
        <div v-if="quizLoading">
          <Skeleton height="3rem" class="mb-2" />
          <Skeleton height="3rem" class="mb-2" />
        </div>

        <div v-else-if="quizError">
          <p>Unable to load quiz.</p>
          <Button label="Reload" icon="pi pi-refresh" class="p-button-text" @click="loadQuiz" />
        </div>

        <div v-else-if="quiz && quiz.questions?.length">
          <div v-for="(question, index) in quiz.questions" :key="question.id" class="quiz-question">
            <h4>Question {{ index + 1 }}</h4>
            <p>{{ question.questionText }}</p>

            <div class="quiz-options">
              <div v-for="option in question.options" :key="option.id" class="quiz-option">
                <RadioButton
                  :inputId="`option-${option.id}`"
                  :value="option.id"
                  :modelValue="quizSelections[question.id] || null"
                  @update:modelValue="(value) => updateSelection(question.id, value)"
                  :disabled="quizPassed || quizSubmitting"
                />
                <label :for="`option-${option.id}`">{{ option.optionText }}</label>
              </div>
            </div>
          </div>

          <div class="quiz-actions">
            <Button
              label="Submit quiz"
              icon="pi pi-send"
              :loading="quizSubmitting"
              :disabled="quizPassed || !canSubmitQuiz || quizSubmitting"
              @click="submitQuiz"
            />
          </div>
        </div>

        <div v-else class="empty-state">
          No quiz available for this lesson.
        </div>
      </template>
    </Card>

    <!-- Quiz results -->
    <Card v-if="loadingQuizScore" class="quiz-results-card">
      <template #content>
        <Skeleton height="3rem" class="mb-2" />
        <Skeleton height="2rem" />
      </template>
    </Card>

    <Card v-else-if="showQuizResults" class="quiz-results-card">
      <template #title>Quiz results</template>
      <template #content>
        <div class="quiz-results-grid">
          <div>
            <small>Last attempt</small>
            <strong>{{ quizScore?.lastScore }}%</strong>
          </div>
          <div>
            <small>Best score</small>
            <strong>{{ bestShown }}%</strong>
          </div>
          <div class="quiz-result-tag">
            <Tag :value="bestShown >= 70 ? 'Passed' : 'Not passed'" :severity="bestShown >= 70 ? 'success' : 'warning'" />
          </div>
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
import PreviewBanner from '../components/PreviewBanner.vue';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const auth = useAuthStore();

const course = ref(null);
const moduleInfo = ref(null);
const lesson = ref(null);
const assets = ref([]);

const loading = ref(true);
const error = ref(false);
const errorMessage = ref('Failed to load lesson.');
const updating = ref(null);

// Quiz state
const quiz = ref(null);
const quizSelections = ref({});
const quizLoading = ref(false);
const quizSubmitting = ref(false);
const quizError = ref(false);
const quizExists = ref(false);
const quizPassed = ref(false);

// Quiz score card state
const quizScore = ref(null);
const loadingQuizScore = ref(false);

const courseId = computed(() => route.params.courseId);
const lessonId = computed(() => route.params.lessonId);
const isPreview = computed(() => route.query.preview === '1' || route.query.preview === 'true');
const showPreviewBanner = computed(
  () => isPreview.value && ['admin', 'instructor'].includes(auth.role),
);

const breadcrumbHome = computed(() => ({
  icon: 'pi pi-home',
  to: '/student',
}));

const breadcrumbItems = computed(() => {
  const items = [{ label: 'Student', to: '/student' }];
  if (courseId.value) items.push({ label: 'Course', to: `/student/course/${courseId.value}` });
  if (lesson.value?.title) items.push({ label: lesson.value.title });
  return items;
});

// FIX 1: safe locateLesson
const locateLesson = (courseData, targetLessonId) => {
  for (const mod of courseData.modules || []) {
    const lessons = mod.lessons || [];
    const found = lessons.find((l) => l.id === targetLessonId);
    if (found) return { module: mod, lesson: found };
  }
  return null;
};

const normalizeLesson = (rawLesson) => ({
  id: rawLesson.id,
  title: rawLesson.title,
  contentType: rawLesson.contentType ?? rawLesson.content_type ?? null,
  contentText: rawLesson.contentText ?? rawLesson.content_text ?? null,
  contentUrl: rawLesson.contentUrl ?? rawLesson.content_url ?? null,
  videoUrl: rawLesson.videoUrl ?? rawLesson.video_url ?? null,
  estimatedMinutes: rawLesson.estimatedMinutes ?? rawLesson.estimated_minutes ?? null,
  durationSeconds: rawLesson.durationSeconds ?? rawLesson.duration_seconds ?? null,
  // support both names
  assets: rawLesson.assets ?? rawLesson.lesson_assets ?? [],
});

const loadLesson = async () => {
  loading.value = true;
  error.value = false;

  try {
    const courseUrl = isPreview.value
      ? `/courses/${courseId.value}?preview=1`
      : `/courses/${courseId.value}`;
    const { data } = await api.get(courseUrl);
    course.value = data;

    const found = locateLesson(data, lessonId.value);
    if (!found) {
      error.value = true;
      errorMessage.value = 'Lesson not found.';
      lesson.value = null;
      moduleInfo.value = null;
      assets.value = [];
      return;
    }

    moduleInfo.value = found.module;
    lesson.value = normalizeLesson(found.lesson);
    assets.value = lesson.value.assets || [];

    // Load quiz score (sets quizPassed as well)
    await fetchQuizScore();
    // Load quiz content (if exists)
    await loadQuiz();
  } catch (err) {
    error.value = true;
    errorMessage.value = 'Failed to load lesson.';
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load lesson', life: 3000 });
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push(`/student/course/${courseId.value}`);
};

const updateStatus = async (status, progressPercent, key) => {
  if (isPreview.value) {
    toast.add({ severity: 'info', summary: 'Preview mode', detail: 'Progress not available in preview', life: 2500 });
    return;
  }
  updating.value = key;
  try {
    await api.post(`/lessons/${lessonId.value}/progress`, { status, progressPercent });
    toast.add({ severity: 'success', summary: 'Updated', detail: 'Progress saved', life: 2000 });
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to update progress', life: 3000 });
  } finally {
    updating.value = null;
  }
};

// Helpers
const formatDuration = (seconds) => {
  const s = Number(seconds || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
};

const isYoutube = (url) => {
  try {
    const u = new URL(url);
    return u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be');
  } catch {
    return false;
  }
};

const youtubeEmbed = (url) => {
  try {
    const u = new URL(url);
    let id = '';
    if (u.hostname.includes('youtu.be')) {
      id = u.pathname.replace('/', '');
    } else {
      id = u.searchParams.get('v') || '';
    }
    return id ? `https://www.youtube.com/embed/${id}` : url;
  } catch {
    return url;
  }
};

const openVideo = (url) => {
  window.open(url, '_blank', 'noopener');
};

// Quiz score fetch (FIX 2: derive quizPassed from best/last)
const fetchQuizScore = async () => {
  if (!lessonId.value) return;
  if (isPreview.value) {
    quizScore.value = null;
    quizPassed.value = false;
    return;
  }

  loadingQuizScore.value = true;
  try {
    const { data } = await api.get(`/lessons/${lessonId.value}/quiz/score`);

    if (data?.lastScore === null || data?.lastScore === undefined) {
      quizScore.value = null;
      quizPassed.value = false;
      return;
    }

    quizScore.value = { lastScore: data.lastScore, bestScore: data.bestScore ?? null };
    const best = (data.bestScore ?? data.lastScore);
    quizPassed.value = best >= 70;
  } catch {
    // Silent: endpoint might not exist yet, or no attempts
    quizScore.value = null;
    quizPassed.value = false;
  } finally {
    loadingQuizScore.value = false;
  }
};

const bestShown = computed(() => {
  if (!quizScore.value) return 0;
  return quizScore.value.bestScore ?? quizScore.value.lastScore ?? 0;
});

const showQuizResults = computed(() => Boolean(quizScore.value && quizScore.value.lastScore !== null));

// Quiz load
const loadQuiz = async () => {
  if (!lessonId.value) return;

  quizLoading.value = true;
  quizError.value = false;
  quizExists.value = false;

  try {
    const endpoint = isPreview.value
      ? `/cms/lessons/${lessonId.value}/quiz`
      : `/lessons/${lessonId.value}/quiz`;
    const { data } = await api.get(endpoint);
    quiz.value = data;
    quizExists.value = Boolean(data?.questions?.length);
    // Do NOT reset quizPassed here (it comes from fetchQuizScore)
    quizSelections.value = {};
  } catch (err) {
    // If no quiz, just hide the section (do not show error)
    quiz.value = null;
    quizExists.value = false;

    // If you want to show errors for real failures (non-404), you can do:
    // if (err?.response?.status && err.response.status !== 404) quizError.value = true;
  } finally {
    quizLoading.value = false;
  }
};

const showQuizSection = computed(() => quizLoading.value || quizError.value || quizExists.value);

const updateSelection = (questionId, optionId) => {
  quizSelections.value = { ...quizSelections.value, [questionId]: optionId };
};

const canSubmitQuiz = computed(() => {
  const questions = quiz.value?.questions || [];
  if (!questions.length) return false;
  return questions.every((q) => Boolean(quizSelections.value[q.id]));
});

const submitQuiz = async () => {
  if (!quiz.value?.questions?.length) return;

  quizSubmitting.value = true;
  try {
    const answers = quiz.value.questions.map((q) => ({
      questionId: q.id,
      optionId: quizSelections.value[q.id],
    }));

    const { data } = await api.post(`/lessons/${lessonId.value}/quiz/attempt`, { answers });

    toast.add({
      severity: data.passed ? 'success' : 'warn',
      summary: 'Quiz submitted',
      detail: `Score: ${data.scorePercent}%`,
      life: 3000,
    });

    // Refresh score card and pass state
    await fetchQuizScore();

    // If passed, lock UI
    if (data.passed) {
      quizPassed.value = true;
      // Optional: also mark lesson done UI-side (backend already does it when passed)
      // await updateStatus('done', 100, 'done');
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to submit quiz', life: 3000 });
  } finally {
    quizSubmitting.value = false;
  }
};

onMounted(() => {
  loadLesson();
});

watch(
  () => [courseId.value, lessonId.value],
  ([newCourseId, newLessonId], [oldCourseId, oldLessonId]) => {
    if (!newCourseId || !newLessonId) return;
    if (newCourseId !== oldCourseId || newLessonId !== oldLessonId) loadLesson();
  },
);
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lesson-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.breadcrumb-text {
  color: #6b7280;
}

.meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.content-area {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lesson-card {
  margin-bottom: 0.5rem;
}

.lesson-text {
  white-space: pre-wrap;
  line-height: 1.6;
}

.video-embed iframe {
  width: 100%;
  height: 360px;
  border: 0;
  border-radius: 10px;
}

.assets ul {
  list-style: none;
  padding: 0;
  margin: 0;
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

.quiz-card {
  margin-top: 0.5rem;
}

.quiz-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quiz-question {
  padding: 0.75rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.quiz-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.quiz-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.quiz-actions {
  margin-top: 1rem;
}

.quiz-results-card {
  margin-top: 0.5rem;
}

.quiz-results-grid {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 1rem;
  align-items: center;
}

.quiz-results-grid small {
  display: block;
  color: #6b7280;
}

.quiz-result-tag {
  display: flex;
  justify-content: flex-end;
}

.empty-state {
  color: #6b7280;
  padding: 0.75rem 0;
}
</style>

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
        <Button
          :label="t('lesson.actions.reload')"
          icon="pi pi-refresh"
          class="p-button-text"
          @click="loadLesson"
        />
        <Button
          :label="t('lesson.actions.back')"
          icon="pi pi-arrow-left"
          class="p-button-text"
          @click="goBack"
        />
      </template>
    </Card>

    <Card v-else class="lesson-shell">
      <template #title>
        <div class="lesson-header">
          <div class="lesson-header-main">
            <small class="breadcrumb-text"
              >{{ course?.title }} / {{ moduleInfo?.title }}</small
            >
            <h2>{{ lesson?.title }}</h2>
          </div>

          <div class="actions">
            <Button
              :label="t('lesson.actions.back')"
              icon="pi pi-arrow-left"
              class="p-button-text"
              @click="goBack"
            />
          </div>
        </div>
      </template>

      <template #content>
        <div class="meta">
          <Tag
            :value="
              lesson?.contentType || t('lesson.labels.defaultContentType')
            "
            severity="info"
          />
          <Tag
            v-if="lesson?.estimatedMinutes"
            :value="`${lesson.estimatedMinutes} min`"
            severity="secondary"
          />
          <span v-if="lesson?.durationSeconds">{{
            formatDuration(lesson.durationSeconds)
          }}</span>
        </div>

        <Divider />

        <div v-if="lesson?.coverImage" class="lesson-cover-hero">
          <img :src="lesson.coverImage" :alt="lesson.title" />
        </div>

        <div class="content-area">
          <Card
            v-if="hasRichContent || lesson?.contentUrl"
            class="lesson-card lesson-book-card"
          >
            <template #title>
              <div class="lesson-book-title">
                <span>{{ t("lesson.sections.text") }}</span>
              </div>
            </template>

            <template #content>
              <div
                v-if="hasRichContent"
                ref="presentationContainer"
                :class="[
                  'book-viewer',
                  { 'presentation-mode': presentationMode },
                ]"
              >
                <div class="book-toolbar">
                  <div class="book-toolbar-top">
                    <div class="book-presentation-meta">
                      <span class="book-mode-badge">
                        {{
                          presentationMode
                            ? "Modo presentación"
                            : "Modo lectura"
                        }}
                      </span>
                      <h3 class="book-lesson-heading">{{ lesson?.title }}</h3>
                    </div>

                    <div class="book-toolbar-actions">
                      <Button
                        v-if="!presentationMode"
                        label="Presentar"
                        icon="pi pi-window-maximize"
                        class="p-button-sm"
                        @click="openPresentation"
                      />
                      <Button
                        v-else
                        icon="pi pi-times"
                        class="book-close-btn"
                        @click="closePresentation"
                      />
                    </div>
                  </div>

                  <div class="book-progress-shell">
                    <div class="book-progress-topline">
                      <span class="book-page-counter">
                        Página {{ currentPage + 1 }} de
                        {{ richContentPages.length }}
                      </span>
                      <span class="book-page-percent"
                        >{{ pageProgressPercent }}%</span
                      >
                    </div>

                    <div class="book-progress-track">
                      <div
                        class="book-progress-fill"
                        :style="{ width: `${pageProgressPercent}%` }"
                      ></div>
                    </div>
                  </div>
                </div>

                <div
                  class="book-stage"
                  @touchstart.passive="onTouchStart"
                  @touchmove.passive="onTouchMove"
                  @touchend.passive="onTouchEnd"
                >
                  <Transition :name="transitionName" mode="out-in">
                    <div class="book-page" :key="currentPage">
                      <RichContent
                        :content="currentPageContent"
                        :quiz-questions="inlineQuizQuestions"
                        :answers-by-question-id="myAnswersByQuestionId"
                        @inline-quiz-attempted="handleInlineQuizAttempted"
                      />
                    </div>
                  </Transition>
                </div>

                <div v-if="hasMultiplePages" class="book-navigation">
                  <Button
                    icon="pi pi-arrow-left"
                    class="book-nav-btn book-nav-prev"
                    :disabled="currentPage === 0"
                    @click="prevPage"
                  />

                  <div class="book-dots">
                    <button
                      v-for="(_, index) in richContentPages"
                      :key="index"
                      type="button"
                      class="book-dot"
                      :class="{ active: currentPage === index }"
                      @click="goToPage(index)"
                    ></button>
                  </div>

                  <Button
                    icon="pi pi-arrow-right"
                    class="book-nav-btn book-nav-next"
                    :disabled="currentPage >= richContentPages.length - 1"
                    @click="nextPage"
                  />
                </div>
              </div>

              <p v-else class="lesson-text muted">
                {{ t("lesson.labels.noContent") }}
              </p>

              <a
                v-if="lesson?.contentUrl"
                :href="lesson.contentUrl"
                target="_blank"
                rel="noopener"
                class="reference-link"
              >
                {{ t("lesson.labels.referenceLink") }}
              </a>
            </template>
          </Card>

          <Card v-if="lesson?.videoUrl" class="lesson-card">
            <template #title>{{ t("lesson.sections.video") }}</template>
            <template #content>
              <RichContent :content="lesson.videoUrl" />
            </template>
          </Card>

          <div
            v-if="!hasRichContent && !lesson?.contentUrl && !lesson?.videoUrl"
            class="empty-state"
          >
            {{ t("lesson.labels.noContent") }}
          </div>
        </div>

        <div v-if="assets.length" class="assets">
          <h4>{{ t("lesson.sections.assets") }}</h4>
          <ul>
            <li v-for="asset in assets" :key="asset.id">
              <i class="pi pi-paperclip"></i>
              <span>{{ asset.path }} ({{ asset.mimeType }})</span>
            </li>
          </ul>
        </div>

        <Divider />

        <div v-if="!isPreview" class="lesson-streak-summary">
          <img :src="fireIcon" alt="Racha diaria" />
          <div>
            <small>Racha diaria</small>
            <strong>{{ gamificationSummary?.streak?.currentDayStreak ?? 0 }}</strong>
          </div>
        </div>

        <div class="progress-actions">
          <Button
            :label="t('lesson.actions.markInProgress')"
            icon="pi pi-play"
            class="p-button-outlined"
            :loading="updating === 'progress'"
            @click="updateStatus('in_progress', 35, 'progress')"
          />
          <Button
            :label="t('lesson.actions.markDone')"
            icon="pi pi-check"
            :loading="updating === 'done'"
            @click="updateStatus('done', 100, 'done')"
          />
        </div>
      </template>
    </Card>

    <Card v-if="loadingQuizScore" class="quiz-results-card">
      <template #content>
        <Skeleton height="3rem" class="mb-2" />
        <Skeleton height="2rem" />
      </template>
    </Card>

    <Card v-else-if="showQuizResults" class="quiz-results-card">
      <template #title>{{ t("lesson.sections.quizResults") }}</template>
      <template #content>
        <div class="quiz-results-grid">
          <div>
            <small>{{ t("lesson.labels.lastAttempt") }}</small>
            <strong>{{ quizScore?.lastScore }}%</strong>
          </div>
          <div>
            <small>{{ t("lesson.labels.bestScore") }}</small>
            <strong>{{ bestShown }}%</strong>
          </div>
          <div class="quiz-result-tag">
            <Tag
              :value="
                bestShown >= 70
                  ? t('lesson.labels.passed')
                  : t('lesson.labels.notPassed')
              "
              :severity="bestShown >= 70 ? 'success' : 'warning'"
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import {
  computed,
  createApp,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "primevue/usetoast";
import { useI18n } from "vue-i18n";
import api from "../api/axios";
import PreviewBanner from "../components/PreviewBanner.vue";
import RichContent from "../components/RichContent.vue";
import { useAuthStore } from "../stores/auth";
import { extractInlineQuestionIds } from "../utils/richContent";
import fireIcon from "../assets/fuego.png";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { t } = useI18n();
const auth = useAuthStore();

const course = ref(null);
const moduleInfo = ref(null);
const lesson = ref(null);
const assets = ref([]);

const loading = ref(true);
const error = ref(false);
const errorMessage = ref(t("lesson.errors.load"));
const updating = ref(null);

// Quiz state
const quiz = ref(null);
const quizSelections = ref({});
const myAnswersByQuestionId = ref({});
const quizLoading = ref(false);
const quizSubmitting = ref(false);
const quizError = ref(false);
const quizExists = ref(false);
const quizPassed = ref(false);
let inlineQuizScoreRefreshTimer = null;
const gamificationSummary = ref(null);

// Quiz score state
const quizScore = ref(null);
const loadingQuizScore = ref(false);

const courseId = computed(() => route.params.courseId);
const lessonId = computed(() => route.params.lessonId);
const isPreview = computed(
  () => route.query.preview === "1" || route.query.preview === "true",
);

const showPreviewBanner = computed(
  () =>
    isPreview.value &&
    auth.hasAnyRole(["admin", "instructor", "content_editor"]),
);

const richContentSource = computed(() => {
  const source =
    lesson.value?.contentHtml ||
    lesson.value?.contentMarkdown ||
    lesson.value?.contentText ||
    "";
  return source ? source.trim() : "";
});

const hasRichContent = computed(() => richContentSource.value.length > 0);

const presentationMode = ref(false);
const isFullscreenActive = ref(false);
const currentPage = ref(0);
const presentationContainer = ref(null);

const navDirection = ref("next");
const touchStartX = ref(0);
const touchCurrentX = ref(0);

const transitionName = computed(() =>
  navDirection.value === "prev" ? "page-slide-prev" : "page-slide-next",
);

const richContentPages = computed(() => {
  if (!richContentSource.value) return [];

  const parts = richContentSource.value
    .split(/<div\s+class=["']page-break["']\s*><\/div>/gi)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length ? parts : [richContentSource.value];
});

const hasMultiplePages = computed(() => richContentPages.value.length > 1);

const currentPageContent = computed(() => {
  if (!richContentPages.value.length) return "";
  return richContentPages.value[currentPage.value] || "";
});

const pageProgressPercent = computed(() => {
  if (!richContentPages.value.length) return 0;
  return Math.round(
    ((currentPage.value + 1) / richContentPages.value.length) * 100,
  );
});

const prevPage = () => {
  if (currentPage.value > 0) {
    navDirection.value = "prev";
    currentPage.value -= 1;
  }
};

const nextPage = () => {
  if (currentPage.value < richContentPages.value.length - 1) {
    navDirection.value = "next";
    currentPage.value += 1;
  }
};

const goToPage = (index) => {
  if (index < 0 || index >= richContentPages.value.length) return;
  if (index === currentPage.value) return;

  navDirection.value = index > currentPage.value ? "next" : "prev";
  currentPage.value = index;
};

const syncFullscreenState = () => {
  const active = Boolean(document.fullscreenElement);
  isFullscreenActive.value = active;

  if (!active && presentationMode.value) {
    presentationMode.value = false;
  }
};

const handleFullscreenChange = () => {
  syncFullscreenState();
};

const openPresentation = async () => {
  presentationMode.value = true;
  await nextTick();

  const el = presentationContainer.value;
  if (el?.requestFullscreen) {
    try {
      await el.requestFullscreen();
      isFullscreenActive.value = true;
    } catch (e) {
      isFullscreenActive.value = false;
    }
  }
};

const closePresentation = async () => {
  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch (e) {
      // noop
    }
  }

  isFullscreenActive.value = false;
  presentationMode.value = false;
};

const handleKeyNavigation = (event) => {
  if (!hasMultiplePages.value) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    prevPage();
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    nextPage();
    return;
  }

  if (event.key === "Escape" && presentationMode.value) {
    event.preventDefault();
    closePresentation();
  }
};

const onTouchStart = (event) => {
  if (!hasMultiplePages.value) return;
  touchStartX.value = event.changedTouches?.[0]?.clientX || 0;
  touchCurrentX.value = touchStartX.value;
};

const onTouchMove = (event) => {
  if (!hasMultiplePages.value) return;
  touchCurrentX.value = event.changedTouches?.[0]?.clientX || touchStartX.value;
};

const onTouchEnd = () => {
  if (!hasMultiplePages.value) return;

  const deltaX = touchCurrentX.value - touchStartX.value;
  const threshold = 60;

  if (Math.abs(deltaX) < threshold) return;

  if (deltaX > 0) {
    prevPage();
  } else {
    nextPage();
  }

  touchStartX.value = 0;
  touchCurrentX.value = 0;
};

const inlineQuestionIds = computed(() =>
  extractInlineQuestionIds(richContentSource.value),
);

const finalQuestions = computed(() =>
  (quiz.value?.questions || []).filter(
    (q) => !inlineQuestionIds.value.has(String(q.id)),
  ),
);

const inlineQuizQuestions = computed(() =>
  (quiz.value?.questions || []).map((question) => ({
    ...question,
    id: question.id || question.questionId || question.question_id || null,
    options: question.options || [],
  })),
);

const breadcrumbHome = computed(() => ({
  icon: "pi pi-home",
  to: "/student",
  label: t("lesson.breadcrumbs.home"),
}));

const breadcrumbItems = computed(() => {
  const items = [{ label: t("lesson.breadcrumbs.home"), to: "/student" }];
  if (courseId.value) {
    items.push({
      label: t("lesson.breadcrumbs.course"),
      to: `/student/course/${courseId.value}`,
    });
  }
  if (lesson.value?.title) items.push({ label: lesson.value.title });
  return items;
});

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
  coverImage:
    rawLesson.coverImage ??
    rawLesson.cover_image_url ??
    rawLesson.image_url ??
    null,
  contentType: rawLesson.contentType ?? rawLesson.content_type ?? null,
  contentMarkdown:
    rawLesson.contentMarkdown ?? rawLesson.content_markdown ?? null,
  contentHtml: rawLesson.contentHtml ?? rawLesson.content_html ?? null,
  contentText: rawLesson.contentText ?? rawLesson.content_text ?? null,
  contentUrl: rawLesson.contentUrl ?? rawLesson.content_url ?? null,
  videoUrl: rawLesson.videoUrl ?? rawLesson.video_url ?? null,
  estimatedMinutes:
    rawLesson.estimatedMinutes ?? rawLesson.estimated_minutes ?? null,
  durationSeconds:
    rawLesson.durationSeconds ?? rawLesson.duration_seconds ?? null,
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
      errorMessage.value = t("lesson.errors.notFound");
      lesson.value = null;
      moduleInfo.value = null;
      assets.value = [];
      return;
    }

    moduleInfo.value = found.module;
    lesson.value = normalizeLesson(found.lesson);
    assets.value = lesson.value.assets || [];
    currentPage.value = 0;
    presentationMode.value = false;

    await fetchQuizScore();
    await loadQuiz();
  } catch (err) {
    error.value = true;
    errorMessage.value = t("lesson.errors.load");
    toast.add({
      severity: "error",
      summary: t("common.notifications.error"),
      detail: t("lesson.errors.load"),
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push(`/student/course/${courseId.value}`);
};

const updateStatus = async (status, progressPercent, key) => {
  if (isPreview.value) {
    toast.add({
      severity: "info",
      summary: t("course.previewToastTitle"),
      detail: t("course.previewToastMessage"),
      life: 2500,
    });
    return;
  }

  updating.value = key;
  try {
    await api.post(`/lessons/${lessonId.value}/progress`, {
      status,
      progressPercent,
    });
    if (status === "done") {
      await loadGamificationSummary();
    }
    const detail =
      status === "done"
        ? t("lesson.toasts.done")
        : t("lesson.toasts.inProgress");

    toast.add({
      severity: "success",
      summary: t("common.notifications.success"),
      detail,
      life: 2000,
    });
  } catch (err) {
    toast.add({
      severity: "error",
      summary: t("common.notifications.error"),
      detail: t("lesson.errors.update"),
      life: 3000,
    });
  } finally {
    updating.value = null;
  }
};

const loadGamificationSummary = async () => {
  if (isPreview.value) return;
  try {
    const { data } = await api.get("/gamification/me");
    gamificationSummary.value = data || null;
  } catch {
    // Informational only; skip UI noise if this request fails.
  }
};

const formatDuration = (seconds) => {
  const s = Number(seconds || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
};

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

    quizScore.value = {
      lastScore: data.lastScore,
      bestScore: data.bestScore ?? null,
    };

    const best = data.bestScore ?? data.lastScore;
    quizPassed.value = best >= 70;
  } catch {
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

const showQuizResults = computed(() =>
  Boolean(quizScore.value && quizScore.value.lastScore !== null),
);

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

    myAnswersByQuestionId.value =
      data?.myAnswersByQuestionId &&
      typeof data.myAnswersByQuestionId === "object"
        ? data.myAnswersByQuestionId
        : {};

    const inlineIds = extractInlineQuestionIds(richContentSource.value);
    const initialSelections = {};

    for (const question of data?.questions || []) {
      if (inlineIds.has(String(question.id))) continue;

      const preloaded = myAnswersByQuestionId.value[String(question.id)];
      if (!preloaded) continue;

      if (question.questionType === "multiple_choice") {
        const ids = Array.isArray(preloaded.optionIds)
          ? preloaded.optionIds.filter(Boolean)
          : [];

        if (ids.length) initialSelections[question.id] = ids;
        continue;
      }

      const optionId =
        preloaded.optionId ||
        (Array.isArray(preloaded.optionIds) ? preloaded.optionIds[0] : null);

      if (optionId) initialSelections[question.id] = optionId;
    }

    quizSelections.value = initialSelections;
  } catch (err) {
    quiz.value = null;
    quizExists.value = false;
    myAnswersByQuestionId.value = {};
    quizSelections.value = {};
  } finally {
    quizLoading.value = false;
  }
};

const showQuizSection = computed(
  () => quizLoading.value || quizError.value || quizExists.value,
);

const isOptionSelected = (questionId, optionId) => {
  const selected = quizSelections.value[questionId];
  return Array.isArray(selected) ? selected.includes(optionId) : false;
};

const updateSelection = (question, value, checked = undefined) => {
  const questionId = question.id;

  if (question.questionType === "multiple_choice") {
    const current = Array.isArray(quizSelections.value[questionId])
      ? [...quizSelections.value[questionId]]
      : [];

    const next = checked
      ? Array.from(new Set([...current, value]))
      : current.filter((optionId) => optionId !== value);

    quizSelections.value = { ...quizSelections.value, [questionId]: next };
    return;
  }

  quizSelections.value = { ...quizSelections.value, [questionId]: value };
};

const canSubmitQuiz = computed(() => {
  const questions = finalQuestions.value;
  if (!questions.length) return false;

  return questions.every((q) => {
    const selected = quizSelections.value[q.id];
    if (q.questionType === "multiple_choice") {
      return Array.isArray(selected) && selected.length > 0;
    }
    return Boolean(selected);
  });
});

const submitQuiz = async () => {
  if (!finalQuestions.value.length) return;

  quizSubmitting.value = true;
  try {
    const answers = finalQuestions.value.map((q) => {
      const selected = quizSelections.value[q.id];

      if (q.questionType === "multiple_choice") {
        return {
          questionId: q.id,
          optionIds: Array.isArray(selected) ? selected : [],
        };
      }

      return {
        questionId: q.id,
        optionId: selected,
      };
    });

    const { data } = await api.post(`/lessons/${lessonId.value}/quiz/attempt`, {
      answers,
    });

    toast.add({
      severity: data.passed ? "success" : "warn",
      summary: t("lesson.toasts.quizSubmitted"),
      detail: t("lesson.labels.score", { score: data.scorePercent }),
      life: 3000,
    });

    await fetchQuizScore();

    if (data.passed) {
      quizPassed.value = true;
    }
  } catch (err) {
    toast.add({
      severity: "error",
      summary: t("common.notifications.error"),
      detail: t("lesson.errors.quizSubmit"),
      life: 3000,
    });
  } finally {
    quizSubmitting.value = false;
  }
};

const handleInlineQuizAttempted = () => {
  if (inlineQuizScoreRefreshTimer) {
    clearTimeout(inlineQuizScoreRefreshTimer);
  }

  inlineQuizScoreRefreshTimer = setTimeout(async () => {
    await fetchQuizScore();
  }, 250);
};

onMounted(() => {
  loadLesson();
  loadGamificationSummary();
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  window.addEventListener("keydown", handleKeyNavigation);
});

onBeforeUnmount(() => {
  if (inlineQuizScoreRefreshTimer) {
    clearTimeout(inlineQuizScoreRefreshTimer);
    inlineQuizScoreRefreshTimer = null;
  }

  document.removeEventListener("fullscreenchange", handleFullscreenChange);
  window.removeEventListener("keydown", handleKeyNavigation);
});
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

.page-slide-next-enter-active,
.page-slide-next-leave-active,
.page-slide-prev-enter-active,
.page-slide-prev-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.page-slide-next-enter-from {
  opacity: 0;
  transform: translateX(46px) scale(0.985);
}

.page-slide-next-leave-to {
  opacity: 0;
  transform: translateX(-46px) scale(0.985);
}

.page-slide-prev-enter-from {
  opacity: 0;
  transform: translateX(-46px) scale(0.985);
}

.page-slide-prev-leave-to {
  opacity: 0;
  transform: translateX(46px) scale(0.985);
}

.page-slide-leave-to {
  opacity: 0;
  transform: translateX(-28px) scale(0.985);
}

.lesson-shell {
  overflow: hidden;
}

.lesson-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.lesson-header-main {
  min-width: 0;
}

.lesson-header h2 {
  margin: 0.3rem 0 0;
  line-height: 1.15;
  overflow-wrap: anywhere;
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

.lesson-book-card :deep(.p-card-body) {
  padding: 1rem;
}

.lesson-book-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.book-viewer {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lesson-text {
  white-space: pre-wrap;
  line-height: 1.6;
}

.reference-link {
  display: inline-block;
  margin-top: 1rem;
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

.lesson-streak-summary {
  margin-bottom: 0.9rem;
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid #fed7aa;
  border-radius: 12px;
  background: #fff7ed;
}

.lesson-streak-summary img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.lesson-streak-summary small {
  display: block;
  color: #9a3412;
  font-size: 0.72rem;
  line-height: 1.1;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 700;
}

.lesson-streak-summary strong {
  display: block;
  color: #7c2d12;
  font-size: 1rem;
  line-height: 1.1;
}

.quiz-card {
  margin-top: 0.5rem;
}

.quiz-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
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

.book-viewer {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.book-viewer {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.book-toolbar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 1rem 0.75rem;
  border-radius: 22px;
  background: linear-gradient(135deg, #0f172a 0%, #111c44 60%, #1e1b4b 100%);
  color: #fff;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
}

.book-toolbar-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.book-presentation-meta {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}

.book-mode-badge {
  display: inline-flex;
  width: fit-content;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.book-lesson-heading {
  margin: 0;
  font-size: clamp(1rem, 2vw, 1.35rem);
  color: #fff;
  line-height: 1.2;
}

.book-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.book-progress-shell {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 0.2rem;
}

.book-progress-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 4px;
}

.book-page-counter {
  font-size: 0.95rem;
  font-weight: 700;
  color: #e2e8f0;
}

.book-page-percent {
  font-size: 0.92rem;
  font-weight: 700;
  color: #93c5fd;
}

.book-progress-track {
  position: relative;
  width: 100%;
  height: 12px;
  background: rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  overflow: hidden;
}

.book-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #22d3ee, #6366f1, #8b5cf6);
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.6);
  transition: width 0.35s ease;
}

.book-stage {
  display: flex;
  justify-content: center;
  align-items: center;
}

.book-page {
  width: 100%;
  max-width: 100%;
  height: clamp(560px, 72vh, 760px);
  padding: 1.5rem;
  border-radius: 24px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid #e2e8f0;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
  overflow: auto;
}

.book-page :deep(img),
.book-page :deep(video),
.book-page :deep(iframe) {
  max-width: 100%;
  height: auto;
}

.book-page :deep(.lesson-media-image),
.book-page :deep(.lesson-media-video),
.book-page :deep(.lesson-media-audio) {
  width: 100%;
  max-width: 100%;
}

.book-stage {
  width: 100%;
}

.book-navigation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.book-nav-btn {
  width: 52px;
  height: 52px;
  min-width: 52px;
  border: 0 !important;
  border-radius: 999px !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 24px rgba(2, 6, 23, 0.28);
}

.book-nav-prev {
  background: #0f172a !important;
  color: #ffffff !important;
}

.book-nav-prev:hover {
  background: #1e293b !important;
  color: #ffffff !important;
}

.presentation-mode .book-nav-prev {
  background: rgba(255, 255, 255, 0.12) !important;
  color: #ffffff !important;
}

.presentation-mode .book-nav-prev:hover {
  background: rgba(255, 255, 255, 0.18) !important;
}

.book-nav-next {
  background: linear-gradient(90deg, #2563eb 0%, #6366f1 100%) !important;
  color: #ffffff !important;
}

.book-close-btn {
  width: 52px;
  height: 52px;
  min-width: 52px;
  border: 0 !important;
  border-radius: 999px !important;
  background: rgba(37, 99, 235, 0.95) !important;
  color: #ffffff !important;
  box-shadow: 0 10px 24px rgba(2, 6, 23, 0.28);
}

.book-nav-btn:hover,
.book-nav-prev:hover,
.book-nav-next:hover,
.book-close-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.06);
  color: #ffffff !important;
}

.book-nav-btn:focus,
.book-close-btn:focus {
  box-shadow:
    0 0 0 3px rgba(96, 165, 250, 0.28),
    0 10px 24px rgba(2, 6, 23, 0.28) !important;
}

.book-nav-btn:disabled {
  opacity: 0.35 !important;
  cursor: not-allowed !important;
  transform: none !important;
}

.book-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.book-dot {
  width: 10px;
  height: 10px;
  border: 0;
  border-radius: 999px;
  background: #cbd5e1;
  opacity: 0.5;
  cursor: pointer;
  transition: all 0.25s ease;
}

.book-dot.active {
  width: 40px;
  opacity: 1;
  background: linear-gradient(90deg, #3b82f6 0%, #6366f1 100%);
}

.presentation-mode {
  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow: hidden;
  background:
    radial-gradient(circle at top, rgba(99, 102, 241, 0.16), transparent 28%),
    linear-gradient(180deg, #020617 0%, #0f172a 100%);
}

.presentation-mode .book-toolbar {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: min(1100px, calc(100% - 40px));
  z-index: 10000;
  backdrop-filter: blur(12px);
  background: rgba(15, 23, 42, 0.7);
  border-radius: 18px;
  padding: 1rem 1.2rem;
}

.presentation-mode .book-page {
  max-width: 1100px;
  width: 100%;
  height: calc(100vh - 240px);
  margin: 0 auto;
  margin-top: 140px;
  margin-bottom: 100px;
  border-radius: 28px;
  padding: 2rem;
  overflow: auto;
}

.presentation-mode .book-navigation {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: min(900px, calc(100% - 40px));
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  z-index: 10000;
  backdrop-filter: blur(12px);
  background: rgba(15, 23, 42, 0.7);
  padding: 0.8rem 1rem;
  border-radius: 999px;
}

.book-page :deep(.lesson-page-block > h2:first-child) {
  display: none;
}

.book-page :deep(.lesson-page-block h3),
.book-page :deep(.lesson-page-block h4) {
  display: none;
}

.book-page :deep(.inline-quiz),
.book-page :deep(.quiz-block),
.book-page :deep(.question-card) {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.lesson-cover-hero {
  width: 100%;
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
}

.lesson-cover-hero img {
  display: block;
  width: 100%;
  height: clamp(180px, 34vw, 360px);
  object-fit: cover;
}

@media (max-width: 768px) {
  .lesson-book-card :deep(.p-card-body) {
    padding: 0.75rem;
  }

  .lesson-header {
    flex-direction: column;
    align-items: stretch;
  }

  /* ===== TOOLBAR ===== */
  .book-toolbar {
    gap: 0.85rem;
    padding: 0.95rem;
    border-radius: 18px;
  }

  .book-toolbar-top {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .book-presentation-meta {
    gap: 0.4rem;
  }

  .book-mode-badge {
    font-size: 0.7rem;
    padding: 0.28rem 0.6rem;
  }

  .book-lesson-heading {
    font-size: 0.95rem;
    line-height: 1.18;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .book-toolbar-actions {
    width: 100%;
  }

  .book-toolbar-actions :deep(.p-button) {
    width: 100%;
    justify-content: center;
    border-radius: 999px;
  }

  /* ===== PROGRESS ===== */
  .book-progress-shell {
    gap: 0.45rem;
  }

  .book-progress-topline {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .book-page-counter,
  .book-page-percent {
    font-size: 0.82rem;
  }

  .book-progress-track {
    height: 8px;
  }

  /* ===== PAGE ===== */
  .book-page {
    height: auto;
    min-height: auto;
    max-height: none;
    padding: 1rem;
    border-radius: 18px;
  }

  .book-page :deep(iframe),
  .book-page :deep(video) {
    width: 100%;
    max-width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 14px;
    display: block;
  }

  .book-page :deep(.inline-quiz),
  .book-page :deep(.quiz-block),
  .book-page :deep(.question-card) {
    padding: 0.9rem;
    border-radius: 14px;
  }

  .book-page :deep(.quiz-options),
  .book-page :deep(.option-list) {
    gap: 0.65rem;
  }

  .book-page :deep(label) {
    font-size: 0.9rem;
    line-height: 1.35;
  }

  .book-page :deep(.p-button) {
    min-height: 36px;
  }

  /* ===== PRESENTATION MODE ===== */
  .presentation-mode {
    padding: 0;
    overflow: hidden;
  }

  .presentation-mode .book-toolbar {
    position: fixed;
    top: 10px;
    left: 10px;
    right: 10px;
    width: auto;
    transform: none;
    padding: 0.75rem;
    border-radius: 18px;
    z-index: 10000;
  }

  .presentation-mode .book-toolbar-top {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: start;
    gap: 0.75rem;
  }

  .presentation-mode .book-toolbar-actions {
    width: auto;
  }

  .presentation-mode .book-toolbar-actions :deep(.p-button),
  .presentation-mode .book-close-btn {
    width: 42px !important;
    height: 42px !important;
    min-width: 42px !important;
    padding: 0 !important;
    border-radius: 999px !important;
  }

  .presentation-mode .book-lesson-heading {
    font-size: 0.86rem;
    line-height: 1.15;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .presentation-mode .book-mode-badge {
    font-size: 0.66rem;
    padding: 0.22rem 0.52rem;
  }

  .presentation-mode .book-progress-shell {
    gap: 0.35rem;
  }

  .presentation-mode .book-page-counter,
  .presentation-mode .book-page-percent {
    font-size: 0.76rem;
  }

  .presentation-mode .book-progress-track {
    height: 7px;
  }

  .presentation-mode .book-stage {
    height: 100vh;
    padding: 135px 10px 88px;
    align-items: stretch;
    overflow: hidden;
  }

  .presentation-mode .book-page {
    width: 100%;
    height: 100%;
    min-height: 0;
    max-height: none;
    margin: 0;
    padding: 0.9rem;
    border-radius: 22px;
    overflow-y: auto;
  }

  .presentation-mode .book-navigation {
    position: fixed;
    left: 10px;
    right: 10px;
    bottom: 12px;
    width: auto;
    transform: none;
    padding: 0.7rem 0.85rem;
    border-radius: 999px;
  }

  .book-nav-btn {
    width: 40px;
    height: 40px;
    min-width: 40px;
    box-shadow: 0 8px 18px rgba(2, 6, 23, 0.18);
  }

  .book-navigation {
    gap: 0.75rem;
    padding: 0.6rem 0;
  }

  .book-dot {
    width: 8px;
    height: 8px;
  }

  .book-dot.active {
    width: 32px;
  }

  /* ===== ACTIONS ===== */
  .progress-actions {
    flex-direction: column;
  }

  .progress-actions :deep(.p-button) {
    width: 100%;
  }

  /* ===== QUIZ ===== */
  .quiz-results-grid {
    grid-template-columns: 1fr;
  }

  .quiz-result-tag {
    justify-content: flex-start;
  }

  /* ===== NAVIGATION ===== */
  .book-navigation {
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
  }

  .book-nav-btn {
    width: 46px;
    height: 46px;
    min-width: 46px;
  }

  .book-dots {
    display: flex;
    justify-content: center;
    align-items: center;
  }
}

@media (max-width: 420px) {
  /* ===== TOOLBAR ===== */
  .book-toolbar {
    padding: 0.85rem;
    border-radius: 16px;
  }

  .book-lesson-heading {
    font-size: 0.88rem;
  }

  /* ===== PROGRESS ===== */
  .book-page-counter,
  .book-page-percent {
    font-size: 0.78rem;
  }

  /* ===== PAGE ===== */
  .book-page {
    padding: 0.75rem;
  }

  .book-page :deep(.inline-quiz),
  .book-page :deep(.quiz-block),
  .book-page :deep(.question-card) {
    padding: 0.75rem;
  }

  .book-page :deep(iframe),
  .book-page :deep(video) {
    border-radius: 12px;
  }

  /* ===== PRESENTATION MODE ===== */
  .presentation-mode .book-stage {
    padding: 128px 8px 84px;
  }

  .presentation-mode .book-page {
    padding: 0.75rem;
    border-radius: 20px;
  }

  .presentation-mode .book-navigation {
    left: 8px;
    right: 8px;
    bottom: 10px;
  }

  /* ===== NAVIGATION ===== */
  .book-nav-btn {
    width: 38px;
    height: 38px;
    min-width: 38px;
  }

  .book-dot {
    width: 7px;
    height: 7px;
  }

  .book-dot.active {
    width: 28px;
  }
}
</style>

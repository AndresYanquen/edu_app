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
        <TabView class="course-tabs">
          <TabPanel :header="t('course.tabs.lessons')">
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
          </TabPanel>

          <TabPanel :header="t('course.tabs.liveSessions')">
            <div class="live-sessions-tab">
              <div v-if="liveSessionsLoading" class="live-tab-skeleton">
                <Skeleton height="2rem" class="mb-2" />
                <Skeleton height="2rem" class="mb-2" />
                <Skeleton height="2rem" />
              </div>
              <div v-else-if="liveSessionsError" class="live-tab-error">
                <p>{{ t('course.liveSessions.error') }}</p>
                <Button
                  :label="t('common.reload')"
                  icon="pi pi-refresh"
                  class="p-button-text"
                  @click="loadLiveSessions(course.id)"
                />
              </div>
              <div v-else-if="!liveSessions.length">
                <p class="muted-text">{{ t('course.liveSessions.empty') }}</p>
              </div>
              <div v-else class="session-schedule">
                <template v-for="week in liveSessionWeekGroups" :key="week.key">
                  <div class="week-group">
                    <div class="week-header">
                      <div>
                        <h3 class="week-title">{{ week.label }}</h3>
                        <small class="week-meta muted">{{ week.meta }}</small>
                      </div>
                    </div>
                    <div class="session-list">
                      <div
                        v-for="session in week.sessions"
                        :key="session.id"
                        class="session-row"
                      >
                        <div class="session-time">
                          <strong>{{ formatSessionDate(session.startsAt) }}</strong>
                          <small>{{ formatSessionRange(session.startsAt, session.endsAt) }}</small>
                          <small
                            class="muted countdown-text"
                            v-if="formatCountdown(session.startsAt)"
                          >
                            {{ formatCountdown(session.startsAt) }}
                          </small>
                        </div>
                        <div class="session-details">
                          <div class="session-title">{{ session.title }}</div>
                          <div class="session-meta">
                            <Tag
                              :value="session.classTypeName || t('course.liveSessions.unknownType')"
                              severity="info"
                            />
                            <span v-if="session.hostTeacherName">{{ session.hostTeacherName }}</span>
                            <Divider
                              v-if="session.hostTeacherName && session.groupName"
                              layout="vertical"
                            />
                            <span v-if="session.groupName">{{ session.groupName }}</span>
                          </div>
                        </div>
                        <div class="session-action">
                          <Button
                            :label="t('course.liveSessions.join')"
                            icon="pi pi-external-link"
                            class="p-button-text"
                            :disabled="!isSessionJoinable(session)"
                            @click="joinSession(session.joinUrl)"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </TabPanel>
        </TabView>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '../stores/auth';
import { useI18n } from 'vue-i18n';
import TabPanel from 'primevue/tabpanel';
import TabView from 'primevue/tabview';
import PreviewBanner from '../components/PreviewBanner.vue';
import api from '../api/axios';
import { mySessions } from '../api/liveSessions';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const { t, locale } = useI18n();

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
const liveSessions = ref([]);
const liveSessionsLoading = ref(false);
const liveSessionsError = ref(false);
const now = ref(new Date());
let countdownIntervalId = null;
const refreshNow = () => {
  now.value = new Date();
};
const startCountdownTimer = () => {
  refreshNow();
  countdownIntervalId = setInterval(refreshNow, 60 * 1000);
};

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

const loadLiveSessions = async (courseId) => {
  if (!courseId) {
    return;
  }
  liveSessionsLoading.value = true;
  liveSessionsError.value = false;
  liveSessions.value = [];
  try {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 7);
    windowStart.setHours(0, 0, 0, 0);

    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 35);
    windowEnd.setHours(23, 59, 59, 999);

    const data = await mySessions({
      from: windowStart.toISOString(),
      to: windowEnd.toISOString(),
      courseId,
    });

    const sanitized = Array.isArray(data)
      ? data
          .map((item) => ({
            id: item.id,
            title: item.title,
            startsAt: item.startsAt || item.starts_at,
            endsAt: item.endsAt || item.ends_at,
            classTypeName: item.classTypeName || item.class_type_name || '',
            hostTeacherName:
              item.hostTeacherName || item.host_teacher_name || '',
            groupName: item.groupName || item.group_name || '',
            joinUrl: item.joinUrl || item.join_url || '',
          }))
          .sort(
            (a, b) =>
              new Date(a.startsAt || 0).getTime() - new Date(b.startsAt || 0).getTime(),
      )
      : [];

    liveSessions.value = sanitized;
  } catch (err) {
    liveSessionsError.value = true;
    liveSessions.value = [];
  } finally {
    liveSessionsLoading.value = false;
  }
};

const fetchData = async (id) => {
  loading.value = true;
  error.value = false;
  try {
    const url = isPreview.value ? `/courses/${id}?preview=1` : `/courses/${id}`;
    const courseRes = await api.get(url);
    course.value = courseRes.data;
    loadLiveSessions(id);
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

const formatSessionDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatSessionRange = (start, end) => {
  if (!start) return '';
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const startTime = startDate.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = endDate
    ? endDate.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  return endTime ? `${startTime} — ${endTime}` : startTime;
};

const formatCountdown = (value) => {
  if (!value) return '';
  const diff = new Date(value).getTime() - now.value.getTime();
  if (Number.isNaN(diff) || diff <= 0) {
    return '';
  }
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.ceil((diff % 3_600_000) / 60_000);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!parts.length) {
    parts.push('moments');
  }
  return `Starts in ${parts.join(' ')}`;
};

const formatWeekDateLabel = (value) => {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(locale.value || undefined, {
      month: 'short',
      day: 'numeric',
    }).format(value);
  } catch (_) {
    return value.toLocaleDateString();
  }
};

const getWeekBounds = (value) => {
  const reference = value ? new Date(value) : null;
  if (!reference || Number.isNaN(reference.getTime())) {
    return null;
  }
  const weekStart = new Date(reference);
  const day = weekStart.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + offset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { start: weekStart, end: weekEnd };
};

const formatWeekLabel = (start, end) => {
  if (!start || !end) {
    return '';
  }
  return t('course.liveSessions.weekLabel', {
    start: formatWeekDateLabel(start),
    end: formatWeekDateLabel(end),
  });
};

const formatWeekMeta = (count) =>
  count === 1
    ? t('course.liveSessions.weekMetaSingle')
    : t('course.liveSessions.weekMetaMany', { count });

const liveSessionWeekGroups = computed(() => {
  const sortedSessions = [...liveSessions.value]
    .filter((session) => session.startsAt)
    .map((session) => ({
      ...session,
      startsAtDate: new Date(session.startsAt),
    }))
    .filter((session) => !Number.isNaN(session.startsAtDate.getTime()))
    .sort((a, b) => a.startsAtDate - b.startsAtDate);

  const weekMap = new Map();
  sortedSessions.forEach((session) => {
    const bounds = getWeekBounds(session.startsAtDate);
    if (!bounds) {
      return;
    }
    const key = bounds.start.toISOString();
    const existing = weekMap.get(key);
    if (existing) {
      existing.sessions.push(session);
    } else {
      weekMap.set(key, {
        key,
        weekStart: bounds.start,
        weekEnd: bounds.end,
        sessions: [session],
      });
    }
  });

  return Array.from(weekMap.values()).map((group, index) => {
    const orderedSessions = [...group.sessions].sort(
      (a, b) => a.startsAtDate - b.startsAtDate,
    );
    return {
      key: `${group.key}-${index}`,
      label: formatWeekLabel(group.weekStart, group.weekEnd),
      meta: formatWeekMeta(orderedSessions.length),
      sessions: orderedSessions,
    };
  });
});

const isSessionJoinable = (session) => {
  if (!session?.joinUrl || !session.startsAt) {
    return false;
  }
  const diff = new Date(session.startsAt).getTime() - now.value.getTime();
  return diff <= 5 * 60 * 1000;
};

const joinSession = (url) => {
  if (!url) return;
  window.open(url, '_blank', 'noopener');
};

onMounted(() => {
  fetchData(route.params.id);
  startCountdownTimer();
});

onBeforeUnmount(() => {
  if (countdownIntervalId) {
    clearInterval(countdownIntervalId);
  }
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

.course-tabs {
  margin-top: 1rem;
}

.live-sessions-tab {
  min-height: 200px;
}

.live-tab-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.live-tab-error {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 0.5rem;
}

.week-group {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 1rem;
  background: #fff;
  margin-bottom: 1rem;
}
.week-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 0.5rem;
}
.week-title {
  margin: 0;
  font-size: 1.05rem;
}
.week-meta {
  font-size: 0.9rem;
  font-weight: 500;
}

.session-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.session-row:last-child {
  border-bottom: none;
}

.session-time {
  min-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.9rem;
  color: #6b7280;
}

.session-time strong {
  color: #111827;
  font-size: 1rem;
}

.session-details {
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.session-title {
  font-weight: 600;
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  color: #4b5563;
}

.session-action {
  display: flex;
  align-items: center;
}

.muted-text {
  color: #6b7280;
  margin: 0;
}
</style>

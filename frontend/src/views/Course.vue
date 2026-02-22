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
          <div class="progress" v-show="!isLiveTabActive">
            <span>{{ t('course.progressLabel') }}</span>
            <ProgressBar :value="progress?.percent ?? 0" />
            <small>{{ progressSummaryText }}</small>
            <small v-if="progress?.nextLessonTitle">
              {{ nextLessonText }}
            </small>
          </div>
              <div class="live-session-image-card" v-if="isLiveTabActive">
                <div class="live-session-image-card__text">
                  <h3>Live Sessions</h3>
                  <p>Upcoming and past live sessions</p>
                </div>
                <div class="live-session-image-card__media">
                  <img
                    src="/assets/3dIcons/schedule_live.png"
                    alt="Live schedule"
                  />
                </div>
              </div>
        </div>
      </template>
      <template #content>
        <TabView class="course-tabs" v-model:activeIndex="activeTabIndex">
          <TabPanel header="Posts">
            <CoursePostsFeed :course-id="route.params.id" />
          </TabPanel>

          <TabPanel :header="t('course.tabs.lessons')">
            <section class="student-course-hero">
              <div class="continue-card">
                <div class="continue-content">
                  <h2>Continue with</h2>
                  <h3>{{ nextLessonTitle || t('course.courseCompleted') }}</h3>
                  <Button
                    class="btn-primary"
                    icon="pi pi-arrow-right"
                    label="Continue"
                    :disabled="!nextLesson"
                    @click="openNextLesson"
                  />
                </div>
                <img
                  src="/assets/3dIcons/laptop_reports.png"
                  alt="Continue lesson"
                  class="continue-image"
                />
              </div>

              <div class="progress-card">
                <img
                  src="/assets/3dIcons/orTrophy.png"
                  alt="Progress trophy"
                  class="progress-image"
                />

                <div class="progress-info">
                  <label>Progress</label>
                  <ProgressBar :value="progressPercentage" />
                  <p>Completed {{ completedCount }} / {{ totalCount }}</p>
                  <small>Next: {{ nextLessonTitle || t('course.courseCompleted') }}</small>
                </div>
              </div>
            </section>

            <section class="student-modules-list">
              <div
                v-for="module in courseModules"
                :key="module.id"
                class="module-card"
              >
                <div class="module-header" @click="toggleModule(module.id)">
                  <div class="module-info">
                    <i class="pi pi-book module-icon"></i>
                    <h4>{{ module.title }}</h4>
                  </div>

                  <Button
                    :icon="expandedModules.includes(module.id)
                      ? 'pi pi-chevron-up'
                      : 'pi pi-chevron-down'"
                    class="p-button-text"
                  />
                </div>

                <div
                  v-if="expandedModules.includes(module.id)"
                  class="module-lessons"
                >
                  <div
                    v-for="lesson in module.lessons"
                    :key="lesson.id"
                    class="lesson-row"
                  >

                    <div class="lesson-title-group">
                      <span>{{ lesson.title }}</span>
                      <small>{{ lesson.estimated_minutes }} min</small>
                    </div>

                    <div class="lesson-actions">
                      <Button
                        icon="pi pi-external-link"
                        class="p-button-text"
                        @click="openLesson(lesson.id)"
                      />

                      <Button
                        label="Open"
                        class="btn-open"
                        @click="openLesson(lesson.id)"
                      />

                      <Button
                        :label="isLessonDone(lesson) ? 'Done' : 'Mark done'"
                        class="btn-done"
                        :severity="isLessonDone(lesson) ? 'success' : 'secondary'"
                        icon="pi pi-check"
                        :disabled="isLessonDone(lesson) || isPreview"
                        :loading="!isLessonDone(lesson) && updatingLesson === lesson.id"
                        @click="!isLessonDone(lesson) && markDone(lesson.id)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </TabPanel>

          <TabPanel :header="t('course.tabs.liveSessions')">
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
            <div v-else>
              <section class="live-sessions-hero">
                <div class="hero-icon">
                  <i class="pi pi-calendar" />
                </div>
                <div class="hero-info">
                  <h2>Live Sessions</h2>
                  <small>Upcoming and past live meetings</small>
                </div>
                <div class="hero-badge">
                  <Tag :value="`${liveSessionsThisWeek} sessions this week`" severity="info" />
                </div>
              </section>

              <div class="live-session-filters">
                <Dropdown
                  v-model="selectedLiveGroup"
                  :options="liveSessionGroupOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Filter by group"
                  showClear
                  class="filter-dropdown"
                />
                <Dropdown
                  v-model="selectedLiveInstructor"
                  :options="liveSessionInstructorOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Filter by instructor"
                  showClear
                  class="filter-dropdown"
                />
                <div class="session-chip-row">
                  <Button
                    v-for="filter in sessionStatusFilters"
                    :key="filter.key"
                    :label="filter.label"
                    class="session-chip"
                    :class="{ 'is-active': activeSessionFilters.includes(filter.key) }"
                    severity="secondary"
                    text
                    @click="toggleSessionFilter(filter.key)"
                  />
                </div>
              </div>

              <div v-if="!groupedLiveSessions.length" class="empty-state">
                {{ t('course.liveSessions.empty') }}
              </div>

              <Accordion
                v-else
                multiple
                class="live-sessions-accordion"
              >
                <AccordionTab
                  v-for="(block, index) in groupedLiveSessions"
                  :key="block.key"
                  :header="`${block.weekRange.text} — ${block.sessions.length} session(s)`"
                >
                  <div class="session-block">
                    <div
                      v-for="session in block.sessions"
                      :key="session.id"
                      class="session-card"
                      :class="{
                        'bg-live': session.status === 'live',
                        'bg-upcoming': session.status === 'upcoming',
                        'bg-past': session.status === 'past',
                      }"
                    >
                      <div class="session-left">
                        <div class="session-day">{{ session.dayLabel }}</div>
                        <div class="session-date">{{ session.dateLabel }}</div>
                        <div class="session-time">{{ session.timeLabel }}</div>
                      </div>

                      <div class="session-body">
                        <div class="session-meta">
                          <Tag
                            :value="session.typeLabel || 'Live'"
                            severity="info"
                            class="session-type-tag"
                          />
                          <span class="session-instructor">
                            <i class="pi pi-user"></i>
                            {{ session.instructorName }}
                          </span>
                          <span v-if="session.groupName" class="session-group">
                            • {{ session.groupName }}
                          </span>
                        </div>
                      </div>

                      <div class="session-actions">
                        <Button
                          icon="pi pi-sign-in"
                          label="Join"
                          class="btn-join"
                          :disabled="!isSessionJoinable(session)"
                          @click="joinSession(session.joinUrl)"
                        />
                        <small v-if="session.startsIn" class="session-starts-in">
                          Starts in {{ session.startsIn }}
                        </small>
                      </div>
                    </div>
                  </div>
                </AccordionTab>
              </Accordion>
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
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import PreviewBanner from '../components/PreviewBanner.vue';
import CoursePostsFeed from '../components/student/posts/CoursePostsFeed.vue';
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
const markLessonCompleted = (lessonId) => {
  const nextSet = new Set(completedLessons.value);
  nextSet.add(lessonId);
  completedLessons.value = nextSet;
};
const isLessonCompleted = (lessonId) => completedLessons.value.has(lessonId);
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

const selectedLiveGroup = ref(null);
const selectedLiveInstructor = ref(null);
const activeSessionFilters = ref(['this-week', 'upcoming', 'past']);
const sessionStatusFilters = [
  { key: 'this-week', label: 'This week' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
];

const expandedModules = ref([]);
const courseModules = computed(() => course.value?.modules || []);
const toggleModule = (id) => {
  const idx = expandedModules.value.indexOf(id);
  if (idx > -1) {
    expandedModules.value.splice(idx, 1);
    return;
  }
  expandedModules.value.push(id);
};

const totalCount = computed(() =>
  progress.value?.totalLessons ?? courseModules.value.reduce((sum, m) => sum + (m.lessons?.length || 0), 0),
);

const isLessonDone = (lesson) => lesson.completed || isLessonCompleted(lesson.id);

const completedCount = computed(
  () => progress.value?.completedLessons ?? courseModules.value.reduce(
    (sum, m) => sum + (m.lessons?.filter((lesson) => isLessonDone(lesson)).length || 0),
    0,
  ),
);

const progressPercentage = computed(() => progress.value?.percent ?? 0);

const nextLesson = computed(() => {
  for (const module of courseModules.value) {
    const next = (module.lessons || []).find((lesson) => !isLessonDone(lesson));
    if (next) return next;
  }
  return null;
});

const nextLessonTitle = computed(() => nextLesson.value?.title || '');

const fetchProgress = async (id) => {
  if (isPreview.value) {
    progress.value = { ...defaultProgress };
    return;
  }
  const { data } = await api.get(`/courses/${id}/progress`);
  progress.value = data;
  if (Array.isArray(data.completedLessonDetails)) {
    const doneSet = new Set(data.completedLessonDetails.map((lesson) => lesson.id));
    completedLessons.value = doneSet;
  }
};

const activeTabIndex = ref(0);
const TAB_INDEX = {
  posts: 0,
  lessons: 1,
  live: 2,
};
const isLiveTabActive = computed(() => activeTabIndex.value === TAB_INDEX.live);

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
    const doneSet = new Set();
    (course.value?.modules || []).forEach((module) => {
      (module.lessons || []).forEach((lesson) => {
        if (lesson.completed || lesson.is_completed) {
          doneSet.add(lesson.id);
        }
      });
    });
    completedLessons.value = doneSet;
    loadLiveSessions(id);
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

const openNextLesson = () => {
  if (nextLesson.value) {
    openLesson(nextLesson.value.id);
  }
};

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
  return `${parts.join(' ')}`;
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

const liveSessionGroupOptions = computed(() => {
  const values = liveSessions.value
    .map((session) => session.groupName || session.group_name || '')
    .filter(Boolean);
  return Array.from(new Set(values)).map((value) => ({ label: value, value }));
});

const liveSessionInstructorOptions = computed(() => {
  const values = liveSessions.value
    .map((session) => session.hostTeacherName || session.host_teacher_name || '')
    .filter(Boolean);
  return Array.from(new Set(values)).map((value) => ({ label: value, value }));
});

const liveSessionsThisWeek = computed(() =>
  liveSessions.value.filter((session) => isSessionInWeek(session, now.value)).length,
);

const getSessionDate = (session) => {
  if (!session?.startsAt) return null;
  const date = new Date(session.startsAt);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getSessionStatus = (session) => {
  const start = getSessionDate(session);
  if (!start) return 'upcoming';
  const end = session.endsAt ? new Date(session.endsAt) : null;
  if (start <= now.value && (!end || end >= now.value)) {
    return 'live';
  }
  if (start > now.value) {
    return 'upcoming';
  }
  return 'past';
};

const isSessionInWeek = (session, reference) => {
  const date = getSessionDate(session);
  if (!date) return false;
  const bounds = getWeekBounds(reference);
  if (!bounds) return false;
  return date >= bounds.start && date <= bounds.end;
};

const filteredLiveSessions = computed(() => {
  const statuses = activeSessionFilters.value;
  return liveSessions.value
    .filter((session) => {
      if (selectedLiveGroup.value) {
        const groupName = session.groupName || session.group_name;
        if (groupName !== selectedLiveGroup.value) {
          return false;
        }
      }
      if (selectedLiveInstructor.value) {
        const instructor =
          session.hostTeacherName || session.host_teacher_name || '';
        if (instructor !== selectedLiveInstructor.value) {
          return false;
        }
      }
      if (!statuses.length) {
        return true;
      }
      return statuses.some((status) => {
        if (status === 'this-week') {
          return isSessionInWeek(session, now.value);
        }
        if (status === 'upcoming') {
          return getSessionStatus(session) === 'upcoming';
        }
        if (status === 'past') {
          return getSessionStatus(session) === 'past';
        }
        return false;
      });
    })
    .map((session) => {
      const sessionDate = getSessionDate(session);
      return {
        ...session,
        startsAtDate: sessionDate,
        status: getSessionStatus(session),
        dayLabel: sessionDate
          ? sessionDate.toLocaleDateString(undefined, { weekday: 'long' })
          : '',
        dateLabel: formatSessionDate(session.startsAt),
        timeLabel: formatSessionRange(session.startsAt, session.endsAt),
        instructorName: session.hostTeacherName || session.host_teacher_name || '',
        groupName: session.groupName || session.group_name || '',
        typeLabel: session.classTypeName || session.class_type_name || 'Live',
        startsIn: formatCountdown(session.startsAt),
      };
    });
});

const groupedLiveSessions = computed(() => {
  const weekMap = new Map();
  filteredLiveSessions.value
    .filter((session) => session.startsAtDate)
    .sort((a, b) => a.startsAtDate - b.startsAtDate)
    .forEach((session) => {
      const bounds = getWeekBounds(session.startsAtDate);
      if (!bounds) return;
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
      weekRange: {
        text: formatWeekLabel(group.weekStart, group.weekEnd),
        meta: formatWeekMeta(orderedSessions.length),
      },
      sessions: orderedSessions,
    };
  });
});

const toggleSessionFilter = (key) => {
  const current = [...activeSessionFilters.value];
  const index = current.indexOf(key);
  if (index > -1) {
    current.splice(index, 1);
  } else {
    current.push(key);
  }
  activeSessionFilters.value = current;
};

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

watch(courseModules, (modules) => {
  if (!modules.length) {
    expandedModules.value = [];
    return;
  }
  if (!expandedModules.value.length) {
    expandedModules.value = [modules[0].id];
  }
});

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

.student-course-hero {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.continue-card,
.progress-card {
  background: #ffffff;
  border-radius: 18px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  flex: 1;
}

.continue-image,
.progress-image {
  width: 140px;
  height: auto;
}

.student-course-hero .continue-card {
  background-color: #EAF4FE;
}

.student-course-hero .progress-card {
  background: linear-gradient(
    135deg,
    #e8f6f1 0%,
    #e3f0fb 50%,
    #f7fbff 100%
  );
  box-shadow: 
    0 10px 30px rgba(16, 185, 129, 0.08),
    0 20px 60px rgba(59, 130, 246, 0.08);
  border-radius: 20px;
}



.continue-content h2 {
  font-size: 1.25rem;
  margin: 0;
}

.continue-content h3 {
  font-size: 1.5rem;
  margin: 0.25rem 0;
}

.btn-primary {
  background: #1d4ed8;
  color: #fff;
  border: none;
}

.progress-info {
  flex: 1;
}

.progress-info label {
  font-size: 0.85rem;
  color: #6b7280;
  display: block;
  margin-bottom: 0.35rem;
}

.student-modules-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.module-card {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.module-header {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.module-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.module-icon {
  font-size: 1.5rem;
  color: #1d4ed8;
}

.module-lessons {
  display: flex;
  flex-direction: column;
}

.lesson-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-top: 1px solid #e5e7eb;
}

.lesson-title-group {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.lesson-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-open {
  background: #1e3a8a;
  color: #ffffff;
  border: none;
}

.btn-done {
  background: #10b981;
  color: #ffffff;
  border: none;
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

.live-sessions-hero {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #fff;
  border-radius: 16px;
  padding: 1rem;
  box-shadow: var(--shadow-md);
  margin-bottom: 1.5rem;
}

.live-sessions-hero .hero-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  background: rgba(var(--brand-primary-rgb), 0.08);
  border-radius: 50%;
  font-size: 1.5rem;
}

.live-sessions-hero h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.live-sessions-hero small {
  color: var(--text-secondary);
}

.live-session-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: center;
}

.filter-dropdown {
  min-width: 200px;
  max-width: 260px;
}

.session-chip-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.session-chip {
  border-radius: 999px;
}

.session-chip.is-active {
  background: rgba(59, 130, 246, 0.1);
}

.live-sessions-accordion .p-accordion-header {
  font-weight: 600;
  font-size: 1.1rem;
}

.session-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.session-card {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid var(--app-border);
  align-items: center;
  background: #fff;
  margin-bottom: 0.75rem;
}

.session-left {
  text-align: left;
  min-width: 6.5rem;
  color: var(--text-primary);
  font-weight: 500;
}

.session-body {
  flex: 1;
}

.session-meta {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.session-instructor i {
  margin-right: 0.35rem;
}

.session-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.btn-join {
  background: var(--brand-primary);
  color: #fff;
  border: none;
}

.session-starts-in {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.bg-live {
  /* aquí puedes aplicar fondo con imagen o gradiente */
}

.bg-upcoming {
  /* aquí puedes aplicar otro fondo */
}

.bg-past {
  /* aquí puedes aplicar otro */
}
.live-session-image-card {
  margin-bottom: 1rem;
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  justify-content: center;
  background:
  radial-gradient(
    circle at 80% 50%,
    rgba(59, 130, 246, 0.18),
    transparent 45%
  ),
  radial-gradient(
    circle at 65% 40%,
    rgba(34, 197, 94, 0.12),
    transparent 50%
  ),
  linear-gradient(
    135deg,
    #eef6ff 0%,
    #e9f3ff 40%,
    #f5faff 100%
  );
}

.live-session-image-card img {
  max-width: 200px;
  height: auto;
}
</style>

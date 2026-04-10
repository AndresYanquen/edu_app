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
              <h3>Clases en vivo</h3>
              <p>Visualiza primero tus clases de esta semana y luego el resto de sesiones</p>
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
                  <h2>Clases en vivo</h2>
                  <small>Primero verás tus clases de esta semana y luego el historial o próximas semanas</small>
                </div>

                <div class="hero-badge">
                  <Tag :value="`${liveSessionsThisWeek} sesiones esta semana`" severity="info" />
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

              <div
                v-if="!currentWeekGroup && !otherWeekGroups.length"
                class="empty-state"
              >
                {{ t('course.liveSessions.empty') }}
              </div>

              <div v-else class="live-sessions-layout">
                <section v-if="currentWeekGroup" class="current-week-section">
                  <div class="section-header">
                    <div>
                      <h3>Esta semana</h3>
                      <small>{{ currentWeekGroup.weekRange.text }} · {{ currentWeekGroup.sessions.length }} sesión(es)</small>
                    </div>
                  </div>

                  <div class="session-grid">
                    <div
                      v-for="session in currentWeekGroup.sessions"
                      :key="session.id"
                      class="session-card current-week-card"
                      :class="{
                        'bg-live': session.status === 'live',
                        'bg-upcoming': session.status === 'upcoming',
                        'bg-past': session.status === 'past',
                      }"
                    >
                      <div class="session-leading-icon">
                        <i
                          class="pi"
                          :class="session.status === 'live'
                            ? 'pi-video'
                            : session.status === 'upcoming'
                              ? 'pi-calendar-clock'
                              : 'pi-check-circle'"
                        />
                      </div>

                      <div class="session-main">
                        <div class="session-topline">
                          <Tag
                            :value="session.status === 'live'
                              ? 'Live'
                              : session.status === 'upcoming'
                                ? 'Upcoming'
                                : 'Past'"
                            :severity="session.status === 'live'
                              ? 'success'
                              : session.status === 'upcoming'
                                ? 'info'
                                : 'secondary'"
                            class="session-status-tag"
                          />

                          <Tag
                            :value="session.typeLabel || 'Live'"
                            severity="info"
                            class="session-type-tag"
                          />
                        </div>

                        <h4 class="session-title-text">
                          {{ session.title || 'Clase en vivo' }}
                        </h4>

                        <div class="session-details-row">
                          <div class="session-detail">
                            <i class="pi pi-calendar"></i>
                            <span>{{ session.dateLabel }}</span>
                          </div>

                          <div class="session-detail">
                            <i class="pi pi-clock"></i>
                            <span>{{ session.timeLabel }}</span>
                          </div>

                          <div class="session-detail">
                            <i class="pi pi-user"></i>
                            <span>{{ session.instructorName || 'Instructor pending' }}</span>
                          </div>

                          <div v-if="session.groupName" class="session-detail">
                            <i class="pi pi-users"></i>
                            <span>{{ session.groupName }}</span>
                          </div>
                        </div>
                      </div>

                      <div class="session-actions">
                        <Button
                          icon="pi pi-sign-in"
                          :label="session.status === 'past' ? 'Closed' : 'Join'"
                          class="btn-join"
                          :class="{ 'btn-join-past': session.status === 'past' }"
                          :disabled="session.status === 'past' || !isSessionJoinable(session)"
                          @click="joinSession(session.joinUrl)"
                        />
                        <small v-if="session.startsIn" class="session-starts-in">
                          Starts in {{ session.startsIn }}
                        </small>
                      </div>
                    </div>
                  </div>
                </section>

                <section v-if="otherWeekGroups.length" class="other-weeks-section">
                  <div class="section-header">
                    <div>
                      <h3>Otras semanas</h3>
                      <small>Consulta próximas o pasadas sin saturar la vista principal</small>
                    </div>
                  </div>

                  <Accordion class="other-weeks-accordion" multiple>
                    <AccordionTab
                      v-for="block in otherWeekGroups"
                      :key="block.key"
                      :header="`${block.weekRange.text} — ${block.sessions.length} session(s)`"
                    >
                      <div class="session-grid">
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
                          <div class="session-leading-icon">
                            <i
                              class="pi"
                              :class="session.status === 'live'
                                ? 'pi-video'
                                : session.status === 'upcoming'
                                  ? 'pi-calendar-clock'
                                  : 'pi-check-circle'"
                            />
                          </div>

                          <div class="session-main">
                            <div class="session-topline">
                              <Tag
                                :value="session.status === 'live'
                                  ? 'Live'
                                  : session.status === 'upcoming'
                                    ? 'Upcoming'
                                    : 'Past'"
                                :severity="session.status === 'live'
                                  ? 'success'
                                  : session.status === 'upcoming'
                                    ? 'info'
                                    : 'secondary'"
                                class="session-status-tag"
                              />

                              <Tag
                                :value="session.typeLabel || 'Live'"
                                severity="info"
                                class="session-type-tag"
                              />
                            </div>

                            <h4 class="session-title-text">
                              {{ session.title || 'Clase en vivo' }}
                            </h4>

                            <div class="session-details-row">
                              <div class="session-detail">
                                <i class="pi pi-calendar"></i>
                                <span>{{ session.dateLabel }}</span>
                              </div>

                              <div class="session-detail">
                                <i class="pi pi-clock"></i>
                                <span>{{ session.timeLabel }}</span>
                              </div>

                              <div class="session-detail">
                                <i class="pi pi-user"></i>
                                <span>{{ session.instructorName || 'Instructor pending' }}</span>
                              </div>

                              <div v-if="session.groupName" class="session-detail">
                                <i class="pi pi-users"></i>
                                <span>{{ session.groupName }}</span>
                              </div>
                            </div>
                          </div>

                          <div class="session-actions">
                            <Button
                              icon="pi pi-sign-in"
                              :label="session.status === 'past' ? 'Closed' : 'Join'"
                              class="btn-join"
                              :class="{ 'btn-join-past': session.status === 'past' }"
                              :disabled="session.status === 'past' || !isSessionJoinable(session)"
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
                </section>
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
  progress.value?.totalLessons ??
  courseModules.value.reduce((sum, m) => sum + (m.lessons?.length || 0), 0),
);

const isLessonDone = (lesson) => lesson.completed || isLessonCompleted(lesson.id);

const completedCount = computed(
  () =>
    progress.value?.completedLessons ??
    courseModules.value.reduce(
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
  if (!courseId) return;

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
            hostTeacherName: item.hostTeacherName || item.host_teacher_name || '',
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
  router.push({
    path: `/student/course/${route.params.id}/lesson/${lessonId}`,
    query,
  });
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
  if (Number.isNaN(diff) || diff <= 0) return '';

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.ceil((diff % 3_600_000) / 60_000);

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!parts.length) parts.push('moments');

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
  if (!reference || Number.isNaN(reference.getTime())) return null;

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
  if (!start || !end) return '';
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

  if (start <= now.value && (!end || end >= now.value)) return 'live';
  if (start > now.value) return 'upcoming';
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
        if (groupName !== selectedLiveGroup.value) return false;
      }

      if (selectedLiveInstructor.value) {
        const instructor = session.hostTeacherName || session.host_teacher_name || '';
        if (instructor !== selectedLiveInstructor.value) return false;
      }

      if (!statuses.length) return true;

      return statuses.some((status) => {
        if (status === 'this-week') return isSessionInWeek(session, now.value);
        if (status === 'upcoming') return getSessionStatus(session) === 'upcoming';
        if (status === 'past') return getSessionStatus(session) === 'past';
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
      isCurrentWeek:
        now.value >= group.weekStart &&
        now.value <= group.weekEnd,
    };
  });
});

const currentWeekGroup = computed(() =>
  groupedLiveSessions.value.find((group) => group.isCurrentWeek) || null,
);

const otherWeekGroups = computed(() =>
  groupedLiveSessions.value.filter((group) => !group.isCurrentWeek),
);

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
  if (!session?.joinUrl || !session?.startsAt) return false;
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

const previewQuery = computed(() => {
  if (!isPreview.value) return null;
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
.page,
.page * {
  box-sizing: border-box;
}

.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 100%;
}

/* =========================
   PRIMEVUE BASE
========================= */
:deep(.p-card) {
  width: 100%;
  max-width: 100%;
  border-radius: 22px;
  overflow: hidden;
}

:deep(.p-card-body) {
  padding: 1.15rem;
}

:deep(.p-card-title) {
  margin-bottom: 0.9rem;
}

:deep(.p-card-content) {
  padding-top: 0;
}

:deep(.p-breadcrumb) {
  width: 100%;
  max-width: 100%;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  overflow-x: auto;
  white-space: nowrap;
}

:deep(.p-breadcrumb ul) {
  flex-wrap: nowrap;
  min-width: max-content;
}

:deep(.p-tabview-nav) {
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
}

:deep(.p-tabview-nav::-webkit-scrollbar) {
  display: none;
}

:deep(.p-tabview-nav li) {
  flex: 0 0 auto;
}

:deep(.p-tabview-nav-link) {
  white-space: nowrap;
}

:deep(.p-progressbar) {
  height: 0.7rem;
  border-radius: 999px;
  overflow: hidden;
}

/* =========================
   HEADER
========================= */
.course-header {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.9fr);
  gap: 1.5rem;
  align-items: start;
}

.course-header h2 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.08;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #0f172a;
}

.description {
  margin: 0.75rem 0 0;
  color: #64748b;
  font-size: 1rem;
  line-height: 1.55;
  max-width: 720px;
}

.progress {
  min-width: 0;
  background: linear-gradient(135deg, #f8fafc 0%, #eef4ff 100%);
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 1rem;
  display: grid;
  gap: 0.55rem;
}

.progress span {
  font-size: 0.86rem;
  font-weight: 700;
  color: #334155;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.progress small {
  color: #64748b;
  line-height: 1.4;
}

/* =========================
   HERO LESSONS
========================= */
.student-course-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 1.25rem;
  margin-bottom: 1.6rem;
}

.continue-card,
.progress-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 1.35rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
  min-width: 0;
}

.student-course-hero .continue-card {
  background: linear-gradient(135deg, #eaf4fe 0%, #f4faff 100%);
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
}

.continue-content {
  min-width: 0;
  flex: 1;
}

.continue-content h2 {
  font-size: 0.95rem;
  font-weight: 700;
  color: #64748b;
  margin: 0 0 0.2rem;
}

.continue-content h3 {
  font-size: 1.45rem;
  line-height: 1.2;
  margin: 0 0 0.85rem;
  color: #0f172a;
  font-weight: 800;
}

.continue-image,
.progress-image {
  width: 120px;
  max-width: 35%;
  height: auto;
  flex-shrink: 0;
}

.btn-primary {
  background: #1d4ed8;
  color: #fff;
  border: none;
}

.progress-info {
  flex: 1;
  min-width: 0;
}

.progress-info label {
  font-size: 0.82rem;
  color: #64748b;
  display: block;
  margin-bottom: 0.45rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.progress-info p {
  margin: 0.55rem 0 0.2rem;
  color: #334155;
  font-weight: 600;
}

.progress-info small {
  color: #64748b;
  line-height: 1.4;
}

/* =========================
   MODULES / LESSONS
========================= */
.student-modules-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.module-card {
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
}

.module-header {
  padding: 1rem 1.1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  background: #fcfdff;
}

.module-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.module-info h4 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.3;
  color: #0f172a;
  font-weight: 700;
}

.module-icon {
  font-size: 1.35rem;
  color: #1d4ed8;
  flex-shrink: 0;
}

.module-lessons {
  display: flex;
  flex-direction: column;
}

.lesson-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1.1rem;
  border-top: 1px solid #e5e7eb;
}

.lesson-title-group {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  min-width: 0;
}

.lesson-title-group span {
  font-weight: 600;
  color: #0f172a;
  line-height: 1.35;
}

.lesson-title-group small {
  color: #64748b;
  line-height: 1.3;
}

.lesson-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
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

/* =========================
   LEGACY / SMALL HELPERS
========================= */
.modules {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.continue-card {
  margin-bottom: 0;
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

.lesson-title {
  font-weight: 500;
}

.badge {
  text-transform: capitalize;
  font-size: 0.85rem;
  color: #64748b;
}

/* =========================
   LIVE SESSIONS
========================= */
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

.live-sessions-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  background: #fff;
  border-radius: 18px;
  padding: 1rem 1.15rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
  margin-bottom: 1.35rem;
}

.live-sessions-hero .hero-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  background: rgba(59, 130, 246, 0.08);
  border-radius: 50%;
  font-size: 1.4rem;
  color: #1d4ed8;
  flex-shrink: 0;
}

.live-sessions-hero h2 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  color: #0f172a;
}

.live-sessions-hero small {
  color: #64748b;
  line-height: 1.4;
}

.hero-info {
  min-width: 0;
}

.live-session-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  margin-bottom: 1.25rem;
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

.live-sessions-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.current-week-section,
.other-weeks-section {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.section-header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: #0f172a;
}

.section-header small {
  color: #64748b;
  line-height: 1.4;
}

.other-weeks-accordion :deep(.p-accordion-header-link) {
  font-weight: 700;
}

.session-grid {
  display: grid;
  gap: 0.85rem;
}

.session-card {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.05rem;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.current-week-card {
  box-shadow: 0 12px 28px rgba(29, 78, 216, 0.08);
}

.session-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
}

.session-leading-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 1.35rem;
}

.session-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.session-topline {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.session-title-text {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.25;
}

.session-details-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
}

.session-detail {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: #475569;
  font-size: 0.9rem;
  line-height: 1.35;
}

.session-detail i {
  color: #64748b;
  font-size: 0.88rem;
}

.session-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.btn-join {
  background: #1d4ed8;
  color: #fff;
  border: none;
  min-width: 116px;
  justify-content: center;
}

.btn-join-past {
  background: #cbd5e1 !important;
  color: #475569 !important;
}

.session-starts-in {
  font-size: 0.8rem;
  color: #64748b;
  text-align: right;
  line-height: 1.3;
}

.session-status-tag {
  font-weight: 700;
}

.session-type-tag {
  font-weight: 600;
}

.bg-live {
  border-left: 5px solid #22c55e;
  background: linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%);
}

.bg-upcoming {
  border-left: 5px solid #3b82f6;
  background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
}

.bg-past {
  border-left: 5px solid #94a3b8;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
}

.empty-state {
  color: #6b7280;
  padding: 1rem 0;
}

.live-session-image-card {
  border-radius: 20px;
  padding: 1.15rem 1.2rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  background:
    radial-gradient(
      circle at 85% 50%,
      rgba(59, 130, 246, 0.16),
      transparent 42%
    ),
    radial-gradient(
      circle at 68% 36%,
      rgba(34, 197, 94, 0.1),
      transparent 48%
    ),
    linear-gradient(
      135deg,
      #eef6ff 0%,
      #eaf4ff 42%,
      #f7fbff 100%
    );
  border: 1px solid #dbeafe;
  min-width: 320px;
  max-width: 100%;
}

.live-session-image-card__text {
  min-width: 0;
  display: grid;
  gap: 0.3rem;
}

.live-session-image-card__text h3 {
  margin: 0;
  font-size: 1.18rem;
  line-height: 1.15;
  font-weight: 800;
  color: #0f172a;
}

.live-session-image-card__text p {
  margin: 0;
  color: #64748b;
  line-height: 1.45;
  font-size: 0.94rem;
  max-width: 320px;
}

.live-session-image-card__media {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.live-session-image-card img {
  max-width: 150px;
  height: auto;
}

/* =========================
   LARGE TABLET
========================= */
@media (max-width: 1024px) {
  .session-card {
    grid-template-columns: 52px minmax(0, 1fr);
  }

  .session-actions {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.35rem;
  }

  .session-starts-in {
    text-align: left;
  }
}

/* =========================
   TABLET
========================= */
@media (max-width: 900px) {
  .course-header {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .student-course-hero {
    grid-template-columns: 1fr;
  }

  .course-header h2 {
    font-size: 2.25rem;
    line-height: 1.08;
  }

  .description {
    max-width: 100%;
  }

  .live-session-image-card {
    min-width: 0;
    width: 100%;
    grid-template-columns: minmax(0, 1fr) 140px;
    padding: 1rem 1.1rem;
    gap: 0.9rem;
  }

  .live-session-image-card__text h3 {
    font-size: 1.08rem;
  }

  .live-session-image-card__text p {
    font-size: 0.9rem;
    max-width: 100%;
  }

  .live-session-image-card img {
    max-width: 120px;
  }
}

/* =========================
   MOBILE
========================= */
@media (max-width: 768px) {
  .page {
    gap: 0.9rem;
  }

  :deep(.p-card-body) {
    padding: 0.95rem;
  }

  :deep(.p-breadcrumb) {
    border-radius: 12px;
  }

  .course-header h2 {
    font-size: 1.9rem;
    line-height: 1.1;
  }

  .description {
    font-size: 0.92rem;
    line-height: 1.45;
    margin-top: 0.55rem;
  }

  .progress {
    padding: 0.9rem;
    border-radius: 16px;
  }

  .student-course-hero {
    gap: 0.95rem;
    margin-bottom: 1.2rem;
  }

  .continue-card,
  .progress-card {
    padding: 1rem;
    border-radius: 16px;
    flex-direction: column;
    align-items: flex-start;
  }

  .continue-image,
  .progress-image {
    width: 92px;
    max-width: 100%;
    align-self: flex-end;
  }

  .continue-content h2 {
    font-size: 0.86rem;
  }

  .continue-content h3 {
    font-size: 1.2rem;
  }

  .live-sessions-hero {
    grid-template-columns: 1fr;
    gap: 0.8rem;
    align-items: flex-start;
  }

  .hero-badge {
    width: 100%;
  }

  .live-session-filters {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-dropdown {
    max-width: 100%;
    width: 100%;
  }

  .session-chip-row {
    width: 100%;
  }

  .session-card {
    grid-template-columns: 1fr;
    gap: 0.9rem;
    padding: 0.95rem;
    border-radius: 16px;
  }

  .session-leading-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    font-size: 1.2rem;
  }

  .session-actions {
    grid-column: auto;
    flex-direction: column;
    align-items: stretch;
  }

  .btn-join {
    width: 100%;
  }

  .session-starts-in {
    text-align: left;
  }

  .lesson-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.8rem;
  }

  .lesson-actions {
    width: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .lesson-actions :deep(.p-button) {
    flex: 1 1 auto;
  }

  .live-session-image-card {
    grid-template-columns: 1fr;
    padding: 1rem;
    gap: 0.85rem;
  }

  .live-session-image-card__text h3 {
    font-size: 1rem;
  }

  .live-session-image-card__text p {
    font-size: 0.88rem;
  }

  .live-session-image-card__media {
    justify-content: center;
  }

  .live-session-image-card img {
    max-width: 120px;
  }
}

/* =========================
   SMALL MOBILE
========================= */
@media (max-width: 420px) {
  .course-header h2 {
    font-size: 1.7rem;
  }

  .description {
    font-size: 0.88rem;
  }

  .continue-content h3 {
    font-size: 1.08rem;
  }

  .session-title-text {
    font-size: 0.98rem;
  }

  .session-detail {
    font-size: 0.86rem;
  }

  .lesson-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .lesson-actions :deep(.p-button) {
    width: 100%;
  }
}
</style>
<template>
  <div class="page">
    <Card>
      <template #title>
        <div class="header">
          <div>
            <h2>{{ group?.name || t('instructorGroup.titleFallback') }}</h2>
            <p>{{ group?.schedule_text }}</p>
          </div>
          <Button :label="t('instructorGroup.back')" icon="pi pi-arrow-left" class="p-button-text" @click="goBack" />
        </div>
      </template>

      <template #content>
        <TabView v-model:activeIndex="activeTab" @tab-change="onTabChange">
          <TabPanel :header="t('instructor.tabs.progress')">
            <div v-if="loading">
              <Skeleton height="3rem" class="mb-2" />
              <Skeleton height="3rem" class="mb-2" />
              <Skeleton height="3rem" class="mb-2" />
            </div>

            <div v-else-if="permissionError">
              <p>{{ permissionMessage }}</p>
              <Button :label="t('instructorGroup.back')" icon="pi pi-arrow-left" class="p-button-text" @click="goBack" />
            </div>

            <div v-else-if="error">
              <p>{{ t('instructorGroup.loadError') }}</p>
              <Button :label="t('instructorGroup.reload')" icon="pi pi-refresh" class="p-button-text" @click="loadData" />
            </div>

            <div v-else>
              <div class="summary">
                <div>
                  <small>{{ t('instructorGroup.totalStudents') }}</small>
                  <strong>{{ totalStudents }}</strong>
                </div>
                <div>
                  <small>{{ t('instructorGroup.averageProgress') }}</small>
                  <strong>{{ averagePercent }}%</strong>
                </div>
              </div>

              <div class="table-controls">
                <span class="control-label">{{ t('instructorGroup.filterLabel') }}</span>
                <InputText v-model="filter" :placeholder="t('instructorGroup.filterPlaceholder')" />
                <Button :label="t('instructorGroup.reload')" icon="pi pi-refresh" class="p-button-text" @click="loadData" />
              </div>

              <template v-if="students.length">
                <DataTable
                  :value="filteredStudents"
                  responsiveLayout="scroll"
                  paginator
                  :rows="10"
                  :rowsPerPageOptions="[10, 25, 50]"
                  :sortField="'percent'"
                  :sortOrder="-1"
                >
                  <Column field="fullName" :header="t('instructorGroup.table.student')" />
                  <Column field="email" :header="t('instructorGroup.table.email')" />
                  <Column :header="t('instructorGroup.table.connection')">
                    <template #body="{ data }">
                      <div class="activity-cell">
                        <Tag
                          :value="presenceLabel(data)"
                          :severity="presenceSeverity(data)"
                          :icon="getStudentPresence(data.id)?.isOnline ? 'pi pi-circle-fill' : undefined"
                        />
                      </div>
                    </template>
                  </Column>
                  <Column :header="t('instructorGroup.table.progress')">
                    <template #body="{ data }">
                      <div class="progress-cell">
                        <ProgressBar :value="data.percent" style="width: 160px" />
                        <span class="pct">{{ data.percent }}%</span>
                      </div>
                    </template>
                  </Column>
                  <Column :header="t('instructorGroup.table.lastActivity')">
                    <template #body="{ data }">
                      <div class="activity-cell">
                        <Tag
                          v-if="!data.lastSeenAt"
                          :value="t('instructorGroup.neverAccessed')"
                          severity="warning"
                        />
                        <span v-else>{{ formatLastActivity(data.lastSeenAt) }}</span>
                      </div>
                    </template>
                  </Column>
                  <Column :header="t('instructorGroup.table.quizScore')">
                    <template #body="{ data }">
                      <span>{{ formatScore(data.bestQuizScore) }}</span>
                    </template>
                  </Column>
                  <Column :header="t('instructorGroup.table.actions')">
                    <template #body="{ data }">
                      <Button
                        :label="t('instructorGroup.viewDetail')"
                        icon="pi pi-chart-line"
                        class="p-button-text"
                        @click="openStudentProgressDrawer(data)"
                      />
                    </template>
                  </Column>
                </DataTable>

                <div v-if="!filteredStudents.length" class="empty-state">
                  {{ t('instructorGroup.searchEmpty') }}
                </div>
              </template>

              <div v-else class="empty-state">
                {{ t('instructorGroup.noStudents') }}
              </div>
            </div>
          </TabPanel>

          <TabPanel :header="t('instructor.tabs.content')">
            <div class="course-content-tab">
              <div v-if="courseLoading">
                <Skeleton height="2.5rem" class="mb-2" />
                <Skeleton height="1.5rem" class="mb-2" />
                <Skeleton height="6rem" class="mb-2" />
              </div>
              <div v-else-if="courseError" class="empty-state">
                {{ t('instructorGroup.courseContentError') }}
                <Button :label="t('instructorGroup.reload')" class="p-button-text" @click="loadCourseContent(true)" />
              </div>
              <div v-else-if="courseDetail">
                <div class="course-summary">
                  <h3>{{ courseDetail.title }}</h3>
                  <p class="muted" v-if="courseDetail.description">{{ courseDetail.description }}</p>
                </div>
                <div v-if="courseDetail.modules?.length">
                  <Panel
                    v-for="module in courseDetail.modules"
                    :key="module.id"
                    toggleable
                    class="module-panel"
                  >
                    <template #header>
                      <div class="module-header">
                        <strong>{{ module.title }}</strong>
                        <Tag
                          :value="module.is_published ? 'Published' : 'Draft'"
                          :severity="module.is_published ? 'success' : 'warning'"
                        />
                      </div>
                    </template>
                    <ul class="lesson-list">
                      <li v-for="lesson in module.lessons" :key="lesson.id">
                        <div class="lesson-row">
                          <span>{{ lesson.title }}</span>
                          <div class="lesson-actions">
                            <Tag :value="lesson.contentType || 'lesson'" severity="info" />
                            <Button
                              :label="t('instructor.open')"
                              class="p-button-text"
                              icon="pi pi-external-link"
                              @click="openLessonPreview(lesson.id)"
                            />
                          </div>
                        </div>
                      </li>
                    </ul>
                  </Panel>
                </div>
                <div v-else class="empty-state">
                  {{ t('instructorGroup.noModules') }}
                </div>
              </div>
              <div v-else class="empty-state">
              {{ t('instructorGroup.courseTabHint') }}
            </div>
          </div>
        </TabPanel>
        <TabPanel :header="t('instructor.tabs.liveSessions')">
          <div v-if="liveTabLoading" class="live-tab-skeleton">
            <Skeleton height="2.5rem" class="mb-2" />
            <Skeleton height="12rem" class="mb-2" />
            <Skeleton height="20rem" />
          </div>
          <div v-else-if="liveTabError" class="empty-state">
            <p>{{ t('liveSessions.loadError') }}</p>
            <Button
              :label="t('liveSessions.actions.reloadTab')"
              icon="pi pi-refresh"
              class="p-button-text"
              @click="ensureLiveTabData(true)"
            />
          </div>
          <div v-else class="live-tab">
            <div class="readonly-live-sessions">
              <div class="readonly-toolbar">
                <div>
                  <h3>Sesiones programadas</h3>
                  <small class="muted">Consulta tus próximas clases y enlaces de acceso.</small>
                </div>
                <div class="readonly-actions">
                  <Calendar
                    v-model="readonlyRangeValue"
                    selectionMode="range"
                    showIcon
                    dateFormat="yy-mm-dd"
                    placeholder="Selecciona día o rango"
                  />
                  <Button
                    icon="pi pi-check"
                    label="Aplicar"
                    class="p-button-text"
                    @click="applyReadonlyRange"
                  />
                  <Button
                    icon="pi pi-times"
                    label="Limpiar"
                    class="p-button-text"
                    @click="clearReadonlyRange"
                  />
                  <Button
                    icon="pi pi-refresh"
                    label="Recargar"
                    class="p-button-text"
                    :loading="sessionsLoading"
                    @click="loadSessions"
                  />
                </div>
              </div>

              <div v-if="!readonlySessions.length" class="empty-state">
                <p>No hay sesiones programadas para este grupo.</p>
              </div>

              <div v-else class="readonly-session-grid">
                <article
                  v-for="session in readonlySessions"
                  :key="session.id"
                  class="readonly-session-card"
                  :class="`is-${session.displayStatus}`"
                >
                  <div class="session-leading-icon">
                    <i
                      class="pi"
                      :class="
                        session.displayStatus === 'live'
                          ? 'pi-video'
                          : session.displayStatus === 'past'
                            ? 'pi-check-circle'
                            : 'pi-calendar-clock'
                      "
                    />
                  </div>

                  <div class="session-main">
                    <div class="session-topline">
                      <Tag :value="session.statusLabel" :severity="session.statusSeverity" />
                      <Tag :value="session.classTypeName || 'Live'" severity="info" />
                    </div>
                    <h4>{{ session.title || 'Clase en vivo' }}</h4>
                    <div class="session-details">
                      <span><i class="pi pi-calendar" /> {{ session.dateLabel }}</span>
                      <span><i class="pi pi-clock" /> {{ session.timeLabel }}</span>
                      <span><i class="pi pi-user" /> {{ session.hostTeacherName || 'Instructor pendiente' }}</span>
                    </div>
                  </div>

                  <div class="session-actions">
                    <Button
                      icon="pi pi-sign-in"
                      :label="session.displayStatus === 'past' ? 'Cerrada' : 'Ingresar'"
                      class="p-button-text"
                      :disabled="session.displayStatus === 'past' || !session.joinUrl"
                      @click="openJoinLink(session.joinUrl)"
                    />
                    <a
                      v-if="session.joinUrl"
                      class="session-link"
                      :href="session.joinUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      :title="session.joinUrl"
                    >
                      {{ session.joinUrl }}
                    </a>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </TabPanel>
      </TabView>
    </template>
  </Card>
    <Dialog
      v-model:visible="studentProgressDrawerVisible"
      modal
      position="right"
      :draggable="false"
      :header="t('instructorGroup.detailDrawer.title')"
      class="student-progress-drawer"
      :style="{ width: 'min(36rem, 100vw)' }"
    >
      <div v-if="selectedStudent" class="student-progress-detail">
        <div class="student-detail-header">
          <div>
            <h3>{{ selectedStudent.fullName }}</h3>
            <p>{{ selectedStudent.email }}</p>
          </div>
          <Tag
            :value="presenceLabel(selectedStudent)"
            :severity="presenceSeverity(selectedStudent)"
            :icon="getStudentPresence(selectedStudent.id)?.isOnline ? 'pi pi-circle-fill' : undefined"
          />
        </div>

        <div v-if="studentProgressLoading" class="student-detail-loading">
          <Skeleton height="4rem" class="mb-2" />
          <Skeleton height="6rem" class="mb-2" />
          <Skeleton height="6rem" />
        </div>

        <div v-else-if="studentProgressError" class="empty-state">
          <p>{{ t('instructorGroup.detailDrawer.loadError') }}</p>
          <Button
            :label="t('instructorGroup.reload')"
            icon="pi pi-refresh"
            class="p-button-text"
            @click="loadStudentProgressDetail(selectedStudent)"
          />
        </div>

        <template v-else-if="studentProgressDetail">
          <div class="student-progress-summary">
            <div>
              <small>{{ t('instructorGroup.detailDrawer.completed') }}</small>
              <strong>
                {{ studentProgressDetail.completedLessons }} / {{ studentProgressDetail.totalLessons }}
              </strong>
            </div>
            <div>
              <small>{{ t('instructorGroup.detailDrawer.progress') }}</small>
              <strong>{{ studentProgressDetail.percent }}%</strong>
            </div>
          </div>

          <ProgressBar :value="studentProgressDetail.percent" class="student-detail-progressbar" />

          <div v-if="studentProgressDetail.modules?.length" class="student-modules">
            <section
              v-for="module in studentProgressDetail.modules"
              :key="module.id"
              class="student-module"
            >
              <h4>{{ module.title }}</h4>
              <div class="student-lessons">
                <article
                  v-for="lesson in module.lessons"
                  :key="lesson.id"
                  class="student-lesson-row"
                >
                  <div class="student-lesson-main">
                    <span class="student-lesson-title">{{ lesson.title }}</span>
                    <span class="student-lesson-meta">
                      {{ lesson.contentType || 'lesson' }}
                      <template v-if="lesson.lastSeenAt">
                        - {{ formatLastActivity(lesson.lastSeenAt) }}
                      </template>
                    </span>
                  </div>
                  <div class="student-lesson-status">
                    <Tag
                      :value="lessonStatusLabel(lesson.status)"
                      :severity="lessonStatusSeverity(lesson.status)"
                    />
                    <span v-if="lesson.bestQuizScore !== null" class="student-quiz-score">
                      {{ t('instructorGroup.detailDrawer.quiz') }} {{ formatScore(lesson.bestQuizScore) }}
                    </span>
                  </div>
                </article>
              </div>
            </section>
          </div>

          <div v-else class="empty-state">
            {{ t('instructorGroup.detailDrawer.noLessons') }}
          </div>
        </template>
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { computed, ref, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import api from '../api/axios';
import {
  listGroupSessions,
} from '../api/liveSessions';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { t } = useI18n();

const group = ref(null);
const students = ref([]);
const presenceByStudentId = ref({});
const presenceLoading = ref(false);
const loading = ref(true);
const error = ref(false);
const permissionError = ref(false);
const permissionMessage = ref(t('instructorGroup.permissionMessage'));
const filter = ref('');
const activeTab = ref(0);
const studentProgressDrawerVisible = ref(false);
const selectedStudent = ref(null);
const studentProgressDetail = ref(null);
const studentProgressLoading = ref(false);
const studentProgressError = ref(false);
const courseDetail = ref(null);
const courseLoading = ref(false);
const courseError = ref(false);
const classTypes = ref([]);
const classTypesLoaded = ref(false);
const groupTeachers = ref([]);
const liveSeries = ref([]);
const liveSessions = ref([]);
const seriesLoading = ref(false);
const sessionsLoading = ref(false);
const liveTabLoading = ref(false);
const liveTabError = ref(false);
const liveTabLoaded = ref(false);
const seriesDialogVisible = ref(false);
const editingSeries = ref(null);
const savingSeries = ref(false);
const publishLoadingId = ref(null);
const generatingSeriesId = ref(null);
const regeneratingSeriesId = ref(null);
const deletingSeriesId = ref(null);
const editingLiveSession = ref(null);
const liveSessionEditDialogVisible = ref(false);
const savingLiveSessionEdit = ref(false);
const defaultSessionRange = () => {
  const from = new Date();
  from.setDate(from.getDate() - 7);
  const to = new Date();
  to.setDate(to.getDate() + 28);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
};
const sessionRange = ref(defaultSessionRange());
const readonlyRangeValue = ref([]);
const courseModules = computed(() => courseDetail.value?.modules || []);
const PRESENCE_REFRESH_MS = 60000;
let presenceRefreshTimer = null;

const formatLiveSessionDate = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatLiveSessionTimeRange = (session) => {
  const startsAt = session.startsAt ? new Date(session.startsAt) : null;
  const endsAt = session.endsAt ? new Date(session.endsAt) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) return 'Hora pendiente';
  const start = startsAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (!endsAt || Number.isNaN(endsAt.getTime())) return start;
  return `${start} - ${endsAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
};

const resolveLiveSessionStatus = (session) => {
  const now = Date.now();
  const startsAt = session.startsAt ? new Date(session.startsAt).getTime() : null;
  const endsAt = session.endsAt ? new Date(session.endsAt).getTime() : null;
  if (startsAt && endsAt && startsAt <= now && endsAt >= now) return 'live';
  if (endsAt && endsAt < now) return 'past';
  return 'upcoming';
};

const readonlySessions = computed(() =>
  [...(liveSessions.value || [])]
    .sort((a, b) => new Date(a.startsAt || 0) - new Date(b.startsAt || 0))
    .map((session) => {
      const displayStatus = resolveLiveSessionStatus(session);
      return {
        ...session,
        displayStatus,
        dateLabel: formatLiveSessionDate(session.startsAt),
        timeLabel: formatLiveSessionTimeRange(session),
        statusLabel:
          displayStatus === 'live' ? 'Live' : displayStatus === 'past' ? 'Pasada' : 'Próxima',
        statusSeverity:
          displayStatus === 'live' ? 'success' : displayStatus === 'past' ? 'secondary' : 'info',
      };
    }),
);

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const applyReadonlyRange = () => {
  const [from, to] = readonlyRangeValue.value || [];
  if (!from) {
    clearReadonlyRange();
    return;
  }
  handleSessionsRangeChange({
    from: startOfDay(from).toISOString(),
    to: (to ? endOfDay(to) : endOfDay(from)).toISOString(),
  });
};

const clearReadonlyRange = () => {
  readonlyRangeValue.value = [];
  handleSessionsRangeChange({ from: null, to: null });
};

const openJoinLink = (url) => {
  if (!url) return;
  window.open(url, '_blank', 'noopener');
};

const resetLiveTabState = () => {
  liveSeries.value = [];
  liveSessions.value = [];
  groupTeachers.value = [];
  liveTabLoaded.value = false;
  liveTabError.value = false;
  seriesDialogVisible.value = false;
  editingSeries.value = null;
  publishLoadingId.value = null;
  generatingSeriesId.value = null;
  regeneratingSeriesId.value = null;
  deletingSeriesId.value = null;
  sessionRange.value = defaultSessionRange();
};

const loadData = async () => {
  loading.value = true;
  error.value = false;
  permissionError.value = false;
  courseDetail.value = null;
  courseError.value = false;

  try {
    const [groupsRes, analyticsRes] = await Promise.all([
      api.get('/instructor/groups'),
      api.get(`/groups/${route.params.id}/analytics`),
    ]);

    const availableGroups = groupsRes.data.map((g) => ({
      id: g.group_id,
      name: g.group_name,
      schedule_text: g.schedule_text,
      course_id: g.course_id,
      course_title: g.course_title,
    }));

    const matchedGroup = availableGroups.find((g) => g.id === route.params.id);
    if (!matchedGroup) {
      permissionError.value = true;
      permissionMessage.value = t('instructorGroup.permissionMessage');
      students.value = [];
      group.value = null;
      resetLiveTabState();
      return;
    }
    group.value = matchedGroup;

    students.value = (analyticsRes.data || []).map((row) => ({
      id: row.studentId,
      fullName: row.fullName,
      email: row.email,
      percent: row.percent,
      completedLessons: row.completedLessons,
      totalLessons: row.totalLessons,
      lastSeenAt: row.lastSeenAt,
      bestQuizScore: row.bestQuizScore,
      lastQuizScore: row.lastQuizScore,
    }));
    await loadPresence();

    if (activeTab.value === 1) {
      await loadCourseContent(true);
    } else if (activeTab.value === 2) {
      await ensureLiveTabData(true);
    }
  } catch (err) {
    if (err.response?.status === 403) {
      permissionError.value = true;
      permissionMessage.value = err.response?.data?.error || t('instructorGroup.permissionMessage');
    } else {
      error.value = true;
      toast.add({
        severity: 'error',
        summary: t('common.notifications.error'),
        detail: t('instructorGroup.loadError'),
        life: 3000,
      });
    }
  } finally {
    loading.value = false;
  }
};

const loadPresence = async () => {
  if (!group.value?.id) return;
  presenceLoading.value = true;
  try {
    const { data } = await api.get(`/groups/${group.value.id}/presence`);
    const rows = Array.isArray(data?.students) ? data.students : [];
    const nextMap = {};
    rows.forEach((row) => {
      if (!row?.studentId) return;
      nextMap[row.studentId] = {
        isOnline: Boolean(row.isOnline),
        lastSeenAt: row.lastSeenAt || null,
      };
    });
    presenceByStudentId.value = nextMap;
  } catch (err) {
    console.error('Failed to load presence', err);
  } finally {
    presenceLoading.value = false;
  }
};

const clearPresenceRefreshTimer = () => {
  if (presenceRefreshTimer) {
    clearInterval(presenceRefreshTimer);
    presenceRefreshTimer = null;
  }
};

const startPresenceRefreshTimer = () => {
  clearPresenceRefreshTimer();
  if (activeTab.value !== 0) return;
  presenceRefreshTimer = setInterval(() => {
    loadPresence();
  }, PRESENCE_REFRESH_MS);
};

const goBack = () => {
  router.push('/instructor');
};

const openLessonPreview = (lessonId) => {
  if (!group.value?.course_id) return;
  const routeData = router.resolve({
    path: `/student/course/${group.value.course_id}/lesson/${lessonId}`,
    query: { preview: '1' },
  });
  window.open(routeData.href, '_blank', 'noopener');
};

const openStudentProgressDrawer = (student) => {
  selectedStudent.value = student;
  studentProgressDrawerVisible.value = true;
  loadStudentProgressDetail(student);
};

const loadStudentProgressDetail = async (student) => {
  if (!group.value?.id || !student?.id) return;
  studentProgressLoading.value = true;
  studentProgressError.value = false;
  try {
    const { data } = await api.get(`/groups/${group.value.id}/students/${student.id}/progress`);
    studentProgressDetail.value = data;
  } catch (err) {
    console.error('Failed to load student progress detail', err);
    studentProgressError.value = true;
    studentProgressDetail.value = null;
  } finally {
    studentProgressLoading.value = false;
  }
};

const filteredStudents = computed(() => {
  const term = filter.value.trim().toLowerCase();
  const sorted = [...students.value].sort((a, b) => (b.percent || 0) - (a.percent || 0));
  if (!term) return sorted;

  return sorted.filter((s) => {
    const name = (s.fullName || '').toLowerCase();
    const email = (s.email || '').toLowerCase();
    return name.includes(term) || email.includes(term);
  });
});

const totalStudents = computed(() => students.value.length);

const averagePercent = computed(() => {
  if (!students.value.length) return 0;
  const sum = students.value.reduce((acc, s) => acc + (s.percent || 0), 0);
  return Math.round(sum / students.value.length);
});

const formatLastActivity = (value) => {
  if (!value) return t('instructorGroup.neverAccessed');
  const date = new Date(value);
  return date.toLocaleString();
};

const formatScore = (value) => {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${value}%`;
};

const lessonStatusLabel = (status) => {
  if (status === 'done') return t('instructorGroup.detailDrawer.status.done');
  if (status === 'in_progress') return t('instructorGroup.detailDrawer.status.inProgress');
  return t('instructorGroup.detailDrawer.status.notStarted');
};

const lessonStatusSeverity = (status) => {
  if (status === 'done') return 'success';
  if (status === 'in_progress') return 'info';
  return 'secondary';
};

const getStudentPresence = (studentId) => presenceByStudentId.value?.[studentId] || null;

const presenceLabel = (student) => {
  const presence = getStudentPresence(student.id);
  if (presence?.isOnline) return t('instructorGroup.onlineNow');
  const lastSeenAt = presence?.lastSeenAt || student.lastSeenAt;
  if (!lastSeenAt) return t('instructorGroup.neverAccessed');
  return t('instructorGroup.lastSeenAgo', { value: formatRelativeTime(lastSeenAt) });
};

const presenceSeverity = (student) => {
  const presence = getStudentPresence(student.id);
  if (presence?.isOnline) return 'success';
  const lastSeenAt = presence?.lastSeenAt || student.lastSeenAt;
  if (!lastSeenAt) return 'warning';
  return 'secondary';
};

const formatRelativeTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return '—';
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
};

const loadCourseContent = async (force = false) => {
  if (!group.value?.course_id) {
    return;
  }
  if (courseDetail.value && !force) {
    return;
  }
  courseLoading.value = true;
  courseError.value = false;
  try {
    const { data } = await api.get(`/courses/${group.value.course_id}?preview=1`);
    courseDetail.value = data;
  } catch (err) {
    console.error('Failed to load course content', err);
    courseError.value = true;
  } finally {
    courseLoading.value = false;
  }
};

const loadClassTypes = async ({ showToast = true } = {}) => {
  if (classTypesLoaded.value) {
    return;
  }
  try {
    classTypes.value = await getClassTypes();
    classTypesLoaded.value = true;
  } catch (err) {
    console.error('Failed to load class types', err);
    if (showToast) {
      toast.add({
        severity: 'error',
        summary: t('common.notifications.error'),
        detail: t('liveSessions.toasts.loadFailed'),
        life: 3000,
      });
    }
    throw err;
  }
};

const loadGroupTeachersList = async ({ showToast = true } = {}) => {
  if (!group.value?.id) return;
  try {
    groupTeachers.value = await getGroupTeachers(group.value.id);
  } catch (err) {
    console.error('Failed to load group teachers', err);
    if (showToast) {
      toast.add({
        severity: 'error',
        summary: t('common.notifications.error'),
        detail: t('liveSessions.toasts.loadFailed'),
        life: 3000,
      });
    }
    throw err;
  }
};

const loadSeries = async ({ showToast = true } = {}) => {
  if (!group.value?.id) return;
  seriesLoading.value = true;
  try {
    liveSeries.value = await listGroupSeries(group.value.id);
  } catch (err) {
    console.error('Failed to load live session series', err);
    if (showToast) {
      toast.add({
        severity: 'error',
        summary: t('common.notifications.error'),
        detail: t('liveSessions.toasts.seriesLoadFailed'),
        life: 3000,
      });
    }
    throw err;
  } finally {
    seriesLoading.value = false;
  }
};

const loadSessions = async ({ showToast = true } = {}) => {
  if (!group.value?.id) return;
  sessionsLoading.value = true;
  const params = {};
  if (sessionRange.value?.from) {
    params.from = sessionRange.value.from;
  }
  if (sessionRange.value?.to) {
    params.to = sessionRange.value.to;
  }
  try {
    liveSessions.value = await listGroupSessions(group.value.id, params);
  } catch (err) {
    console.error('Failed to load live sessions', err);
    if (showToast) {
      toast.add({
        severity: 'error',
        summary: t('common.notifications.error'),
        detail: t('liveSessions.toasts.sessionsLoadFailed'),
        life: 3000,
      });
    }
    throw err;
  } finally {
    sessionsLoading.value = false;
  }
};

const ensureLiveTabData = async (force = false) => {
  if (!group.value?.id) {
    return;
  }
  if (liveTabLoading.value) {
    return;
  }
  if (liveTabLoaded.value && !force) {
    return;
  }
  liveTabLoading.value = true;
  liveTabError.value = false;
  try {
    await loadSessions({ showToast: false });
    liveTabLoaded.value = true;
  } catch (err) {
    liveTabError.value = true;
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: t('liveSessions.loadError'),
      life: 3500,
    });
  } finally {
    liveTabLoading.value = false;
  }
};

const openCreateSeries = () => {
  editingSeries.value = null;
  seriesDialogVisible.value = true;
};

const openEditSeries = (series) => {
  editingSeries.value = series || null;
  seriesDialogVisible.value = true;
};

const handleSeriesSubmit = async (payload) => {
  if (!group.value?.id) return;
  savingSeries.value = true;
  try {
    if (editingSeries.value) {
      await updateSeries(editingSeries.value.id, payload);
      toast.add({
        severity: 'success',
        summary: t('common.notifications.success'),
        detail: t('liveSessions.toasts.seriesUpdated'),
        life: 2500,
      });
    } else {
      await createSeries(group.value.id, payload);
      toast.add({
        severity: 'success',
        summary: t('common.notifications.success'),
        detail: t('liveSessions.toasts.seriesCreated'),
        life: 2500,
      });
    }
    seriesDialogVisible.value = false;
    editingSeries.value = null;
    await loadSeries();
  } catch (err) {
    console.error('Failed to save series', err);
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: err.response?.data?.error || t('liveSessions.toasts.saveFailed'),
      life: 3500,
    });
  } finally {
    savingSeries.value = false;
  }
};

const handlePublishToggle = async ({ series, value }) => {
  if (!series) return;
  publishLoadingId.value = series.id;
  try {
    if (value) {
      await publishSeries(series.id);
      toast.add({
        severity: 'success',
        summary: t('common.notifications.success'),
        detail: t('liveSessions.toasts.seriesPublished'),
        life: 2500,
      });
    } else {
      await unpublishSeries(series.id);
      toast.add({
        severity: 'info',
        summary: t('common.notifications.info'),
        detail: t('liveSessions.toasts.seriesUnpublished'),
        life: 2500,
      });
    }
    await loadSeries();
  } catch (err) {
    console.error('Failed to toggle publish state', err);
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: err.response?.data?.error || t('liveSessions.toasts.publishFailed'),
      life: 3500,
    });
  } finally {
    publishLoadingId.value = null;
  }
};

const handleGenerateSeries = async (series) => {
  if (!series) return;
  generatingSeriesId.value = series.id;
  try {
    const result = await generateSeries(series.id, { weeks: 8 });
    toast.add({
      severity: 'success',
      summary: t('common.notifications.success'),
      detail: t('liveSessions.toasts.sessionsGenerated', { count: result?.created || 0 }),
      life: 3500,
    });
    await loadSessions();
  } catch (err) {
    console.error('Failed to generate sessions', err);
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: err.response?.data?.error || t('liveSessions.toasts.generateFailed'),
      life: 3500,
    });
  } finally {
    generatingSeriesId.value = null;
  }
};

const handleRegenerateSeries = async (series) => {
  if (!series) return;
  const confirmed = window.confirm(t('liveSessions.confirmRegenerateSeries'));
  if (!confirmed) return;
  regeneratingSeriesId.value = series.id;
  try {
    const result = await regenerateSeries(series.id, { weeks: 8 });
    toast.add({
      severity: 'success',
      summary: t('common.notifications.success'),
      detail: t('liveSessions.toasts.sessionsRegenerated', {
        created: result?.created || 0,
        deleted: result?.deleted || 0,
      }),
      life: 3500,
    });
    await loadSessions();
  } catch (err) {
    console.error('Failed to regenerate sessions', err);
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: err.response?.data?.error || t('liveSessions.toasts.generateFailed'),
      life: 3500,
    });
  } finally {
    regeneratingSeriesId.value = null;
  }
};

const openSessionEditDialog = (session) => {
  if (!session?.id) return;
  editingLiveSession.value = session;
  liveSessionEditDialogVisible.value = true;
};

watch(liveSessionEditDialogVisible, (visible) => {
  if (!visible) {
    editingLiveSession.value = null;
  }
});

const handleSessionEditSubmit = async ({ sessionId, payload }) => {
  if (!sessionId) {
    return;
  }
  savingLiveSessionEdit.value = true;
  try {
    await updateSession(sessionId, payload);
    toast.add({
      severity: 'success',
      summary: t('common.notifications.success'),
      detail: t('liveSessions.toasts.sessionUpdated'),
      life: 3000,
    });
    await loadSessions();
    liveSessionEditDialogVisible.value = false;
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: err?.response?.data?.error || t('liveSessions.toasts.sessionUpdateFailed'),
      life: 3500,
    });
  } finally {
    savingLiveSessionEdit.value = false;
  }
};

const handleDeleteSeries = async (series) => {
  if (!series) return;
  const confirmed = window.confirm(t('liveSessions.confirmDeleteSeries'));
  if (!confirmed) {
    return;
  }
  deletingSeriesId.value = series.id;
  try {
    await deleteSeries(series.id);
    toast.add({
      severity: 'success',
      summary: t('common.notifications.success'),
      detail: t('liveSessions.toasts.seriesDeleted'),
      life: 3500,
    });
    await loadSeries();
    await loadSessions();
  } catch (err) {
    console.error('Failed to delete live session series', err);
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: err.response?.data?.error || t('liveSessions.toasts.deleteFailed'),
      life: 3500,
    });
  } finally {
    deletingSeriesId.value = null;
  }
};

const handleSessionsRangeChange = (range) => {
  if (!range?.from || !range?.to) {
    sessionRange.value = defaultSessionRange();
  } else {
    sessionRange.value = range;
  }
  loadSessions();
};

const onTabChange = (event) => {
  activeTab.value = event.index;
  startPresenceRefreshTimer();
  if (event.index === 1) {
    loadCourseContent();
  } else if (event.index === 2) {
    ensureLiveTabData();
  } else if (event.index === 0) {
    loadPresence();
  }
};

onMounted(() => {
  loadData();
  startPresenceRefreshTimer();
});

watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      resetLiveTabState();
      presenceByStudentId.value = {};
      studentProgressDrawerVisible.value = false;
      selectedStudent.value = null;
      studentProgressDetail.value = null;
      loadData();
      startPresenceRefreshTimer();
    }
  },
);

onBeforeUnmount(() => {
  clearPresenceRefreshTimer();
});
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary {
  display: flex;
  gap: 2rem;
  margin-bottom: 1rem;
}

.summary small {
  display: block;
  color: #6b7280;
  font-size: 0.85rem;
}

.summary strong {
  font-size: 1.25rem;
}

.table-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.control-label {
  font-size: 0.85rem;
  color: #6b7280;
}

.progress-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pct {
  width: 3ch;
  text-align: right;
  color: #6b7280;
  font-size: 0.85rem;
}

.activity-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.empty-state {
  margin-top: 1rem;
  color: #6b7280;
}

.course-content-tab {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.course-summary h3 {
  margin: 0 0 0.25rem;
}

.module-panel {
  margin-bottom: 0.75rem;
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.lesson-list {
  list-style: none;
  padding: 0.25rem 0 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lesson-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.lesson-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.live-tab {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.live-tab-skeleton > * {
  display: block;
}

.readonly-live-sessions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.readonly-toolbar {
  align-items: flex-start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.readonly-toolbar h3 {
  margin: 0;
}

.readonly-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: flex-end;
}

.readonly-session-grid {
  display: grid;
  gap: 0.85rem;
}

.readonly-session-card {
  align-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: grid;
  gap: 1rem;
  grid-template-columns: auto minmax(0, 1fr) auto;
  padding: 1rem;
}

.readonly-session-card.is-live {
  border-color: #22c55e;
}

.session-leading-icon {
  align-items: center;
  background: #eef2ff;
  border-radius: 8px;
  color: #4338ca;
  display: inline-flex;
  height: 2.5rem;
  justify-content: center;
  width: 2.5rem;
}

.session-main {
  min-width: 0;
}

.session-main h4 {
  margin: 0.45rem 0;
}

.session-topline,
.session-details,
.session-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.session-details span {
  align-items: center;
  color: #4b5563;
  display: inline-flex;
  gap: 0.3rem;
}

.session-actions {
  justify-content: flex-end;
  max-width: 18rem;
}

.session-link {
  color: #2563eb;
  display: block;
  max-width: 18rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.student-progress-drawer) {
  margin: 0;
  height: 100vh;
  max-height: 100vh;
  border-radius: 0;
}

:deep(.student-progress-drawer .p-dialog-content) {
  height: calc(100vh - 4rem);
  overflow-y: auto;
}

.student-progress-detail {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.student-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.student-detail-header h3 {
  margin: 0 0 0.25rem;
  color: #111827;
}

.student-detail-header p {
  margin: 0;
  color: #6b7280;
}

.student-detail-loading {
  display: flex;
  flex-direction: column;
}

.student-progress-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.student-progress-summary > div {
  padding: 0.85rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #f9fafb;
}

.student-progress-summary small {
  display: block;
  color: #6b7280;
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}

.student-progress-summary strong {
  color: #111827;
  font-size: 1.25rem;
}

.student-detail-progressbar {
  height: 0.65rem;
}

.student-modules,
.student-lessons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.student-module h4 {
  margin: 0 0 0.75rem;
  color: #111827;
}

.student-lesson-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.85rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #fff;
}

.student-lesson-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.student-lesson-title {
  color: #111827;
  font-weight: 600;
}

.student-lesson-meta,
.student-quiz-score {
  color: #6b7280;
  font-size: 0.85rem;
}

.student-lesson-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .readonly-toolbar {
    flex-direction: column;
  }

  .readonly-actions {
    justify-content: flex-start;
    width: 100%;
  }

  .readonly-session-card {
    align-items: flex-start;
    grid-template-columns: auto minmax(0, 1fr);
  }

  .session-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .student-detail-header,
  .student-lesson-row {
    flex-direction: column;
  }

  .student-progress-summary {
    grid-template-columns: 1fr;
  }

  .student-lesson-status {
    align-items: flex-start;
  }
}
</style>

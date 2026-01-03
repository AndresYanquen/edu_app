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
            <SeriesTable
              :series="liveSeries"
              :modules="courseModules"
              :loading="seriesLoading"
              :publishLoadingId="publishLoadingId"
              :generatingId="generatingSeriesId"
              :deletingId="deletingSeriesId"
              @create="openCreateSeries"
              @edit="openEditSeries"
              @toggle-publish="handlePublishToggle"
              @generate="handleGenerateSeries"
              @delete-series="handleDeleteSeries"
            />
            <SessionsTable
              :sessions="liveSessions"
              :loading="sessionsLoading"
              :classTypes="classTypes"
              :modules="courseModules"
              :teachers="groupTeachers"
              :range="sessionRange"
              @refresh="loadSessions"
              @range-change="handleSessionsRangeChange"
            />
          </div>
        </TabPanel>
      </TabView>
    </template>
  </Card>
    <SeriesFormDialog
      v-model:visible="seriesDialogVisible"
      :loading="savingSeries"
      :modules="courseModules"
      :classTypes="classTypes"
      :teachers="groupTeachers"
      :editing="editingSeries"
      @submit="handleSeriesSubmit"
    />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import api from '../api/axios';
import SeriesTable from '../components/live/SeriesTable.vue';
import SeriesFormDialog from '../components/live/SeriesFormDialog.vue';
import SessionsTable from '../components/live/SessionsTable.vue';
import {
  getClassTypes,
  getGroupTeachers,
  listGroupSeries,
  createSeries,
  updateSeries,
  publishSeries,
  unpublishSeries,
  generateSeries,
  deleteSeries,
  listGroupSessions,
} from '../api/liveSessions';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { t } = useI18n();

const group = ref(null);
const students = ref([]);
const loading = ref(true);
const error = ref(false);
const permissionError = ref(false);
const permissionMessage = ref(t('instructorGroup.permissionMessage'));
const filter = ref('');
const activeTab = ref(0);
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
const deletingSeriesId = ref(null);
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
const courseModules = computed(() => courseDetail.value?.modules || []);

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
      lastSeenAt: row.lastSeenAt,
      bestQuizScore: row.bestQuizScore,
      lastQuizScore: row.lastQuizScore,
    }));

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
    await loadClassTypes({ showToast: false });
    await loadCourseContent();
    await loadGroupTeachersList({ showToast: false });
    await Promise.all([
      loadSeries({ showToast: false }),
      loadSessions({ showToast: false }),
    ]);
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
  if (event.index === 1) {
    loadCourseContent();
  } else if (event.index === 2) {
    ensureLiveTabData();
  }
};

onMounted(() => {
  loadData();
});

watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      resetLiveTabState();
      loadData();
    }
  },
);
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
</style>

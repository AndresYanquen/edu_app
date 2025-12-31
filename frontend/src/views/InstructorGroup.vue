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
        </TabView>
      </template>
    </Card>
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

const onTabChange = (event) => {
  activeTab.value = event.index;
  if (event.index === 1) {
    loadCourseContent();
  }
};

onMounted(() => {
  loadData();
});

watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) loadData();
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
</style>

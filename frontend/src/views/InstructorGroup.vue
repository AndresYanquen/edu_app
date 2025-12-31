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
      </template>
    </Card>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';
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

const loadData = async () => {
  loading.value = true;
  error.value = false;
  permissionError.value = false;

  try {
    const [groupsRes, analyticsRes] = await Promise.all([
      api.get('/instructor/groups'),
      api.get(`/groups/${route.params.id}/analytics`),
    ]);

    const availableGroups = groupsRes.data.map((g) => ({
      id: g.group_id,
      name: g.group_name,
      schedule_text: g.schedule_text,
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
</style>

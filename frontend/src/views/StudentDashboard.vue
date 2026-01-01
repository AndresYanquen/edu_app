<template>
  <div class="page">
    <Card>
      <template #title>{{ t('student.title') }}</template>
      <template #content>
        <div v-if="loading">
          <Skeleton height="3rem" class="mb-2" />
          <Skeleton height="3rem" class="mb-2" />
        </div>
        <div v-else-if="error">
          <p>{{ t('student.loadError') }}</p>
          <Button
            :label="t('student.reload')"
            icon="pi pi-refresh"
            class="p-button-text"
            @click="loadCourses"
          />
        </div>
        <div v-else-if="courses.length">
          <DataTable :value="courses" responsiveLayout="scroll">
            <Column field="title" :header="t('student.columns.title')" />
            <Column field="level" :header="t('student.columns.level')" />
            <Column :header="t('student.columns.status')">
              <template #body="{ data }">
                <Tag
                  :value="statusLabel(data.status)"
                  :severity="statusSeverity(data.status)"
                />
              </template>
            </Column>
            <Column :header="t('student.columns.actions')">
              <template #body="{ data }">
                <Button :label="t('student.open')" icon="pi pi-arrow-right" @click="openCourse(data.id)" />
              </template>
            </Column>
          </DataTable>
        </div>
        <div v-else>
          <Card class="empty-card">
            <template #content>
              <div class="empty-card-content">
                <i class="pi pi-book"></i>
                <div>
                  <h4>{{ t('student.emptyTitle') }}</h4>
                  <p>{{ t('student.emptyDescription') }}</p>
                </div>
              </div>
            </template>
          </Card>
        </div>
      </template>
    </Card>
    <Card class="mt-card">
      <template #title>{{ t('student.liveSessions.title') }}</template>
      <template #content>
        <div v-if="sessionsLoading">
          <Skeleton height="3rem" class="mb-2" />
          <Skeleton height="3rem" class="mb-2" />
        </div>
        <div v-else-if="!liveSessions.length">
          <p class="muted-text">{{ t('student.liveSessions.empty') }}</p>
        </div>
        <div v-else class="session-list">
          <div v-for="session in liveSessions" :key="session.id" class="session-row">
            <div class="session-time">
              <strong>{{ formatSessionDate(session.startsAt) }}</strong>
              <small>{{ formatSessionRange(session.startsAt, session.endsAt) }}</small>
            </div>
            <div class="session-details">
              <div class="session-title">{{ session.title }}</div>
              <div class="session-meta">
                <Tag :value="session.classTypeName || t('student.liveSessions.unknownType')" severity="info" />
                <span>{{ session.hostTeacherName }}</span>
                <Divider layout="vertical" />
                <span>{{ session.groupName }}</span>
              </div>
            </div>
            <div class="session-action">
              <Button
                :label="t('student.liveSessions.join')"
                icon="pi pi-external-link"
                class="p-button-text"
                :disabled="!session.joinUrl"
                @click="joinSession(session.joinUrl)"
              />
            </div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';
import api from '../api/axios';
import { mySessions } from '../api/liveSessions';

const courses = ref([]);
const loading = ref(true);
const error = ref(false);
const liveSessions = ref([]);
const sessionsLoading = ref(true);
const router = useRouter();
const toast = useToast();
const { t } = useI18n();

const statusSeverity = (status) => {
  if (!status) return 'info';
  const normalized = String(status).toUpperCase();
  if (normalized === 'PUBLISHED') return 'success';
  if (normalized === 'DRAFT') return 'warning';
  if (normalized === 'IN_PROGRESS') return 'info';
  if (normalized === 'COMPLETED') return 'success';
  return 'info';
};

const statusLabel = (status) => {
  if (!status) return '';
  const key = String(status).toLowerCase();
  const translationKey = `student.status.${key}`;
  const translated = t(translationKey);
  return translated === translationKey ? status : translated;
};

const openCourse = (id) => {
  router.push(`/student/course/${id}`);
};

const loadCourses = async () => {
  loading.value = true;
  error.value = false;
  try {
    const { data } = await api.get('/me/courses');
    courses.value = data;
  } catch (err) {
    error.value = true;
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: t('student.toastError'),
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const loadLiveSessions = async () => {
  sessionsLoading.value = true;
  try {
    const now = new Date();
    const from = now.toISOString();
    const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const data = await mySessions({ from, to });
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
          .slice(0, 5)
      : [];
    liveSessions.value = sanitized;
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: t('student.liveSessions.error'),
      life: 3000,
    });
  } finally {
    sessionsLoading.value = false;
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
  const startTime = startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const endTime = endDate
    ? endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';
  return endTime ? `${startTime} — ${endTime}` : startTime;
};

const joinSession = (url) => {
  if (!url) return;
  window.open(url, '_blank', 'noopener');
};

onMounted(() => {
  loadCourses();
  loadLiveSessions();
});
</script>

<style scoped>
.empty-card {
  text-align: center;
}

.empty-card-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.empty-card-content i {
  font-size: 2rem;
  color: #94a3b8;
}

.mt-card {
  margin-top: 1.5rem;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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


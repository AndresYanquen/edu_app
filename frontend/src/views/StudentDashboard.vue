<template>
  <div class="page">
    <section class="student-hero">
      <h1>{{ greetingTitle }}</h1>
      <p>{{ greetingSubtitle }}</p>
    </section>

    <Card class="pending-classes-card">
      <template #title>Clases pendientes esta semana</template>
      <template #content>
        <div v-if="loadingPendingSessions" class="pending-classes-loading">
          <Skeleton height="2.8rem" class="mb-2" />
          <Skeleton height="2.8rem" class="mb-2" />
        </div>
        <div v-else-if="pendingSessionsError" class="pending-classes-error">
          <p>No se pudieron cargar las clases de esta semana.</p>
          <Button
            label="Reintentar"
            icon="pi pi-refresh"
            class="p-button-text"
            @click="loadPendingSessions"
          />
        </div>
        <div v-else-if="!pendingSessions.length" class="pending-classes-empty">
          <i class="pi pi-calendar-times"></i>
          <p>No tienes clases pendientes para esta semana.</p>
        </div>
        <div v-else class="pending-classes-list">
          <div
            v-for="session in pendingSessions"
            :key="session.id"
            class="pending-class-item"
          >
            <div class="pending-class-item__main">
              <strong>{{ session.courseTitle || 'Clase en vivo' }}</strong>
              <small>
                {{ formatSessionDay(session.startsAt) }} · {{ formatSessionTime(session.startsAt, session.endsAt) }}
              </small>
              <small v-if="session.classTypeName">{{ session.classTypeName }}</small>
              <small v-if="session.hostTeacherName">Profesor: {{ session.hostTeacherName }}</small>
            </div>
            <div class="pending-class-item__actions">
              <Button
                v-if="session.joinUrl"
                label="Unirme"
                icon="pi pi-video"
                class="p-button-sm"
                @click="joinSession(session.joinUrl)"
              />
              <Button
                v-else-if="session.courseId"
                label="Ver curso"
                icon="pi pi-arrow-right"
                class="p-button-text p-button-sm"
                @click="openCourse(session.courseId)"
              />
            </div>
          </div>
        </div>
      </template>
    </Card>

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
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';
import api from '../api/axios';
import { useAuthStore } from '../stores/auth';
import { listMyLiveSessions } from '../api/liveSessions';

const courses = ref([]);
const loading = ref(true);
const error = ref(false);
const pendingSessions = ref([]);
const loadingPendingSessions = ref(true);
const pendingSessionsError = ref(false);
const router = useRouter();
const toast = useToast();
const { t } = useI18n();
const auth = useAuthStore();

const firstName = computed(() => {
  const rawName = String(auth.user?.fullName || auth.user?.full_name || '').trim();
  if (!rawName) {
    return 'there';
  }
  return rawName.split(/\s+/)[0];
});

const greetingTitle = computed(() => `Good morning, ${firstName.value} 👋`);
const greetingSubtitle = 'Welcome back. Pick up your priority learning for today.';

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

const getWeekBounds = () => {
  const now = new Date();
  const day = now.getDay();
  const mondayDiff = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + mondayDiff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end, now };
};

const formatSessionDay = (value) => {
  if (!value) return 'Fecha por definir';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha por definir';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatSessionTime = (startValue, endValue) => {
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;
  if (!start || Number.isNaN(start.getTime())) {
    return 'Hora por definir';
  }
  const startLabel = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (!end || Number.isNaN(end.getTime())) {
    return startLabel;
  }
  const endLabel = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${startLabel} - ${endLabel}`;
};

const joinSession = (url) => {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
};

const loadPendingSessions = async () => {
  loadingPendingSessions.value = true;
  pendingSessionsError.value = false;
  try {
    const { start, end, now } = getWeekBounds();
    const rows = await listMyLiveSessions({ from: start.toISOString(), to: end.toISOString() });
    const normalized = (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        id: row.id,
        startsAt: row.startsAt || row.starts_at || null,
        endsAt: row.endsAt || row.ends_at || null,
        joinUrl: row.joinUrl || row.join_url || null,
        courseId: row.courseId || row.course_id || null,
        courseTitle: row.courseTitle || row.course_title || '',
        classTypeName: row.classTypeName || row.class_type_name || '',
        hostTeacherName: row.hostTeacherName || row.host_teacher_name || '',
      }))
      .filter((row) => {
        const startsAt = row.startsAt ? new Date(row.startsAt) : null;
        if (!startsAt || Number.isNaN(startsAt.getTime())) return false;
        return startsAt >= now && startsAt < end;
      })
      .sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
    pendingSessions.value = normalized;
  } catch (err) {
    pendingSessionsError.value = true;
  } finally {
    loadingPendingSessions.value = false;
  }
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

onMounted(() => {
  loadCourses();
  loadPendingSessions();
});
</script>

<style scoped>
.student-hero {
  margin-bottom: 1.25rem;
}

.student-hero h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.5rem);
  line-height: 1.05;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #0f172a;
}

.student-hero p {
  margin: 0.55rem 0 0;
  font-size: 1.1rem;
  color: #334155;
}

.pending-classes-card {
  margin-bottom: 1rem;
}

.pending-classes-loading,
.pending-classes-error,
.pending-classes-empty {
  color: #64748b;
}

.pending-classes-empty {
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.pending-classes-list {
  display: grid;
  gap: 0.65rem;
}

.pending-class-item {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.75rem 0.9rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.pending-class-item__main {
  display: grid;
  gap: 0.15rem;
}

.pending-class-item__main strong {
  color: #0f172a;
}

.pending-class-item__main small {
  color: #64748b;
}

.pending-class-item__actions {
  display: flex;
  align-items: center;
}

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
</style>

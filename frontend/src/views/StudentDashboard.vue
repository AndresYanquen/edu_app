<template>
  <div class="page student-dashboard">
    <section class="student-hero">
      <div class="student-hero__content">
        <div class="student-hero__text">
          <span class="student-hero__eyebrow">Panel del estudiante</span>
          <h1>{{ greetingTitle }}</h1>
          <p>{{ greetingSubtitle }}</p>
        </div>

        <div class="student-hero__stats">
          <div class="hero-stat-card">
            <span class="hero-stat-card__label">Cursos</span>
            <strong>{{ courses.length }}</strong>
            <small>{{ courses.length === 1 ? 'curso disponible' : 'cursos disponibles' }}</small>
          </div>

          <div class="hero-stat-card">
            <span class="hero-stat-card__label">Esta semana</span>
            <strong>{{ pendingSessions.length }}</strong>
            <small>{{ pendingSessions.length === 1 ? 'clase pendiente' : 'clases pendientes' }}</small>
          </div>
        </div>
      </div>
    </section>

    <Card class="dashboard-card pending-classes-card">
      <template #title>
        <div class="card-title-row">
          <div>
            <h3>Clases pendientes esta semana</h3>
            <p>Revisa tus próximas sesiones en vivo.</p>
          </div>
        </div>
      </template>

      <template #content>
        <div v-if="loadingPendingSessions" class="pending-classes-loading">
          <Skeleton height="4.2rem" class="mb-3" borderRadius="16px" />
          <Skeleton height="4.2rem" class="mb-3" borderRadius="16px" />
        </div>

        <div v-else-if="pendingSessionsError" class="state-box state-box--error">
          <i class="pi pi-exclamation-circle"></i>
          <div>
            <strong>No se pudieron cargar las clases de esta semana.</strong>
            <p>Intenta nuevamente en unos segundos.</p>
          </div>
          <Button
            label="Reintentar"
            icon="pi pi-refresh"
            class="p-button-sm p-button-outlined"
            @click="loadPendingSessions"
          />
        </div>

        <div v-else-if="!pendingSessions.length" class="state-box state-box--empty">
          <i class="pi pi-calendar-times"></i>
          <div>
            <strong>No tienes clases pendientes esta semana</strong>
            <p>Puedes aprovechar este tiempo para avanzar en tus cursos disponibles.</p>
          </div>
        </div>

        <div v-else class="pending-classes-list">
          <div
            v-for="session in pendingSessions"
            :key="session.id"
            class="pending-class-item"
          >
            <div class="pending-class-item__date">
              <span>{{ formatSessionWeekday(session.startsAt) }}</span>
              <strong>{{ formatSessionDayNumber(session.startsAt) }}</strong>
            </div>

            <div class="pending-class-item__main">
              <strong>{{ session.courseTitle || 'Clase en vivo' }}</strong>
              <small>{{ formatSessionFullDate(session.startsAt) }}</small>
              <small>{{ formatSessionTime(session.startsAt, session.endsAt) }}</small>
              <small v-if="session.classTypeName">{{ session.classTypeName }}</small>
              <small v-if="session.hostTeacherName">Profesor: {{ session.hostTeacherName }}</small>
            </div>

            <div class="pending-class-item__actions">
              <Button
                v-if="session.joinUrl"
                label="Unirme"
                icon="pi pi-video"
                class="p-button-sm"
                :disabled="!isJoinEnabled(session)"
                @click="joinSession(session.joinUrl)"
              />
              <Button
                v-else-if="session.courseId"
                label="Ver curso"
                icon="pi pi-arrow-right"
                class="p-button-sm p-button-outlined"
                @click="openCourse(session.courseId)"
              />
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Card class="dashboard-card">
      <template #title>
        <div class="card-title-row">
          <div>
            <h3>{{ t('student.title') }}</h3>
            <p>Accede rápidamente a tus cursos y revisa su estado.</p>
          </div>
        </div>
      </template>

      <template #content>
        <div v-if="loading">
          <Skeleton height="3.2rem" class="mb-2" borderRadius="14px" />
          <Skeleton height="3.2rem" class="mb-2" borderRadius="14px" />
        </div>

        <div v-else-if="error" class="state-box state-box--error">
          <i class="pi pi-exclamation-triangle"></i>
          <div>
            <strong>{{ t('student.loadError') }}</strong>
            <p>Por favor vuelve a intentarlo.</p>
          </div>
          <Button
            :label="t('student.reload')"
            icon="pi pi-refresh"
            class="p-button-sm p-button-outlined"
            @click="loadCourses"
          />
        </div>

        <div v-else-if="courses.length">
          <!-- Desktop / Tablet -->
          <div class="courses-table-wrap courses-table-desktop">
            <DataTable
              :value="courses"
              responsiveLayout="scroll"
              class="courses-table"
            >
              <Column field="title" :header="t('student.columns.title')">
                <template #body="{ data }">
                  <div class="course-title-cell">
                    <strong>{{ data.title }}</strong>
                  </div>
                </template>
              </Column>

              <Column field="level" :header="t('student.columns.level')">
                <template #body="{ data }">
                  <span class="course-level-badge">{{ data.level || '—' }}</span>
                </template>
              </Column>

              <Column :header="t('student.columns.status')">
                <template #body="{ data }">
                  <Tag
                    :value="statusLabel(data.status)"
                    :severity="statusSeverity(data.status)"
                    rounded
                  />
                </template>
              </Column>

              <Column :header="t('student.columns.actions')">
                <template #body="{ data }">
                  <Button
                    :label="t('student.open')"
                    icon="pi pi-arrow-right"
                    class="p-button-sm"
                    @click="openCourse(data.id)"
                  />
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Mobile -->
          <div class="courses-mobile-list">
            <article
              v-for="course in courses"
              :key="course.id"
              class="course-mobile-card"
            >
              <div class="course-mobile-card__top">
                <div class="course-mobile-card__title-wrap">
                  <h4>{{ course.title }}</h4>
                </div>

                <Tag
                  :value="statusLabel(course.status)"
                  :severity="statusSeverity(course.status)"
                  rounded
                />
              </div>

              <div class="course-mobile-card__meta">
                <div class="course-mobile-card__meta-item">
                  <span>Nivel</span>
                  <strong>{{ course.level || '—' }}</strong>
                </div>

                <div class="course-mobile-card__meta-item">
                  <span>Estado</span>
                  <strong>{{ statusLabel(course.status) }}</strong>
                </div>
              </div>

              <div class="course-mobile-card__actions">
                <Button
                  :label="t('student.open')"
                  icon="pi pi-arrow-right"
                  class="p-button-sm"
                  @click="openCourse(course.id)"
                />
              </div>
            </article>
          </div>
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
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
const nowTick = ref(Date.now());
let nowIntervalId = null;

const router = useRouter();
const toast = useToast();
const { t } = useI18n();
const auth = useAuthStore();

const firstName = computed(() => {
  const rawName = String(auth.user?.fullName || auth.user?.full_name || '').trim();
  if (!rawName) return 'Estudiante';
  return rawName.split(/\s+/)[0];
});

const greetingByHour = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
});

const greetingTitle = computed(() => `${greetingByHour.value}, ${firstName.value} 👋`);
const greetingSubtitle = computed(() => 'Tu resumen de aprendizaje de hoy.');

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

const formatSessionWeekday = (value) => {
  if (!value) return '---';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '---';

  return date.toLocaleDateString('es-ES', {
    weekday: 'short',
  }).replace('.', '');
};

const formatSessionDayNumber = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return String(date.getDate()).padStart(2, '0');
};

const formatSessionFullDate = (value) => {
  if (!value) return 'Fecha por definir';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha por definir';

  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

const formatSessionTime = (startValue, endValue) => {
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;

  if (!start || Number.isNaN(start.getTime())) {
    return 'Hora por definir';
  }

  const startLabel = start.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (!end || Number.isNaN(end.getTime())) {
    return startLabel;
  }

  const endLabel = end.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${startLabel} - ${endLabel}`;
};

const joinSession = (url) => {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
};

const toSessionDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const isJoinEnabled = (session) => {
  if (!session?.joinUrl) return false;
  const startsAt = toSessionDate(session.startsAt);
  if (!startsAt) return false;

  const startMs = startsAt.getTime();
  const enableFromMs = startMs - 5 * 60 * 1000;
  const nowMs = nowTick.value;
  if (nowMs < enableFromMs) return false;

  const endsAt = toSessionDate(session.endsAt);
  if (!endsAt) return true;
  return nowMs <= endsAt.getTime();
};

const loadPendingSessions = async () => {
  loadingPendingSessions.value = true;
  pendingSessionsError.value = false;

  try {
    const { start, end, now } = getWeekBounds();
    const rows = await listMyLiveSessions({
      from: start.toISOString(),
      to: end.toISOString(),
    });

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
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

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
  nowIntervalId = setInterval(() => {
    nowTick.value = Date.now();
  }, 30 * 1000);
  loadCourses();
  loadPendingSessions();
});

onBeforeUnmount(() => {
  if (nowIntervalId) clearInterval(nowIntervalId);
});
</script>

<style scoped>
/* 🔥 FIX GLOBAL */
.student-dashboard,
.student-dashboard * {
  box-sizing: border-box;
}

.student-dashboard {
  display: grid;
  gap: 1.15rem;
  width: 100%;
  max-width: 100%;
}

/* =========================
   HERO
========================= */
.student-hero {
  width: 100%;
  max-width: 100%;
  border-radius: 22px;
  padding: 1.25rem;
  background: linear-gradient(135deg, #f8fafc 0%, #eef4ff 100%);
  border: 1px solid #e2e8f0;
}

.student-hero__content {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.student-hero__text {
  min-width: 0;
}

.student-hero__eyebrow {
  display: inline-flex;
  align-items: center;
  margin-bottom: 0.6rem;
  padding: 0.35rem 0.72rem;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1;
}

.student-hero h1 {
  margin: 0;
  font-size: clamp(1.9rem, 3vw, 2.55rem);
  line-height: 1.05;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #0f172a;
}

.student-hero p {
  margin: 0.45rem 0 0;
  font-size: 0.95rem;
  line-height: 1.45;
  color: #475569;
}

.student-hero__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.hero-stat-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 0.85rem 0.9rem;
  min-height: 92px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.22rem;
}

.hero-stat-card__label {
  display: block;
  font-size: 0.73rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  line-height: 1.1;
}

.hero-stat-card strong {
  display: block;
  font-size: 1.55rem;
  line-height: 1;
  font-weight: 800;
  color: #0f172a;
}

.hero-stat-card small {
  display: block;
  font-size: 0.8rem;
  line-height: 1.25;
  color: #64748b;
}

/* =========================
   CARDS / PRIMEVUE
========================= */
.dashboard-card {
  width: 100%;
  max-width: 100%;
  border-radius: 20px;
}

:deep(.p-card) {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

:deep(.p-card-body) {
  width: 100%;
  box-sizing: border-box;
  padding: 1.1rem;
}

:deep(.p-card-title) {
  margin-bottom: 0.8rem;
}

:deep(.p-card-content) {
  padding-top: 0;
}

.card-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.card-title-row h3 {
  margin: 0;
  font-size: 1.15rem;
  line-height: 1.2;
  font-weight: 800;
  color: #0f172a;
}

.card-title-row p {
  margin: 0.28rem 0 0;
  font-size: 0.9rem;
  line-height: 1.42;
  color: #64748b;
}

/* =========================
   STATES
========================= */
.state-box {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  border-radius: 16px;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  background: #fff;
}

.state-box i {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.state-box strong {
  display: block;
  margin-bottom: 0.18rem;
  color: #0f172a;
  line-height: 1.25;
}

.state-box p {
  margin: 0;
  color: #64748b;
  line-height: 1.45;
}

.state-box--empty {
  background: #f8fafc;
}

.state-box--error {
  background: #fff7ed;
  border-color: #fed7aa;
}

.state-box--error i {
  color: #ea580c;
}

/* =========================
   PENDING CLASSES
========================= */
.pending-classes-list {
  display: grid;
  gap: 0.85rem;
}

.pending-class-item {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.95rem;
  padding: 0.95rem;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #ffffff;
  width: 100%;
}

.pending-class-item__date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  padding: 0.72rem 0.5rem;
  background: #eff6ff;
  color: #1d4ed8;
  text-transform: capitalize;
  min-height: 80px;
}

.pending-class-item__date span {
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.1;
}

.pending-class-item__date strong {
  font-size: 1.25rem;
  line-height: 1;
}

.pending-class-item__main {
  display: grid;
  gap: 0.16rem;
  min-width: 0;
}

.pending-class-item__main strong {
  font-size: 0.98rem;
  line-height: 1.3;
  color: #0f172a;
}

.pending-class-item__main small {
  color: #64748b;
  line-height: 1.38;
}

.pending-class-item__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

/* =========================
   TABLE DESKTOP
========================= */
.courses-table-wrap {
  overflow-x: auto;
  border-radius: 16px;
}

.courses-table {
  min-width: 720px;
}

.course-title-cell strong {
  color: #0f172a;
  font-weight: 700;
}

/* =========================
   COURSES MOBILE
========================= */
.courses-mobile-list {
  display: none;
  gap: 0.85rem;
}

.course-mobile-card {
  width: 100%;
  border-radius: 16px;
  padding: 0.95rem;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  display: grid;
  gap: 0.85rem;
}

.course-mobile-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.course-mobile-card__title-wrap {
  min-width: 0;
  flex: 1;
}

.course-mobile-card__title-wrap h4 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.35;
  font-weight: 800;
  color: #0f172a;
}

.course-mobile-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.course-mobile-card__meta-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.72rem;
  display: grid;
  gap: 0.2rem;
}

.course-mobile-card__meta-item span {
  display: block;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  font-weight: 700;
  line-height: 1.1;
}

.course-mobile-card__meta-item strong {
  display: block;
  font-size: 0.92rem;
  line-height: 1.28;
  color: #0f172a;
  word-break: break-word;
}

.course-mobile-card__actions {
  display: flex;
}

.course-mobile-card__actions :deep(.p-button) {
  width: 100%;
}

/* =========================
   EMPTY
========================= */
.empty-card {
  border-radius: 18px;
  background: #f8fafc;
}

.empty-card-content {
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: left;
}

.empty-card-content i {
  font-size: 2rem;
  color: #94a3b8;
}

.empty-card-content h4 {
  margin: 0 0 0.35rem;
  color: #0f172a;
}

.empty-card-content p {
  margin: 0;
  color: #64748b;
  line-height: 1.45;
}

/* =========================
   TABLET
========================= */
@media (max-width: 1199px) {
  .student-hero__content {
    grid-template-columns: 1fr;
  }

  .pending-class-item {
    grid-template-columns: 68px minmax(0, 1fr) auto;
  }
}

/* =========================
   MOBILE
========================= */
@media (max-width: 767px) {
  :deep(.page) {
    padding-left: 0.65rem !important;
    padding-right: 0.65rem !important;
    margin: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  .student-dashboard {
    width: 100%;
    gap: 0.95rem;
  }

  .student-hero {
    padding: 0.9rem;
    border-radius: 16px;
  }

  .student-hero__eyebrow {
    font-size: 0.7rem;
    padding: 0.28rem 0.58rem;
    margin-bottom: 0.45rem;
  }

  .student-hero h1 {
    font-size: 1.55rem;
    line-height: 1.1;
  }

  .student-hero p {
    font-size: 0.86rem;
    line-height: 1.35;
    margin-top: 0.38rem;
  }

  .student-hero__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem;
  }

  .hero-stat-card {
    min-height: 84px;
    padding: 0.72rem;
    gap: 0.18rem;
  }

  .hero-stat-card__label {
    font-size: 0.68rem;
  }

  .hero-stat-card strong {
    font-size: 1.25rem;
  }

  .hero-stat-card small {
    font-size: 0.72rem;
    line-height: 1.22;
  }

  .dashboard-card {
    border-radius: 16px;
  }

  :deep(.p-card-body) {
    padding: 0.95rem;
  }

  .card-title-row h3 {
    font-size: 1rem;
  }

  .card-title-row p {
    font-size: 0.83rem;
    line-height: 1.35;
  }

  .state-box {
    flex-direction: column;
    align-items: flex-start;
    padding: 0.9rem;
  }

  .pending-class-item {
    grid-template-columns: 1fr;
    align-items: flex-start;
    padding: 0.88rem;
    border-radius: 14px;
  }

  .pending-class-item__date {
    width: fit-content;
    min-width: 64px;
    min-height: auto;
  }

  .pending-class-item__actions {
    width: 100%;
    justify-content: flex-start;
    padding-top: 0.2rem;
  }

  .pending-class-item__actions :deep(.p-button) {
    width: 100%;
  }

  .courses-table-desktop {
    display: none;
  }

  .courses-mobile-list {
    display: grid;
  }

  .course-mobile-card {
    padding: 0.9rem;
    gap: 0.8rem;
    border-radius: 14px;
  }

  .course-mobile-card__top {
    gap: 0.6rem;
  }

  .course-mobile-card__title-wrap h4 {
    font-size: 0.98rem;
  }

  .course-mobile-card__meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem;
  }

  .course-mobile-card__meta-item {
    padding: 0.68rem;
  }

  .course-mobile-card__meta-item span {
    font-size: 0.68rem;
  }

  .course-mobile-card__meta-item strong {
    font-size: 0.9rem;
  }

  .empty-card-content {
    flex-direction: column;
    text-align: center;
    min-height: auto;
    padding: 0.4rem 0;
  }
}

/* =========================
   SMALL MOBILE
========================= */
@media (max-width: 420px) {
  .student-hero h1 {
    font-size: 1.42rem;
  }

  .hero-stat-card strong {
    font-size: 1.16rem;
  }

  .hero-stat-card small {
    font-size: 0.7rem;
  }

  .course-mobile-card__meta {
    grid-template-columns: 1fr;
  }

  .course-mobile-card__title-wrap h4 {
    font-size: 0.94rem;
  }
}
</style>

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
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';
import api from '../api/axios';

const courses = ref([]);
const loading = ref(true);
const error = ref(false);
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

onMounted(loadCourses);
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
</style>

<template>
  <div class="page">
    <Card>
      <template #title>My Courses</template>
      <template #content>
        <div v-if="loading">
          <Skeleton height="3rem" class="mb-2" />
          <Skeleton height="3rem" class="mb-2" />
        </div>
        <div v-else-if="error">
          <p>Could not load courses.</p>
          <Button label="Reload" icon="pi pi-refresh" class="p-button-text" @click="loadCourses" />
        </div>
        <div v-else-if="courses.length">
          <DataTable :value="courses" responsiveLayout="scroll">
            <Column field="title" header="Title" />
            <Column field="level" header="Level" />
            <Column field="status" header="Status">
              <template #body="{ data }">
                <Tag :value="data.status" :severity="statusSeverity(data.status)" />
              </template>
            </Column>
            <Column header="Actions">
              <template #body="{ data }">
                <Button label="Open" icon="pi pi-arrow-right" @click="openCourse(data.id)" />
              </template>
            </Column>
          </DataTable>
        </div>
        <div v-else class="empty-state">You are not enrolled in any courses.</div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import api from '../api/axios';

const courses = ref([]);
const loading = ref(true);
const error = ref(false);
const router = useRouter();
const toast = useToast();

const statusSeverity = (status) => {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'DRAFT') return 'warning';
  return 'info';
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
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load courses', life: 3000 });
  } finally {
    loading.value = false;
  }
};

onMounted(loadCourses);
</script>

<style scoped>
</style>

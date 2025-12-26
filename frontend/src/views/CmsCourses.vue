<template>
  <div class="page cms-page">
    <Card>
      <template #title>
        <div class="cms-header">
          <div>
            <h2>Courses</h2>
            <small>Draft and publish academy courses</small>
          </div>
          <div class="cms-actions">
            <span class="p-input-icon-left">
              <i class="pi pi-search" />
              <InputText v-model="filter" placeholder="Search courses" />
            </span>
            <Button label="Create course" icon="pi pi-plus" @click="openCreateDialog" />
          </div>
        </div>
      </template>
      <template #content>
        <div v-if="loading">
          <Skeleton height="3rem" class="mb-2" />
          <Skeleton height="3rem" class="mb-2" />
          <Skeleton height="3rem" class="mb-2" />
        </div>
        <div v-else>
          <DataTable :value="filteredCourses" responsiveLayout="scroll">
            <Column field="title" header="Title" />
            <Column header="Status">
              <template #body="{ data }">
                <Tag
                  :value="data.is_published ? 'Published' : 'Draft'"
                  :severity="data.is_published ? 'success' : 'warning'"
                />
              </template>
            </Column>
            <Column header="Updated">
              <template #body="{ data }">
                {{ formatDate(data.updated_at || data.created_at) }}
              </template>
            </Column>
            <Column header="Actions">
              <template #body="{ data }">
                <div class="table-actions">
                  <Button
                    label="Manage"
                    icon="pi pi-folder"
                    class="p-button-text"
                    @click="goToBuilder(data.id)"
                  />
                  <Button
                    label="Edit"
                    icon="pi pi-pencil"
                    class="p-button-text"
                    @click="openEditDialog(data)"
                  />
                  <Button
                    :label="data.is_published ? 'Unpublish' : 'Publish'"
                    :icon="data.is_published ? 'pi pi-eye-slash' : 'pi pi-eye'"
                    class="p-button-text"
                    @click="togglePublish(data)"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
          <div v-if="!filteredCourses.length" class="empty-state">
            No courses yet. Click "Create course" to get started.
          </div>
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="showCourseDialog"
      :header="dialogMode === 'create' ? 'Create course' : 'Edit course'"
      modal
      :style="{ width: '30rem' }"
    >
      <div class="dialog-field">
        <label>Title</label>
        <InputText v-model="courseForm.title" placeholder="Course title" />
      </div>
      <div class="dialog-field">
        <label>Description</label>
        <textarea
          v-model="courseForm.description"
          rows="4"
          class="p-inputtextarea p-inputtext"
          placeholder="Describe the course"
        ></textarea>
      </div>
      <div class="dialog-field">
        <label>Level</label>
        <InputText v-model="courseForm.level" placeholder="B1, B2..." />
      </div>
      <template #footer>
        <Button label="Cancel" class="p-button-text" @click="showCourseDialog = false" />
        <Button
          :label="dialogMode === 'create' ? 'Create' : 'Save'"
          :loading="savingCourse"
          @click="submitCourse"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import {
  listCourses,
  createCourse,
  updateCourse,
  publishCourse,
  unpublishCourse,
} from '../api/cms';

const router = useRouter();
const toast = useToast();

const courses = ref([]);
const loading = ref(true);
const filter = ref('');
const showCourseDialog = ref(false);
const dialogMode = ref('create');
const courseForm = ref({
  title: '',
  description: '',
  level: '',
});
const editingId = ref(null);
const savingCourse = ref(false);

const loadCourses = async () => {
  loading.value = true;
  try {
    courses.value = await listCourses();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load courses', life: 3000 });
  } finally {
    loading.value = false;
  }
};

const filteredCourses = computed(() => {
  if (!filter.value.trim()) return courses.value;
  const term = filter.value.toLowerCase();
  return courses.value.filter((course) =>
    [course.title, course.description]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(term)),
  );
});

const openCreateDialog = () => {
  dialogMode.value = 'create';
  editingId.value = null;
  courseForm.value = { title: '', description: '', level: '' };
  showCourseDialog.value = true;
};

const openEditDialog = (course) => {
  dialogMode.value = 'edit';
  editingId.value = course.id;
  courseForm.value = {
    title: course.title,
    description: course.description || '',
    level: course.level || '',
  };
  showCourseDialog.value = true;
};

const submitCourse = async () => {
  if (!courseForm.value.title.trim()) {
    toast.add({ severity: 'warn', summary: 'Title required', detail: 'Course title is required', life: 2500 });
    return;
  }

  savingCourse.value = true;
  try {
    if (dialogMode.value === 'create') {
      await createCourse(courseForm.value);
      toast.add({ severity: 'success', summary: 'Course created', life: 2000 });
    } else {
      await updateCourse(editingId.value, courseForm.value);
      toast.add({ severity: 'success', summary: 'Course updated', life: 2000 });
    }
    showCourseDialog.value = false;
    await loadCourses();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to save course',
      life: 3500,
    });
  } finally {
    savingCourse.value = false;
  }
};

const togglePublish = async (course) => {
  try {
    if (course.is_published) {
      await unpublishCourse(course.id);
      toast.add({ severity: 'info', summary: 'Course unpublished', life: 2000 });
    } else {
      await publishCourse(course.id);
      toast.add({ severity: 'success', summary: 'Course published', life: 2000 });
    }
    await loadCourses();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to update course',
      life: 3500,
    });
  }
};

const goToBuilder = (courseId) => {
  router.push(`/cms/courses/${courseId}`);
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

loadCourses();
</script>

<style scoped>
.cms-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.cms-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.table-actions {
  display: flex;
  gap: 0.35rem;
}

.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
}

.mb-2 {
  margin-bottom: 0.75rem;
}
</style>

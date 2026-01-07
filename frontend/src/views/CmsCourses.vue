<template>
  <div class="page cms-page">
    <Dialog
      v-model:visible="confirmDeleteDialogVisible"
      :header="t('common.confirm')"
      modal
      :closable="!confirmDeleteDialogLoading"
      :style="{ width: '28rem' }"
    >
      <p class="confirm-message">{{ confirmDeleteDialogMessage }}</p>
      <template #footer>
        <Button
          label="Cancel"
          class="p-button-text"
          :disabled="confirmDeleteDialogLoading"
          @click="closeDeleteDialog"
        />
        <Button
          :label="t('common.delete')"
          severity="danger"
          :loading="confirmDeleteDialogLoading"
          :disabled="confirmDeleteDialogLoading"
          @click="confirmCourseDeletion"
        />
      </template>
    </Dialog>
    <Card>
      <template #title>
        <div class="cms-header">
          <div>
            <h2>{{ t('cmsCourses.title') }}</h2>
            <small>{{ t('cmsCourses.subtitle') }}</small>
          </div>
          <div class="cms-actions">
            <span class="p-input-icon-left">
              <i class="pi pi-search" />
              <InputText v-model="filter" :placeholder="t('cmsCourses.searchPlaceholder')" />
            </span>
            <Button :label="t('cmsCourses.createCourse')" icon="pi pi-plus" @click="openCreateDialog" />
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
            <Column field="title" :header="t('cmsCourses.table.title')" />
            <Column :header="t('cmsCourses.table.status')">
              <template #body="{ data }">
                <Tag
                  :value="
                    data.is_published
                      ? t('cmsCourses.statusLabel.published')
                      : t('cmsCourses.statusLabel.draft')
                  "
                  :severity="data.is_published ? 'success' : 'warning'"
                />
              </template>
            </Column>
            <Column :header="t('cmsCourses.table.updated')">
              <template #body="{ data }">
                {{ formatDate(data.updated_at || data.created_at) }}
              </template>
            </Column>
            <Column :header="t('cmsCourses.table.actions')">
              <template #body="{ data }">
                <div class="table-actions">
                  <Button
                    :label="t('cmsCourses.table.manage')"
                    icon="pi pi-folder"
                    class="p-button-text"
                    @click="goToBuilder(data.id)"
                  />
                  <Button
                    :label="t('cmsCourses.table.edit')"
                    icon="pi pi-pencil"
                    class="p-button-text"
                    @click="openEditDialog(data)"
                  />
                  <Button
                    :label="
                      data.is_published
                        ? t('cmsCourses.table.unpublish')
                        : t('cmsCourses.table.publish')
                    "
                    :icon="data.is_published ? 'pi pi-eye-slash' : 'pi pi-eye'"
                    class="p-button-text"
                    @click="togglePublish(data)"
                  />
                  <Button
                    icon="pi pi-trash"
                    severity="danger"
                    size="small"
                    class="p-button-text"
                    :loading="deletingCourseId === data.id"
                    :disabled="deletingCourseId === data.id"
                    @click.stop="openDeleteCourseDialog(data)"
                    aria-label="Delete course"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
          <div v-if="!filteredCourses.length" class="empty-state">
            {{ t('cmsCourses.table.empty') }}
          </div>
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="showCourseDialog"
      :header="dialogTitle"
      modal
      :style="{ width: '30rem' }"
    >
      <div class="dialog-field">
        <label>{{ t('cmsCourses.dialog.titleLabel') }}</label>
        <InputText v-model="courseForm.title" :placeholder="t('cmsCourses.dialog.titlePlaceholder')" />
      </div>
      <div class="dialog-field">
        <label>{{ t('cmsCourses.dialog.descriptionLabel') }}</label>
        <textarea
          v-model="courseForm.description"
          rows="4"
          class="p-inputtextarea p-inputtext"
          :placeholder="t('cmsCourses.dialog.descriptionPlaceholder')"
        ></textarea>
      </div>
      <div class="dialog-field">
        <label>{{ t('cmsCourses.dialog.levelLabel') }}</label>
        <Dropdown
          v-model="courseForm.level"
          :options="courseLevelOptions"
          optionLabel="label"
          optionValue="value"
          :disabled="!courseLevelOptions.length"
          :placeholder="t('cmsCourses.dialog.levelPlaceholder')"
        />
      </div>
      <template #footer>
        <Button :label="t('cmsCourses.dialog.cancel')" class="p-button-text" @click="showCourseDialog = false" />
        <Button
          :label="dialogMode === 'create' ? t('cmsCourses.dialog.create') : t('cmsCourses.dialog.save')"
          :loading="savingCourse"
          @click="submitCourse"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';
import {
  listCourses,
  createCourse,
  updateCourse,
  publishCourse,
  unpublishCourse,
  deleteCourse,
  listCourseLevels,
} from '../api/cms';

const router = useRouter();
const toast = useToast();
const { t } = useI18n();

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
const deletingCourseId = ref(null);
const confirmDeleteDialogVisible = ref(false);
const confirmDeleteDialogLoading = ref(false);
const confirmDeleteCourse = ref(null);
const dialogTitle = computed(() =>
  dialogMode.value === 'create'
    ? t('cmsCourses.dialog.createHeader')
    : t('cmsCourses.dialog.editHeader'),
);

const loadCourses = async () => {
  loading.value = true;
  try {
    courses.value = await listCourses();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: t('cmsCourses.toasts.loadError'),
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const courseLevels = ref([]);
const courseLevelOptions = computed(() =>
  courseLevels.value.map((level) => ({
    label: level.label || level.code,
    value: level.code,
  })),
);
const getDefaultLevelCode = () => courseLevelOptions.value[0]?.value || '';

const loadCourseLevels = async () => {
  try {
    courseLevels.value = await listCourseLevels();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: t('cmsCourses.toasts.levelsLoadError'),
      life: 3500,
    });
  }
};

watch(
  () => courseLevelOptions.value,
  () => {
    if (dialogMode.value === 'create' && showCourseDialog.value && !courseForm.value.level) {
      courseForm.value.level = getDefaultLevelCode();
    }
  },
  { immediate: true },
);

const filteredCourses = computed(() => {
  if (!filter.value.trim()) return courses.value;
  const term = filter.value.toLowerCase();
  return courses.value.filter((course) =>
    [course.title, course.description]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(term)),
  );
});

const confirmDeleteDialogMessage = computed(() => {
  const course = confirmDeleteCourse.value;
  if (!course) {
    return 'Are you sure you want to delete this course? This action cannot be undone.';
  }
  return `Are you sure you want to delete "${course.title}"? This action cannot be undone.`;
});

const openCreateDialog = () => {
  dialogMode.value = 'create';
  editingId.value = null;
  courseForm.value = { title: '', description: '', level: getDefaultLevelCode() };
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
    toast.add({
      severity: 'warn',
      summary: t('common.notifications.warning'),
      detail: t('cmsCourses.toasts.titleRequired'),
      life: 2500,
    });
    return;
  }

  savingCourse.value = true;
  try {
    if (dialogMode.value === 'create') {
      await createCourse({
        ...courseForm.value,
        level: courseForm.value.level || getDefaultLevelCode(),
      });
      toast.add({
        severity: 'success',
        summary: t('cmsCourses.toasts.createSuccess'),
        life: 2000,
      });
    } else {
      await updateCourse(editingId.value, {
        ...courseForm.value,
        level: courseForm.value.level || getDefaultLevelCode(),
      });
      toast.add({
        severity: 'success',
        summary: t('cmsCourses.toasts.updateSuccess'),
        life: 2000,
      });
    }
    showCourseDialog.value = false;
    await loadCourses();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: err.response?.data?.error || t('cmsCourses.toasts.saveError'),
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
      toast.add({
        severity: 'info',
        summary: t('cmsCourses.toasts.unpublishInfo'),
        life: 2000,
      });
    } else {
      await publishCourse(course.id);
      toast.add({
        severity: 'success',
        summary: t('cmsCourses.toasts.publishSuccess'),
        life: 2000,
      });
    }
    await loadCourses();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: err.response?.data?.error || t('cmsCourses.toasts.updateError'),
      life: 3500,
    });
  }
};

const closeDeleteDialog = () => {
  confirmDeleteDialogVisible.value = false;
  confirmDeleteDialogLoading.value = false;
  confirmDeleteCourse.value = null;
};

const openDeleteCourseDialog = (course) => {
  confirmDeleteCourse.value = course;
  confirmDeleteDialogVisible.value = true;
};

const confirmCourseDeletion = async () => {
  const course = confirmDeleteCourse.value;
  if (!course) {
    closeDeleteDialog();
    return;
  }
  confirmDeleteDialogLoading.value = true;
  deletingCourseId.value = course.id;
  try {
    await deleteCourse(course.id);
    toast.add({
      severity: 'success',
      summary: t('common.notifications.success'),
      detail: t('cmsCourses.toasts.deleteSuccess'),
      life: 2500,
    });
    courses.value = courses.value.filter((item) => item.id !== course.id);
    closeDeleteDialog();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: err.response?.data?.error || t('cmsCourses.toasts.deleteError'),
      life: 3500,
    });
  } finally {
    confirmDeleteDialogLoading.value = false;
    deletingCourseId.value = null;
  }
};

const goToBuilder = (courseId) => {
  router.push(`/cms/courses/${courseId}`);
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

loadCourseLevels();
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

.confirm-message {
  margin-bottom: 1rem;
  line-height: 1.4;
}

.mb-2 {
  margin-bottom: 0.75rem;
}
</style>

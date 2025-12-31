<template>
  <div class="page cms-page">
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
        <InputText v-model="courseForm.level" :placeholder="t('cmsCourses.dialog.levelPlaceholder')" />
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
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';
import {
  listCourses,
  createCourse,
  updateCourse,
  publishCourse,
  unpublishCourse,
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
      await createCourse(courseForm.value);
      toast.add({
        severity: 'success',
        summary: t('cmsCourses.toasts.createSuccess'),
        life: 2000,
      });
    } else {
      await updateCourse(editingId.value, courseForm.value);
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

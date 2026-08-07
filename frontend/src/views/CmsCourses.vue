<template>
  <div class="page cms-page">
    <Dialog
      v-model:visible="confirmDeleteDialogVisible"
      :header="t('common.confirm')"
      modal
      :closable="!confirmDeleteDialogLoading"
      :style="{ width: '28rem', maxWidth: '95vw' }"
    >
      <p class="confirm-message">{{ confirmDeleteDialogMessage }}</p>

      <template #footer>
        <div class="dialog-footer-actions">
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
        </div>
      </template>
    </Dialog>

    <Card class="courses-card">
      <template #title>
        <div class="cms-header">
          <div class="cms-title-block">
            <div class="cms-title-row">
              <div class="cms-title-icon">
                <i class="pi pi-book"></i>
              </div>

              <div class="cms-title-text">
                <h2>{{ t('cmsCourses.title') }}</h2>
                <small>{{ t('cmsCourses.subtitle') }}</small>
              </div>
            </div>
          </div>

          <div class="cms-actions">
            <span class="p-input-icon-left search-box">
              <i class="pi pi-search" />
              <InputText
                v-model="filter"
                :placeholder="t('cmsCourses.searchPlaceholder')"
              />
            </span>

            <Button
              v-if="canCreateCourse"
              :label="t('cmsCourses.createCourse')"
              icon="pi pi-plus"
              class="create-course-btn"
              @click="openCreateDialog"
            />
          </div>
        </div>
      </template>

      <template #content>
        <div v-if="loading" class="loading-state">
          <Skeleton height="3rem" class="mb-2" borderRadius="14px" />
          <Skeleton height="3rem" class="mb-2" borderRadius="14px" />
          <Skeleton height="3rem" class="mb-2" borderRadius="14px" />
        </div>

        <div v-else>
          <div class="table-shell" v-if="filteredCourses.length">
            <DataTable
              :value="filteredCourses"
              responsiveLayout="scroll"
              class="courses-table"
            >
              <Column field="title" :header="t('cmsCourses.table.title')">
                <template #body="{ data }">
                  <div class="course-title-cell">
                    <div class="course-avatar">
                      <i class="pi pi-bookmark"></i>
                    </div>

                    <div class="course-title-content">
                      <button
                        type="button"
                        class="course-main-title course-main-title-link"
                        :aria-label="`Manage ${data.title}`"
                        @click="goToBuilder(data.id)"
                      >
                        {{ data.title }}
                      </button>
                      <small class="course-subtext">
                        {{ data.description || 'Sin descripción disponible' }}
                      </small>
                    </div>
                  </div>
                </template>
              </Column>

              <Column :header="t('cmsCourses.table.status')">
                <template #body="{ data }">
                  <div class="mobile-field mobile-status">
                    <span class="mobile-label">Estado</span>
                    <Tag
                      :value="
                        data.is_published
                          ? t('cmsCourses.statusLabel.published')
                          : t('cmsCourses.statusLabel.draft')
                      "
                      :severity="data.is_published ? 'success' : 'warning'"
                      rounded
                      class="status-tag"
                    />
                  </div>
                </template>
              </Column>

              <Column :header="t('cmsCourses.table.updated')">
                <template #body="{ data }">
                  <div class="updated-cell">
                    <span class="mobile-label">Actualizado</span>
                    <div class="updated-inline">
                      <i class="pi pi-clock"></i>
                      <span>{{ formatDate(data.updated_at || data.created_at) }}</span>
                    </div>
                  </div>
                </template>
              </Column>

              <Column :header="t('cmsCourses.table.actions')">
                <template #body="{ data }">
                  <div class="row-menu-cell">
                    <span class="mobile-label">Acciones</span>
                    <Button
                      icon="pi pi-ellipsis-v"
                      class="p-button-text row-menu-trigger"
                      @click="toggleRowMenu($event, data)"
                      aria-label="More actions"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>

            <Menu ref="rowMenu" :model="rowMenuItems" popup />
          </div>

          <div v-else class="empty-state">
            <div class="empty-state-icon">
              <i class="pi pi-inbox"></i>
            </div>
            <div class="empty-state-text">
              {{ t('cmsCourses.table.empty') }}
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="showCourseDialog"
      :header="dialogTitle"
      modal
      :style="{ width: '30rem', maxWidth: '95vw' }"
      class="course-dialog"
    >
      <div class="dialog-field">
        <label>{{ t('cmsCourses.dialog.titleLabel') }}</label>
        <InputText
          v-model="courseForm.title"
          :placeholder="t('cmsCourses.dialog.titlePlaceholder')"
        />
      </div>

      <div class="dialog-field">
        <label>{{ t('cmsCourses.dialog.descriptionLabel') }}</label>
        <textarea
          v-model="courseForm.description"
          rows="4"
          class="p-inputtextarea p-inputtext custom-textarea"
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
        <div class="dialog-footer-actions">
          <Button
            :label="t('cmsCourses.dialog.cancel')"
            class="p-button-text"
            @click="showCourseDialog = false"
          />
          <Button
            :label="dialogMode === 'create' ? t('cmsCourses.dialog.create') : t('cmsCourses.dialog.save')"
            :loading="savingCourse"
            class="create-course-btn"
            @click="submitCourse"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';
import Menu from 'primevue/menu';
import {
  listCourses,
  createCourse,
  updateCourse,
  publishCourse,
  unpublishCourse,
  deleteCourse,
  listCourseLevels,
} from '../api/cms';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const toast = useToast();
const { t } = useI18n();
const auth = useAuthStore();

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

const rowMenu = ref();
const selectedCourse = ref(null);

const dialogTitle = computed(() =>
  dialogMode.value === 'create'
    ? t('cmsCourses.dialog.createHeader')
    : t('cmsCourses.dialog.editHeader'),
);

const isEnrollmentOnly = computed(
  () =>
    auth.hasRole('enrollment_manager') &&
    !auth.hasAnyRole(['admin', 'instructor', 'content_editor']),
);
const isInstructorOnly = computed(
  () =>
    auth.hasRole('instructor') &&
    !auth.hasAnyRole(['admin', 'content_editor', 'enrollment_manager']),
);
const canCreateCourse = computed(() => !isInstructorOnly.value);

const rowMenuItems = computed(() => {
  if (!selectedCourse.value) return [];

  const course = selectedCourse.value;

  const manageItem = {
    label: t('cmsCourses.table.manage'),
    icon: 'pi pi-folder',
    command: () => goToBuilder(course.id),
  };

  const items = [
    manageItem,
    {
      label: t('cmsCourses.table.edit'),
      icon: 'pi pi-pencil',
      command: () => openEditDialog(course),
    },
    {
      separator: true,
    },
    {
      label: t('common.delete'),
      icon: 'pi pi-trash',
      command: () => openDeleteCourseDialog(course),
    },
  ];

  if (!isInstructorOnly.value) {
    items.splice(2, 0, {
      label: course.is_published
        ? t('cmsCourses.table.unpublish')
        : t('cmsCourses.table.publish'),
      icon: course.is_published ? 'pi pi-eye-slash' : 'pi pi-eye',
      command: () => togglePublish(course),
    });
  }

  return items;
});

const toggleRowMenu = (event, course) => {
  selectedCourse.value = course;
  rowMenu.value.toggle(event);
};

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
  courseForm.value = {
    title: '',
    description: '',
    level: getDefaultLevelCode(),
  };
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

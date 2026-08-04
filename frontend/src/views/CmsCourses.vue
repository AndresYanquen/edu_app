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

<style scoped>
.cms-page,
.cms-page * {
  box-sizing: border-box;
  min-width: 0;
}

.cms-page {
  width: 100%;
  max-width: 100%;
  padding: 0.25rem;
  overflow-x: hidden;
}

.courses-card {
  width: 100%;
  max-width: 100%;
  border-radius: 24px;
  border: 1px solid #e8edf5;
  box-shadow:
    0 12px 32px rgba(15, 23, 42, 0.05),
    0 2px 10px rgba(15, 23, 42, 0.03);
  overflow: hidden;
  background: linear-gradient(180deg, #ffffff 0%, #fcfdff 100%);
}

.courses-card :deep(.p-card-body) {
  padding: 1.2rem 1.4rem;
}

.courses-card :deep(.p-card-title) {
  margin-bottom: 0.7rem;
}

.courses-card :deep(.p-card-content) {
  padding-top: 0 !important;
  margin-top: 0;
}

/* HEADER */
.cms-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  width: 100%;
  margin-bottom: 0;
}

.cms-title-block {
  flex: 1 1 320px;
  min-width: 280px;
}

.cms-title-row {
  display: flex;
  align-items: center;
  gap: 0.95rem;
}

.cms-title-text {
  min-width: 0;
}

.cms-title-icon {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%);
  color: #1d4ed8;
  font-size: 1.3rem;
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.12);
  flex-shrink: 0;
}

.cms-title-row h2 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
  line-height: 1.08;
}

.cms-title-row small {
  display: block;
  margin-top: 0.3rem;
  color: #64748b;
  font-size: 0.94rem;
  line-height: 1.42;
}

.cms-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  flex: 0 1 auto;
  flex-wrap: wrap;
  margin-left: auto;
}

.search-box {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 340px;
  min-width: 300px;
}

.search-box > i {
  position: absolute;
  left: 0.95rem;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  font-size: 0.95rem;
  z-index: 2;
  pointer-events: none;
}

.search-box :deep(.p-inputtext) {
  width: 100%;
  min-width: 100%;
  height: 46px;
  border-radius: 15px;
  border: 1px solid #dbe3ef;
  background: #f8fafc;
  box-shadow: none;
  transition: all 0.2s ease;
  padding-left: 2.65rem;
}

.search-box :deep(.p-inputtext:focus) {
  background: #ffffff;
  border-color: #93c5fd;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.create-course-btn {
  min-height: 46px;
  border: none;
  border-radius: 15px;
  padding: 0 1.15rem;
  font-weight: 700;
  background: linear-gradient(135deg, #0f3d79 0%, #1457a8 100%);
  box-shadow: 0 10px 20px rgba(20, 87, 168, 0.22);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  flex-shrink: 0;
}

.create-course-btn:hover {
  filter: brightness(1.03);
  transform: translateY(-1px);
}

.loading-state {
  padding-top: 0.2rem;
}

/* TABLE */
.table-shell {
  margin-top: 0.2rem;
  border: 1px solid #ebf0f6;
  border-radius: 18px;
  overflow: hidden;
  background: #ffffff;
}

.courses-table {
  width: 100%;
  table-layout: fixed;
}

.courses-table :deep(.p-datatable-wrapper) {
  border-radius: 18px;
}

.courses-table :deep(table) {
  width: 100%;
  table-layout: fixed;
}

.courses-table :deep(.p-datatable-thead > tr > th) {
  background: #f8fafc;
  color: #334155;
  font-size: 0.92rem;
  font-weight: 700;
  padding: 1rem 0.95rem;
  border-bottom: 1px solid #e5eaf2;
  white-space: nowrap;
}

.courses-table :deep(.p-datatable-thead > tr > th:nth-child(1)) { width: 46%; }
.courses-table :deep(.p-datatable-thead > tr > th:nth-child(2)) { width: 14%; }
.courses-table :deep(.p-datatable-thead > tr > th:nth-child(3)) { width: 22%; }
.courses-table :deep(.p-datatable-thead > tr > th:nth-child(4)) { width: 18%; }

.courses-table :deep(.p-datatable-tbody > tr:hover) {
  background: #f8fbff;
}

.courses-table :deep(.p-datatable-tbody > tr > td) {
  padding: 1rem 0.95rem;
  border-bottom: 1px solid #edf2f7;
  vertical-align: middle;
  overflow: hidden;
}

.course-title-cell {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
}

.course-avatar {
  width: 44px;
  height: 44px;
  border-radius: 13px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.course-title-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  width: 100%;
}

.course-main-title {
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.22;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.course-main-title-link {
  cursor: pointer;
  transition: color 0.15s ease;
}

.course-main-title-link:hover {
  color: #1d4ed8;
}

.course-subtext {
  margin-top: 0.22rem;
  color: #64748b;
  font-size: 0.84rem;
  line-height: 1.38;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.status-tag {
  font-weight: 700;
  padding-inline: 0.8rem;
}

.mobile-label {
  display: none;
  font-size: 0.72rem;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.35rem;
}

.updated-cell {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  color: #475569;
  font-size: 0.9rem;
  min-width: 0;
}

.updated-inline {
  display: inline-flex;
  align-items: flex-start;
  gap: 0.42rem;
  min-width: 0;
  line-height: 1.3;
}

.updated-inline i {
  color: #94a3b8;
  font-size: 0.88rem;
  margin-top: 0.1rem;
  flex-shrink: 0;
}

.updated-inline span {
  word-break: break-word;
  overflow-wrap: anywhere;
}

.row-menu-cell {
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.row-menu-trigger {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  color: #334155 !important;
}

.row-menu-trigger:hover {
  background: #eff6ff !important;
  color: #1d4ed8 !important;
}

/* EMPTY */
.empty-state {
  margin-top: 0.6rem;
  border: 1px dashed #dbe3ef;
  border-radius: 18px;
  padding: 2rem 1rem;
  text-align: center;
  background: linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%);
}

.empty-state-icon {
  width: 58px;
  height: 58px;
  margin: 0 auto 0.85rem;
  border-radius: 16px;
  background: #eef4ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
}

.empty-state-text {
  color: #64748b;
  font-weight: 600;
}

/* DIALOGS */
.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-bottom: 1rem;
}

.dialog-field label {
  font-weight: 700;
  color: #334155;
}

.custom-textarea {
  resize: vertical;
  min-height: 110px;
  border-radius: 14px;
}

.confirm-message {
  margin: 0;
  line-height: 1.55;
  color: #334155;
}

.dialog-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  width: 100%;
}

.mb-2 {
  margin-bottom: 0.75rem;
}

.course-dialog :deep(.p-dialog-header) {
  padding-bottom: 0.6rem;
}

.course-dialog :deep(.p-dialog-content) {
  padding-top: 0.5rem;
}

/* TABLET */
@media (max-width: 1024px) {
  .cms-header {
    align-items: flex-start;
  }

  .cms-actions {
    width: 100%;
    margin-left: 0;
    justify-content: flex-start;
  }

  .search-box {
    flex: 1 1 auto;
    width: 300px;
    min-width: 240px;
  }
}

/* MOBILE */
@media (max-width: 768px) {
  .cms-page {
    padding: 0;
    overflow-x: hidden;
  }

  .courses-card {
    width: 100%;
    max-width: 100%;
    border-radius: 18px;
  }

  .courses-card :deep(.p-card-body) {
    padding: 1rem;
  }

  .courses-card :deep(.p-card-title) {
    margin-bottom: 0.55rem;
  }

  .courses-card :deep(.p-card-content) {
    padding-top: 0 !important;
    margin-top: 0 !important;
  }

  .cms-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    margin-bottom: 0;
  }

  .cms-title-block {
    flex: none;
    min-width: 0;
    width: 100%;
  }

  .cms-title-row {
    align-items: flex-start;
  }

  .cms-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 0.7rem;
    margin-left: 0;
  }

  .search-box {
    width: 100%;
    min-width: 100%;
  }

  .search-box :deep(.p-inputtext) {
    width: 100%;
    min-width: 100%;
  }

  .create-course-btn {
    width: 100%;
    justify-content: center;
  }

  .table-shell {
    margin-top: 0.2rem;
    border: none;
    border-radius: 0;
    background: transparent;
    overflow: visible;
  }

  .courses-table :deep(.p-datatable-thead) {
    display: none;
  }

  .courses-table :deep(.p-datatable-tbody) {
    display: grid;
    gap: 0.85rem;
  }

  .courses-table :deep(.p-datatable-tbody > tr) {
    display: grid;
    grid-template-columns: 1fr;
    border: 1px solid #e5eaf2;
    border-radius: 18px;
    background: #ffffff;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
    overflow: hidden;
  }

  .courses-table :deep(.p-datatable-tbody > tr > td) {
    display: block;
    width: 100%;
    border: none;
    padding: 0.9rem;
  }

  .courses-table :deep(.p-datatable-tbody > tr > td:nth-child(1)) {
    padding-bottom: 0.78rem;
    border-bottom: 1px solid #f1f5f9;
  }

  .courses-table :deep(.p-datatable-tbody > tr > td:nth-child(2)),
  .courses-table :deep(.p-datatable-tbody > tr > td:nth-child(3)) {
    padding-top: 0.72rem;
    padding-bottom: 0.72rem;
  }

  .courses-table :deep(.p-datatable-tbody > tr > td:nth-child(4)) {
    padding-top: 0.78rem;
    border-top: 1px solid #f1f5f9;
  }

  .course-title-cell {
    align-items: flex-start;
    gap: 0.8rem;
  }

  .course-main-title {
    display: block;
    font-size: 1.02rem;
    line-height: 1.28;
    margin-bottom: 0.22rem;
  }

  .course-subtext {
    max-width: 100%;
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
  }

  .mobile-label {
    display: inline-block;
  }

  .mobile-status,
  .updated-cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .row-menu-cell {
    justify-content: space-between;
    align-items: center;
  }

  .dialog-footer-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .dialog-footer-actions :deep(.p-button) {
    width: 100%;
  }
}

/* SMALL MOBILE */
@media (max-width: 640px) {
  .cms-page {
    padding: 0;
  }

  .courses-card :deep(.p-card-body) {
    padding: 0.9rem;
  }

  .cms-title-row h2 {
    font-size: 1.42rem;
  }

  .cms-title-row small {
    font-size: 0.88rem;
  }

  .cms-title-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    font-size: 1.15rem;
  }

  .course-avatar {
    width: 40px;
    height: 40px;
    border-radius: 12px;
  }

  .courses-table :deep(.p-datatable-tbody > tr) {
    border-radius: 16px;
  }

  .courses-table :deep(.p-datatable-tbody > tr > td) {
    padding-left: 0.85rem;
    padding-right: 0.85rem;
  }
}
</style>

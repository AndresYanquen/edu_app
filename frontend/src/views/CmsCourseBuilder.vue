<template>
  <div class="page cms-page">
    <Dialog
      v-model:visible="confirmDialogVisible"
      :header="confirmDialogHeader"
      modal
      :style="{ width: '28rem' }"
      :closable="!confirmDialogLoading"
    >
      <p class="confirm-message" v-if="confirmDialogMessage">{{ confirmDialogMessage }}</p>
      <template #footer>
        <Button
          label="Cancel"
          class="p-button-text"
          :disabled="confirmDialogLoading"
          @click="closeConfirmDialog"
        />
        <Button
          :label="confirmDialogActionLabel"
          severity="danger"
          :loading="confirmDialogLoading"
          :disabled="confirmDialogLoading"
          @click="confirmDeletion"
        />
      </template>
    </Dialog>
    <div v-if="loadingCourse" class="loading-panel">
      <Skeleton height="3rem" class="mb-2" />
      <Skeleton height="40vh" />
    </div>
    <template v-else-if="course">
      <Card class="course-header-card">
        <template #title>
          <div class="course-header">
            <div class="course-title">
              <Button icon="pi pi-arrow-left" class="p-button-text" @click="router.back()" />
              <h2>{{ course.title }}</h2>
              <p>{{ course.description }}</p>
            </div>
            <div class="header-actions">
              <Tag
                :value="course.is_published ? 'Published' : 'Draft'"
                :severity="course.is_published ? 'success' : 'warning'"
              />
              <div v-if="hasContentAccess" class="header-buttons">
                <Button
                  :label="course.is_published ? 'Unpublish' : 'Publish'"
                  :icon="course.is_published ? 'pi pi-eye-slash' : 'pi pi-eye'"
                  @click="toggleCoursePublish"
                />
                <Button
                  label="Preview as student"
                  icon="pi pi-external-link"
                  class="p-button-text"
                  @click="previewStudent"
                />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <div class="course-tabs">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.key"
          :to="{ name: tab.routeName, params: { id: courseId } }"
          class="course-tab-link"
          :class="{ 'is-active': currentTabKey === tab.key }"
        >
          {{ tab.label }}
        </RouterLink>
      </div>

      <div class="course-tab-panel">
        <RouterView />
      </div>
    </template>

    <Dialog v-model:visible="showModuleDialog" header="Module" modal :style="{ width: '25rem' }">
      <div class="dialog-field">
        <label>Title</label>
        <InputText v-model="moduleForm.title" placeholder="Module title" />
      </div>
      <template #footer>
        <Button label="Cancel" class="p-button-text" @click="showModuleDialog = false" />
        <Button label="Save" :loading="savingModule" @click="submitModule" />
      </template>
    </Dialog>

    <Dialog v-model:visible="showLessonDialog" header="Lesson" modal :style="{ width: '25rem' }">
      <div class="dialog-field">
        <label>Title</label>
        <InputText v-model="lessonForm.title" placeholder="Lesson title" />
      </div>
      <div class="dialog-field">
        <label>Estimated minutes</label>
        <InputNumber v-model="lessonForm.estimatedMinutes" showButtons />
      </div>
      <div class="dialog-field">
        <label>Video URL</label>
        <InputText v-model="lessonForm.videoUrl" placeholder="https://..." />
      </div>
      <template #footer>
        <Button label="Cancel" class="p-button-text" @click="showLessonDialog = false" />
        <Button label="Save" :loading="savingLesson" @click="submitLesson" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showEnrollDialog"
      header="Enroll students"
      modal
      :style="{ width: '90vw', maxWidth: '1200px' }"
      :contentStyle="{ minHeight: '60vh' }"
      class="enroll-dialog"
    >
      <div class="picklist-search">
        <span class="p-input-icon-left">
          <i class="pi pi-search" />
          <InputText v-model="picklistFilter" placeholder="Search students" />
        </span>
      </div>
      <PickList
        v-model="picklistModel"
        dataKey="id"
        class="enroll-picklist"
        sourceHeader="Available students"
        targetHeader="Selected students"
        :metaKeySelection="false"
        :showSourceControls="false"
        :showTargetControls="false"
        :filter="true"
        filterBy="fullName,email"
        sourceFilterPlaceholder="Search students"
        :breakpoint="'0px'"
        :sourceStyle="{ minHeight: '320px', maxHeight: '480px' }"
        :targetStyle="{ minHeight: '320px', maxHeight: '480px' }"
      >
        <template #item="{ item }">
          <div class="dropdown-option">
            <span class="option-name">{{ item.fullName }}</span>
            <small>{{ item.email }}</small>
          </div>
        </template>
      </PickList>
      <div class="bulk-actions">
        <span class="selection-hint">
          {{ selectedStudentCount }} student{{ selectedStudentCount === 1 ? '' : 's' }} selected
        </span>
        <div class="bulk-buttons">
          <Button
            label="Select all"
            class="p-button-text"
            :disabled="!picklistSource.length"
            @click="selectAllAvailableStudents"
          />
          <Button
            label="Clear"
            class="p-button-text"
            :disabled="!picklistTarget.length"
            @click="clearSelectedStudents"
          />
        </div>
      </div>
      <div class="dialog-field">
        <label>Group (optional)</label>
        <Dropdown
          v-model="enrollForm.groupId"
          :options="groupDropdownOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Select group"
          showClear
        />
      </div>
      <div v-if="bulkErrors.length" class="bulk-errors">
        <Tag value="Skipped" severity="warning" />
        <ul>
          <li v-for="item in bulkErrors" :key="item.studentId">
            {{ findStudentName(item.studentId) }} — {{ skippedReasonLabel(item.reason) }}
          </li>
        </ul>
      </div>
      <template #footer>
        <Button label="Cancel" class="p-button-text" @click="showEnrollDialog = false" />
        <Button label="Enroll" :loading="submittingEnrollment" @click="submitEnrollment" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showGroupDialog"
      :header="groupDialogTitle"
      modal
      :style="{ width: '30rem' }"
    >
      <div class="dialog-field">
        <label>Code</label>
        <InputText v-model="groupForm.code" placeholder="Optional code" />
      </div>
      <div class="dialog-field">
        <label>Name</label>
        <InputText v-model="groupForm.name" placeholder="Group name" />
      </div>
      <div class="dialog-field">
        <label>Schedule</label>
        <InputText v-model="groupForm.scheduleText" placeholder="Example: Tue/Thu 8pm" />
      </div>
      <div class="dialog-field">
        <label>Timezone</label>
        <Dropdown
          v-model="groupForm.timezone"
          :options="timezoneOptions"
          optionLabel="label"
          optionValue="value"
        />
      </div>
      <div class="dialog-field dialog-row">
        <div class="dialog-field-half">
          <label>Start date</label>
          <Calendar
            v-model="groupForm.startDate"
            dateFormat="yy-mm-dd"
            showButtonBar
            showIcon
          />
        </div>
        <div class="dialog-field-half">
          <label>End date</label>
          <Calendar
            v-model="groupForm.endDate"
            dateFormat="yy-mm-dd"
            showButtonBar
            showIcon
          />
        </div>
      </div>
      <div class="dialog-field">
        <label>Capacity</label>
        <InputNumber v-model="groupForm.capacity" :showButtons="true" :min="1" />
      </div>
      <div class="dialog-field">
        <label>Status</label>
        <Dropdown
          v-model="groupForm.status"
          :options="groupStatusOptions"
          optionLabel="label"
          optionValue="value"
        />
      </div>
      <div class="dialog-field dialog-switch">
        <label>Active</label>
        <InputSwitch v-model="groupForm.isActive" />
      </div>
      <template #footer>
        <Button label="Cancel" class="p-button-text" @click="closeGroupDialog" />
        <Button label="Save" :loading="savingGroup" @click="submitGroupForm" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showGroupTeacherDialog"
      header="Assign instructor"
      modal
      :style="{ width: '28rem' }"
    >
      <div class="dialog-field">
        <label>Instructor</label>
        <Dropdown
          v-model="selectedGroupTeacherUserId"
          :options="groupTeacherCandidates"
          optionLabel="label"
          optionValue="value"
          placeholder="Search instructor"
          :loading="loadingGroupTeacherCandidates"
          filter
          filterPlaceholder="Type to search"
          @filter="handleGroupTeacherFilter"
        />
      </div>
      <template #footer>
        <Button label="Cancel" class="p-button-text" @click="showGroupTeacherDialog = false" />
        <Button
          label="Assign"
          :disabled="!selectedGroupTeacherUserId"
          :loading="assigningGroupTeacher"
          @click="submitGroupTeacherAssignment"
        />
      </template>
    </Dialog>
    <SeriesFormDialog
      v-model:visible="liveSeriesDialogVisible"
      :loading="savingLiveSeries"
      :modules="modules"
      :classTypes="liveSessionClassTypes"
      :teachers="liveSessionTeachers"
      :editing="editingLiveSeries"
      @submit="handleLiveSeriesSubmit"
    />
    <SessionEditDialog
      v-model:visible="liveSessionEditDialogVisible"
      :loading="savingLiveSessionEdit"
      :session="liveSessionEditingSession"
      :modules="modules"
      :classTypes="liveSessionClassTypes"
      :teachers="liveSessionTeachers"
      @submit="handleLiveSessionEditSubmit"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount, provide } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';
import SessionEditDialog from '../components/live/SessionEditDialog.vue';
import SeriesFormDialog from '../components/live/SeriesFormDialog.vue';
import { useAuthStore } from '../stores/auth';
import { cmsCourseBuilderContextKey } from './cms/courses/cmsCourseBuilderContext';
import {
  listCourses,
  publishCourse,
  unpublishCourse,
  getModules,
  createModule,
  updateModule,
  publishModule,
  unpublishModule,
  deleteModule,
  getLessons,
  createLesson,
  updateLesson,
  publishLesson,
  unpublishLesson,
  deleteLesson,
  getAvailableStudents,
  getCourseEnrollments,
  removeEnrollment,
  updateEnrollmentGroup,
  bulkEnrollStudents,
} from '../api/cms';
import {
  listCourseGroups,
  createCourseGroup,
  updateGroup,
  getGroupTeachers,
  addGroupTeacher,
  removeGroupTeacher,
  deleteGroup,
} from '../api/groups';
import {
  listUsers,
  getCourseStaff,
  assignCourseStaff,
  removeCourseStaffRole,
} from '../api/admin';
import {
  getClassTypes as fetchLiveClassTypes,
  getGroupTeachers as fetchLiveGroupTeachers,
  listGroupSeries,
  createSeries,
  updateSeries,
  publishSeries,
  unpublishSeries,
  generateSeries,
  regenerateSeries,
  updateSession,
  deleteSeries,
  listGroupSessions,
} from '../api/liveSessions';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { t } = useI18n();
const auth = useAuthStore();
const isAdmin = computed(() => auth.isAdmin);
const hasContentAccess = computed(
  () => auth.isAdmin || (auth.hasAnyRole && auth.hasAnyRole(['instructor', 'content_editor'])),
);
const isEnrollmentManagerRole = computed(
  () => auth.hasAnyRole && auth.hasAnyRole(['enrollment_manager']),
);
const enrollmentOnlyMode = computed(
  () => isEnrollmentManagerRole.value && !hasContentAccess.value,
);
const canManageEnrollments = computed(
  () => auth.isAdmin || (auth.hasAnyRole && auth.hasAnyRole(['instructor', 'enrollment_manager'])),
);
const courseTabRouteNames = {
  summary: 'cms-course-summary',
  build: 'cms-course-build',
  groups: 'cms-course-groups',
  announcements: 'cms-course-announcements',
  posts: 'cms-course-posts',
  live: 'cms-course-live-sessions',
  attendance: 'cms-course-attendance',
  instructors: 'cms-course-instructors',
  enrollments: 'cms-course-enrollments',
  staff: 'cms-course-staff',
};
const tabs = computed(() => {
  const list = [];
  if (canManageEnrollments.value) {
    list.push({ key: 'summary', label: 'Resumen', routeName: courseTabRouteNames.summary });
  }
  if (hasContentAccess.value) {
    list.push({ key: 'build', label: 'Build', routeName: courseTabRouteNames.build });
  }
  if (canManageEnrollments.value) {
    list.push({ key: 'groups', label: 'Groups', routeName: courseTabRouteNames.groups });
  }
  if (hasContentAccess.value) {
    list.push({ key: 'announcements', label: 'Announcements', routeName: courseTabRouteNames.announcements });
  }
  if (hasContentAccess.value) {
    list.push({ key: 'posts', label: 'Posts', routeName: courseTabRouteNames.posts });
  }
  if (isAdmin.value) {
    list.push({ key: 'live', label: 'Live sessions', routeName: courseTabRouteNames.live });
  }
  if (canManageEnrollments.value) {
    list.push({ key: 'attendance', label: 'Asistencia', routeName: courseTabRouteNames.attendance });
  }
  if (canManageEnrollments.value && hasContentAccess.value) {
    list.push({ key: 'instructors', label: 'Instructors', routeName: courseTabRouteNames.instructors });
  }
  if (canManageEnrollments.value) {
    list.push({ key: 'enrollments', label: 'Enrollments', routeName: courseTabRouteNames.enrollments });
  }
  if (isAdmin.value) {
    list.push({ key: 'staff', label: 'Staff', routeName: courseTabRouteNames.staff });
  }
  return list;
});
const currentTabKey = computed(() => String(route.meta?.cmsCourseTabKey || ''));
const tabDataReady = ref({
  summary: false,
  build: false,
  groups: false,
  announcements: false,
  posts: false,
  live: false,
  attendance: false,
  instructors: false,
  enrollments: false,
  staff: false,
});

const hasTab = (key) => tabs.value.some((tab) => tab.key === key);
const determineDefaultTabKey = () => {
  if (canManageEnrollments.value && hasTab('summary')) {
    return 'summary';
  }
  if (enrollmentOnlyMode.value && hasTab('enrollments')) {
    return 'enrollments';
  }
  if (hasContentAccess.value && hasTab('build')) {
    return 'build';
  }
  if (canManageEnrollments.value && hasTab('groups')) {
    return 'groups';
  }
  if (canManageEnrollments.value && hasTab('enrollments')) {
    return 'enrollments';
  }
  if (isAdmin.value && hasTab('live')) {
    return 'live';
  }
  if (isAdmin.value && hasTab('staff')) {
    return 'staff';
  }
  return tabs.value[0]?.key ?? null;
};

const syncCurrentTabRoute = () => {
  if (currentTabKey.value && hasTab(currentTabKey.value)) {
    return;
  }
  const defaultKey = determineDefaultTabKey();
  const targetRouteName = courseTabRouteNames[defaultKey];
  if (!targetRouteName) {
    return;
  }
  if (route.name === targetRouteName) {
    return;
  }
  router.replace({ name: targetRouteName, params: { ...route.params } });
};

const courseId = route.params.id;
const course = ref(null);
const loadingCourse = ref(true);

const resetTabDataState = () => {
  tabDataReady.value = {
    summary: false,
    build: false,
    groups: false,
    announcements: false,
    posts: false,
    live: false,
    attendance: false,
    instructors: false,
    enrollments: false,
    staff: false,
  };
};

const modules = ref([]);
const selectedModuleId = ref(null);
const activeModuleTabs = ref([]);
const lessonsByModuleId = ref({});
const lessonsLoadingByModuleId = ref({});
const lessonFiltersByModuleId = ref({});
const lessonStatusOptions = [
  { label: 'All', value: 'all' },
  { label: 'Published', value: 'published' },
  { label: 'Draft', value: 'draft' },
];
const loadingModules = ref(true);
const loadingLessons = ref(false);

const showModuleDialog = ref(false);
const moduleForm = ref({ title: '' });
const editingModuleId = ref(null);
const savingModule = ref(false);

const showLessonDialog = ref(false);
const lessonForm = ref({
  title: '',
  estimatedMinutes: 0,
  videoUrl: '',
});
const savingLesson = ref(false);
const deletingModuleId = ref(null);
const deletingLessonId = ref(null);
const deletingGroupId = ref(null);
const confirmDialogVisible = ref(false);
const confirmDialogLoading = ref(false);
const confirmDialogPayload = ref({
  type: null,
  id: null,
  title: '',
  isPublished: false,
});
const resetConfirmPayload = () => {
  confirmDialogPayload.value = {
    type: null,
    id: null,
    title: '',
    isPublished: false,
  };
};
const closeConfirmDialog = () => {
  confirmDialogVisible.value = false;
  confirmDialogLoading.value = false;
  resetConfirmPayload();
};
const openConfirmDialog = ({ type, id, title = '', isPublished = false }) => {
  confirmDialogPayload.value = {
    type: type || null,
    id: id || null,
    title: title || '',
    isPublished: Boolean(isPublished),
  };
  confirmDialogVisible.value = true;
};
const openDeleteModuleDialog = (module) => {
  if (!module?.id) return;
  openConfirmDialog({
    type: 'module',
    id: module.id,
    title: module.title,
    isPublished: module.is_published,
  });
};
const openDeleteLessonDialog = (lesson) => {
  if (!lesson?.id) return;
  openConfirmDialog({
    type: 'lesson',
    id: lesson.id,
    title: lesson.title,
    isPublished: lesson.is_published,
  });
};

const openDeleteLessonDialogForModule = (_moduleId, lesson) => {
  openDeleteLessonDialog(lesson);
};
const openDeleteGroupDialog = (group) => {
  if (!group?.id) return;
  openConfirmDialog({
    type: 'group',
    id: group.id,
    title: group.name,
  });
};
const openRegenerateSeriesDialog = (series) => {
  if (!series?.id) return;
  openConfirmDialog({
    type: 'regenerate-series',
    id: series.id,
    title: series.title,
  });
};
const confirmDeletion = async () => {
  const payload = confirmDialogPayload.value;
  if (!payload.type || !payload.id) {
    closeConfirmDialog();
    return;
  }
  confirmDialogLoading.value = true;
  try {
    switch (payload.type) {
      case 'module':
        deletingModuleId.value = payload.id;
        await deleteModule(payload.id);
        toast.add({
          severity: 'success',
          summary: 'Module deleted',
          detail: 'Module removed',
          life: 2500,
        });
        await loadModules();
        closeConfirmDialog();
        break;
      case 'lesson':
        deletingLessonId.value = payload.id;
        await deleteLesson(payload.id);
        toast.add({
          severity: 'success',
          summary: 'Lesson deleted',
          detail: 'Lesson removed',
          life: 2500,
        });
        if (selectedModuleId.value) {
          await loadLessons(selectedModuleId.value);
        } else {
          lessons.value = [];
        }
        closeConfirmDialog();
        break;
      case 'group':
        deletingGroupId.value = payload.id;
        await deleteGroup(payload.id);
        toast.add({
          severity: 'success',
          summary: 'Group deleted',
          detail: 'Group removed',
          life: 2500,
        });
        await refreshGroupList();
        closeConfirmDialog();
        break;
      case 'regenerate-series':
        liveSeriesRegeneratingId.value = payload.id;
        const result = await regenerateSeries(payload.id, { weeks: 8 });
        toast.add({
          severity: 'success',
          summary: t('common.notifications.success'),
          detail: t('liveSessions.toasts.sessionsRegenerated', {
            created: result?.created || 0,
            deleted: result?.deleted || 0,
          }),
          life: 3500,
        });
        await loadLiveSessionSessions();
        closeConfirmDialog();
        break;
      default:
        break;
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail:
        payload.type === 'regenerate-series'
          ? err?.response?.data?.error || 'Failed to regenerate sessions'
          : err?.response?.data?.error || 'Failed to delete item',
      life: 3500,
    });
  } finally {
    confirmDialogLoading.value = false;
    deletingModuleId.value = null;
    deletingLessonId.value = null;
    deletingGroupId.value = null;
    liveSeriesRegeneratingId.value = null;
  }
};

const enrollments = ref([]);
const enrollmentFilter = ref('');
const enrollmentGroupFilter = ref(null);
const enrollmentPage = ref(0);
const enrollmentRows = ref(25);
const enrollmentTotal = ref(0);
const ENROLLMENT_SEARCH_DEBOUNCE = 400;
let enrollmentSearchTimeout;
const courseGroups = ref([]);
const showGroupDialog = ref(false);
const editingGroupId = ref(null);
const savingGroup = ref(false);
const groupForm = ref({
  name: '',
  code: '',
  timezone: 'America/Bogota',
  startDate: null,
  endDate: null,
  capacity: null,
  status: 'active',
  isActive: true,
  scheduleText: '',
});
const loadingEnrollments = ref(true);
const loadingGroups = ref(false);
const showEnrollDialog = ref(false);
const availableStudents = ref([]);
const loadingAvailableStudents = ref(false);
const enrollForm = ref({ groupId: null });
const picklistModel = ref([[], []]);
const picklistFilter = ref('');
const picklistSource = computed(() => picklistModel.value[0]);
const picklistTarget = computed(() => picklistModel.value[1]);
const filteredAvailableStudents = computed(() => {
  const term = picklistFilter.value.trim().toLowerCase();
  if (!term) {
    return availableStudents.value || [];
  }
  return (availableStudents.value || []).filter((student) => {
    const name = student.fullName?.toLowerCase() || '';
    const email = student.email?.toLowerCase() || '';
    return name.includes(term) || email.includes(term);
  });
});
const submittingEnrollment = ref(false);
const removingEnrollmentId = ref(null);
const updatingGroupId = ref(null);
const bulkErrors = ref([]);

const selectedGroupForTeachers = ref(null);
const groupTeachers = ref([]);
const loadingGroupTeachers = ref(false);
const removingGroupTeacherId = ref(null);
const showGroupTeacherDialog = ref(false);
const groupTeacherCandidates = ref([]);
const loadingGroupTeacherCandidates = ref(false);
const groupTeacherSearchTerm = ref('');
const selectedGroupTeacherUserId = ref(null);
const assigningGroupTeacher = ref(false);
const GROUP_TEACHER_SEARCH_DEBOUNCE = 400;
let groupTeacherFilterTimeout;

const staffAssignments = ref([]);
const loadingStaff = ref(false);
const assigningStaff = ref(false);
const removingStaffRoleKey = ref(null);
const staffForm = ref({ userId: null, roles: [] });
const staffRoleOptions = [
  { label: 'Instructor', value: 'instructor' },
  { label: 'Content editor', value: 'content_editor' },
  { label: 'Enrollment manager', value: 'enrollment_manager' },
];
const staffRoleLabels = {
  instructor: 'Instructor',
  content_editor: 'Content editor',
  enrollment_manager: 'Enrollment manager',
};
const timezoneOptions = [
  { label: 'America/Bogota', value: 'America/Bogota' },
  { label: 'America/New_York', value: 'America/New_York' },
  { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
  { label: 'UTC', value: 'UTC' },
];
const groupStatusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Archived', value: 'archived' },
];
const staffCandidates = ref([]);
const loadingStaffCandidates = ref(false);
const STAFF_SEARCH_DEBOUNCE = 400;
let staffFilterTimeout;

const selectedModule = computed(() => modules.value.find((m) => m.id === selectedModuleId.value));
const groupDropdownOptions = computed(() => {
  const base = [{ label: 'No group', value: null }];
  const groupOptions = courseGroups.value.map((group) => ({
    label: group.scheduleText ? `${group.name} (${group.scheduleText})` : group.name,
    value: group.id,
  }));
  return [...base, ...groupOptions];
});
const enrollmentGroupOptions = computed(() => [
  { label: 'All groups', value: null },
  { label: 'No group', value: 'no-group' },
  ...courseGroups.value.map((group) => ({
    label: group.scheduleText ? `${group.name} (${group.scheduleText})` : group.name,
    value: group.id,
  })),
]);
const enrollmentRowsOptions = [10, 25, 50];
const groupDialogTitle = computed(() =>
  editingGroupId.value ? 'Edit group' : 'Create group'
);
const setPicklistState = (source, target) => {
  picklistModel.value = [source, target];
};
const selectedStudentCount = computed(() => picklistTarget.value.length);

const groupTeacherOptions = computed(() =>
  courseGroups.value.map((group) => ({
    label: group.scheduleText ? `${group.name} (${group.scheduleText})` : group.name,
    value: group.id,
  })),
);
const liveSessionGroupOptions = computed(() =>
  courseGroups.value.map((group) => ({
    label: group.scheduleText ? `${group.name} (${group.scheduleText})` : group.name,
    value: group.id,
  })),
);
const confirmDialogMessage = computed(() => {
  const { type, title, isPublished } = confirmDialogPayload.value;
  if (!type) {
    return '';
  }
  const labelMap = {
    module: 'This module',
    lesson: 'This lesson',
    group: 'This group',
    'regenerate-series': 'This series',
  };
  const itemLabel = title ? `“${title}”` : labelMap[type] || 'This item';
  switch (type) {
    case 'module':
      return `${itemLabel} — Are you sure you want to delete this module? All its lessons will be removed.${
        isPublished ? ' It is currently published and deleting it will affect learners immediately.' : ''
      }`;
    case 'lesson':
      return `${itemLabel} — Are you sure you want to delete this lesson?${
        isPublished ? ' It is published and this action will impact students right away.' : ''
      }`;
    case 'group':
      return `${itemLabel} — Are you sure you want to delete this group? Students and sessions will be affected.`;
    case 'regenerate-series':
      return `${itemLabel} — Regenerating will remove previously generated sessions in the upcoming window and recreate them with the updated series settings.`;
    default:
      return '';
  }
});
const confirmDialogHeader = computed(() => {
  const { type } = confirmDialogPayload.value;
  if (type === 'regenerate-series') {
    return 'Regenerate sessions';
  }
  return 'Confirm deletion';
});
const confirmDialogActionLabel = computed(() => {
  const { type } = confirmDialogPayload.value;
  switch (type) {
    case 'module':
      return 'Delete module';
    case 'lesson':
      return 'Delete lesson';
    case 'group':
      return 'Delete group';
    case 'regenerate-series':
      return 'Regenerate sessions';
    default:
      return 'Delete';
  }
});

const defaultLiveSessionRange = () => {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7);
  const toDate = new Date();
  toDate.setDate(toDate.getDate() + 28);
  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  };
};

const liveSessionGroupId = ref(null);
const liveSessionClassTypes = ref([]);
const liveSessionClassTypesLoaded = ref(false);
const liveSessionTeachers = ref([]);
const liveSessionSeries = ref([]);
const liveSessionSeriesLoading = ref(false);
const liveSessionSessions = ref([]);
const liveSessionSessionsLoading = ref(false);
const liveSessionLoading = ref(false);
const liveSessionError = ref(false);
const liveSeriesDialogVisible = ref(false);
const editingLiveSeries = ref(null);
const savingLiveSeries = ref(false);
const liveSeriesPublishLoadingId = ref(null);
const liveSeriesGeneratingId = ref(null);
const liveSeriesRegeneratingId = ref(null);
const liveSeriesDeletingId = ref(null);
const liveSessionEditingSession = ref(null);
const liveSessionEditDialogVisible = ref(false);
const savingLiveSessionEdit = ref(false);
const liveSessionRange = ref(null);

const loadLiveSessionClassTypes = async () => {
  if (liveSessionClassTypesLoaded.value) {
    return;
  }
  try {
    const types = await fetchLiveClassTypes();
    liveSessionClassTypes.value = Array.isArray(types) ? types : [];
    liveSessionClassTypesLoaded.value = true;
  } catch (err) {
    liveSessionClassTypes.value = [];
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load live session class types',
      life: 3000,
    });
    throw err;
  }
};

const loadLiveSessionTeachers = async () => {
  if (!liveSessionGroupId.value) {
    liveSessionTeachers.value = [];
    return;
  }
  try {
    const teachers = await fetchLiveGroupTeachers(liveSessionGroupId.value);
    liveSessionTeachers.value = (teachers || []).map((teacher) => ({
      id: teacher.id || teacher.user_id,
      full_name: teacher.full_name || teacher.fullName || teacher.name,
      email: teacher.email,
    }));
  } catch (err) {
    liveSessionTeachers.value = [];
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load live session instructors',
      life: 3000,
    });
    throw err;
  }
};

const loadLiveSessionSeries = async () => {
  if (!liveSessionGroupId.value) {
    liveSessionSeries.value = [];
    return;
  }
  liveSessionSeriesLoading.value = true;
  try {
    liveSessionSeries.value = await listGroupSeries(liveSessionGroupId.value);
  } catch (err) {
    liveSessionSeries.value = [];
    liveSessionError.value = true;
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load live series',
      life: 3000,
    });
    throw err;
  } finally {
    liveSessionSeriesLoading.value = false;
  }
};

const loadLiveSessionSessions = async () => {
  if (!liveSessionGroupId.value) {
    liveSessionSessions.value = [];
    return;
  }
  liveSessionSessionsLoading.value = true;
  try {
    const params = {};
    if (liveSessionRange.value?.from) {
      params.from = liveSessionRange.value.from;
    }
    if (liveSessionRange.value?.to) {
      params.to = liveSessionRange.value.to;
    }
    liveSessionSessions.value = await listGroupSessions(liveSessionGroupId.value, params);
  } catch (err) {
    liveSessionSessions.value = [];
    liveSessionError.value = true;
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load live sessions',
      life: 3000,
    });
    throw err;
  } finally {
    liveSessionSessionsLoading.value = false;
  }
};

const loadLiveSessionData = async () => {
  if (!isAdmin.value || !liveSessionGroupId.value) {
    return;
  }
  liveSessionLoading.value = true;
  liveSessionError.value = false;
  try {
    await Promise.all([
      loadLiveSessionClassTypes(),
      loadLiveSessionTeachers(),
      loadLiveSessionSeries(),
      loadLiveSessionSessions(),
    ]);
  } catch (err) {
    liveSessionError.value = true;
  } finally {
    liveSessionLoading.value = false;
  }
};

const ensureLiveSessionGroupSelection = () => {
  if (!isAdmin.value) {
    liveSessionGroupId.value = null;
    return;
  }
  if (!courseGroups.value.length) {
    liveSessionGroupId.value = null;
    return;
  }
  if (
    !liveSessionGroupId.value ||
    !courseGroups.value.some((group) => group.id === liveSessionGroupId.value)
  ) {
    liveSessionGroupId.value = courseGroups.value[0].id;
  }
};

const openLiveSeriesCreate = () => {
  editingLiveSeries.value = null;
  liveSeriesDialogVisible.value = true;
};

const openLiveSeriesEdit = (series) => {
  editingLiveSeries.value = series || null;
  liveSeriesDialogVisible.value = true;
};

const handleLiveSeriesSubmit = async (payload) => {
  debugger;
  if (!liveSessionGroupId.value) return;
  savingLiveSeries.value = true;
  try {
    if (editingLiveSeries.value) {
      await updateSeries(editingLiveSeries.value.id, payload);
      toast.add({
        severity: 'success',
        summary: 'Series updated',
        detail: 'Live series updated',
        life: 2500,
      });
    } else {
      await createSeries(liveSessionGroupId.value, payload);
      toast.add({
        severity: 'success',
        summary: 'Series created',
        detail: 'Live series created',
        life: 2500,
      });
    }
    liveSeriesDialogVisible.value = false;
    editingLiveSeries.value = null;
    await loadLiveSessionSeries();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'Failed to save live series',
      life: 3000,
    });
  } finally {
    savingLiveSeries.value = false;
  }
};

const handleLiveSeriesPublishToggle = async ({ series, value }) => {
  if (!series) return;
  liveSeriesPublishLoadingId.value = series.id;
  try {
    if (value) {
      await publishSeries(series.id);
      toast.add({ severity: 'success', summary: 'Series published', life: 2500 });
    } else {
      await unpublishSeries(series.id);
      toast.add({ severity: 'info', summary: 'Series unpublished', life: 2000 });
    }
    await loadLiveSessionSeries();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'Failed to update live series',
      life: 3000,
    });
  } finally {
    liveSeriesPublishLoadingId.value = null;
  }
};

const handleLiveSeriesGenerate = async (series) => {
  debugger;
  if (!series) return;
  liveSeriesGeneratingId.value = series.id;
  try {
    const result = await generateSeries(series.id, series);
    toast.add({
      severity: 'success',
      summary: 'Sessions generated',
      detail: `${result?.created || 0} session(s) created`,
      life: 3000,
    });
    await loadLiveSessionSessions();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'Failed to generate sessions',
      life: 3000,
    });
  } finally {
    liveSeriesGeneratingId.value = null;
  }
};

const openLiveSessionEdit = (session) => {
  if (!session || !session.id) return;
  liveSessionEditingSession.value = session;
  liveSessionEditDialogVisible.value = true;
};

watch(liveSessionEditDialogVisible, (visible) => {
  if (!visible) {
    liveSessionEditingSession.value = null;
  }
});

const handleLiveSessionEditSubmit = async ({ sessionId, payload }) => {
  if (!sessionId || !liveSessionGroupId.value) {
    return;
  }
  savingLiveSessionEdit.value = true;
  try {
    await updateSession(sessionId, payload);
    toast.add({
      severity: 'success',
      summary: t('common.notifications.success'),
      detail: t('liveSessions.toasts.sessionUpdated'),
      life: 3000,
    });
    await loadLiveSessionSessions();
    liveSessionEditDialogVisible.value = false;
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('common.notifications.error'),
      detail: err?.response?.data?.error || t('liveSessions.toasts.sessionUpdateFailed'),
      life: 3500,
    });
  } finally {
    savingLiveSessionEdit.value = false;
  }
};

const handleLiveSeriesDelete = async (series) => {
  if (!series) return;
  const confirmed = window.confirm(
    'Are you sure you want to delete this series? Generated sessions will be removed.',
  );
  if (!confirmed) {
    return;
  }
  liveSeriesDeletingId.value = series.id;
  try {
    await deleteSeries(series.id);
    toast.add({
      severity: 'success',
      summary: 'Series deleted',
      detail: 'Live series removed',
      life: 2500,
    });
    await Promise.all([loadLiveSessionSeries(), loadLiveSessionSessions()]);
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'Failed to delete live series',
      life: 3000,
    });
  } finally {
    liveSeriesDeletingId.value = null;
  }
};

const handleLiveSessionsRangeChange = (range) => {
  if (!range?.from || !range?.to) {
    liveSessionRange.value = defaultLiveSessionRange();
  } else {
    liveSessionRange.value = range;
  }
  loadLiveSessionSessions();
};

const handleLiveSessionsRefresh = () => {
  loadLiveSessionSessions();
};

const updateGroupList = (groups) => {
  courseGroups.value = groups || [];
  ensureGroupTeacherSelection();
  ensureLiveSessionGroupSelection();
};

const refreshGroupList = async () => {
  loadingGroups.value = true;
  try {
    const groups = await listCourseGroups(courseId);
    updateGroupList(groups);
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load groups',
      life: 3000,
    });
  }
  finally {
    loadingGroups.value = false;
  }
};

const ensureGroupsReady = async (...keys) => {
  const needsFetch = keys.some((key) => !tabDataReady.value[key]);
  if (!needsFetch) {
    return;
  }
  await refreshGroupList();
  const nextState = { ...tabDataReady.value };
  keys.forEach((key) => {
    nextState[key] = true;
  });
  tabDataReady.value = nextState;
};

let groupTeachersRequestId = 0;
const loadGroupTeachers = async (groupId) => {
  if (!groupId || !canManageEnrollments.value) {
    groupTeachers.value = [];
    return;
  }
  const requestId = ++groupTeachersRequestId;
  loadingGroupTeachers.value = true;
  try {
    const rows = await getGroupTeachers(groupId);
    if (requestId !== groupTeachersRequestId) {
      return;
    }
    groupTeachers.value = (rows || []).map((row) => ({
      id: row.id || row.user_id,
      fullName: row.fullName || row.full_name || row.name,
      email: row.email,
    }));
  } catch (err) {
    if (requestId === groupTeachersRequestId) {
      groupTeachers.value = [];
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load group instructors',
        life: 3000,
      });
    }
  } finally {
    if (requestId === groupTeachersRequestId) {
      loadingGroupTeachers.value = false;
    }
  }
};

const ensureGroupTeacherSelection = () => {
  if (!canManageEnrollments.value) {
    selectedGroupForTeachers.value = null;
    groupTeachers.value = [];
    return;
  }
  const groups = courseGroups.value;
  if (!groups.length) {
    selectedGroupForTeachers.value = null;
    groupTeachers.value = [];
    return;
  }
  if (
    !selectedGroupForTeachers.value ||
    !groups.some((group) => group.id === selectedGroupForTeachers.value)
  ) {
    selectedGroupForTeachers.value = groups[0].id;
  }
};

const fetchGroupTeacherCandidates = async () => {
  loadingGroupTeacherCandidates.value = true;
  try {
    const params = { page: 1, pageSize: 25, role: 'instructor' };
    const term = groupTeacherSearchTerm.value.trim();
    if (term) {
      params.search = term;
    }
    const response = await listUsers(params);
    const userList = Array.isArray(response?.users)
      ? response.users
      : Array.isArray(response)
      ? response
      : [];
    const assignedIds = new Set(groupTeachers.value.map((teacher) => teacher.id));
    groupTeacherCandidates.value = userList
      .filter((user) => !assignedIds.has(user.id))
      .map((user) => ({
      label: `${user.full_name || user.fullName} (${user.email})`,
      value: user.id,
    }));
  } catch (err) {
    groupTeacherCandidates.value = [];
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to search instructors',
      life: 3000,
    });
  } finally {
    loadingGroupTeacherCandidates.value = false;
  }
};

const openGroupTeacherDialog = (groupId = null) => {
  if (groupId && typeof groupId === 'string') {
    selectedGroupForTeachers.value = groupId;
  }
  if (!selectedGroupForTeachers.value) {
    toast.add({
      severity: 'warn',
      summary: 'Select group',
      detail: 'Choose a group before assigning instructors',
      life: 2500,
    });
    return;
  }
  groupTeacherSearchTerm.value = '';
  selectedGroupTeacherUserId.value = null;
  groupTeacherCandidates.value = [];
  showGroupTeacherDialog.value = true;
  fetchGroupTeacherCandidates();
};

const handleGroupTeacherFilter = (event) => {
  const term = event?.value || '';
  groupTeacherSearchTerm.value = term;
  if (groupTeacherFilterTimeout) {
    clearTimeout(groupTeacherFilterTimeout);
  }
  groupTeacherFilterTimeout = setTimeout(() => {
    fetchGroupTeacherCandidates();
  }, GROUP_TEACHER_SEARCH_DEBOUNCE);
};

const submitGroupTeacherAssignment = async () => {
  if (!selectedGroupForTeachers.value) {
    toast.add({
      severity: 'warn',
      summary: 'Select group',
      detail: 'Choose a group before assigning instructors',
      life: 2500,
    });
    return;
  }
  if (!selectedGroupTeacherUserId.value) {
    toast.add({
      severity: 'warn',
      summary: 'Select instructor',
      detail: 'Choose an instructor to assign',
      life: 2500,
    });
    return;
  }

  assigningGroupTeacher.value = true;
  try {
    await addGroupTeacher(selectedGroupForTeachers.value, {
      userId: selectedGroupTeacherUserId.value,
    });
    toast.add({
      severity: 'success',
      summary: 'Assigned',
      detail: 'Instructor assigned to group',
      life: 2000,
    });
    showGroupTeacherDialog.value = false;
    await loadGroupTeachers(selectedGroupForTeachers.value);
    if (selectedGroupForTeachers.value === liveSessionGroupId.value) {
      await loadLiveSessionTeachers();
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to assign instructor',
      life: 3000,
    });
  } finally {
    assigningGroupTeacher.value = false;
  }
};

const removeGroupInstructor = async (userId) => {
  if (!selectedGroupForTeachers.value) {
    return;
  }
  removingGroupTeacherId.value = userId;
  try {
    await removeGroupTeacher(selectedGroupForTeachers.value, userId);
    toast.add({
      severity: 'success',
      summary: 'Removed',
      detail: 'Instructor removed from group',
      life: 2000,
    });
    await loadGroupTeachers(selectedGroupForTeachers.value);
    if (selectedGroupForTeachers.value === liveSessionGroupId.value) {
      await loadLiveSessionTeachers();
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to remove instructor',
      life: 3000,
    });
  } finally {
    removingGroupTeacherId.value = null;
  }
};

const normalizeDateValue = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'string') {
    return value || null;
  }
  return null;
};

const defaultGroupForm = () => ({
  name: '',
  code: '',
  timezone: 'America/Bogota',
  startDate: null,
  endDate: null,
  capacity: null,
  status: 'active',
  isActive: true,
  scheduleText: '',
});

const openGroupDialog = (group = null) => {
  editingGroupId.value = group?.id || null;
  groupForm.value = {
    name: group?.name || '',
    code: group?.code || '',
    timezone: group?.timezone || 'America/Bogota',
    startDate: group?.startDate ? new Date(group.startDate) : null,
    endDate: group?.endDate ? new Date(group.endDate) : null,
    capacity: typeof group?.capacity === 'number' ? group.capacity : null,
    status: group?.status || 'active',
    isActive: group?.isActive !== undefined ? group.isActive : true,
    scheduleText: group?.scheduleText || '',
  };
  showGroupDialog.value = true;
};

const closeGroupDialog = () => {
  showGroupDialog.value = false;
  editingGroupId.value = null;
  groupForm.value = defaultGroupForm();
};

const submitGroupForm = async () => {
  const trimmedName = (groupForm.value.name || '').trim();
  if (!trimmedName) {
    toast.add({
      severity: 'warn',
      summary: 'Missing information',
      detail: 'Group name is required',
      life: 2500,
    });
    return;
  }

  savingGroup.value = true;
  try {
    const payload = {
      name: trimmedName,
      code: (groupForm.value.code || '').trim() || null,
      timezone: groupForm.value.timezone || 'America/Bogota',
      startDate: normalizeDateValue(groupForm.value.startDate),
      endDate: normalizeDateValue(groupForm.value.endDate),
      capacity: groupForm.value.capacity ?? null,
      status: groupForm.value.status || 'active',
      isActive: groupForm.value.isActive,
      scheduleText: (groupForm.value.scheduleText || '').trim() || null,
    };

    if (editingGroupId.value) {
      await updateGroup(editingGroupId.value, payload);
      toast.add({
        severity: 'success',
        summary: 'Group updated',
        detail: 'Group details saved',
        life: 2500,
      });
    } else {
      await createCourseGroup(courseId, payload);
      toast.add({
        severity: 'success',
        summary: 'Group created',
        detail: 'Group added successfully',
        life: 2500,
      });
    }
    closeGroupDialog();
    await refreshGroupList();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'Failed to save group',
      life: 3000,
    });
  } finally {
    savingGroup.value = false;
  }
};

const loadCourse = async () => {
  if (!auth.isAuthenticated || auth.isLoggingOut) {
    course.value = null;
    loadingCourse.value = false;
    return;
  }
  loadingCourse.value = true;
  try {
    const list = await listCourses();
    course.value = list.find((item) => item.id === courseId) || null;
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load course', life: 3000 });
  } finally {
    loadingCourse.value = false;
  }
};

const ensureLessonFilterForModule = (moduleId) => {
  if (!lessonFiltersByModuleId.value[moduleId]) {
    lessonFiltersByModuleId.value = {
      ...lessonFiltersByModuleId.value,
      [moduleId]: { search: '', status: 'all' },
    };
  }
};

const loadModules = async () => {
  if (!hasContentAccess.value) {
    modules.value = [];
    selectedModuleId.value = null;
    lessons.value = [];
    loadingModules.value = false;
    return;
  }
  loadingModules.value = true;
  try {
    modules.value = await getModules(courseId);
    modules.value.forEach((module) => ensureLessonFilterForModule(module.id));
    if (!selectedModuleId.value && modules.value.length) {
      selectedModuleId.value = modules.value[0].id;
    }
    if (modules.value.length) {
      activeModuleTabs.value = [0];
      await ensureLessonsForModule(modules.value[0].id);
    }
    if (selectedModuleId.value) {
      await ensureLessonsForModule(selectedModuleId.value);
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load modules', life: 3000 });
  } finally {
    loadingModules.value = false;
  }
};

const loadLessons = async (moduleId) => {
  if (!hasContentAccess.value) {
    lessons.value = [];
    loadingLessons.value = false;
    return;
  }
  loadingLessons.value = true;
  try {
    lessons.value = await getLessons(moduleId);
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load lessons', life: 3000 });
  } finally {
    loadingLessons.value = false;
  }
};

const ensureLessonsForModule = async (moduleId) => {
  if (lessonsByModuleId.value[moduleId]) {
    return;
  }
  lessonsLoadingByModuleId.value = {
    ...lessonsLoadingByModuleId.value,
    [moduleId]: true,
  };
  try {
    const data = await getLessons(moduleId);
    lessonsByModuleId.value = {
      ...lessonsByModuleId.value,
      [moduleId]: data,
    };
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load lessons', life: 3000 });
  } finally {
    lessonsLoadingByModuleId.value = {
      ...lessonsLoadingByModuleId.value,
      [moduleId]: false,
    };
  }
};

const reloadLessonsForModule = async (moduleId) => {
  lessonsLoadingByModuleId.value = {
    ...lessonsLoadingByModuleId.value,
    [moduleId]: true,
  };
  try {
    const data = await getLessons(moduleId);
    lessonsByModuleId.value = {
      ...lessonsByModuleId.value,
      [moduleId]: data,
    };
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to reload lessons', life: 3000 });
  } finally {
    lessonsLoadingByModuleId.value = {
      ...lessonsLoadingByModuleId.value,
      [moduleId]: false,
    };
  }
};

const loadEnrollmentData = async () => {
  if (!canManageEnrollments.value) {
    enrollments.value = [];
    enrollmentTotal.value = 0;
    courseGroups.value = [];
    ensureGroupTeacherSelection();
    return;
  }
  loadingEnrollments.value = true;
  loadingGroups.value = true;
  try {
    const params = {
      page: enrollmentPage.value + 1,
      pageSize: enrollmentRows.value,
    };
    if (enrollmentFilter.value.trim()) {
      params.search = enrollmentFilter.value.trim();
    }
    if (enrollmentGroupFilter.value) {
      params.groupId = enrollmentGroupFilter.value;
    }
    const [enrollmentRes, groupRows] = await Promise.all([
      getCourseEnrollments(courseId, params),
      listCourseGroups(courseId),
    ]);
    const isLegacyResponse = Array.isArray(enrollmentRes);
    const totalRecords = isLegacyResponse
      ? enrollmentRes.length
      : Number(enrollmentRes?.total ?? 0) || 0;
    enrollmentTotal.value = totalRecords;
    const records = isLegacyResponse
      ? enrollmentRes
      : Array.isArray(enrollmentRes?.data)
      ? enrollmentRes.data
      : [];
    const maxPage = Math.max(Math.ceil((totalRecords || 0) / enrollmentRows.value) - 1, 0);
    if (enrollmentPage.value > maxPage) {
      enrollmentPage.value = maxPage;
      if (!isLegacyResponse && maxPage + 1 !== params.page) {
        await loadEnrollmentData();
        return;
      }
    }
    if (isLegacyResponse) {
      const start = enrollmentPage.value * enrollmentRows.value;
      enrollments.value = records.slice(start, start + enrollmentRows.value);
    } else {
      enrollments.value = records;
    }
    updateGroupList(groupRows);
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load enrollments',
      life: 3000,
    });
  } finally {
    loadingEnrollments.value = false;
    loadingGroups.value = false;
  }
};

const clearEnrollmentSearchTimeout = () => {
  if (enrollmentSearchTimeout) {
    clearTimeout(enrollmentSearchTimeout);
    enrollmentSearchTimeout = null;
  }
};

const onEnrollmentPage = (event) => {
  const nextRows = event.rows;
  const nextPage = Math.floor(event.first / event.rows);
  if (enrollmentRows.value === nextRows && enrollmentPage.value === nextPage) {
    return;
  }
  enrollmentRows.value = nextRows;
  enrollmentPage.value = nextPage;
  loadEnrollmentData();
};

const fetchStaffCandidates = async (searchTerm = '') => {
  loadingStaffCandidates.value = true;
  try {
    const params = { page: 1, pageSize: 25 };
    if (searchTerm.trim()) {
      params.search = searchTerm.trim();
    }
    const response = await listUsers(params);
    const userList = Array.isArray(response?.users)
      ? response.users
      : Array.isArray(response)
      ? response
      : [];
    staffCandidates.value = userList.map((user) => ({
      label: `${user.full_name} (${user.email})`,
      value: user.id,
    }));
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load users',
      life: 3000,
    });
  } finally {
    loadingStaffCandidates.value = false;
  }
};

const ensureStaffCandidates = async () => {
  if (!isAdmin.value || staffCandidates.value.length || loadingStaffCandidates.value) {
    return;
  }
  await fetchStaffCandidates();
};

const handleStaffFilter = (event) => {
  if (!isAdmin.value) {
    return;
  }
  const term = event?.value || '';
  if (staffFilterTimeout) {
    clearTimeout(staffFilterTimeout);
  }
  staffFilterTimeout = setTimeout(() => {
    fetchStaffCandidates(term);
  }, STAFF_SEARCH_DEBOUNCE);
};

const loadStaffAssignments = async () => {
  if (!isAdmin.value) {
    return;
  }
  loadingStaff.value = true;
  try {
    staffAssignments.value = await getCourseStaff(courseId);
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load staff',
      life: 3000,
    });
  } finally {
    loadingStaff.value = false;
  }
};

const submitStaffAssignment = async () => {
  if (!staffForm.value.userId || !staffForm.value.roles.length) {
    toast.add({
      severity: 'warn',
      summary: 'Missing info',
      detail: 'Select a user and at least one role',
      life: 3000,
    });
    return;
  }
  assigningStaff.value = true;
  try {
    await assignCourseStaff(courseId, {
      userId: staffForm.value.userId,
      roles: staffForm.value.roles,
    });
    toast.add({
      severity: 'success',
      summary: 'Staff updated',
      detail: 'Roles assigned successfully',
      life: 2000,
    });
    staffForm.value = { userId: null, roles: [] };
    await loadStaffAssignments();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to assign staff',
      life: 3000,
    });
  } finally {
    assigningStaff.value = false;
  }
};

const removeStaffRole = async (userId, roleName) => {
  removingStaffRoleKey.value = `${userId}:${roleName}`;
  try {
    await removeCourseStaffRole(courseId, userId, roleName);
    toast.add({
      severity: 'success',
      summary: 'Role removed',
      life: 2000,
    });
    await loadStaffAssignments();
  } catch (err) {
    const apiError = err?.response?.data;
    const isDependencyConflict = err?.response?.status === 409 && apiError?.details;
    let detail = 'Failed to remove role';

    if (isDependencyConflict) {
      const groupAssignments = Number(apiError.details.groupAssignments || 0);
      const hostedSeries = Number(apiError.details.hostedSeries || 0);
      const hostedSessions = Number(apiError.details.hostedSessions || 0);
      detail = `No se puede remover el rol de instructor. Dependencias activas: grupos (${groupAssignments}), series en vivo (${hostedSeries}), sesiones en vivo (${hostedSessions}).`;
    } else if (apiError?.error) {
      detail = apiError.error;
    }

    toast.add({
      severity: 'error',
      summary: 'Error',
      detail,
      life: 4500,
    });
  } finally {
    removingStaffRoleKey.value = null;
  }
};

const syncPicklistSource = () => {
  if (!showEnrollDialog.value) return;
  const target = picklistTarget.value;
  const targetIds = new Set(target.map((student) => student.id));
  const nextSource = (filteredAvailableStudents.value || []).filter(
    (student) => !targetIds.has(student.id),
  );
  setPicklistState(nextSource, target);
};

const loadAvailableStudents = async () => {
  if (!canManageEnrollments.value) {
    availableStudents.value = [];
    return;
  }
  loadingAvailableStudents.value = true;
  try {
    availableStudents.value = await getAvailableStudents(courseId);
    syncPicklistSource();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load students',
      life: 3000,
    });
  } finally {
    loadingAvailableStudents.value = false;
  }
};

const selectModule = async (moduleId) => {
  selectedModuleId.value = moduleId;
  await ensureLessonsForModule(moduleId);
};

const selectModuleFromTab = async (moduleId) => {
  selectedModuleId.value = moduleId;
  await ensureLessonsForModule(moduleId);
};

const onModuleTabOpen = async (event) => {
  const idx = event?.index;
  if (typeof idx !== 'number') {
    return;
  }
  const module = modules.value[idx];
  if (!module) {
    return;
  }
  selectedModuleId.value = module.id;
  await ensureLessonsForModule(module.id);
};

const toggleCoursePublish = async () => {
  try {
    if (course.value.is_published) {
      await unpublishCourse(courseId);
      toast.add({ severity: 'info', summary: 'Course unpublished', life: 2000 });
    } else {
      await publishCourse(courseId);
      toast.add({ severity: 'success', summary: 'Course published', life: 2000 });
    }
    await loadCourse();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to update course',
      life: 3500,
    });
  }
};

const previewStudent = () => {
  const url = router.resolve({
    path: `/student/course/${courseId}`,
    query: { preview: '1' },
  }).href;
  window.open(url, '_blank', 'noopener');
};

const openModuleDialog = (module) => {
  editingModuleId.value = module?.id || null;
  moduleForm.value = { title: module?.title || '' };
  showModuleDialog.value = true;
};

const submitModule = async () => {
  if (!moduleForm.value.title.trim()) {
    toast.add({ severity: 'warn', summary: 'Title required', detail: 'Module title is required', life: 2500 });
    return;
  }
  savingModule.value = true;
  try {
    if (editingModuleId.value) {
      await updateModule(editingModuleId.value, { title: moduleForm.value.title });
      toast.add({ severity: 'success', summary: 'Module updated', life: 2000 });
    } else {
      await createModule(courseId, { title: moduleForm.value.title });
      toast.add({ severity: 'success', summary: 'Module created', life: 2000 });
    }
    showModuleDialog.value = false;
    await loadModules();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to save module',
      life: 3500,
    });
  } finally {
    savingModule.value = false;
  }
};

const toggleModulePublish = async (module) => {
  try {
    if (module.is_published) {
      await unpublishModule(module.id);
      toast.add({ severity: 'info', summary: 'Module unpublished', life: 2000 });
    } else {
      await publishModule(module.id);
      toast.add({ severity: 'success', summary: 'Module published', life: 2000 });
    }
    await loadModules();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to update module',
      life: 3500,
    });
  }
};

const reorderModule = async (module, direction) => {
  const index = modules.value.findIndex((m) => m.id === module.id);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  const swapWith = modules.value[targetIndex];
  if (!swapWith) return;
  try {
    await Promise.all([
      updateModule(module.id, { orderIndex: swapWith.order_index }),
      updateModule(swapWith.id, { orderIndex: module.order_index }),
    ]);
    await loadModules();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to reorder modules', life: 3000 });
  }
};

const openLessonDialog = () => {
  if (!selectedModuleId.value) return;
  lessonForm.value = { title: '', estimatedMinutes: 0, videoUrl: '' };
  showLessonDialog.value = true;
};

const openLessonDialogForModule = (moduleId) => {
  if (!moduleId) return;
  selectedModuleId.value = moduleId;
  openLessonDialog();
};

const openEnrollDialog = async () => {
  enrollForm.value = { groupId: null };
  bulkErrors.value = [];
  setPicklistState([], []);
  showEnrollDialog.value = true;
  await loadAvailableStudents();
};

const submitLesson = async () => {
  if (!lessonForm.value.title.trim()) {
    toast.add({ severity: 'warn', summary: 'Title required', detail: 'Lesson title is required', life: 2500 });
    return;
  }
  savingLesson.value = true;
  try {
    const payload = {
      title: lessonForm.value.title,
      estimatedMinutes: lessonForm.value.estimatedMinutes,
    };
    const trimmedVideoUrl = lessonForm.value.videoUrl?.trim();
    if (trimmedVideoUrl) {
      payload.videoUrl = trimmedVideoUrl;
    }
    await createLesson(selectedModuleId.value, payload);
    toast.add({ severity: 'success', summary: 'Lesson created', life: 2000 });
    showLessonDialog.value = false;
    await loadLessons(selectedModuleId.value);
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to create lesson',
      life: 3500,
    });
  } finally {
    savingLesson.value = false;
  }
};

const submitEnrollment = async () => {
  if (!picklistTarget.value.length) {
    toast.add({
      severity: 'warn',
      summary: 'Students required',
      detail: 'Select at least one student',
      life: 2500,
    });
    return;
  }
  submittingEnrollment.value = true;
  try {
    const result = await bulkEnrollStudents(courseId, {
      studentIds: picklistTarget.value.map((student) => student.id),
      groupId: enrollForm.value.groupId || null,
    });
    bulkErrors.value = result.skipped || [];
    const enrolledCount = result.enrolled?.length || 0;
    const skippedCount = result.skipped?.length || 0;

    if (enrolledCount) {
      toast.add({
        severity: 'success',
        summary: 'Students enrolled',
        detail: `${enrolledCount} student(s) enrolled successfully`,
        life: 2500,
      });
      await Promise.all([loadEnrollmentData(), loadAvailableStudents()]);
      enrollForm.value = { groupId: null };
      setPicklistState([], []);
      showEnrollDialog.value = false;
    }
    if (skippedCount) {
      toast.add({
        severity: 'warn',
        summary: 'Some students were skipped',
        detail: `${skippedCount} already enrolled or invalid`,
        life: 4000,
      });
    }
    if (!enrolledCount && skippedCount) {
      // keep dialog open so user can review errors
      await loadAvailableStudents();
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to enroll students',
      life: 3500,
    });
  } finally {
    submittingEnrollment.value = false;
  }
};

const removeEnrollmentRow = async (row) => {
  if (!window.confirm(`Remove ${row.fullName} from this course?`)) return;
  removingEnrollmentId.value = row.studentId;
  try {
    await removeEnrollment(courseId, row.studentId);
    toast.add({ severity: 'success', summary: 'Enrollment removed', life: 2000 });
    await loadEnrollmentData();
    if (showEnrollDialog.value) {
      await loadAvailableStudents();
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to remove enrollment',
      life: 3500,
    });
  } finally {
    removingEnrollmentId.value = null;
  }
};

const updateStudentGroup = async (studentId, groupId) => {
  const current = enrollments.value.find((s) => s.studentId === studentId)?.groupId || null;
  const nextGroupId = groupId || null;
  if (current === nextGroupId) {
    return;
  }
  updatingGroupId.value = studentId;
  try {
    await updateEnrollmentGroup(courseId, studentId, { groupId: nextGroupId });
    toast.add({ severity: 'success', summary: 'Group updated', life: 2000 });
    await loadEnrollmentData();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to update group',
      life: 3500,
    });
  } finally {
    updatingGroupId.value = null;
  }
};

const selectAllAvailableStudents = () => {
  const combinedTarget = [...picklistTarget.value, ...picklistSource.value];
  setPicklistState([], combinedTarget);
};

const clearSelectedStudents = () => {
  setPicklistState(availableStudents.value.slice(), []);
};

const skippedReasonLabel = (reason) => {
  switch (reason) {
    case 'not_student':
      return 'Not a student';
    case 'already_enrolled':
      return 'Already enrolled';
    default:
      return 'Skipped';
  }
};

const findStudentName = (id) => {
  const available = availableStudents.value.find((student) => student.id === id);
  if (available) return available.fullName;
  const targeted = picklistTarget.value.find((student) => student.id === id);
  if (targeted) return targeted.fullName;
  const enrolled = enrollments.value.find((student) => student.studentId === id);
  if (enrolled) return enrolled.fullName;
  return id;
};

const toggleLessonPublish = async (lesson) => {
  try {
    if (lesson.is_published) {
      await unpublishLesson(lesson.id);
      toast.add({ severity: 'info', summary: 'Lesson unpublished', life: 2000 });
    } else {
      await publishLesson(lesson.id);
      toast.add({ severity: 'success', summary: 'Lesson published', life: 2000 });
    }
    await reloadLessonsForModule(selectedModuleId.value);
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to update lesson',
      life: 3500,
    });
  }
};

const reorderLesson = async (lesson, direction) => {
  const moduleLessons = lessonsByModuleId.value[selectedModuleId.value] || [];
  const index = moduleLessons.findIndex((l) => l.id === lesson.id);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  const swapWith = moduleLessons[targetIndex];
  if (!swapWith) return;
  try {
    await Promise.all([
      updateLesson(lesson.id, { orderIndex: swapWith.order_index }),
      updateLesson(swapWith.id, { orderIndex: lesson.order_index }),
    ]);
    await reloadLessonsForModule(selectedModuleId.value);
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to reorder lessons', life: 3000 });
  }
};

const reorderLessonForModule = async (moduleId, lesson, direction) => {
  if (!moduleId || !lesson?.id) return;
  selectedModuleId.value = moduleId;
  await reorderLesson(lesson, direction);
};

const editLesson = (lesson) => {
  router.push({
    path: `/cms/lessons/${lesson.id}/edit`,
    query: { courseId, moduleId: selectedModuleId.value },
  });
};

const lessonFiltersForModule = (moduleId) =>
  lessonFiltersByModuleId.value[moduleId] || { search: '', status: 'all' };

const filteredLessonsForModule = (moduleId) => {
  const list = lessonsByModuleId.value[moduleId] || [];
  const filter = lessonFiltersForModule(moduleId);
  return list.filter((lesson) => {
    const matchesSearch = (lesson.title || '')
      .toLowerCase()
      .includes((filter.search || '').toLowerCase());
    const matchesStatus =
      filter.status === 'all'
        ? true
        : filter.status === 'published'
        ? lesson.is_published
        : !lesson.is_published;
    return matchesSearch && matchesStatus;
  });
};

const ensureDataForCurrentTab = async () => {
  if (!auth.isAuthenticated || auth.isLoggingOut || !course.value) {
    return;
  }

  switch (currentTabKey.value) {
    case 'summary':
    case 'groups':
    case 'announcements':
    case 'posts':
    case 'attendance':
      await ensureGroupsReady(currentTabKey.value);
      return;
    case 'build':
      if (!hasContentAccess.value || tabDataReady.value.build) {
        return;
      }
      await loadModules();
      tabDataReady.value = { ...tabDataReady.value, build: true };
      return;
    case 'instructors':
      if (!canManageEnrollments.value || !hasContentAccess.value) {
        return;
      }
      {
        const previousGroupId = selectedGroupForTeachers.value;
        await ensureGroupsReady('instructors');
        ensureGroupTeacherSelection();
        if (
          selectedGroupForTeachers.value &&
          (tabDataReady.value.instructors || selectedGroupForTeachers.value === previousGroupId)
        ) {
          await loadGroupTeachers(selectedGroupForTeachers.value);
        }
      }
      tabDataReady.value = { ...tabDataReady.value, instructors: true };
      return;
    case 'enrollments':
      if (!canManageEnrollments.value || tabDataReady.value.enrollments) {
        return;
      }
      await loadEnrollmentData();
      tabDataReady.value = { ...tabDataReady.value, enrollments: true };
      return;
    case 'live':
      if (!isAdmin.value) {
        return;
      }
      {
        if (!tabDataReady.value.build && hasContentAccess.value) {
          await loadModules();
          tabDataReady.value = { ...tabDataReady.value, build: true };
        }
        const previousGroupId = liveSessionGroupId.value;
        if (!tabDataReady.value.live) {
          await ensureGroupsReady('live');
        }
        ensureLiveSessionGroupSelection();
        if (
          liveSessionGroupId.value &&
          (tabDataReady.value.live || liveSessionGroupId.value === previousGroupId)
        ) {
          await loadLiveSessionData();
        }
      }
      tabDataReady.value = { ...tabDataReady.value, live: true };
      return;
    case 'staff':
      if (!isAdmin.value || tabDataReady.value.staff) {
        return;
      }
      await loadStaffAssignments();
      tabDataReady.value = { ...tabDataReady.value, staff: true };
      return;
    default:
      return;
  }
};

watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      resetTabDataState();
      loadData();
    }
  },
);

watch(availableStudents, () => {
  syncPicklistSource();
});

watch(picklistFilter, () => {
  syncPicklistSource();
});

watch(
  enrollmentFilter,
  () => {
    if (!canManageEnrollments.value) return;
    enrollmentPage.value = 0;
    clearEnrollmentSearchTimeout();
    enrollmentSearchTimeout = setTimeout(() => {
      loadEnrollmentData();
      enrollmentSearchTimeout = null;
    }, ENROLLMENT_SEARCH_DEBOUNCE);
  },
  { immediate: false },
);

watch(
  enrollmentGroupFilter,
  () => {
    if (!canManageEnrollments.value) return;
    enrollmentPage.value = 0;
    clearEnrollmentSearchTimeout();
    loadEnrollmentData();
  },
  { immediate: false },
);

watch(
  selectedGroupForTeachers,
  (groupId, previous) => {
    if (
      currentTabKey.value === 'instructors' &&
      groupId &&
      groupId !== previous &&
      canManageEnrollments.value
    ) {
      loadGroupTeachers(groupId);
    } else if (!groupId) {
      groupTeachers.value = [];
    }
  },
);

watch(
  canManageEnrollments,
  (allowed) => {
    clearEnrollmentSearchTimeout();
    if (!allowed) {
      selectedGroupForTeachers.value = null;
      groupTeachers.value = [];
      enrollmentPage.value = 0;
      enrollmentTotal.value = 0;
      tabDataReady.value = {
        ...tabDataReady.value,
        attendance: false,
        groups: false,
        announcements: false,
        posts: false,
        instructors: false,
        enrollments: false,
        summary: false,
      };
    } else {
      enrollmentPage.value = 0;
      ensureGroupTeacherSelection();
    }
  },
  { immediate: false },
);

watch(
  showGroupTeacherDialog,
  (visible) => {
    if (!visible) {
      groupTeacherSearchTerm.value = '';
      groupTeacherCandidates.value = [];
      selectedGroupTeacherUserId.value = null;
      assigningGroupTeacher.value = false;
      if (groupTeacherFilterTimeout) {
        clearTimeout(groupTeacherFilterTimeout);
        groupTeacherFilterTimeout = null;
      }
    }
  },
);

watch(
  showEnrollDialog,
  (visible) => {
    if (!visible) {
      setPicklistState([], []);
      enrollForm.value.groupId = null;
      bulkErrors.value = [];
      picklistFilter.value = '';
    }
  },
);

watch(
  () => liveSessionGroupId.value,
  (groupId) => {
    if (groupId && currentTabKey.value === 'live') {
      liveSessionRange.value = defaultLiveSessionRange();
      loadLiveSessionData();
    } else {
      liveSessionSeries.value = [];
      liveSessionSessions.value = [];
      liveSessionTeachers.value = [];
    }
  },
);

watch(
  isAdmin,
  (value) => {
    if (!value) {
      staffAssignments.value = [];
      staffCandidates.value = [];
      liveSessionGroupId.value = null;
      liveSessionSeries.value = [];
      liveSessionSessions.value = [];
      liveSessionTeachers.value = [];
      liveSessionError.value = false;
      liveSessionLoading.value = false;
      tabDataReady.value = {
        ...tabDataReady.value,
        live: false,
        staff: false,
      };
    }
  },
  { immediate: true },
);

watch(
  currentTabKey,
  () => {
    ensureDataForCurrentTab();
  },
  { immediate: false },
);

watch(
  [enrollmentOnlyMode, hasContentAccess, canManageEnrollments, isAdmin, () => route.name],
  () => {
    syncCurrentTabRoute();
  },
  { immediate: true },
);

provide(cmsCourseBuilderContextKey, {
  courseId,
  courseGroups,
  loadingModules,
  modules,
  activeModuleTabs,
  onModuleTabOpen,
  selectModuleFromTab,
  openModuleDialog,
  toggleModulePublish,
  deletingModuleId,
  reorderModule,
  lessonsByModuleId,
  openLessonDialogForModule,
  lessonFiltersByModuleId,
  lessonStatusOptions,
  lessonsLoadingByModuleId,
  filteredLessonsForModule,
  editLesson,
  toggleLessonPublish,
  deletingLessonId,
  openDeleteModuleDialog,
  openDeleteLessonDialogForModule,
  reorderLessonForModule,
  loadingGroups,
  openGroupDialog,
  openGroupTeacherDialog,
  deletingGroupId,
  openDeleteGroupDialog,
  liveSessionGroupId,
  liveSessionGroupOptions,
  liveSessionLoading,
  liveSessionError,
  loadLiveSessionData,
  liveSessionSeries,
  liveSessionSeriesLoading,
  liveSeriesPublishLoadingId,
  liveSeriesGeneratingId,
  liveSeriesRegeneratingId,
  liveSeriesDeletingId,
  openLiveSeriesCreate,
  openLiveSeriesEdit,
  handleLiveSeriesPublishToggle,
  handleLiveSeriesGenerate,
  openRegenerateSeriesDialog,
  handleLiveSeriesDelete,
  liveSessionSessions,
  liveSessionSessionsLoading,
  liveSessionClassTypes,
  liveSessionTeachers,
  liveSessionRange,
  handleLiveSessionsRefresh,
  openLiveSessionEdit,
  handleLiveSessionsRangeChange,
  selectedGroupForTeachers,
  groupTeacherOptions,
  loadingGroupTeachers,
  groupTeachers,
  removingGroupTeacherId,
  removeGroupInstructor,
  openEnrollDialog,
  loadingEnrollments,
  enrollmentFilter,
  enrollmentGroupFilter,
  enrollmentGroupOptions,
  enrollmentTotal,
  enrollments,
  enrollmentRows,
  enrollmentPage,
  enrollmentRowsOptions,
  onEnrollmentPage,
  groupDropdownOptions,
  updatingGroupId,
  updateStudentGroup,
  removingEnrollmentId,
  removeEnrollmentRow,
  staffForm,
  staffCandidates,
  loadingStaffCandidates,
  ensureStaffCandidates,
  handleStaffFilter,
  staffRoleOptions,
  assigningStaff,
  submitStaffAssignment,
  loadingStaff,
  staffAssignments,
  staffRoleLabels,
  removingStaffRoleKey,
  removeStaffRole,
});

onBeforeUnmount(() => {
  if (staffFilterTimeout) {
    clearTimeout(staffFilterTimeout);
  }
  if (groupTeacherFilterTimeout) {
    clearTimeout(groupTeacherFilterTimeout);
  }
  clearEnrollmentSearchTimeout();
});

const init = async () => {
  if (!auth.isAuthenticated || auth.isLoggingOut) {
    return;
  }
  await loadCourse();
  await ensureDataForCurrentTab();
};

const loadData = init;

init();
</script>

<style scoped>
.course-header-card {
  margin-bottom: 1rem;
}

.course-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.course-tab-link {
  display: inline-flex;
  align-items: center;
  padding: 0.85rem 1rem;
  color: #475569;
  font-weight: 700;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.course-tab-link:hover {
  color: #0f172a;
}

.course-tab-link.is-active {
  color: #0f172a;
  border-bottom-color: #3b82f6;
}

.course-tab-panel {
  min-height: 12rem;
}

.course-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.course-title h2 {
  margin: 0;
}

.course-title p {
  margin: 0.25rem 0 0;
  color: #6b7280;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.builder-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.module-list,
.lesson-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.module-item,
.lesson-item {
  gap: 0.6rem;
}

.module-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.module-actions {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}

.module-tab-header {
  width: 80%;
}

.lessons-head {
  display: flex;
  justify-content: space-between;
  margin: 1rem 0px;
}

.lessons-toolbar {
  width: 100%;
  display: flex;
  justify-content: space-between;
}


.module-tab-title{
  display: flex;
  justify-content: space-between;
}

.lesson-meta {
  margin: 0.25rem 0 0;
  color: #6b7280;
  font-size: 0.85rem;
}

.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
}

.dialog-row {
  display: flex;
  gap: 1rem;
}

.dialog-field-half {
  flex: 1;
}

.dialog-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.confirm-message {
  margin: 0 0 1rem;
  line-height: 1.35;
}

.loading-panel {
  padding: 1rem;
}

.enrollments-card {
  margin-top: 1rem;
}

.enrollment-filters {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
  align-items: flex-end;
}

.enrollment-filters .filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 200px;
}

.group-teachers-card {
  margin-top: 1rem;
}

.groups-card {
  margin-top: 1rem;
}

.group-teachers-selector {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
  max-width: 320px;
}

.group-teacher-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.group-teacher-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 0.75rem;
}

.group-teacher-item small {
  color: #6b7280;
  display: block;
  margin-top: 0.15rem;
}

.staff-card {
  margin-top: 1rem;
}

.staff-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.staff-form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.staff-role-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.staff-role-tag {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.group-dropdown {
  width: 100%;
}

.group-cell {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.group-tag {
  align-self: flex-start;
}

.dropdown-option {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.dropdown-option .option-name {
  font-weight: 600;
}

.dropdown-option small {
  color: #6b7280;
}

.bulk-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0.5rem 0 1rem;
}

.bulk-buttons {
  display: flex;
  gap: 0.5rem;
}

.selection-hint {
  color: #6b7280;
  font-size: 0.85rem;
}

.bulk-errors {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border: 1px solid #f59e0b;
  border-radius: 0.75rem;
  background: #fffbeb;
}

.bulk-errors ul {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
  color: #92400e;
  font-size: 0.9rem;
}

.live-sessions-card {
  margin-top: 1rem;
}

.live-session-controls {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
}

.live-session-loading {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.enroll-dialog .p-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.picklist-search {
  max-width: 400px;
}

.picklist-search .p-input-icon-left {
  width: 100%;
}

.picklist-search input {
  width: 100%;
}

.enroll-picklist {
  width: 100%;
}

.enroll-picklist .p-picklist-list {
  min-height: 320px;
  max-height: 480px;
}

.enroll-picklist .p-picklist-target .p-picklist-filter-container {
  display: none;
}

.enroll-picklist.p-picklist {
  display: flex;
  gap: 1rem;
}

.enroll-picklist .p-picklist-list-wrapper {
  flex: 1;
}

.enroll-picklist .p-picklist-buttons {
  flex-direction: column;
  justify-content: center;
  gap: 0.5rem;
}

.enroll-picklist .p-picklist-buttons .p-button {
  width: 2.5rem;
  height: 2.5rem;
}

.modules-accordion{
}

@media (max-width: 900px) {
  .builder-grid {
    grid-template-columns: 1fr;
  }
}

</style>

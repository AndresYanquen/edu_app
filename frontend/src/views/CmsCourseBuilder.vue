<template>
  <div class="page cms-page">
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
        </template>
      </Card>

      <div class="builder-grid">
        <Card class="modules-card">
          <template #title>
            <div class="section-header">
              <h3>Modules</h3>
              <Button label="Add module" icon="pi pi-plus" @click="openModuleDialog()" />
            </div>
          </template>
          <template #content>
            <div v-if="loadingModules">
              <Skeleton height="2rem" class="mb-2" />
              <Skeleton height="2rem" class="mb-2" />
            </div>
            <div v-else-if="!modules.length" class="empty-state">No modules yet.</div>
            <div v-else class="module-list">
              <div
                v-for="(module, index) in modules"
                :key="module.id"
                :class="['module-item', { active: module.id === selectedModuleId }]"
                @click="selectModule(module.id)"
              >
                <div class="module-info">
                  <strong>{{ module.title }}</strong>
                  <Tag
                    :value="module.is_published ? 'Published' : 'Draft'"
                    :severity="module.is_published ? 'success' : 'warning'"
                  />
                </div>
                <div class="module-actions" @click.stop>
                  <Button icon="pi pi-pencil" class="p-button-text" @click="openModuleDialog(module)" />
                  <Button
                    :icon="module.is_published ? 'pi pi-eye-slash' : 'pi pi-eye'"
                    class="p-button-text"
                    @click="toggleModulePublish(module)"
                  />
                  <Button
                    icon="pi pi-arrow-up"
                    class="p-button-text"
                    :disabled="index === 0"
                    @click="reorderModule(module, 'up')"
                  />
                  <Button
                    icon="pi pi-arrow-down"
                    class="p-button-text"
                    :disabled="index === modules.length - 1"
                    @click="reorderModule(module, 'down')"
                  />
                </div>
              </div>
            </div>
          </template>
        </Card>

        <Card class="lessons-card">
          <template #title>
            <div class="section-header">
              <div>
                <h3>Lessons</h3>
                <small v-if="selectedModule">{{ selectedModule.title }}</small>
              </div>
              <Button
                label="Add lesson"
                icon="pi pi-plus"
                :disabled="!selectedModuleId"
                @click="openLessonDialog()"
              />
            </div>
          </template>
          <template #content>
            <div v-if="!selectedModuleId" class="empty-state">Select a module to view lessons.</div>
            <div v-else-if="loadingLessons">
              <Skeleton height="2rem" class="mb-2" />
              <Skeleton height="2rem" class="mb-2" />
            </div>
            <div v-else-if="!lessons.length" class="empty-state">No lessons yet.</div>
            <div v-else class="lesson-list">
              <div v-for="(lesson, index) in lessons" :key="lesson.id" class="lesson-item">
                <div>
                  <strong>{{ lesson.title }}</strong>
                  <p class="lesson-meta">{{ lesson.estimated_minutes || 0 }} min</p>
                </div>
                <div class="module-actions">
                  <Tag
                    :value="lesson.is_published ? 'Published' : 'Draft'"
                    :severity="lesson.is_published ? 'success' : 'warning'"
                  />
                  <Button icon="pi pi-pencil" class="p-button-text" @click="editLesson(lesson)" />
                  <Button
                    :icon="lesson.is_published ? 'pi pi-eye-slash' : 'pi pi-eye'"
                    class="p-button-text"
                    @click="toggleLessonPublish(lesson)"
                  />
                  <Button
                    icon="pi pi-arrow-up"
                    class="p-button-text"
                    :disabled="index === 0"
                    @click="reorderLesson(lesson, 'up')"
                  />
                  <Button
                    icon="pi pi-arrow-down"
                    class="p-button-text"
                    :disabled="index === lessons.length - 1"
                    @click="reorderLesson(lesson, 'down')"
                  />
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <Card v-if="canManageEnrollments" class="enrollments-card">
        <template #title>
          <div class="section-header">
            <h3>Enrollments</h3>
            <Button label="Enroll student" icon="pi pi-user-plus" @click="openEnrollDialog" />
          </div>
        </template>
        <template #content>
          <div v-if="loadingEnrollments">
            <Skeleton height="2.5rem" class="mb-2" />
            <Skeleton height="2.5rem" class="mb-2" />
            <Skeleton height="2.5rem" />
          </div>
          <div v-else-if="!enrollments.length" class="empty-state">
            No students enrolled yet.
          </div>
          <div v-else>
            <DataTable :value="enrollments" responsiveLayout="scroll">
              <Column field="fullName" header="Student" />
              <Column field="email" header="Email" />
              <Column header="Group" body-style="min-width:16rem">
                <template #body="{ data }">
                  <div class="group-cell">
                    <Tag
                      :value="data.groupName || 'No group'"
                      :severity="data.groupName ? 'info' : 'warning'"
                      class="group-tag"
                    />
                    <Dropdown
                      :modelValue="data.groupId || null"
                      :options="groupDropdownOptions"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Select group"
                      showClear
                      class="group-dropdown"
                      :loading="updatingGroupId === data.studentId"
                      :disabled="updatingGroupId === data.studentId"
                      @update:modelValue="(value) => updateStudentGroup(data.studentId, value)"
                    />
                  </div>
                </template>
              </Column>
              <Column header="Actions" body-style="min-width:6rem">
                <template #body="{ data }">
                  <Button
                    label="Remove"
                    icon="pi pi-times"
                    class="p-button-text p-button-danger"
                    :loading="removingEnrollmentId === data.studentId"
                    @click="removeEnrollmentRow(data)"
                  />
                </template>
              </Column>
            </DataTable>
          </div>
        </template>
      </Card>

      <Card v-if="canManageEnrollments" class="group-teachers-card">
        <template #title>
          <div class="section-header">
            <div>
              <h3>Group instructors</h3>
              <small>Assign instructors to a specific group</small>
            </div>
            <Button
              label="Add instructor"
              icon="pi pi-user-plus"
              :disabled="!selectedGroupForTeachers"
              @click="openGroupTeacherDialog"
            />
          </div>
        </template>
        <template #content>
          <div class="group-teachers-selector">
            <label>Select group</label>
            <Dropdown
              v-model="selectedGroupForTeachers"
              :options="groupTeacherOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select group"
              :disabled="!courseGroups.length"
            />
          </div>
          <div v-if="!courseGroups.length" class="empty-state">
            Create a group to assign instructors.
          </div>
          <div v-else>
            <div v-if="loadingGroupTeachers">
              <Skeleton height="2.5rem" class="mb-2" />
              <Skeleton height="2.5rem" class="mb-2" />
            </div>
            <div v-else-if="!groupTeachers.length" class="empty-state">
              No instructors assigned yet.
            </div>
            <ul v-else class="group-teacher-list">
              <li v-for="teacher in groupTeachers" :key="teacher.id" class="group-teacher-item">
                <div>
                  <strong>{{ teacher.fullName }}</strong>
                  <small>{{ teacher.email }}</small>
                </div>
                <Button
                  icon="pi pi-times"
                  class="p-button-text p-button-danger"
                  :loading="removingGroupTeacherId === teacher.id"
                  @click="removeGroupInstructor(teacher.id)"
                  aria-label="Remove instructor"
                />
              </li>
            </ul>
          </div>
        </template>
      </Card>

      <Card v-if="isAdmin" class="staff-card">
        <template #title>
          <div class="section-header">
            <h3>Staff</h3>
            <small>Assign instructors, editors, and enrollment managers</small>
          </div>
        </template>
        <template #content>
          <div class="staff-form-grid">
            <div class="dialog-field">
              <label>User</label>
              <Dropdown
                v-model="staffForm.userId"
                :options="staffCandidates"
                optionLabel="label"
                optionValue="value"
                placeholder="Select user"
                filter
                :loading="loadingStaffCandidates"
                @show="ensureStaffCandidates"
                @filter="handleStaffFilter"
              />
            </div>
            <div class="dialog-field">
              <label>Roles</label>
              <MultiSelect
                v-model="staffForm.roles"
                :options="staffRoleOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Select roles"
                display="chip"
              />
            </div>
            <div class="staff-form-actions">
              <Button
                label="Assign roles"
                :loading="assigningStaff"
                @click="submitStaffAssignment"
              />
            </div>
          </div>

          <div class="staff-list">
            <div v-if="loadingStaff">
              <Skeleton height="2.5rem" class="mb-2" />
              <Skeleton height="2.5rem" />
            </div>
            <div v-else-if="!staffAssignments.length" class="empty-state">
              No staff assigned yet.
            </div>
            <div v-else>
              <DataTable :value="staffAssignments" responsiveLayout="scroll">
                <Column field="fullName" header="Name" />
                <Column field="email" header="Email" />
                <Column header="Roles">
                  <template #body="{ data }">
                    <div class="staff-role-tags">
                      <div
                        v-for="role in data.roles"
                        :key="`${data.userId}-${role}`"
                        class="staff-role-tag"
                      >
                        <Tag :value="staffRoleLabels[role] || role" severity="info" />
                        <Button
                          icon="pi pi-times"
                          class="p-button-text p-button-danger"
                          :loading="removingStaffRoleKey === `${data.userId}:${role}`"
                          @click="removeStaffRole(data.userId, role)"
                        />
                      </div>
                    </div>
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </template>
      </Card>
    </template>
    <div v-else class="empty-state">Course not found.</div>

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
      v-model:visible="showGroupTeacherDialog"
      header="Assign instructor"
      modal
      :style="{ width: '28rem' }"
    >
      <div class="dialog-field">
        <label>Search instructor</label>
        <div class="group-teacher-search">
          <InputText
            v-model="groupTeacherSearchTerm"
            placeholder="Name or email"
            @keyup.enter="searchGroupTeacherCandidates"
          />
          <Button
            icon="pi pi-search"
            class="p-button-text"
            :loading="loadingGroupTeacherCandidates"
            @click="searchGroupTeacherCandidates"
          />
        </div>
      </div>
      <div class="dialog-field">
        <label>Instructor</label>
        <Dropdown
          v-model="selectedGroupTeacherUserId"
          :options="groupTeacherCandidates"
          optionLabel="label"
          optionValue="value"
          placeholder="Select instructor"
          :loading="loadingGroupTeacherCandidates"
          filter
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
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '../stores/auth';
import {
  listCourses,
  publishCourse,
  unpublishCourse,
  getModules,
  createModule,
  updateModule,
  publishModule,
  unpublishModule,
  getLessons,
  createLesson,
  updateLesson,
  publishLesson,
  unpublishLesson,
  getCourseGroups,
  getAvailableStudents,
  getCourseEnrollments,
  removeEnrollment,
  updateEnrollmentGroup,
  bulkEnrollStudents,
  getGroupTeachers,
  addGroupTeacher,
  removeGroupTeacher,
} from '../api/cms';
import { listUsers, getCourseStaff, assignCourseStaff, removeCourseStaffRole } from '../api/admin';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const isAdmin = computed(() => auth.isAdmin);
const canManageEnrollments = computed(() =>
  auth.isAdmin || (auth.hasAnyRole && auth.hasAnyRole(['instructor', 'enrollment_manager'])),
);

const courseId = route.params.id;
const course = ref(null);
const loadingCourse = ref(true);

const modules = ref([]);
const selectedModuleId = ref(null);
const lessons = ref([]);
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

const enrollments = ref([]);
const courseGroups = ref([]);
const loadingEnrollments = ref(true);
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
  } else {
    loadGroupTeachers(selectedGroupForTeachers.value);
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
    groupTeacherCandidates.value = userList.map((user) => ({
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

const openGroupTeacherDialog = () => {
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

const searchGroupTeacherCandidates = () => {
  if (loadingGroupTeacherCandidates.value) {
    return;
  }
  fetchGroupTeacherCandidates();
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

const loadCourse = async () => {
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

const loadModules = async () => {
  loadingModules.value = true;
  try {
    modules.value = await getModules(courseId);
    if (!selectedModuleId.value && modules.value.length) {
      selectedModuleId.value = modules.value[0].id;
    }
    if (selectedModuleId.value) {
      await loadLessons(selectedModuleId.value);
    } else {
      lessons.value = [];
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load modules', life: 3000 });
  } finally {
    loadingModules.value = false;
  }
};

const loadLessons = async (moduleId) => {
  loadingLessons.value = true;
  try {
    lessons.value = await getLessons(moduleId);
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load lessons', life: 3000 });
  } finally {
    loadingLessons.value = false;
  }
};

const loadEnrollmentData = async () => {
  if (!canManageEnrollments.value) {
    enrollments.value = [];
    courseGroups.value = [];
    ensureGroupTeacherSelection();
    return;
  }
  loadingEnrollments.value = true;
  try {
    const [enrollmentRows, groupRows] = await Promise.all([
      getCourseEnrollments(courseId),
      getCourseGroups(courseId),
    ]);
    enrollments.value = enrollmentRows;
    courseGroups.value = groupRows;
    ensureGroupTeacherSelection();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load enrollments',
      life: 3000,
    });
  } finally {
    loadingEnrollments.value = false;
  }
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
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to remove role',
      life: 3000,
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
  await loadLessons(moduleId);
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
    await createLesson(selectedModuleId.value, {
      title: lessonForm.value.title,
      estimatedMinutes: lessonForm.value.estimatedMinutes,
      videoUrl: lessonForm.value.videoUrl,
    });
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
    await loadLessons(selectedModuleId.value);
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
  const index = lessons.value.findIndex((l) => l.id === lesson.id);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  const swapWith = lessons.value[targetIndex];
  if (!swapWith) return;
  try {
    await Promise.all([
      updateLesson(lesson.id, { orderIndex: swapWith.order_index }),
      updateLesson(swapWith.id, { orderIndex: lesson.order_index }),
    ]);
    await loadLessons(selectedModuleId.value);
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to reorder lessons', life: 3000 });
  }
};

const editLesson = (lesson) => {
  router.push({
    path: `/cms/lessons/${lesson.id}/edit`,
    query: { courseId, moduleId: selectedModuleId.value },
  });
};

watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) loadData();
  },
);

watch(availableStudents, () => {
  syncPicklistSource();
});

watch(picklistFilter, () => {
  syncPicklistSource();
});

watch(
  selectedGroupForTeachers,
  (groupId, previous) => {
    if (groupId && groupId !== previous && canManageEnrollments.value) {
      loadGroupTeachers(groupId);
    } else if (!groupId) {
      groupTeachers.value = [];
    }
  },
);

watch(
  canManageEnrollments,
  (allowed) => {
    if (!allowed) {
      selectedGroupForTeachers.value = null;
      groupTeachers.value = [];
    } else {
      ensureGroupTeacherSelection();
    }
  },
  { immediate: true },
);

watch(
  showGroupTeacherDialog,
  (visible) => {
    if (!visible) {
      groupTeacherSearchTerm.value = '';
      groupTeacherCandidates.value = [];
      selectedGroupTeacherUserId.value = null;
      assigningGroupTeacher.value = false;
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
  isAdmin,
  (value) => {
    if (value) {
      loadStaffAssignments();
      ensureStaffCandidates();
    } else {
      staffAssignments.value = [];
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (staffFilterTimeout) {
    clearTimeout(staffFilterTimeout);
  }
});

const init = async () => {
  await loadCourse();
  if (course.value) {
    const tasks = [loadModules()];
    if (canManageEnrollments.value) {
      tasks.push(loadEnrollmentData(), loadAvailableStudents());
    }
    await Promise.all(tasks);
  }
};

const loadData = init;

init();
</script>

<style scoped>
.course-header-card {
  margin-bottom: 1rem;
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
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.module-item.active {
  border-color: #2563eb;
  background: #eff6ff;
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

.loading-panel {
  padding: 1rem;
}

.enrollments-card {
  margin-top: 1rem;
}

.group-teachers-card {
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

.group-teacher-search {
  display: flex;
  gap: 0.5rem;
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

@media (max-width: 900px) {
  .builder-grid {
    grid-template-columns: 1fr;
  }
}
</style>
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

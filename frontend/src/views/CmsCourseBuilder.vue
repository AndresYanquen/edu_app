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

      <Card v-if="canManageEnrollments" class="groups-card">
        <template #title>
          <div class="section-header">
            <div>
              <h3>Groups</h3>
              <small>Manage cohorts and staff assignments</small>
            </div>
            <Button label="Create group" icon="pi pi-plus" @click="openGroupDialog()" />
          </div>
        </template>
        <template #content>
          <div v-if="loadingGroups">
            <Skeleton height="2rem" class="mb-2" />
            <Skeleton height="2rem" class="mb-2" />
          </div>
          <div v-else-if="!courseGroups.length" class="empty-state">
            No groups yet.
          </div>
          <DataTable
            v-else
            :value="courseGroups"
            responsiveLayout="scroll"
            dataKey="id"
            :paginator="courseGroups.length > 8"
            :rows="8"
          >
            <Column field="code" header="Code" />
            <Column field="name" header="Name" />
            <Column field="startDate" header="Start date" />
            <Column field="endDate" header="End date" />
            <Column header="Capacity">
              <template #body="{ data }">
                {{ data.capacity ?? '-' }}
              </template>
            </Column>
            <Column header="Status">
              <template #body="{ data }">
                <Tag
                  :value="data.status"
                  :severity="data.status === 'active' ? 'success' : 'warning'"
                />
              </template>
            </Column>
            <Column header="Teachers">
              <template #body="{ data }">
                <Tag
                  :value="`${data.teachersCount} instructor${data.teachersCount === 1 ? '' : 's'}`"
                  severity="info"
                />
              </template>
            </Column>
            <Column header="Actions" body-style="min-width: 12rem">
              <template #body="{ data }">
                <Button
                  icon="pi pi-pencil"
                  class="p-button-text"
                  @click="openGroupDialog(data)"
                  aria-label="Edit group"
                />
                <Button
                  icon="pi pi-users"
                  class="p-button-text"
                  @click="openGroupTeacherDialog(data.id)"
                  aria-label="Manage teachers"
                />
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>

      <Card v-if="isAdmin" class="live-sessions-card">
        <template #title>
          <div class="section-header">
            <div>
              <h3>Live sessions</h3>
              <small>Manage recurring live meetings for each group</small>
            </div>
            <div class="live-session-controls">
              <label>Select group</label>
              <Dropdown
                v-model="liveSessionGroupId"
                :options="liveSessionGroupOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Select group"
                :disabled="!courseGroups.length"
              />
            </div>
          </div>
        </template>
        <template #content>
          <div v-if="liveSessionLoading" class="live-session-loading">
            <Skeleton height="2rem" class="mb-2" />
            <Skeleton height="2rem" class="mb-2" />
            <Skeleton height="12rem" />
          </div>
          <div v-else-if="liveSessionError" class="empty-state">
            <p>Unable to load live sessions right now.</p>
            <Button
              :label="'Reload live sessions'"
              icon="pi pi-refresh"
              class="p-button-text"
              @click="loadLiveSessionData"
            />
          </div>
          <div v-else>
            <SeriesTable
              :series="liveSessionSeries"
              :modules="modules"
              :loading="liveSessionSeriesLoading"
              :publishLoadingId="liveSeriesPublishLoadingId"
              :generatingId="liveSeriesGeneratingId"
              @create="openLiveSeriesCreate"
              @edit="openLiveSeriesEdit"
              @toggle-publish="handleLiveSeriesPublishToggle"
              @generate="handleLiveSeriesGenerate"
            />
            <SessionsTable
              :sessions="liveSessionSessions"
              :loading="liveSessionSessionsLoading"
              :classTypes="liveSessionClassTypes"
              :modules="modules"
              :teachers="liveSessionTeachers"
              :range="liveSessionRange"
              @refresh="handleLiveSessionsRefresh"
              @range-change="handleLiveSessionsRangeChange"
            />
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
          <div v-else>
            <div class="enrollment-filters">
              <div class="filter-field">
                <label>Search</label>
                <InputText v-model="enrollmentFilter" placeholder="Name or email" />
              </div>
              <div class="filter-field">
                <label>Group</label>
                <Dropdown
                  v-model="enrollmentGroupFilter"
                  :options="enrollmentGroupOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="All groups"
                  showClear
                />
              </div>
            </div>
            <div v-if="!enrollmentTotal" class="empty-state">
              {{
                enrollmentFilter || enrollmentGroupFilter
                  ? 'No enrollments match your filters.'
                  : 'No students enrolled yet.'
              }}
            </div>
            <DataTable
              v-else
              :value="enrollments"
              responsiveLayout="scroll"
              :paginator="true"
              :rows="enrollmentRows"
              :totalRecords="enrollmentTotal"
              :first="enrollmentPage * enrollmentRows"
              :rowsPerPageOptions="enrollmentRowsOptions"
              lazy
              @page="onEnrollmentPage"
            >
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
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import SeriesTable from '../components/live/SeriesTable.vue';
import SessionsTable from '../components/live/SessionsTable.vue';
import SeriesFormDialog from '../components/live/SeriesFormDialog.vue';
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
  listGroupSessions,
} from '../api/liveSessions';

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
const liveSessionRange = ref(defaultLiveSessionRange());

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
  if (!series) return;
  liveSeriesGeneratingId.value = series.id;
  try {
    const result = await generateSeries(series.id, { weeks: 8 });
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
    clearEnrollmentSearchTimeout();
    if (!allowed) {
      selectedGroupForTeachers.value = null;
      groupTeachers.value = [];
      enrollmentPage.value = 0;
      enrollmentTotal.value = 0;
    } else {
      enrollmentPage.value = 0;
      ensureGroupTeacherSelection();
      loadEnrollmentData();
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
    if (groupId) {
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
    if (value) {
      loadStaffAssignments();
      ensureStaffCandidates();
      ensureLiveSessionGroupSelection();
      if (liveSessionGroupId.value) {
        loadLiveSessionData();
      }
    } else {
      staffAssignments.value = [];
      liveSessionGroupId.value = null;
      liveSessionSeries.value = [];
      liveSessionSessions.value = [];
      liveSessionTeachers.value = [];
      liveSessionError.value = false;
      liveSessionLoading.value = false;
    }
  },
  { immediate: true },
);

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

@media (max-width: 900px) {
  .builder-grid {
    grid-template-columns: 1fr;
  }
}
</style>

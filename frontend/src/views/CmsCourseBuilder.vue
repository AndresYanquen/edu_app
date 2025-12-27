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

      <Card class="enrollments-card">
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
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
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
} from '../api/cms';

const route = useRoute();
const router = useRouter();
const toast = useToast();

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
const picklistSource = computed(() => picklistModel.value[0]);
const picklistTarget = computed(() => picklistModel.value[1]);
const submittingEnrollment = ref(false);
const removingEnrollmentId = ref(null);
const updatingGroupId = ref(null);
const bulkErrors = ref([]);

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
  loadingEnrollments.value = true;
  try {
    const [enrollmentRows, groupRows] = await Promise.all([
      getCourseEnrollments(courseId),
      getCourseGroups(courseId),
    ]);
    enrollments.value = enrollmentRows;
    courseGroups.value = groupRows;
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

const syncPicklistSource = () => {
  if (!showEnrollDialog.value) return;
  const target = picklistTarget.value;
  const targetIds = new Set(target.map((student) => student.id));
  const nextSource = (availableStudents.value || []).filter(
    (student) => !targetIds.has(student.id),
  );
  setPicklistState(nextSource, target);
};

const loadAvailableStudents = async () => {
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

watch(
  showEnrollDialog,
  (visible) => {
    if (!visible) {
      setPicklistState([], []);
      enrollForm.value.groupId = null;
      bulkErrors.value = [];
    }
  },
);

const init = async () => {
  await loadCourse();
  if (course.value) {
    await Promise.all([loadModules(), loadEnrollmentData(), loadAvailableStudents()]);
  }
};

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

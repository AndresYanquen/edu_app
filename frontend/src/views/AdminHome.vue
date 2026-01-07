<template>
  <div class="page admin-page">
    <Card>
      <template #title>Create user</template>
      <template #content>
        <div class="form-grid">
          <div class="dialog-field">
            <label>Full name</label>
            <InputText v-model="form.fullName" placeholder="Ava Parker" />
          </div>
          <div class="dialog-field">
            <label>Email</label>
            <InputText v-model="form.email" placeholder="user@academy.local" />
          </div>
          <div class="dialog-field">
            <label>Role</label>
            <Dropdown
              v-model="form.role"
              :options="roleOptions"
              optionLabel="label"
              optionValue="value"
            />
          </div>
        </div>
        <div class="form-actions">
          <Button label="Create user" :loading="creating" @click="submit" />
        </div>
      </template>
    </Card>

    <Card class="mt-card">
      <template #title>
        <div class="section-header">
          <div>
            <h3>Users</h3>
            <small>Students and instructors</small>
          </div>
          <div class="section-actions">
            <span class="search-input">
              <i class="pi pi-search" />
              <InputText
                v-model="userSearch"
                placeholder="Search name or email"
              />
            </span>
            <Dropdown
              v-model="filterRole"
              :options="filterOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="All roles"
              showClear
              class="filter-dropdown"
            />
            <Tag class="total-tag" severity="info" :value="`Total: ${totalUsers} usuarios`" />
            <Button icon="pi pi-refresh" class="p-button-text" :loading="loadingUsers" @click="loadUsers" />
          </div>
        </div>
      </template>
      <template #content>
        <div v-if="loadingUsers">
          <Skeleton height="2.5rem" class="mb-2" />
          <Skeleton height="2.5rem" class="mb-2" />
          <Skeleton height="2.5rem" class="mb-2" />
        </div>
        <div v-else-if="!users.length" class="empty-state">
          No users found for this filter.
        </div>
        <div v-else>
          <DataTable
            :value="users"
            responsiveLayout="scroll"
            scrollable
            scrollHeight="420px"
            class="user-table"
            paginator
            lazy
            :rows="rows"
            :totalRecords="totalUsers"
            :rowsPerPageOptions="rowsPerPageOptions"
            :first="page * rows"
            :loading="loadingUsers"
            @page="onPageChange"
          >
            <Column field="full_name" header="Name" />
            <Column field="email" header="Email" />
            <Column header="Role" style="width: 12rem">
              <template #body="{ data }">
                <div class="role-tag-wrap">
                  <Tag
                    v-for="role in userRoles(data)"
                    :key="`${data.id}-${role}`"
                    :value="roleLabel(role)"
                    severity="info"
                  />
                </div>
              </template>
            </Column>
            <Column header="Activation" style="width: 12rem">
              <template #body="{ data }">
                <Tag
                  :value="data.must_set_password ? 'Pending' : 'Ready'"
                  :severity="data.must_set_password ? 'warning' : 'success'"
                />
              </template>
            </Column>
            <Column header="Access" style="width: 10rem">
              <template #body="{ data }">
                <Tag :value="data.is_active ? 'Active' : 'Inactive'" :severity="data.is_active ? 'success' : 'danger'" />
              </template>
            </Column>
            <Column header="Actions" style="width: 16rem">
              <template #body="{ data }">
                <div class="actions-row">
                  <Button
                    label="Reset link"
                    class="p-button-text"
                    :loading="resettingId === data.id"
                    @click="resetPassword(data.id)"
                  />
                  <Button
                    :label="data.is_active ? 'Deactivate' : 'Activate'"
                    class="p-button-text"
                    :severity="data.is_active ? 'danger' : 'success'"
                    :loading="togglingId === data.id"
                    @click="toggleUser(data)"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </Card>

    <Card class="mt-card">
      <template #title>Bulk invite via CSV</template>
      <template #content>
        <div class="bulk-info">
          <p>
            Upload a CSV with columns:
            <strong>email</strong> (required), <strong>fullName</strong>, <strong>role</strong>,
            <strong>courseId</strong>, <strong>groupId</strong>.
          </p>
          <p>Defaults below apply when a row omits those values.</p>
        </div>
        <div class="form-grid bulk-grid">
          <div class="dialog-field">
            <label>Default role</label>
            <Dropdown
              v-model="bulkDefaults.role"
              :options="roleOptions"
              optionLabel="label"
              optionValue="value"
            />
          </div>
          <div class="dialog-field">
            <label>Default course</label>
            <Dropdown
              v-model="bulkDefaults.courseId"
              :options="courseOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="None"
              showClear
            />
          </div>
          <div class="dialog-field">
            <label>Default group</label>
            <Dropdown
              v-model="bulkDefaults.groupId"
              :options="filteredGroupOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="None"
              showClear
              :disabled="!bulkDefaults.courseId"
            />
          </div>
          <div class="dialog-field">
            <label>Activation expiry (days)</label>
            <InputNumber v-model="bulkDefaults.expiresDays" :min="1" :max="30" />
          </div>
        </div>
        <div class="file-input-row">
          <input ref="bulkFileInput" type="file" accept=".csv,text/csv" @change="handleBulkFile" />
          <span v-if="bulkFileName" class="file-name">{{ bulkFileName }}</span>
        </div>
        <div class="bulk-actions-bar">
          <Button label="Upload CSV" :disabled="!bulkFile" :loading="uploading" @click="submitBulk" />
          <Button
            label="Download results"
            class="p-button-text"
            :disabled="!bulkResults.length"
            @click="downloadBulkResults"
          />
          <Button
            label="Clear results"
            class="p-button-text"
            :disabled="!bulkResults.length"
            @click="clearBulkResults"
          />
        </div>
        <div v-if="bulkTotals" class="bulk-summary">
          <Tag :value="`Total: ${bulkTotals.total}`" severity="info" />
          <Tag :value="`Created: ${bulkTotals.created}`" severity="success" />
          <Tag :value="`Existing: ${bulkTotals.alreadyExists}`" severity="info" />
          <Tag :value="`Invalid: ${bulkTotals.invalid}`" severity="warning" />
          <Tag :value="`Failed: ${bulkTotals.failed}`" severity="danger" />
        </div>
        <DataTable v-if="bulkResults.length" :value="bulkResults" responsiveLayout="scroll" class="mt-2">
          <Column field="rowNumber" header="#" style="width: 4rem" />
          <Column field="email" header="Email" />
          <Column header="Role" style="width: 8rem">
            <template #body="{ data }">
              <Tag :value="data.role" severity="info" />
            </template>
          </Column>
          <Column header="Status" style="width: 10rem">
            <template #body="{ data }">
              <Tag :value="data.status" :severity="statusSeverity(data.status)" />
            </template>
          </Column>
          <Column header="Activation">
            <template #body="{ data }">
              <Button
                v-if="data.activationLink"
                icon="pi pi-copy"
                class="p-button-text"
                @click="copyActivationLink(data.activationLink)"
              />
              <span v-else class="muted">—</span>
            </template>
          </Column>
          <Column header="Course" field="enrollment.courseId" style="width: 16rem">
            <template #body="{ data }">
              {{ data.enrollment.courseId || '—' }}
            </template>
          </Column>
          <Column header="Group" field="enrollment.groupId" style="width: 16rem">
            <template #body="{ data }">
              {{ data.enrollment.groupId || '—' }}
            </template>
          </Column>
          <Column header="Enrollment" style="width: 12rem">
            <template #body="{ data }">
              <span v-if="!data.enrollment.requested" class="muted">Not requested</span>
              <Tag
                v-else
                :value="data.enrollment.status || 'pending'"
                :severity="enrollmentSeverity(data.enrollment.status)"
              />
            </template>
          </Column>
          <Column header="Enrollment error">
            <template #body="{ data }">
              <span class="muted">{{ data.enrollment.error || '—' }}</span>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Card class="mt-card levels-card">
      <template #title>
        <div class="section-header">
          <div>
            <h3>Course levels</h3>
            <small>Codes that courses may reference</small>
          </div>
          <Button label="Create level" icon="pi pi-plus" @click="openLevelDialog" />
        </div>
      </template>
      <template #content>
        <div v-if="loadingLevels">
          <Skeleton height="2rem" class="mb-2" />
          <Skeleton height="2rem" class="mb-2" />
        </div>
        <div v-else-if="!courseLevels.length" class="empty-state">
          No course levels defined yet.
        </div>
        <div v-else>
          <DataTable :value="courseLevels" responsiveLayout="scroll">
            <Column field="code" header="Code" />
            <Column field="label" header="Label" />
            <Column header="Status" style="width: 10rem">
              <template #body="{ data }">
                <Tag :value="data.is_active ? 'Active' : 'Inactive'" :severity="data.is_active ? 'success' : 'warning'" />
              </template>
            </Column>
            <Column field="created_at" header="Created" bodyStyle="width: 14rem">
              <template #body="{ data }">
                {{ formatDate(data.created_at) }}
              </template>
            </Column>
            <Column header="Actions" bodyStyle="width: 10rem">
              <template #body="{ data }">
                <Button
                  icon="pi pi-trash"
                  class="p-button-text p-button-danger"
                  severity="danger"
                  size="small"
                  :loading="deletingLevelId === data.id"
                  :disabled="deletingLevelId === data.id"
                  @click="openDeleteLevelDialog(data)"
                  aria-label="Delete level"
                />
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </Card>

    <Dialog v-model:visible="showLevelDialog" header="Create course level" modal :style="{ width: '32rem' }">
      <div class="form-grid">
        <div class="dialog-field">
          <label>Code</label>
          <InputText v-model="levelForm.code" placeholder="A1" />
        </div>
        <div class="dialog-field">
          <label>Label</label>
          <InputText v-model="levelForm.label" placeholder="Beginner" />
        </div>
        <div class="dialog-field dialog-switch">
          <label>Active</label>
          <InputSwitch v-model="levelForm.isActive" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" class="p-button-text" :disabled="savingLevel" @click="closeLevelDialog" />
        <Button label="Save" :loading="savingLevel" severity="success" @click="submitLevelForm" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="confirmDeleteLevelVisible"
      header="Confirm deletion"
      modal
      :style="{ width: '28rem' }"
      :closable="!confirmDeleteLevelLoading"
    >
      <p class="confirm-message">{{ confirmDeleteLevelMessage }}</p>
      <template #footer>
        <Button
          label="Cancel"
          class="p-button-text"
          :disabled="confirmDeleteLevelLoading"
          @click="closeDeleteLevelDialog"
        />
        <Button
          label="Delete"
          severity="danger"
          :loading="confirmDeleteLevelLoading"
          :disabled="confirmDeleteLevelLoading"
          @click="confirmDeleteLevel"
        />
      </template>
    </Dialog>

    <Dialog v-model:visible="linkDialogVisible" header="Activation link" modal :style="{ width: '32rem' }">
      <p>Share this link with the user so they can set their password.</p>
      <div class="link-box">
        <InputText :modelValue="activationLink" readonly />
        <Button icon="pi pi-copy" class="p-button-text" @click="copyLink" />
      </div>
      <small>Links expire after 7 days.</small>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import api from '../api/axios';
import { listCourses } from '../api/cms';
import {
  createUser,
  listUsers,
  resetUserPassword,
  deactivateUser,
  activateUser,
  bulkInviteUsers,
  listCourseLevels,
  createCourseLevel,
  deleteCourseLevel,
} from '../api/admin';

const toast = useToast();

const form = ref({
  fullName: '',
  email: '',
  role: 'student',
});
const creating = ref(false);

const users = ref([]);
const loadingUsers = ref(false);
const filterRole = ref(null);
const userSearch = ref('');
const resettingId = ref(null);
const togglingId = ref(null);

const linkDialogVisible = ref(false);
const activationLink = ref('');

const ROLE_LABELS = {
  student: 'Student',
  instructor: 'Instructor',
  content_editor: 'Content editor',
  enrollment_manager: 'Enrollment manager',
};

const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ label, value }));
const filterOptions = [...roleOptions];

const courses = ref([]);
const allGroups = ref([]);
const bulkDefaults = ref({
  role: 'student',
  courseId: null,
  groupId: null,
  expiresDays: 7,
});
const bulkFile = ref(null);
const bulkFileInput = ref(null);
const uploading = ref(false);
const bulkResults = ref([]);
const bulkTotals = ref(null);
const page = ref(0);
const rows = ref(20);
const rowsPerPageOptions = [10, 20, 50];
const totalUsers = ref(0);
const courseLevels = ref([]);
const loadingLevels = ref(false);
const levelForm = ref({ code: '', label: '', isActive: true });
const showLevelDialog = ref(false);
const savingLevel = ref(false);
const deletingLevelId = ref(null);
const confirmDeleteLevelVisible = ref(false);
const confirmDeleteLevelId = ref(null);
const confirmDeleteLevelLoading = ref(false);

const courseOptions = computed(() =>
  courses.value.map((course) => ({ label: course.title, value: course.id })),
);
const filteredGroupOptions = computed(() => {
  if (!bulkDefaults.value.courseId) {
    return [];
  }
  return allGroups.value
    .filter((group) => group.course_id === bulkDefaults.value.courseId)
    .map((group) => ({ label: group.group_name, value: group.group_id }));
});
const bulkFileName = computed(() => bulkFile.value?.name || '');

const roleLabel = (role) => ROLE_LABELS[role] || role;
const userRoles = (user) =>
  Array.isArray(user.global_roles) ? user.global_roles.filter(Boolean) : [];

const confirmDeleteLevelMessage = computed(() => {
  const level = courseLevels.value.find((entry) => entry.id === confirmDeleteLevelId.value);
  if (!level) {
    return 'Are you sure you want to delete this level?';
  }
  return `Delete level "${level.code}"? Courses that already use it will break.`;
});

const buildUserQuery = () => {
  const params = {
    page: page.value + 1,
    pageSize: rows.value,
  };
  if (filterRole.value) {
    params.role = filterRole.value;
  }
  if (userSearch.value.trim()) {
    params.search = userSearch.value.trim();
  }
  return params;
};

const loadUsers = async () => {
  loadingUsers.value = true;
  try {
    const response = await listUsers(buildUserQuery());
    const dataRows = Array.isArray(response?.users)
      ? response.users
      : Array.isArray(response)
      ? response
      : [];
    const currentRows = rows.value || 20;
    const nextPageSize =
      typeof response?.pageSize === 'number' && response.pageSize > 0
        ? response.pageSize
        : currentRows;
    const nextPage =
      typeof response?.page === 'number' && response.page > 0
        ? response.page - 1
        : 0;
    const nextTotal =
      typeof response?.total === 'number' && response.total >= 0
        ? response.total
        : dataRows.length;

    users.value = dataRows;
    totalUsers.value = nextTotal;
    rows.value = nextPageSize;
    page.value = nextPage;
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.response?.data?.error || 'Failed to load users', life: 3500 });
  } finally {
    loadingUsers.value = false;
  }
};

const onPageChange = (event) => {
  page.value = event.page;
  rows.value = event.rows;
  loadUsers();
};

const submit = async () => {
  if (!form.value.fullName.trim() || !form.value.email.trim()) {
    toast.add({ severity: 'warn', summary: 'Fill all fields', life: 2500 });
    return;
  }
  creating.value = true;
  try {
    const result = await createUser({
      fullName: form.value.fullName.trim(),
      email: form.value.email.trim(),
      role: form.value.role,
    });
    toast.add({ severity: 'success', summary: 'User created', life: 2000 });
    activationLink.value = result.activationLink;
    linkDialogVisible.value = true;
    form.value.fullName = '';
    form.value.email = '';
    await loadUsers();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.response?.data?.error || 'Failed to create user', life: 3500 });
  } finally {
    creating.value = false;
  }
};

const resetPassword = async (userId) => {
  resettingId.value = userId;
  try {
    const result = await resetUserPassword(userId);
    activationLink.value = result.activationLink;
    linkDialogVisible.value = true;
    toast.add({ severity: 'info', summary: 'New activation link generated', life: 2500 });
    await loadUsers();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.response?.data?.error || 'Failed to reset password', life: 3500 });
  } finally {
    resettingId.value = null;
  }
};

const toggleUser = async (user) => {
  const shouldActivate = !user.is_active;
  const confirmMsg = shouldActivate
    ? 'Activate this user and restore access?'
    : 'Deactivate this user and block access?';
  if (!window.confirm(confirmMsg)) {
    return;
  }

  togglingId.value = user.id;
  try {
    if (shouldActivate) {
      await activateUser(user.id);
      toast.add({ severity: 'success', summary: 'User activated', life: 2000 });
    } else {
      await deactivateUser(user.id);
      toast.add({ severity: 'info', summary: 'User deactivated', life: 2000 });
    }
    await loadUsers();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to update user',
      life: 3500,
    });
  } finally {
    togglingId.value = null;
  }
};

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(activationLink.value);
    toast.add({ severity: 'success', summary: 'Link copied', life: 1500 });
  } catch (_) {
    toast.add({ severity: 'warn', summary: 'Copy failed', life: 1500 });
  }
};

const loadCourses = async () => {
  try {
    courses.value = await listCourses();
  } catch (err) {
    console.error('Failed to load courses', err);
  }
};

const loadGroups = async () => {
  try {
    const { data } = await api.get('/instructor/groups');
    allGroups.value = data || [];
  } catch (err) {
    console.error('Failed to load groups', err);
  }
};

const loadCourseLevels = async () => {
  loadingLevels.value = true;
  try {
    courseLevels.value = await listCourseLevels();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to load course levels',
      life: 3500,
    });
  } finally {
    loadingLevels.value = false;
  }
};

const resetLevelForm = () => {
  levelForm.value = { code: '', label: '', isActive: true };
};

const openLevelDialog = () => {
  resetLevelForm();
  showLevelDialog.value = true;
};

const closeLevelDialog = () => {
  showLevelDialog.value = false;
  savingLevel.value = false;
  resetLevelForm();
};

const submitLevelForm = async () => {
  const code = (levelForm.value.code || '').trim();
  const label = (levelForm.value.label || '').trim();
  if (!code || !label) {
    toast.add({
      severity: 'warn',
      summary: 'Missing fields',
      detail: 'Code and label are required',
      life: 2500,
    });
    return;
  }
  savingLevel.value = true;
  try {
    await createCourseLevel({
      code,
      label,
      is_active: levelForm.value.isActive,
    });
    toast.add({
      severity: 'success',
      summary: 'Level created',
      detail: `${code} is now available`,
      life: 2500,
    });
    await loadCourseLevels();
    closeLevelDialog();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to create level',
      life: 3500,
    });
  } finally {
    savingLevel.value = false;
  }
};

const openDeleteLevelDialog = (level) => {
  confirmDeleteLevelId.value = level.id;
  confirmDeleteLevelVisible.value = true;
};

const closeDeleteLevelDialog = () => {
  confirmDeleteLevelVisible.value = false;
  confirmDeleteLevelLoading.value = false;
  confirmDeleteLevelId.value = null;
};

const confirmDeleteLevel = async () => {
  const levelId = confirmDeleteLevelId.value;
  if (!levelId) {
    closeDeleteLevelDialog();
    return;
  }
  confirmDeleteLevelLoading.value = true;
  deletingLevelId.value = levelId;
  try {
    await deleteCourseLevel(levelId);
    toast.add({
      severity: 'success',
      summary: 'Level deleted',
      life: 2500,
    });
    courseLevels.value = courseLevels.value.filter((level) => level.id !== levelId);
    closeDeleteLevelDialog();
  } catch (err) {
    const message =
      err.response?.data?.error || 'Failed to delete level';
    toast.add({
      severity: 'error',
      summary: 'Deletion failed',
      detail: message,
      life: 3500,
    });
  } finally {
    confirmDeleteLevelLoading.value = false;
    deletingLevelId.value = null;
  }
};

const handleBulkFile = (event) => {
  const file = event.target.files?.[0];
  bulkFile.value = file || null;
};

const submitBulk = async () => {
  if (!bulkFile.value) {
    toast.add({ severity: 'warn', summary: 'Select a CSV file', life: 2500 });
    return;
  }
  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append('file', bulkFile.value);
    if (bulkDefaults.value.role) {
      formData.append('defaultRole', bulkDefaults.value.role);
    }
    if (bulkDefaults.value.courseId) {
      formData.append('defaultCourseId', bulkDefaults.value.courseId);
    }
    if (bulkDefaults.value.groupId) {
      formData.append('defaultGroupId', bulkDefaults.value.groupId);
    }
    if (bulkDefaults.value.expiresDays) {
      formData.append('expiresDays', bulkDefaults.value.expiresDays);
    }

    const response = await bulkInviteUsers(formData);
    bulkResults.value = response.results || [];
    bulkTotals.value = response.totals || null;
    toast.add({
      severity: 'success',
      summary: 'Bulk invite processed',
      detail: `Rows: ${response.totals?.total || bulkResults.value.length}`,
      life: 3000,
    });
    if (bulkFileInput.value) {
      bulkFileInput.value.value = '';
    }
    bulkFile.value = null;
    await loadUsers();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Bulk invite failed',
      detail: err.response?.data?.error || 'Failed to process CSV',
      life: 3500,
    });
  } finally {
    uploading.value = false;
  }
};

const clearBulkResults = () => {
  bulkResults.value = [];
  bulkTotals.value = null;
};

const statusSeverity = (status) => {
  switch (status) {
    case 'created':
      return 'success';
    case 'already_exists':
      return 'info';
    case 'invalid_row':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'info';
  }
};

const enrollmentSeverity = (status) => {
  switch (status) {
    case 'enrolled':
      return 'success';
    case 'already_enrolled':
      return 'info';
    case 'skipped_not_student':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'info';
  }
};

const copyActivationLink = async (link) => {
  try {
    await navigator.clipboard.writeText(link);
    toast.add({ severity: 'success', summary: 'Activation link copied', life: 1500 });
  } catch (_) {
    toast.add({ severity: 'warn', summary: 'Copy failed', life: 1500 });
  }
};

const downloadBulkResults = () => {
  if (!bulkResults.value.length) return;
  const headers = [
    'rowNumber',
    'fullName',
    'email',
    'role',
    'status',
    'activationLink',
    'courseId',
    'groupId',
    'enrollmentStatus',
    'enrollmentError',
  ];
  const escapeValue = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };
  const lines = [headers.join(',')];
  bulkResults.value.forEach((row) => {
    lines.push(
      [
        row.rowNumber,
        row.fullName,
        row.email,
        row.role,
        row.status,
        row.activationLink || '',
        row.enrollment.courseId || '',
        row.enrollment.groupId || '',
        row.enrollment.status || '',
        row.enrollment.error || '',
      ]
        .map(escapeValue)
        .join(','),
    );
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bulk-invite-results.csv';
  link.click();
  URL.revokeObjectURL(url);
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

watch(
  () => bulkDefaults.value.courseId,
  () => {
    if (
      bulkDefaults.value.groupId &&
      !filteredGroupOptions.value.some((group) => group.value === bulkDefaults.value.groupId)
    ) {
      bulkDefaults.value.groupId = null;
    }
  },
);

watch(filterRole, () => {
  page.value = 0;
  loadUsers();
});

watch(userSearch, () => {
  page.value = 0;
  loadUsers();
});

onMounted(() => {
  loadUsers();
  loadCourses();
  loadGroups();
  loadCourseLevels();
});
</script>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}
.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
.section-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.search-input {
  position: relative;
}
.search-input i {
  position: absolute;
  top: 50%;
  left: 0.75rem;
  transform: translateY(-50%);
  color: #94a3b8;
}
.search-input :deep(.p-inputtext) {
  padding-left: 2.25rem;
  min-width: 14rem;
}
.link-box {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin: 1rem 0;
}
.empty-state {
  color: #64748b;
}
.mt-card {
  margin-top: 1rem;
}
.filter-dropdown {
  min-width: 10rem;
}
.total-tag {
  white-space: nowrap;
}
.actions-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.user-table :deep(.p-datatable-wrapper) {
  max-height: 420px;
}
.role-tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.bulk-info {
  background: #f8fafc;
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1rem;
  color: #475569;
}
.bulk-grid {
  margin-bottom: 1rem;
}
.file-input-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.file-name {
  color: #475569;
  font-size: 0.9rem;
}
.bulk-actions-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}
.bulk-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.muted {
  color: #94a3b8;
  font-size: 0.9rem;
}
.mt-2 {
  margin-top: 1rem;
}
.levels-card {
  margin-top: 1rem;
}
.levels-card .empty-state {
  padding: 1rem 0;
}
.confirm-message {
  margin: 0 0 1rem;
  line-height: 1.4;
}
</style>

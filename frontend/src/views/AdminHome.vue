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
            <Dropdown
              v-model="filterRole"
              :options="filterOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="All roles"
              showClear
              class="filter-dropdown"
              @update:modelValue="loadUsers"
            />
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
          <DataTable :value="users" responsiveLayout="scroll">
            <Column field="full_name" header="Name" />
            <Column field="email" header="Email" />
            <Column header="Role" style="width: 8rem">
              <template #body="{ data }">
                <Tag :value="data.role" severity="info" />
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
const resettingId = ref(null);
const togglingId = ref(null);

const linkDialogVisible = ref(false);
const activationLink = ref('');

const roleOptions = [
  { label: 'Student', value: 'student' },
  { label: 'Instructor', value: 'instructor' },
];
const filterOptions = [{ label: 'Students', value: 'student' }, { label: 'Instructors', value: 'instructor' }];

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

const loadUsers = async () => {
  loadingUsers.value = true;
  try {
    users.value = await listUsers(filterRole.value ? { role: filterRole.value } : undefined);
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.response?.data?.error || 'Failed to load users', life: 3500 });
  } finally {
    loadingUsers.value = false;
  }
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

onMounted(() => {
  loadUsers();
  loadCourses();
  loadGroups();
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
.actions-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
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

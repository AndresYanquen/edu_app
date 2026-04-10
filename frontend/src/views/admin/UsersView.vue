<template>
  <section class="admin-users-view">
    <Card class="card create-user-card">
      <template #title>
        <div class="card-title-row">
          <div class="card-title">
            <span class="icon-circle">
              <i class="pi pi-user-plus" aria-hidden="true"></i>
            </span>

            <div>
              <h2>Crear usuario</h2>
              <p>Invita y asigna rol en segundos</p>
            </div>
          </div>

          <Button
            label="Crear usuario"
            icon="pi pi-plus"
            :loading="creating"
            @click="submit"
          />
        </div>
      </template>

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
      </template>
    </Card>

    <Card class="card users-card">
      <template #title>
        <div class="users-header">
          <div class="users-header__intro">
            <h2>Usuarios</h2>
            <p>Estudiantes e instructores</p>
          </div>

          <div class="users-header__actions">
            <span class="search-input">
              <i class="pi pi-search" />
              <InputText v-model="userSearch" placeholder="Search name or email" />
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

            <span class="total-pill">Total: {{ totalUsers }} usuarios</span>

            <Button
              icon="pi pi-refresh"
              class="p-button-text refresh-btn"
              :loading="loadingUsers"
              @click="loadUsers"
            />
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

        <div v-else class="table-wrap">
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
            <Column header="Name" style="width: 20rem">
              <template #body="{ data }">
                <div class="user-meta">
                  <span class="user-avatar">{{ getInitials(data.full_name) }}</span>
                  <div class="user-meta__text">
                    <strong>{{ data.full_name }}</strong>
                  </div>
                </div>
              </template>
            </Column>

            <Column field="email" header="Email" style="width: 18rem">
              <template #body="{ data }">
                <span class="muted muted-email">{{ data.email }}</span>
              </template>
            </Column>

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
                <Tag
                  :value="data.is_active ? 'Active' : 'Inactive'"
                  :severity="data.is_active ? 'success' : 'danger'"
                />
              </template>
            </Column>

            <Column header="Actions" style="width: 16rem">
              <template #body="{ data }">
                <div class="actions-row">
                  <Button
                    label="Restablecer"
                    class="p-button-text"
                    :loading="resettingId === data.id"
                    @click="resetPassword(data.id)"
                  />

                  <Button
                    :label="data.is_active ? 'Desactivar' : 'Activar'"
                    class="p-button-text"
                    :severity="data.is_active ? 'warning' : 'success'"
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

    <Dialog
      v-model:visible="linkDialogVisible"
      modal
      header="Activation link"
      :style="{ width: '44rem', maxWidth: '95vw' }"
    >
      <div class="link-dialog-body">
        <InputText :modelValue="activationLink" readonly class="activation-link-input" />

        <div class="dialog-actions">
          <Button label="Copiar" icon="pi pi-copy" @click="copyLink" />
        </div>
      </div>
    </Dialog>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import {
  activateUser,
  createUser,
  deactivateUser,
  listUsers,
  resetUserPassword,
} from '../../api/admin';

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
const page = ref(0);
const rows = ref(20);
const rowsPerPageOptions = [10, 20, 50];
const totalUsers = ref(0);
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

const roleLabel = (role) => ROLE_LABELS[role] || role;

const userRoles = (user) =>
  Array.isArray(user.global_roles) ? user.global_roles.filter(Boolean) : [];

const getInitials = (name = '') =>
  (name || '')
    .split(' ')
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

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
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to load users',
      life: 3500,
    });
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
    toast.add({
      severity: 'warn',
      summary: 'Fill all fields',
      life: 2500,
    });
    return;
  }

  creating.value = true;

  try {
    const result = await createUser({
      fullName: form.value.fullName.trim(),
      email: form.value.email.trim(),
      role: form.value.role,
    });

    toast.add({
      severity: 'success',
      summary: 'User created',
      life: 2000,
    });

    activationLink.value = result.activationLink;
    linkDialogVisible.value = true;
    form.value.fullName = '';
    form.value.email = '';
    await loadUsers();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to create user',
      life: 3500,
    });
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

    toast.add({
      severity: 'info',
      summary: 'New activation link generated',
      life: 2500,
    });

    await loadUsers();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to reset password',
      life: 3500,
    });
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
});
</script>

<style scoped>
.admin-users-view,
.admin-users-view * {
  box-sizing: border-box;
  min-width: 0;
}

.admin-users-view {
  width: 100%;
  display: grid;
  gap: 1rem;
}

.card {
  width: 100%;
  background: #fff;
  border-radius: 22px;
  border: 1px solid var(--app-border);
  box-shadow: var(--shadow-sm);
  padding: 1.2rem 1.4rem;
  overflow: hidden;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
}

.card-title h2 {
  margin: 0;
  font-size: 1.3rem;
  line-height: 1.15;
  color: #1e3a5f;
}

.card-title p {
  margin: 0.15rem 0 0;
  color: var(--text-secondary);
  line-height: 1.45;
}

.icon-circle {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  background: rgba(13, 59, 102, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--brand-primary);
  flex-shrink: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.dialog-field label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.users-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.users-header__intro {
  min-width: 0;
}

.users-header__intro h2 {
  margin: 0;
  font-size: 1.45rem;
  line-height: 1.1;
  color: #1e3a5f;
}

.users-header__intro p {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  line-height: 1.45;
}

.users-header__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.total-pill {
  background: rgba(13, 59, 102, 0.08);
  border-radius: 999px;
  padding: 0.38rem 0.95rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.search-input {
  position: relative;
  min-width: 0;
}

.search-input i {
  position: absolute;
  top: 50%;
  left: 0.8rem;
  transform: translateY(-50%);
  color: #94a3b8;
  z-index: 1;
}

.search-input :deep(.p-inputtext) {
  width: 100%;
  min-width: 16rem;
  padding-left: 2.5rem;
}

.filter-dropdown {
  min-width: 12rem;
}

.refresh-btn {
  flex-shrink: 0;
}

.table-wrap {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.user-table {
  width: 100%;
}

.user-table :deep(.p-datatable-wrapper) {
  max-height: 420px;
}

.user-table :deep(.p-datatable-table) {
  min-width: 1000px;
}

.user-table :deep(.p-datatable-thead > tr > th),
.user-table :deep(.p-datatable-tbody > tr > td) {
  font-size: 0.9rem;
  vertical-align: middle;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

.user-meta__text {
  min-width: 0;
}

.user-meta__text strong {
  display: block;
  color: #0f172a;
  line-height: 1.35;
  word-break: break-word;
}

.user-avatar {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  background: rgba(13, 59, 102, 0.16);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}

.role-tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.actions-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.link-dialog-body {
  display: grid;
  gap: 0.75rem;
}

.activation-link-input {
  width: 100%;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
}

.muted {
  color: #64748b;
  font-size: 0.92rem;
}

.muted-email {
  word-break: break-word;
  overflow-wrap: anywhere;
}

@media (max-width: 1100px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .users-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .users-header__actions {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 900px) {
  .card {
    padding: 1rem;
    border-radius: 18px;
  }

  .card-title-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .card-title-row :deep(.p-button) {
    width: 100%;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .search-input,
  .filter-dropdown {
    width: 100%;
  }

  .search-input :deep(.p-inputtext),
  .filter-dropdown :deep(.p-dropdown) {
    width: 100%;
    min-width: 0;
  }

  .total-pill {
    width: 100%;
    text-align: center;
  }
}

@media (max-width: 640px) {
  .admin-users-view {
    gap: 0.9rem;
  }

  .card {
    padding: 0.9rem;
    border-radius: 16px;
  }

  .card-title {
    align-items: flex-start;
  }

  .card-title h2,
  .users-header__intro h2 {
    font-size: 1.2rem;
  }

  .card-title p,
  .users-header__intro p {
    font-size: 0.92rem;
  }

  .users-header__actions {
    gap: 0.65rem;
  }

  .actions-row {
    flex-direction: column;
    align-items: stretch;
  }

  .actions-row :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }

  .dialog-actions {
    justify-content: stretch;
  }

  .dialog-actions :deep(.p-button) {
    width: 100%;
  }
}
</style>
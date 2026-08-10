<template>
  <section class="admin-users-view">
    <Card class="card users-card">
      <template #title>
        <div class="users-hero">
          <div class="users-hero__copy">
            <h2>Usuarios</h2>
            <p>Gestiona estudiantes, instructores y administradores.</p>
            <span class="total-pill">
              <i class="pi pi-users" aria-hidden="true" />
              <strong>{{ totalUsers }}</strong>
              usuarios registrados
            </span>
          </div>

          <Button
            label="Crear usuario"
            icon="pi pi-user-plus"
            :loading="creating"
            class="create-user-button"
            @click="createDialogVisible = true"
          />
        </div>
      </template>

      <template #content>
        <div class="users-toolbar">
          <span class="search-input">
            <i class="pi pi-search" />
            <InputText v-model="userSearch" placeholder="Buscar por nombre o correo..." />
          </span>

          <Dropdown
            v-model="filterRole"
            :options="filterOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Todos los roles"
            showClear
            class="filter-dropdown"
          />

          <Dropdown
            v-model="filterStatus"
            :options="statusFilterOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Todos los estados"
            showClear
            class="filter-dropdown"
          />

          <Button
            icon="pi pi-refresh"
            class="p-button-outlined refresh-btn"
            :loading="loadingUsers"
            aria-label="Recargar usuarios"
            @click="loadUsers"
          />
        </div>

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
            <Column header="Usuario" style="width: 36%">
              <template #body="{ data }">
                <div class="user-meta">
                  <span class="user-avatar" :class="avatarClass(data)">{{ getInitials(data.full_name) }}</span>
                  <div class="user-meta__text">
                    <strong>{{ data.full_name }}</strong>
                    <small>{{ data.email }}</small>
                    <Tag
                      v-if="isCurrentUser(data)"
                      value="Tu cuenta"
                      severity="success"
                      class="own-account-tag"
                    />
                  </div>
                </div>
              </template>
            </Column>

            <Column header="Rol" style="width: 22%">
              <template #body="{ data }">
                <div class="role-tag-wrap">
                  <span
                    v-for="role in userRoles(data)"
                    :key="`${data.id}-${role}`"
                    class="role-chip"
                    :class="`role-chip--${role}`"
                  >
                    <i :class="roleIcon(role)" aria-hidden="true" />
                    {{ roleLabel(role) }}
                  </span>
                </div>
              </template>
            </Column>

            <Column header="Estado" style="width: 26%">
              <template #body="{ data }">
                <div class="status-cell">
                  <span class="status-dot" :class="statusClass(data)" />
                  <div>
                    <strong>{{ statusLabel(data) }}</strong>
                    <small>{{ statusDescription(data) }}</small>
                  </div>
                </div>
              </template>
            </Column>

            <Column header="Acciones" style="width: 10%">
              <template #body="{ data }">
                <div class="actions-row">
                  <Button
                    icon="pi pi-ellipsis-v"
                    class="p-button-outlined row-menu-button"
                    :loading="resettingId === data.id || togglingId === data.id"
                    aria-label="Acciones de usuario"
                    @click="toggleRowMenu($event, data)"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
          <Menu ref="rowMenu" :model="rowMenuItems" popup class="user-row-menu" />
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="createDialogVisible"
      modal
      header="Crear usuario"
      :style="{ width: '42rem', maxWidth: '95vw' }"
    >
      <div class="create-dialog-body">
        <div class="form-grid">
          <div class="dialog-field">
            <label>Nombre completo</label>
            <InputText v-model="form.fullName" placeholder="Ava Parker" />
          </div>

          <div class="dialog-field">
            <label>Email</label>
            <InputText v-model="form.email" placeholder="user@academy.local" />
          </div>

          <div class="dialog-field">
            <label>Rol</label>
            <Dropdown
              v-model="form.role"
              :options="roleOptions"
              optionLabel="label"
              optionValue="value"
            />
          </div>
        </div>

        <div class="dialog-actions">
          <Button label="Cancelar" class="p-button-text" @click="createDialogVisible = false" />
          <Button label="Crear usuario" icon="pi pi-user-plus" :loading="creating" @click="submit" />
        </div>
      </div>
    </Dialog>

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
import { computed, onMounted, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import Menu from 'primevue/menu';
import {
  activateUser,
  createUser,
  deactivateUser,
  listUsers,
  resetUserPassword,
} from '../../api/admin';
import { useAuthStore } from '../../stores/auth';

const toast = useToast();
const auth = useAuthStore();

const form = ref({
  fullName: '',
  email: '',
  role: 'student',
});

const creating = ref(false);
const users = ref([]);
const loadingUsers = ref(false);
const filterRole = ref(null);
const filterStatus = ref(null);
const userSearch = ref('');
const resettingId = ref(null);
const togglingId = ref(null);
const createDialogVisible = ref(false);
const selectedRowUser = ref(null);
const rowMenu = ref();
const page = ref(0);
const rows = ref(20);
const rowsPerPageOptions = [10, 20, 50];
const totalUsers = ref(0);
const linkDialogVisible = ref(false);
const activationLink = ref('');

const ROLE_LABELS = {
  admin: 'Admin',
  student: 'Estudiante',
  instructor: 'Instructor',
  content_editor: 'Content editor',
  enrollment_manager: 'Enrollment manager',
};

const ROLE_ICONS = {
  admin: 'pi pi-crown',
  student: 'pi pi-user',
  instructor: 'pi pi-graduation-cap',
  content_editor: 'pi pi-file-edit',
  enrollment_manager: 'pi pi-briefcase',
};

const roleOptions = Object.entries(ROLE_LABELS)
  .filter(([value]) => value !== 'admin')
  .map(([value, label]) => ({ label, value }));
const filterOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ label, value }));
const statusFilterOptions = [
  { label: 'Activos', value: 'active' },
  { label: 'Pendientes', value: 'pending' },
  { label: 'Inactivos', value: 'inactive' },
];

const roleLabel = (role) => ROLE_LABELS[role] || role;
const roleIcon = (role) => ROLE_ICONS[role] || 'pi pi-user';

const userRoles = (user) =>
  Array.isArray(user.global_roles) ? user.global_roles.filter(Boolean) : [];

const isCurrentUser = (user) => user?.id && auth.user?.id && user.id === auth.user.id;

const getInitials = (name = '') =>
  (name || '')
    .split(' ')
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const avatarClass = (user) => {
  const role = userRoles(user)[0] || 'student';
  return `user-avatar--${role}`;
};

const statusLabel = (user) => {
  if (!user?.is_active) return 'Inactivo';
  if (user?.must_set_password) return 'Pendiente';
  return 'Activo';
};

const statusDescription = (user) => {
  if (!user?.is_active) return 'Acceso bloqueado';
  if (user?.must_set_password) return 'Debe activar su cuenta';
  return 'Cuenta y acceso habilitados';
};

const statusClass = (user) => {
  if (!user?.is_active) return 'status-dot--inactive';
  if (user?.must_set_password) return 'status-dot--pending';
  return 'status-dot--active';
};

const rowMenuItems = computed(() => {
  const user = selectedRowUser.value;
  if (!user) return [];

  return [
    {
      label: 'Editar usuario',
      icon: 'pi pi-pencil',
      disabled: true,
    },
    {
      label: 'Restablecer contraseña',
      icon: 'pi pi-key',
      command: () => resetPassword(user.id),
    },
    {
      label: user.is_active ? 'Desactivar usuario' : 'Activar usuario',
      icon: user.is_active ? 'pi pi-user-minus' : 'pi pi-user-plus',
      class: user.is_active ? 'menu-danger' : '',
      command: () => toggleUser(user),
    },
  ];
});

const toggleRowMenu = (event, user) => {
  selectedRowUser.value = user;
  rowMenu.value?.toggle(event);
};

const buildUserQuery = () => {
  const params = {
    page: page.value + 1,
    pageSize: rows.value,
  };

  if (filterRole.value) {
    params.role = filterRole.value;
  }

  if (filterStatus.value) {
    params.status = filterStatus.value;
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
    createDialogVisible.value = false;
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

watch(filterStatus, () => {
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

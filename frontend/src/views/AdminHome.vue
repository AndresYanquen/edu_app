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
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { createUser, listUsers, resetUserPassword, deactivateUser, activateUser } from '../api/admin';

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

onMounted(loadUsers);
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

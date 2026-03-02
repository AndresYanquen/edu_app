<template>
  <Card class="staff-card">
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

<script setup>
import { inject } from 'vue';
import { cmsCourseBuilderContextKey } from '../cmsCourseBuilderContext';

const builder = inject(cmsCourseBuilderContextKey);
const {
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
} = builder;
</script>

<style scoped>
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.staff-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  align-items: end;
}

.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.staff-form-actions {
  display: flex;
  justify-content: flex-end;
}

.staff-list {
  margin-top: 1rem;
}

.staff-role-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.staff-role-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
</style>


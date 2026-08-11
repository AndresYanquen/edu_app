<template>
  <Card class="enrollments-card">
    <template #title>
      <div class="enrollments-header">
        <div>
          <h3>Enrollments</h3>
          <p>Manage and review student enrollments and their class schedules.</p>
        </div>
        <Button
          label="Enroll student"
          icon="pi pi-plus"
          class="enrollments-primary-action"
          @click="openEnrollDialog"
        />
      </div>
    </template>
    <template #content>
      <div v-if="loadingEnrollments">
        <Skeleton height="2.5rem" class="mb-2" />
        <Skeleton height="2.5rem" class="mb-2" />
        <Skeleton height="2.5rem" />
      </div>
      <div v-else>
        <div class="enrollments-toolbar">
          <div class="enrollment-filters">
            <span class="enrollment-search">
              <i class="pi pi-search" />
              <InputText v-model="enrollmentFilter" placeholder="Search by name or email" />
            </span>
            <span class="enrollment-group-filter">
              <i class="pi pi-users" />
              <Dropdown
                v-model="enrollmentGroupFilter"
                :options="enrollmentGroupOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="All groups"
                showClear
              />
            </span>
            <Button
              label="Filters"
              icon="pi pi-filter"
              class="p-button-outlined enrollment-filter-button"
              type="button"
            />
            <Button
              v-if="enrollmentFilter || enrollmentGroupFilter"
              label="Clear"
              class="p-button-text enrollment-clear-button"
              type="button"
              @click="clearEnrollmentFilters"
            />
          </div>
          <div class="enrollments-total-card">
            <span class="enrollments-total-icon"><i class="pi pi-users" /></span>
            <span>
              <small>Total enrollments</small>
              <strong>{{ enrollmentTotal }}</strong>
            </span>
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
          class="enrollments-table"
          @page="onEnrollmentPage"
        >
          <Column header="Student">
            <template #body="{ data }">
              <div class="enrollment-student-cell">
                <span
                  class="enrollment-avatar"
                  :class="avatarTone(data.studentId)"
                >
                  {{ initials(data.fullName || data.email) }}
                  <span class="enrollment-avatar-status" />
                </span>
                <span class="enrollment-student-meta">
                  <strong>{{ data.fullName || data.email }}</strong>
                  <small>Student</small>
                </span>
              </div>
            </template>
          </Column>
          <Column header="Contact">
            <template #body="{ data }">
              <span class="enrollment-contact">
                <i class="pi pi-envelope" />
                <span>{{ data.email }}</span>
              </span>
            </template>
          </Column>
          <Column header="Group / Schedule" body-style="min-width:18rem">
            <template #body="{ data }">
              <div class="group-cell">
                <div class="enrollment-group-card" :class="{ 'is-empty': !data.groupName }">
                  <strong>{{ data.groupName || 'No group assigned' }}</strong>
                  <small>
                    <i class="pi pi-calendar" />
                    {{ data.scheduleText || 'No schedule registered' }}
                  </small>
                </div>
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
          <Column header="Status">
            <template #body="{ data }">
              <div class="enrollment-status-cell">
                <span class="enrollment-status-badge">
                  <i class="pi pi-check-circle" />
                  {{ statusLabel(data.enrollmentStatus) }}
                </span>
                <small>Since {{ formatDate(data.enrolledAt) }}</small>
              </div>
            </template>
          </Column>
          <Column header="Actions" body-style="min-width:8rem">
            <template #body="{ data }">
              <div class="enrollment-actions">
                <Button
                  icon="pi pi-history"
                  class="p-button-outlined enrollment-action-button history"
                  aria-label="Historial"
                  title="Historial"
                  @click="openStudentAuditDialog(data)"
                />
                <Button
                  icon="pi pi-trash"
                  class="p-button-outlined p-button-danger enrollment-action-button remove"
                  aria-label="Remove"
                  title="Remove"
                  :loading="removingEnrollmentId === data.studentId"
                  @click="removeEnrollmentRow(data)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </Card>
</template>

<script setup>
import { inject } from 'vue';
import { cmsCourseBuilderContextKey } from '../cmsCourseBuilderContext';

const builder = inject(cmsCourseBuilderContextKey);
const {
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
  openStudentAuditDialog,
  removingEnrollmentId,
  removeEnrollmentRow,
} = builder;

const clearEnrollmentFilters = () => {
  enrollmentFilter.value = '';
  enrollmentGroupFilter.value = null;
};

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'ST';

const avatarTone = (value = '') => {
  const tones = ['tone-blue', 'tone-pink', 'tone-violet', 'tone-teal'];
  const index = String(value)
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length;
  return tones[index];
};

const statusLabel = (status) => {
  if (status === 'active') return 'Enrolled';
  if (!status) return 'Enrolled';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const formatDate = (value) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
};
</script>

<template>
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
  removingEnrollmentId,
  removeEnrollmentRow,
} = builder;
</script>

<style scoped>
.enrollments-card {
  margin-top: 1rem;
}

.section-header,
.group-cell {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.enrollment-filters {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
  align-items: flex-end;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 200px;
}

.group-cell {
  gap: 0.65rem;
}

.group-dropdown {
  min-width: 180px;
}
</style>


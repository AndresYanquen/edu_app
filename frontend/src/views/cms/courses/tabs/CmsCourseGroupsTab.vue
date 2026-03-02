<template>
  <Card class="groups-card">
    <template #title>
      <div class="section-header">
        <div>
          <div class="section-title">Groups</div>
          <small class="muted">Manage cohorts and staff assignments</small>
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
            <Button
              icon="pi pi-trash"
              class="p-button-text p-button-danger"
              severity="danger"
              :loading="deletingGroupId === data.id"
              :disabled="deletingGroupId === data.id"
              @click.stop="openDeleteGroupDialog(data)"
              aria-label="Delete group"
            />
          </template>
        </Column>
      </DataTable>
    </template>
  </Card>
</template>

<script setup>
import { inject } from 'vue';
import { cmsCourseBuilderContextKey } from '../cmsCourseBuilderContext';

const builder = inject(cmsCourseBuilderContextKey);
const {
  loadingGroups,
  courseGroups,
  openGroupDialog,
  openGroupTeacherDialog,
  deletingGroupId,
  openDeleteGroupDialog,
} = builder;
</script>

<style scoped>
.groups-card {
  margin-top: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>


<template>
  <Card class="group-teachers-card">
    <template #title>
      <div class="section-header">
        <div>
          <h3>Group instructors</h3>
          <small>Assign instructors to a specific group</small>
        </div>
        <Button
          label="Add instructor"
          icon="pi pi-user-plus"
          :disabled="!selectedGroupForTeachers"
          @click="openGroupTeacherDialog"
        />
      </div>
    </template>
    <template #content>
      <div class="group-teachers-selector">
        <label>Select group</label>
        <Dropdown
          v-model="selectedGroupForTeachers"
          :options="groupTeacherOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Select group"
          :disabled="!courseGroups.length"
        />
      </div>
      <div v-if="!courseGroups.length" class="empty-state">
        Create a group to assign instructors.
      </div>
      <div v-else>
        <div v-if="loadingGroupTeachers">
          <Skeleton height="2.5rem" class="mb-2" />
          <Skeleton height="2.5rem" class="mb-2" />
        </div>
        <div v-else-if="!groupTeachers.length" class="empty-state">
          No instructors assigned yet.
        </div>
        <ul v-else class="group-teacher-list">
          <li v-for="teacher in groupTeachers" :key="teacher.id" class="group-teacher-item">
            <div>
              <strong>{{ teacher.fullName }}</strong>
              <small>{{ teacher.email }}</small>
            </div>
            <Button
              icon="pi pi-times"
              class="p-button-text p-button-danger"
              :loading="removingGroupTeacherId === teacher.id"
              @click="removeGroupInstructor(teacher.id)"
              aria-label="Remove instructor"
            />
          </li>
        </ul>
      </div>
    </template>
  </Card>
</template>

<script setup>
import { inject } from 'vue';
import { cmsCourseBuilderContextKey } from '../cmsCourseBuilderContext';

const builder = inject(cmsCourseBuilderContextKey);
const {
  selectedGroupForTeachers,
  openGroupTeacherDialog,
  groupTeacherOptions,
  courseGroups,
  loadingGroupTeachers,
  groupTeachers,
  removingGroupTeacherId,
  removeGroupInstructor,
} = builder;
</script>

<style scoped>
.group-teachers-card {
  margin-top: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-teachers-selector {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
  max-width: 320px;
}

.group-teacher-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.group-teacher-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.group-teacher-item small {
  display: block;
  color: #6b7280;
}
</style>


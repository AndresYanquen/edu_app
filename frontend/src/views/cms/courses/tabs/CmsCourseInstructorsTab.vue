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

<template>
  <CmsCourseAttendanceTab
    :course-id="courseId"
    :groups="courseGroups"
    :read-only="attendanceReadOnly"
  />
</template>

<script setup>
import { inject } from 'vue';
import CmsCourseAttendanceTab from '../attendance/CmsCourseAttendanceTab.vue';
import { cmsCourseBuilderContextKey } from '../cmsCourseBuilderContext';

const builder = inject(cmsCourseBuilderContextKey);
const { courseId, courseGroups, attendanceReadOnly } = builder;
</script>


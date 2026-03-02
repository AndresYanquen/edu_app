<template>
  <CmsCourseAttendanceTab :course-id="courseId" :groups="courseGroups" />
</template>

<script setup>
import { inject } from 'vue';
import CmsCourseAttendanceTab from '../attendance/CmsCourseAttendanceTab.vue';
import { cmsCourseBuilderContextKey } from '../cmsCourseBuilderContext';

const builder = inject(cmsCourseBuilderContextKey);
const { courseId, courseGroups } = builder;
</script>


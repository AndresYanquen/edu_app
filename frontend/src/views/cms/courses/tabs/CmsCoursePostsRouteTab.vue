<template>
  <CmsCoursePostsTab :course-id="courseId" :groups="courseGroups" />
</template>

<script setup>
import { inject } from 'vue';
import CmsCoursePostsTab from '../../../../components/cms/posts/CmsCoursePostsTab.vue';
import { cmsCourseBuilderContextKey } from '../cmsCourseBuilderContext';

const builder = inject(cmsCourseBuilderContextKey);
const { courseId, courseGroups } = builder;
</script>


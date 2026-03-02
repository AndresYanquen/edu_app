<template>
  <CmsCourseAnnouncementsTab :course-id="courseId" :groups="courseGroups" />
</template>

<script setup>
import { inject } from 'vue';
import CmsCourseAnnouncementsTab from '../../../../components/cms/announcements/CmsCourseAnnouncementsTab.vue';
import { cmsCourseBuilderContextKey } from '../cmsCourseBuilderContext';

const builder = inject(cmsCourseBuilderContextKey);
const { courseId, courseGroups } = builder;
</script>


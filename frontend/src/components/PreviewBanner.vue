<template>
  <div class="preview-banner">
    <div class="preview-text">
      <i class="pi pi-exclamation-triangle"></i>
      <span>Preview mode — only admins see this banner.</span>
    </div>
    <Button label="Exit preview" severity="warning" @click="exitPreview" />
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

const courseId = computed(() => route.params.courseId || route.params.id || route.query.courseId);

const exitPreview = () => {
  if (courseId.value) {
    router.push(`/cms/courses/${courseId.value}`);
  } else {
    router.push('/cms/courses');
  }
};
</script>

<style scoped>
.preview-banner {
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.preview-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #92400e;
  font-weight: 500;
}
</style>

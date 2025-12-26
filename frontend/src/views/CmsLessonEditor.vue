<template>
  <div class="page cms-page">
    <Card>
      <template #title>
        <div class="lesson-header">
          <div>
            <Button icon="pi pi-arrow-left" class="p-button-text" @click="goBack" />
            <h2>Edit lesson</h2>
          </div>
          <Tag
            :value="lesson?.is_published ? 'Published' : 'Draft'"
            :severity="lesson?.is_published ? 'success' : 'warning'"
          />
        </div>
      </template>
      <template #content>
        <div v-if="loading">
          <Skeleton height="3rem" class="mb-2" />
          <Skeleton height="10rem" />
        </div>
        <div v-else-if="!lesson">
          <div class="empty-state">Lesson not found.</div>
        </div>
        <div v-else class="lesson-grid">
          <div class="lesson-form">
            <div class="dialog-field">
              <label>Title</label>
              <InputText v-model="form.title" placeholder="Lesson title" />
            </div>
            <div class="dialog-field">
              <label>Estimated minutes</label>
              <InputNumber v-model="form.estimatedMinutes" showButtons />
            </div>
            <div class="dialog-field">
              <label>Video URL</label>
              <InputText v-model="form.videoUrl" placeholder="https://..." />
            </div>
      <div class="dialog-field">
        <label>Content</label>
        <textarea
          v-model="form.contentText"
          rows="10"
          class="p-inputtextarea p-inputtext"
          placeholder="Lesson content"
        ></textarea>
      </div>
            <div class="form-actions">
              <Button
                :label="lesson.is_published ? 'Unpublish' : 'Publish'"
                :icon="lesson.is_published ? 'pi pi-eye-slash' : 'pi pi-eye'"
                class="p-button-text"
                @click="togglePublish"
              />
              <Button label="Save" :loading="saving" @click="saveLesson" />
            </div>
          </div>
          <div class="lesson-preview">
            <h4>Preview</h4>
            <p class="preview-text" v-if="form.contentText">{{ form.contentText }}</p>
            <p v-else class="empty-state">Content will appear here.</p>
            <div v-if="form.videoUrl" class="preview-actions">
              <Button label="Open video" icon="pi pi-external-link" class="p-button-text" @click="openVideo" />
            </div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { getLessons, updateLesson, publishLesson, unpublishLesson } from '../api/cms';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const lessonId = route.params.id;
const moduleId = route.query.moduleId;
const courseId = route.query.courseId;

const lesson = ref(null);
const loading = ref(true);
const saving = ref(false);
const form = ref({
  title: '',
  contentText: '',
  videoUrl: '',
  estimatedMinutes: 0,
});

const loadLesson = async () => {
  if (!moduleId) {
    toast.add({ severity: 'warn', summary: 'Missing module', detail: 'Open this lesson from the course builder', life: 3000 });
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const lessons = await getLessons(moduleId);
    lesson.value = lessons.find((item) => item.id === lessonId) || null;
    if (lesson.value) {
      form.value = {
        title: lesson.value.title,
        contentText: lesson.value.content_text || '',
        videoUrl: lesson.value.video_url || '',
        estimatedMinutes: lesson.value.estimated_minutes || 0,
      };
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load lesson', life: 3000 });
  } finally {
    loading.value = false;
  }
};

const saveLesson = async () => {
  if (!form.value.title.trim()) {
    toast.add({ severity: 'warn', summary: 'Title required', detail: 'Lesson title is required', life: 2500 });
    return;
  }
  saving.value = true;
  try {
    await updateLesson(lessonId, {
      title: form.value.title,
      contentText: form.value.contentText,
      videoUrl: form.value.videoUrl,
      estimatedMinutes: form.value.estimatedMinutes,
    });
    toast.add({ severity: 'success', summary: 'Lesson saved', life: 2000 });
    await loadLesson();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to save lesson',
      life: 3500,
    });
  } finally {
    saving.value = false;
  }
};

const togglePublish = async () => {
  if (!lesson.value) return;
  try {
    if (lesson.value.is_published) {
      await unpublishLesson(lessonId);
      toast.add({ severity: 'info', summary: 'Lesson unpublished', life: 2000 });
    } else {
      await publishLesson(lessonId);
      toast.add({ severity: 'success', summary: 'Lesson published', life: 2000 });
    }
    await loadLesson();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to update lesson',
      life: 3500,
    });
  }
};

const goBack = () => {
  router.push(`/cms/courses/${courseId || ''}`);
};

const openVideo = () => {
  if (form.value.videoUrl) {
    window.open(form.value.videoUrl, '_blank', 'noopener');
  }
};

loadLesson();
</script>

<style scoped>
.lesson-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lesson-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.lesson-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lesson-preview {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 1rem;
}

.preview-text {
  white-space: pre-wrap;
  line-height: 1.6;
}

.preview-actions {
  margin-top: 1rem;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.mb-2 {
  margin-bottom: 0.75rem;
}

@media (max-width: 900px) {
  .lesson-grid {
    grid-template-columns: 1fr;
  }
}
</style>

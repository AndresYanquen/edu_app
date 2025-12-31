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
        <div v-else>
          <div class="lesson-grid">
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
                  v-model="form.contentMarkdown"
                  rows="10"
                  class="p-inputtextarea p-inputtext"
                  placeholder="Write lesson notes and paste media links"
                ></textarea>
                <small class="muted">
                  Paste YouTube, Vimeo, Loom, or image URLs on their own lines to render rich embeds.
                </small>
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
              <RichContent v-if="form.contentMarkdown" :content="form.contentMarkdown" />
              <p v-else class="empty-state">Content will appear here.</p>
              <div v-if="form.videoUrl" class="preview-actions">
                <Button label="Open video" icon="pi pi-external-link" class="p-button-text" @click="openVideo" />
              </div>
            </div>
          </div>
          <Divider />
          <div class="quiz-section">
            <div class="quiz-header">
              <div>
                <h3>Quiz</h3>
                <Tag
                  :value="quizReady ? 'Ready' : 'Needs setup'"
                  :severity="quizReady ? 'success' : 'warning'"
                />
              </div>
              <div class="quiz-actions">
                <Button
                  label="Reload"
                  icon="pi pi-refresh"
                  class="p-button-text"
                  @click="loadQuiz"
                  :disabled="quizLoading"
                />
                <Button label="Add question" icon="pi pi-plus" @click="openQuestionDialog()" />
              </div>
            </div>
            <div v-if="quizLoading">
              <Skeleton height="3rem" class="mb-2" />
              <Skeleton height="3rem" class="mb-2" />
            </div>
            <div v-else-if="quizError" class="empty-state">
              Failed to load quiz.
              <Button label="Retry" class="p-button-text" @click="loadQuiz" />
            </div>
            <div v-else>
              <div v-if="!quizQuestions.length" class="empty-state">
                No questions yet. Click "Add question" to start.
              </div>
              <div v-else>
                <DataTable
                  :value="sortedQuestions"
                  v-model:selection="selectedQuestion"
                  selectionMode="single"
                  dataKey="id"
                  class="mb-3"
                >
                  <Column field="orderIndex" header="#" style="width: 5rem" />
                  <Column field="questionText" header="Question" />
                  <Column header="Type" style="width: 10rem">
                    <template #body="{ data }">
                      <Tag :value="questionTypeLabel(data.questionType)" severity="info" />
                    </template>
                  </Column>
                  <Column header="Options" style="width: 8rem">
                    <template #body="{ data }">
                      {{ data.options?.length || 0 }}
                    </template>
                  </Column>
                  <Column header="Actions" style="width: 14rem">
                    <template #body="{ data }">
                      <div class="question-actions">
                        <Button
                          icon="pi pi-arrow-up"
                          class="p-button-text"
                          @click.stop="moveQuestion(data, -1)"
                          :disabled="!canMoveQuestion(data, -1)"
                        />
                        <Button
                          icon="pi pi-arrow-down"
                          class="p-button-text"
                          @click.stop="moveQuestion(data, 1)"
                          :disabled="!canMoveQuestion(data, 1)"
                        />
                        <Button icon="pi pi-pencil" class="p-button-text" @click.stop="openQuestionDialog(data)" />
                        <Button
                          icon="pi pi-trash"
                          class="p-button-text p-button-danger"
                          @click.stop="removeQuestion(data)"
                        />
                      </div>
                    </template>
                  </Column>
                </DataTable>
              </div>
              <div v-if="selectedQuestion" class="options-panel">
                <div class="options-header">
                  <div>
                    <h4>Options</h4>
                    <small>{{ selectedQuestion.questionText }}</small>
                  </div>
                  <div>
                    <Button
                      label="Add option"
                      icon="pi pi-plus"
                      @click="openOptionDialog()"
                      :disabled="selectedQuestion.questionType === 'true_false'"
                    />
                  </div>
                </div>
                <p v-if="selectedQuestion.questionType === 'true_false'" class="muted">
                  True/False options are generated automatically. Use "Mark correct" to set the answer.
                </p>
                <DataTable :value="sortedOptions" dataKey="id">
                  <Column field="orderIndex" header="#" style="width: 4rem" />
                  <Column field="optionText" header="Option" />
                  <Column header="Correct" style="width: 8rem">
                    <template #body="{ data }">
                      <Tag :value="data.isCorrect ? 'Correct' : 'Pending'" :severity="data.isCorrect ? 'success' : 'secondary'" />
                    </template>
                  </Column>
                  <Column header="Actions" style="width: 16rem">
                    <template #body="{ data }">
                      <div class="question-actions">
                        <Button
                          icon="pi pi-check"
                          class="p-button-text"
                          @click="markOptionCorrect(data)"
                          :disabled="data.isCorrect"
                        />
                        <Button
                          icon="pi pi-arrow-up"
                          class="p-button-text"
                          @click="moveOption(data, -1)"
                          :disabled="!canMoveOption(data, -1)"
                        />
                        <Button
                          icon="pi pi-arrow-down"
                          class="p-button-text"
                          @click="moveOption(data, 1)"
                          :disabled="!canMoveOption(data, 1)"
                        />
                        <Button icon="pi pi-pencil" class="p-button-text" @click="openOptionDialog(data)" />
                        <Button
                          icon="pi pi-trash"
                          class="p-button-text p-button-danger"
                          @click="removeOption(data)"
                          :disabled="selectedQuestion.questionType === 'true_false'"
                        />
                      </div>
                    </template>
                  </Column>
                </DataTable>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Dialog v-model:visible="questionDialogVisible" :header="questionDialogTitle" modal class="dialog">
      <div class="dialog-field">
        <label>Question text</label>
        <InputText v-model="questionForm.questionText" placeholder="What is...?" />
      </div>
      <div class="dialog-field">
        <label>Question type</label>
        <Dropdown
          v-model="questionForm.questionType"
          :options="questionTypeOptions"
          optionLabel="label"
          optionValue="value"
        />
      </div>
      <div class="dialog-actions">
        <Button label="Cancel" class="p-button-text" @click="closeQuestionDialog" />
        <Button label="Save" :loading="questionSaving" @click="saveQuestion" />
      </div>
    </Dialog>

    <Dialog v-model:visible="optionDialogVisible" :header="optionDialogTitle" modal class="dialog">
      <div class="dialog-field">
        <label>Option text</label>
        <InputText v-model="optionForm.optionText" placeholder="Describe the option" />
      </div>
      <div class="checkbox-row">
        <Checkbox inputId="option-correct" v-model="optionForm.isCorrect" :binary="true" />
        <label for="option-correct">Mark as correct</label>
      </div>
      <div class="dialog-actions">
        <Button label="Cancel" class="p-button-text" @click="closeOptionDialog" />
        <Button label="Save" :loading="optionSaving" @click="saveOption" />
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import RichContent from '../components/RichContent.vue';
import {
  getLessons,
  updateLesson,
  publishLesson,
  unpublishLesson,
  getLessonQuiz,
  createQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
  createQuizOption,
  updateQuizOption,
  deleteQuizOption,
} from '../api/cms';

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
  contentMarkdown: '',
  videoUrl: '',
  estimatedMinutes: 0,
});

const quizQuestions = ref([]);
const quizLoading = ref(true);
const quizError = ref(false);
const selectedQuestion = ref(null);
const questionDialogVisible = ref(false);
const questionForm = ref({ questionText: '', questionType: 'single_choice' });
const questionSaving = ref(false);
const editingQuestionId = ref(null);
const optionDialogVisible = ref(false);
const optionForm = ref({ optionText: '', isCorrect: false });
const optionSaving = ref(false);
const editingOptionId = ref(null);

const questionTypeOptions = [
  { label: 'Single choice', value: 'single_choice' },
  { label: 'True/False', value: 'true_false' },
];

const sortedQuestions = computed(() =>
  [...quizQuestions.value].sort((a, b) => a.orderIndex - b.orderIndex),
);

const sortedOptions = computed(() => {
  if (!selectedQuestion.value) return [];
  return [...(selectedQuestion.value.options || [])].sort((a, b) => a.orderIndex - b.orderIndex);
});

const quizReady = computed(() => {
  if (!quizQuestions.value.length) return false;
  return quizQuestions.value.every((question) => {
    if (!question.options || question.options.length < 2) {
      return false;
    }
    const correctCount = question.options.filter((opt) => opt.isCorrect).length;
    if (question.questionType === 'single_choice') {
      return correctCount === 1;
    }
    if (question.questionType === 'true_false') {
      return correctCount === 1;
    }
    return true;
  });
});

const questionDialogTitle = computed(() =>
  editingQuestionId.value ? 'Edit question' : 'Add question',
);
const optionDialogTitle = computed(() =>
  editingOptionId.value ? 'Edit option' : 'Add option',
);

const questionTypeLabel = (type) => (type === 'true_false' ? 'True/False' : 'Single choice');

const syncSelectedQuestion = () => {
  if (!selectedQuestion.value) return;
  const next = quizQuestions.value.find((q) => q.id === selectedQuestion.value.id);
  selectedQuestion.value = next || null;
};

const loadLesson = async () => {
  if (!moduleId) {
    toast.add({
      severity: 'warn',
      summary: 'Missing module',
      detail: 'Open this lesson from the course builder',
      life: 3000,
    });
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
        contentMarkdown: lesson.value.content_markdown || lesson.value.content_text || '',
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

const loadQuiz = async () => {
  quizLoading.value = true;
  quizError.value = false;
  try {
    const data = await getLessonQuiz(lessonId);
    quizQuestions.value = (data.questions || []).map((question) => ({
      ...question,
      options: question.options || [],
    }));
    syncSelectedQuestion();
  } catch (err) {
    quizQuestions.value = [];
    quizError.value = true;
    toast.add({
      severity: 'error',
      summary: 'Quiz error',
      detail: err.response?.data?.error || 'Failed to load quiz',
      life: 3000,
    });
  } finally {
    quizLoading.value = false;
  }
};

const saveLesson = async () => {
  if (!form.value.title.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Title required',
      detail: 'Lesson title is required',
      life: 2500,
    });
    return;
  }
  saving.value = true;
  try {
    await updateLesson(lessonId, {
      title: form.value.title,
      contentText: form.value.contentMarkdown,
      contentMarkdown: form.value.contentMarkdown,
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

const openQuestionDialog = (question) => {
  editingQuestionId.value = question?.id || null;
  questionForm.value = {
    questionText: question?.questionText || '',
    questionType: question?.questionType || 'single_choice',
  };
  questionDialogVisible.value = true;
};

const closeQuestionDialog = () => {
  questionDialogVisible.value = false;
  questionForm.value = { questionText: '', questionType: 'single_choice' };
  editingQuestionId.value = null;
};

const saveQuestion = async () => {
  if (!questionForm.value.questionText.trim()) {
    toast.add({ severity: 'warn', summary: 'Text required', detail: 'Question text is required', life: 2500 });
    return;
  }
  questionSaving.value = true;
  try {
    if (editingQuestionId.value) {
      await updateQuizQuestion(editingQuestionId.value, {
        questionText: questionForm.value.questionText,
        questionType: questionForm.value.questionType,
      });
    } else {
      await createQuizQuestion(lessonId, {
        questionText: questionForm.value.questionText,
        questionType: questionForm.value.questionType,
      });
    }
    toast.add({ severity: 'success', summary: 'Question saved', life: 2000 });
    closeQuestionDialog();
    await loadQuiz();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to save question',
      life: 3500,
    });
  } finally {
    questionSaving.value = false;
  }
};

const removeQuestion = async (question) => {
  if (!window.confirm('Delete this question? This cannot be undone.')) {
    return;
  }
  try {
    await deleteQuizQuestion(question.id);
    if (selectedQuestion.value?.id === question.id) {
      selectedQuestion.value = null;
    }
    toast.add({ severity: 'info', summary: 'Question deleted', life: 2000 });
    await loadQuiz();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to delete question',
      life: 3500,
    });
  }
};

const moveQuestion = async (question, direction) => {
  const list = sortedQuestions.value;
  const index = list.findIndex((item) => item.id === question.id);
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= list.length) return;
  const target = list[targetIndex];
  try {
    await updateQuizQuestion(question.id, { orderIndex: target.orderIndex });
    await updateQuizQuestion(target.id, { orderIndex: question.orderIndex });
    await loadQuiz();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to reorder question',
      life: 3500,
    });
  }
};

const canMoveQuestion = (question, direction) => {
  const list = sortedQuestions.value;
  const index = list.findIndex((item) => item.id === question.id);
  const targetIndex = index + direction;
  return targetIndex >= 0 && targetIndex < list.length;
};

const openOptionDialog = (option) => {
  if (!selectedQuestion.value) return;
  editingOptionId.value = option?.id || null;
  optionForm.value = {
    optionText: option?.optionText || '',
    isCorrect: option?.isCorrect || false,
  };
  optionDialogVisible.value = true;
};

const closeOptionDialog = () => {
  optionDialogVisible.value = false;
  optionForm.value = { optionText: '', isCorrect: false };
  editingOptionId.value = null;
};

const saveOption = async () => {
  if (!selectedQuestion.value) return;
  if (!optionForm.value.optionText.trim()) {
    toast.add({ severity: 'warn', summary: 'Text required', detail: 'Option text is required', life: 2500 });
    return;
  }
  optionSaving.value = true;
  try {
    if (editingOptionId.value) {
      await updateQuizOption(editingOptionId.value, {
        optionText: optionForm.value.optionText,
        isCorrect: optionForm.value.isCorrect,
      });
    } else {
      await createQuizOption(selectedQuestion.value.id, {
        optionText: optionForm.value.optionText,
        isCorrect: optionForm.value.isCorrect,
      });
    }
    toast.add({ severity: 'success', summary: 'Option saved', life: 2000 });
    closeOptionDialog();
    await loadQuiz();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to save option',
      life: 3500,
    });
  } finally {
    optionSaving.value = false;
  }
};

const removeOption = async (option) => {
  if (!selectedQuestion.value || selectedQuestion.value.questionType === 'true_false') {
    return;
  }
  if (!window.confirm('Delete this option?')) {
    return;
  }
  try {
    await deleteQuizOption(option.id);
    toast.add({ severity: 'info', summary: 'Option deleted', life: 2000 });
    await loadQuiz();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to delete option',
      life: 3500,
    });
  }
};

const moveOption = async (option, direction) => {
  if (!selectedQuestion.value) return;
  const options = sortedOptions.value;
  const index = options.findIndex((item) => item.id === option.id);
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= options.length) return;
  const target = options[targetIndex];
  try {
    await updateQuizOption(option.id, { orderIndex: target.orderIndex });
    await updateQuizOption(target.id, { orderIndex: option.orderIndex });
    await loadQuiz();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to reorder option',
      life: 3500,
    });
  }
};

const canMoveOption = (option, direction) => {
  const options = sortedOptions.value;
  const index = options.findIndex((item) => item.id === option.id);
  const targetIndex = index + direction;
  return targetIndex >= 0 && targetIndex < options.length;
};

const markOptionCorrect = async (option) => {
  if (!selectedQuestion.value || option.isCorrect) return;
  try {
    await updateQuizOption(option.id, { isCorrect: true });
    toast.add({ severity: 'success', summary: 'Correct answer updated', life: 2000 });
    await loadQuiz();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to update option',
      life: 3500,
    });
  }
};

loadLesson();
loadQuiz();
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

.quiz-section {
  margin-top: 1.5rem;
}

.quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.quiz-actions {
  display: flex;
  gap: 0.5rem;
}

.question-actions {
  display: flex;
  gap: 0.25rem;
}

.options-panel {
  margin-top: 1.5rem;
}

.options-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.muted {
  color: #64748b;
  margin-bottom: 0.75rem;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

@media (max-width: 900px) {
  .lesson-grid {
    grid-template-columns: 1fr;
  }

  .quiz-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .quiz-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>

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

              <div class="assets-inline-hint">
                <small>Assets are managed in Media Library.</small>
                <Button
                  icon="pi pi-images"
                  label="Open Media Library"
                  class="p-button-text"
                  @click="openMediaLibrary"
                  aria-label="Open Media Library"
                />
              </div>
              <div class="dialog-field">
                <div class="content-header-row">
                  <label>Content</label>
                    <!-- <Button
                      icon="pi pi-images"
                      label="Media Library"
                      class="p-button-text"
                      :badge="String(recentAssets.length)"
                      badgeClass="p-badge-info"
                      @click="openMediaLibrary"
                      aria-label="Open Media Library"
                    /> -->
                </div>

                <div class="editor-wrapper">
                  <Editor
                    v-model="form.contentHtml"
                    ref="editorRef"
                    id="<uid>"
                    licenseKey="gpl"
                    tinymce-script-src="/tinymce/tinymce.min.js"
                    :init="tinymceInit"
                    
                  />
                </div>

                <small class="muted">
                  Paste YouTube, Vimeo, Loom, or image URLs on their own lines to render rich embeds.
                </small>

                <div class="asset-file-inputs">
                  <input
                    ref="imageInputRef"
                    type="file"
                    accept="image/*"
                    class="asset-file-input"
                    style="display: none"
                    @change="handleAssetSelection('image', $event)"
                  />
                  <input
                    ref="audioInputRef"
                    type="file"
                    accept="audio/*"
                    class="asset-file-input"
                    style="display: none"
                    @change="handleAssetSelection('audio', $event)"
                  />
                  <input
                    ref="fileInputRef"
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
                    class="asset-file-input"
                    style="display: none"
                    @change="handleAssetSelection('file', $event)"
                  />
                </div>
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
          </div>

          <Divider />

          <div class="quiz-section">
            <div class="quiz-header">
              <div>
                <h3>Quiz</h3>
                <Tag :value="quizReady ? 'Ready' : 'Needs setup'" :severity="quizReady ? 'success' : 'warning'" />
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
                  <Column header="Points" style="width: 6rem">
                    <template #body="{ data }">
                      {{ data.points ?? 1 }}
                    </template>
                  </Column>
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

            </div>
          </div>
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="questionDialogVisible"
      :header="questionDialogTitle"
      modal
      class="dialog"
      maximizable
      maximized
    >
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
      <div v-if="questionDialogUsesOptions" class="dialog-field">
        <label>Options</label>

        <div class="options-editor">
          <div
            v-for="(opt, idx) in questionForm.draftOptions"
            :key="opt.id || idx"
            class="option-row"
          >
            <div class="option-order question-actions">
              <Button
                icon="pi pi-arrow-up"
                class="p-button-text"
                @click="moveQuestionFormOption(idx, -1)"
                :disabled="idx === 0"
              />
              <Button
                icon="pi pi-arrow-down"
                class="p-button-text"
                @click="moveQuestionFormOption(idx, 1)"
                :disabled="idx === questionForm.draftOptions.length - 1"
              />
            </div>

            <InputText v-model="opt.optionText" placeholder="Option text" class="option-input" />

            <div class="option-correct checkbox-row">
              <template v-if="questionForm.questionType === 'single_choice'">
                <RadioButton
                  :inputId="`opt-correct-${idx}`"
                  name="correct-option"
                  :value="idx"
                  v-model="singleChoiceCorrectIndex"
                  @update:modelValue="setSingleCorrect(idx)"
                />
                <label :for="`opt-correct-${idx}`" class="muted">Correct</label>
              </template>

              <template v-else>
                <Checkbox :binary="true" v-model="opt.isCorrect" :inputId="`opt-cb-${idx}`" />
                <label :for="`opt-cb-${idx}`" class="muted">Correct</label>
              </template>
            </div>

            <Button
              icon="pi pi-trash"
              class="p-button-text p-button-danger"
              @click="removeQuestionFormOption(idx)"
              :disabled="questionForm.draftOptions.length <= 2"
            />
          </div>

          <Button
            icon="pi pi-plus"
            label="Add option"
            class="p-button-text"
            @click="addQuestionFormOption()"
          />
        </div>

        <small class="muted">
          Single choice: select exactly one correct option. Multiple choice: select one or more.
        </small>
      </div>
      <div v-if="questionDialogShowsTrueFalseSelector" class="dialog-field">
        <label>Correct answer</label>
        <Dropdown
          v-model="questionForm.trueFalseCorrect"
          :options="trueFalseCorrectOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Select correct answer"
        />
        <small class="muted">
          True/False options are generated automatically; choose the correct answer here.
        </small>
      </div>
      <div class="dialog-field">
        <label>Points</label>
        <InputNumber v-model.number="questionForm.points" :min="0" step="0.5" showButtons />
      </div>
      <div class="dialog-field">
        <label>Explanation</label>
        <Textarea v-model="questionForm.explanation" autoResize />
      </div>
      <Button
        class="p-button-text"
        icon="pi pi-chevron-down"
        label="Advanced"
        @click="questionAdvancedOpen = !questionAdvancedOpen"
      />
      <div v-if="questionAdvancedOpen" class="dialog-field">
        <label>Meta (JSON)</label>
        <Textarea
          v-model="questionForm.metaJson"
          autoResize
          placeholder='{"hint":"Hint text","regex":"^\\d+$"}'
        />
      </div>
      <div class="dialog-actions">
        <Button label="Cancel" class="p-button-text" @click="closeQuestionDialog" />
        <Button label="Save" :loading="questionSaving" @click="saveQuestion" />
      </div>
    </Dialog>

    <Dialog
      v-model:visible="mediaLibraryVisible"
      modal
      :dismissableMask="true"
      :closeOnEscape="true"
      :draggable="false"
      :blockScroll="true"
      class="media-library-dialog"
      :style="{ width: 'min(98vw, 1100px)' }"
    >
      <template #header>
        <div class="media-library-header">
          <div>
            <strong>Media Library</strong>
            <small class="muted">Browse and insert existing assets</small>
          </div>
        </div>
      </template>

      <div class="media-library-content">
        <div class="media-library-toolbar">
          <InputText
            v-model="mediaLibrarySearch"
            placeholder="Search assets..."
            aria-label="Search assets"
          />
          <div class="media-library-tabs">
            <Button
              label="Imágenes"
              :class="['p-button-sm', mediaLibraryTab === 'image' ? '' : 'p-button-outlined']"
              @click="mediaLibraryTab = 'image'"
            />
            <Button
              label="Audio"
              :class="['p-button-sm', mediaLibraryTab === 'audio' ? '' : 'p-button-outlined']"
              @click="mediaLibraryTab = 'audio'"
            />
            <Button
              label="Archivos"
              :class="['p-button-sm', mediaLibraryTab === 'file' ? '' : 'p-button-outlined']"
              @click="mediaLibraryTab = 'file'"
            />
          </div>
          <div class="media-library-upload">
            <Button
              label="Upload Image"
              icon="pi pi-image"
              class="p-button-text p-button-sm"
              :disabled="assetsUploadProcessing"
              @click="triggerAssetInput('image')"
            />
            <Button
              label="Upload Audio"
              icon="pi pi-music"
              class="p-button-text p-button-sm"
              :disabled="assetsUploadProcessing"
              @click="triggerAssetInput('audio')"
            />
            <Button
              label="Upload File"
              icon="pi pi-upload"
              class="p-button-text p-button-sm"
              :disabled="assetsUploadProcessing"
              @click="triggerAssetInput('file')"
            />
            <Button
              label="Refresh"
              icon="pi pi-refresh"
              class="p-button-text p-button-sm"
              @click="refreshAssets"
            />
          </div>
        </div>

        <div class="media-library-list">
          <div v-if="assetsUploadProcessing" class="assets-loading">
            Uploading file...
          </div>

          <div v-if="assetsLoading" class="assets-loading">
            <Skeleton height="2rem" class="mb-2" />
            <Skeleton height="2rem" />
          </div>

          <div v-else-if="assetsError" class="assets-error">
            Unable to load assets.
            <Button
              label="Retry"
              class="p-button-text"
              icon="pi pi-refresh"
              @click="refreshAssets"
            />
          </div>

          <div v-else-if="filteredAssets.length" class="assets-list">
            <div v-for="asset in filteredAssets" :key="asset.assetId" class="asset-row">
              <div class="asset-preview">
                <img v-if="assetKindValue(asset) === 'image'" :src="resolveAssetUrl(asset.url)" alt="" />
                <div v-else class="asset-icon">{{ asset.kind?.charAt(0)?.toUpperCase() || '?' }}</div>
              </div>
              <div class="asset-info">
                <div class="asset-title">{{ asset.originalName || asset.assetId }}</div>
                <div class="asset-meta">
                  <Tag :value="asset.kind" severity="info" />
                  <small>{{ asset.mimeType }}</small>
                  <small>{{ formatTimestamp(asset.createdAt) }}</small>
                </div>
              </div>
              <div class="asset-actions">
                <Button
                  icon="pi pi-copy"
                  class="p-button-text p-button-sm"
                  label="Copy"
                  @click="copyAssetUrl(resolveAssetUrl(asset.url))"
                  aria-label="Copy asset URL"
                />
                <Button
                  icon="pi pi-arrow-down"
                  class="p-button-text p-button-sm"
                  label="Insert"
                  @click="handleInsertAsset(asset)"
                  aria-label="Insert asset into editor"
                />
              </div>
            </div>
          </div>

          <div v-else class="assets-empty">
            No assets found for this filter.
          </div>
        </div>
      </div>
    </Dialog>

    <Dialog
      v-model:visible="insertQuizDialogVisible"
      header="Insert quiz marker"
      modal
      :style="{ width: '34rem', maxWidth: '95vw' }"
    >
      <div class="dialog-field">
        <label>Question</label>
        <Dropdown
          v-model="insertQuizQuestionId"
          :options="insertQuizQuestionOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Select a question"
          filter
        />
        <small class="muted">
          This inserts <code>data-lesson-id</code> and <code>data-question-id</code> marker HTML.
        </small>
      </div>
      <div class="dialog-actions">
        <Button label="Cancel" class="p-button-text" @click="insertQuizDialogVisible = false" />
        <Button label="Insert" :disabled="!isEditorReady" @click="insertQuizMarker" />
      </div>
      <small v-if="!isEditorReady" class="muted">Loading editor…</small>
    </Dialog>

    <Dialog
      v-model:visible="inlineQuizDialogVisible"
      modal
      class="dialog"
      :style="{ width: '80vw', maxWidth: '1100px' }"
    >
      <template #header>
        <div class="inline-quiz-header">
          <div>
            <strong>Quiz (inline)</strong>
            <small v-if="currentQuizId" class="muted">ID: {{ inlineQuizShortId }}</small>
          </div>
          <div class="question-actions">
            <Button
              label="Reload"
              icon="pi pi-refresh"
              class="p-button-text"
              @click="loadInlineQuiz"
              :disabled="inlineQuizLoading || !currentQuizId"
            />
            <Button
              label="Add question"
              icon="pi pi-plus"
              @click="openInlineQuestionDialog()"
              :disabled="!currentQuizId"
            />
          </div>
        </div>
      </template>

      <div class="dialog-field">
        <label>Quizzes in lesson: {{ discoveredQuizIds.length }}</label>
        <Dropdown
          v-model="currentQuizId"
          :options="discoveredQuizIds"
          placeholder="Select a quiz id"
          :disabled="!discoveredQuizIds.length"
        />
      </div>

      <div v-if="inlineQuizLoading">
        <Skeleton height="3rem" class="mb-2" />
        <Skeleton height="3rem" class="mb-2" />
      </div>

      <div v-else-if="inlineQuizError" class="empty-state">
        Failed to load inline quiz.
        <Button label="Retry" class="p-button-text" @click="loadInlineQuiz" />
      </div>

      <div v-else-if="!inlineQuizQuestions.length" class="empty-state">
        No questions yet for this quiz.
      </div>

      <DataTable
        v-else
        :value="sortedInlineQuestions"
        v-model:selection="inlineSelectedQuestion"
        selectionMode="single"
        dataKey="id"
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
              <Button icon="pi pi-pencil" class="p-button-text" @click.stop="openInlineQuestionDialog(data)" />
              <Button
                icon="pi pi-trash"
                class="p-button-text p-button-danger"
                @click.stop="removeQuestion(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
      <small class="muted">Options are edited in the question dialog.</small>
    </Dialog>

  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import RichContent from '../components/RichContent.vue';
import ProgressSpinner from 'primevue/progressspinner';
import { uploadLessonAsset } from '../lib/storageAssets';
import DOMPurify from 'dompurify';
import Editor from '@tinymce/tinymce-vue';
import Textarea from 'primevue/textarea';


// theme



import {
  getLessons,
  updateLesson,
  publishLesson,
  unpublishLesson,
  getLessonQuiz,
  getQuizById,
  createQuizQuestion,
  createQuizQuestionByQuiz,
  updateQuizQuestion,
  deleteQuizQuestion,
  createQuizOption,
  updateQuizOption,
  deleteQuizOption,
  listAssets,
  registerAsset,
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
  contentHtml: '',
  contentMarkdown: '',
  videoUrl: '',
  estimatedMinutes: 0,
});

const mediaLibraryVisible = ref(false);
const assetsLoaded = ref(false);
const assetsLoading = ref(false);
const assetsError = ref(false);
const recentAssets = ref([]);
const mediaLibraryTab = ref('image');
const mediaLibrarySearch = ref('');
const assetsUploadProcessing = ref(false);
const MAX_ASSET_FILE_SIZE = 25 * 1024 * 1024;

const imageInputRef = ref(null);
const audioInputRef = ref(null);
const fileInputRef = ref(null);
const editorRef = ref(null);
const tinymceEditor = ref(null);

const quizQuestions = ref([]);
const quizLoading = ref(true);
const quizError = ref(false);
const selectedQuestion = ref(null);
const inlineQuizDialogVisible = ref(false);
const questionDialogVisible = ref(false);
const questionForm = ref({
  questionText: '',
  questionType: 'single_choice',
  points: 1,
  explanation: '',
  metaJson: '',
  draftOptions: [
    { optionText: '', isCorrect: true },
    { optionText: '', isCorrect: false },
  ],
  trueFalseCorrect: '',
});
const questionSaving = ref(false);
const editingQuestionId = ref(null);
const insertQuizDialogVisible = ref(false);
const insertQuizQuestionId = ref('');
const currentQuizId = ref(null);
const editingQuizId = ref(null);
const insertingQuiz = ref(false);
const inlineQuizQuestions = ref([]);
const inlineQuizLoading = ref(false);
const inlineQuizError = ref(false);
const inlineSelectedQuestion = ref(null);
const questionDialogContext = ref('lesson');
const discoveredQuizIds = ref([]);
let scanQuizDebounceTimer = null;

const questionTypeOptions = [
  { label: 'Single choice', value: 'single_choice' },
  { label: 'Multiple choice', value: 'multiple_choice' },
  { label: 'True/False', value: 'true_false' },
  { label: 'Short text', value: 'short_text' },
  { label: 'Long text', value: 'long_text' },
  { label: 'Numeric', value: 'numeric' },
];

const sortedQuestions = computed(() =>
  [...quizQuestions.value].sort((a, b) => a.orderIndex - b.orderIndex),
);
const sortedInlineQuestions = computed(() =>
  [...inlineQuizQuestions.value].sort((a, b) => a.orderIndex - b.orderIndex),
);
const inlineQuizShortId = computed(() =>
  currentQuizId.value ? String(currentQuizId.value).slice(0, 8) : '',
);
const isEditorReady = computed(() => Boolean(tinymceEditor.value));
const insertedInlineQuestionIds = computed(() => {
  const ids = new Set();
  const body = editorRef.value?.editor?.getBody?.();

  if (body) {
    const nodes = body.querySelectorAll('.cms-quiz[data-question-id]');
    nodes.forEach((node) => {
      const value = String(node.getAttribute('data-question-id') || '').trim();
      if (value) ids.add(value);
    });
    return ids;
  }

  if (typeof document === 'undefined') return ids;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = form.value.contentHtml || '';
  const nodes = wrapper.querySelectorAll('.cms-quiz[data-question-id]');
  nodes.forEach((node) => {
    const value = String(node.getAttribute('data-question-id') || '').trim();
    if (value) ids.add(value);
  });
  return ids;
});
const insertQuizQuestionOptions = computed(() =>
  sortedQuestions.value
    .filter((question) => !insertedInlineQuestionIds.value.has(String(question.id)))
    .map((question) => ({
      label: `${question.orderIndex}. ${question.questionText}`,
      value: question.id,
    })),
);

const questionReady = (question) => {
  if (!question.questionText?.trim()) return false;
  const options = question.options || [];
  const correctCount = options.filter((opt) => opt.isCorrect).length;
  switch (question.questionType) {
    case 'single_choice':
      return options.length >= 2 && correctCount === 1;
    case 'multiple_choice':
      return options.length >= 2 && correctCount >= 1;
    case 'true_false':
      return options.length === 2 && correctCount === 1;
    case 'short_text':
    case 'long_text':
    case 'numeric':
      return true;
    default:
      return false;
  }
};

const quizReady = computed(() => {
  if (!quizQuestions.value.length) return false;
  return quizQuestions.value.every((question) => questionReady(question));
});

const questionDialogTitle = computed(() =>
  editingQuestionId.value ? 'Edit question' : 'Add question',
);
const createQuestionOptionTypes = ['single_choice', 'multiple_choice'];
const syncQuestionOptionTypes = ['single_choice', 'multiple_choice', 'true_false'];
const questionTypeUsesOptions = (type) => syncQuestionOptionTypes.includes(type);
const questionDialogUsesOptions = computed(() =>
  createQuestionOptionTypes.includes(questionForm.value.questionType),
);
const questionDialogShowsTrueFalseSelector = computed(
  () => questionForm.value.questionType === 'true_false',
);
const trueFalseCorrectOptions = [
  { label: 'True', value: 'true' },
  { label: 'False', value: 'false' },
];
const normalizedMediaLibrarySearch = computed(() =>
  String(mediaLibrarySearch.value || '').trim().toLowerCase(),
);
const resolveAssetUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  const base = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!base) return raw;
  try {
    return new URL(raw, base).toString();
  } catch (_) {
    return raw;
  }
};
const assetKindValue = (asset) => {
  const raw = String(asset?.kind || '').toLowerCase();
  if (raw === 'images') return 'image';
  return raw || 'file';
};
const filteredAssets = computed(() =>
  recentAssets.value.filter((asset) => {
    if ((mediaLibraryTab.value || 'image') !== assetKindValue(asset)) return false;
    if (!normalizedMediaLibrarySearch.value) return true;
    const haystack = [
      asset.originalName,
      asset.assetId,
      asset.mimeType,
      resolveAssetUrl(asset.url),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedMediaLibrarySearch.value);
  }),
);

const buildEmptyQuestionOption = () => ({ optionText: '', isCorrect: false });
const normalizeDraftOrder = (options = []) =>
  options.map((option, index) => ({
    ...option,
    orderIndex: index + 1,
  }));

const initializeQuestionFormOptionsByType = (type) => {
  questionForm.value.draftOptions = normalizeDraftOrder([
    { optionText: '', isCorrect: type === 'single_choice' },
    { optionText: '', isCorrect: false },
  ]);
};

const addQuestionFormOption = () => {
  questionForm.value.draftOptions = normalizeDraftOrder([
    ...questionForm.value.draftOptions,
    buildEmptyQuestionOption(),
  ]);
};

const removeQuestionFormOption = (index) => {
  if (questionForm.value.draftOptions.length <= 2) return;
  const copy = [...questionForm.value.draftOptions];
  copy.splice(index, 1);
  if (questionForm.value.questionType === 'single_choice' && !copy.some((option) => option.isCorrect)) {
    copy[0].isCorrect = true;
  }
  questionForm.value.draftOptions = normalizeDraftOrder(copy);
};

const moveQuestionFormOption = (index, dir) => {
  const nextIndex = index + dir;
  if (nextIndex < 0 || nextIndex >= questionForm.value.draftOptions.length) return;
  const copy = [...questionForm.value.draftOptions];
  const [item] = copy.splice(index, 1);
  copy.splice(nextIndex, 0, item);
  questionForm.value.draftOptions = normalizeDraftOrder(copy);
};

const setSingleCorrect = (index) => {
  if (questionForm.value.questionType !== 'single_choice') return;
  questionForm.value.draftOptions = normalizeDraftOrder(
    questionForm.value.draftOptions.map((option, optionIndex) => ({
      ...option,
      isCorrect: optionIndex === index,
    })),
  );
};

const singleChoiceCorrectIndex = computed({
  get() {
    if (questionForm.value.questionType !== 'single_choice') return null;
    return questionForm.value.draftOptions.findIndex((option) => option.isCorrect);
  },
  set(nextIndex) {
    if (typeof nextIndex !== 'number') return;
    setSingleCorrect(nextIndex);
  },
});

const normalizeDraftOptions = (type, draftOptions) => {
  const normalizedOptions = (draftOptions || [])
    .map((option) => ({
      id: option.id || null,
      optionText: (option.optionText || '').trim(),
      isCorrect: Boolean(option.isCorrect),
    }))
    .filter((option) => option.optionText !== '');

  if (!createQuestionOptionTypes.includes(type)) {
    return { normalizedOptions };
  }

  if (normalizedOptions.length < 2) {
    return {
      normalizedOptions,
      validationError: 'Add at least 2 options',
    };
  }

  if (type === 'single_choice') {
    const firstCorrectIndex = normalizedOptions.findIndex((option) => option.isCorrect);
    if (firstCorrectIndex === -1) {
      normalizedOptions[0].isCorrect = true;
    } else {
      normalizedOptions.forEach((option, index) => {
        option.isCorrect = index === firstCorrectIndex;
      });
    }
  }

  if (type === 'multiple_choice') {
    const hasCorrect = normalizedOptions.some((option) => option.isCorrect);
    if (!hasCorrect) normalizedOptions[0].isCorrect = true;
  }

  return {
    normalizedOptions: normalizedOptions.map((option, index) => ({
      ...option,
      orderIndex: index + 1,
    })),
  };
};

const fetchQuestionFromServer = async (questionId) => {
  const data = await getLessonQuiz(lessonId);
  return (data.questions || []).find((question) => question.id === questionId || String(question.id) === String(questionId));
};

const questionTypeLabel = (type) => {
  switch (type) {
    case 'multiple_choice':
      return 'Multiple choice';
    case 'true_false':
      return 'True/False';
    case 'short_text':
      return 'Short text';
    case 'long_text':
      return 'Long text';
    case 'numeric':
      return 'Numeric';
    default:
      return 'Single choice';
  }
};

const syncSelectedQuestion = () => {
  if (!selectedQuestion.value) return;
  const next = quizQuestions.value.find((q) => q.id === selectedQuestion.value.id);
  selectedQuestion.value = next || null;
};

const toHtmlFallback = (value) => {
  if (!value) return '';
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join('');
};

// ✅ estable: extrae texto plano desde HTML
const updatePlainTextFromEditor = () => {
  if (typeof document === 'undefined') {
    form.value.contentMarkdown = '';
    return;
  }
  const container = document.createElement('div');
  container.innerHTML = form.value.contentHtml || '';
  form.value.contentMarkdown = (container.textContent || '').trim();
};

const escapeHtml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildAssetSnippet = (asset) => {
  const url = resolveAssetUrl(asset.url);
  const safeLabel = escapeHtml(asset.originalName || url);
  if (asset.kind === 'image' || asset.kind === 'images') {
    return `<p><img src="${url}" alt="${safeLabel}" /></p>`;
  }
  if (asset.kind === 'audio') {
    return `<p><audio controls src="${url}"></audio></p>`;
  }
  return `<p><a href="${url}" target="_blank" rel="noopener">${safeLabel}</a></p>`;
};

const buildInlineQuizMarkerHtml = (targetLessonId, questionId) => {
  const safeLessonId = escapeHtml(String(targetLessonId || ''));
  const safeQuestionId = escapeHtml(String(questionId || ''));
  return `<div class="cms-quiz mceNonEditable" contenteditable="false" data-lesson-id="${safeLessonId}" data-question-id="${safeQuestionId}"></div>`;
};

const renderQuizPreviewHtml = (questionId) => {
  const question = quizQuestions.value.find((item) => String(item?.id || '') === String(questionId || ''));
  if (!question) {
    return `<div class="cms-quiz-placeholder">🧩 Inline quiz (${String(questionId || '').slice(0, 8)})</div>`;
  }
  const questionText = escapeHtml(String(question.questionText || ''));
  const options = Array.isArray(question.options) ? question.options : [];
  const optionsHtml = options
    .map((option) => {
      const optionText = escapeHtml(String(option?.optionText || ''));
      return `<label class="cms-quiz-option"><input type="radio" disabled /><span>${optionText}</span></label>`;
    })
    .join('');

  return `
    <div class="cms-quiz-preview">
      <p class="cms-quiz-question">${questionText}</p>
      <div class="cms-quiz-options">${optionsHtml || '<small>No options</small>'}</div>
    </div>
  `;
};

const renderInlineQuizMarkersInEditor = (editor) => {
  const body = editor?.getBody?.();
  if (!body) return;
  const markers = body.querySelectorAll('.cms-quiz[data-question-id]');
  markers.forEach((marker) => {
    const questionId = String(marker.getAttribute('data-question-id') || '').trim();
    marker.classList.add('mceNonEditable');
    marker.setAttribute('contenteditable', 'false');
    marker.innerHTML = renderQuizPreviewHtml(questionId);
  });
};

const stripInlineQuizPreviewFromHtml = (html) => {
  if (!html) return html;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const markers = wrapper.querySelectorAll('.cms-quiz[data-lesson-id][data-question-id]');
  markers.forEach((marker) => {
    marker.classList.add('mceNonEditable');
    marker.setAttribute('contenteditable', 'false');
    marker.innerHTML = '';
  });
  return wrapper.innerHTML;
};

const insertQuizMarker = () => {
  const editor = tinymceEditor.value;
  const questionId = insertQuizQuestionId.value;
  if (!editor) {
    toast.add({
      severity: 'warn',
      summary: 'Editor not ready',
      detail: 'TinyMCE editor is not available yet',
      life: 2500,
    });
    return;
  }
  if (!lessonId || !questionId) {
    toast.add({
      severity: 'warn',
      summary: 'Missing data',
      detail: 'Lesson and question are required',
      life: 2500,
    });
    return;
  }

  editor.focus();
  editor.insertContent(buildInlineQuizMarkerHtml(lessonId, questionId));
  renderInlineQuizMarkersInEditor(editor);
  insertQuizDialogVisible.value = false;
  toast.add({
    severity: 'success',
    summary: 'Quiz marker inserted',
    life: 2000,
  });
};

const openInsertQuizDialog = () => {
  if (!lessonId) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Lesson id is required to insert a quiz marker',
      life: 3000,
    });
    return;
  }
  if (!sortedQuestions.value.length) {
    toast.add({
      severity: 'warn',
      summary: 'No questions yet',
      detail: 'Create a quiz question first',
      life: 3000,
    });
    return;
  }
  if (!insertQuizQuestionOptions.value.length) {
    toast.add({
      severity: 'info',
      summary: 'No available questions',
      detail: 'All questions are already inserted in the editor',
      life: 3000,
    });
    return;
  }
  insertQuizQuestionId.value = insertQuizQuestionOptions.value[0]?.value || '';
  insertQuizDialogVisible.value = true;
};

const openInlineQuizEditor = async (quizId) => {
  currentQuizId.value = quizId;
  if (quizId && !discoveredQuizIds.value.includes(quizId)) {
    discoveredQuizIds.value = [...discoveredQuizIds.value, quizId];
  }
  editingQuizId.value = quizId;
  inlineQuizDialogVisible.value = true;
  await loadInlineQuiz();
};

const openInlineQuestionDialog = (question) => {
  questionDialogContext.value = 'inline';
  openQuestionDialog(question);
};

const recentAssetLimit = 50;

const addRecentAsset = (entry) => {
  recentAssets.value = [entry, ...recentAssets.value.filter((item) => item.assetId !== entry.assetId)];
  if (recentAssets.value.length > recentAssetLimit) recentAssets.value.pop();
  assetsLoaded.value = true;
};

const uploadAndRegisterAsset = async (kind, file) => {
  if (file.size > MAX_ASSET_FILE_SIZE) throw new Error('File must be 25 MB or smaller');
  if (!courseId) throw new Error('Course context is missing');

  const uploadResult = await uploadLessonAsset({ courseId, lessonId, file, kind });

  const payload = {
    storagePath: uploadResult.path,
    publicUrl: uploadResult.publicUrl,
    kind: uploadResult.kind,
    mimeType: uploadResult.mimeType,
    originalName: uploadResult.originalName,
    sizeBytes: uploadResult.size,
    storageProvider: 'supabase',
  };

  const registered = await registerAsset(payload);

  const entry = {
    assetId: registered.assetId,
    kind: registered.kind,
    mimeType: registered.mimeType,
    originalName: registered.originalName,
    sizeBytes: registered.sizeBytes,
    storagePath: registered.storagePath,
    url: resolveAssetUrl(registered.url || uploadResult.publicUrl),
    createdAt: registered.createdAt || new Date().toISOString(),
  };

  addRecentAsset(entry);
  return entry;
};

const editorInsertContent = (asset) => {
  const editor = editorRef.value?.editor;
  const url = resolveAssetUrl(asset?.url);
  if (!editor || !url) return;
  const snippet = buildAssetSnippet({ ...asset, url });
  editor.focus();
  editor.insertContent(snippet);
};

const handleTinyMceImageUpload = async (blobInfo, success, failure) => {
  const file = blobInfo.blob();
  try {
    const entry = await uploadAndRegisterAsset('image', file);
    addRecentAsset(entry);
    editorInsertContent(entry);
    success(entry.url);
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Image upload failed',
      detail: err?.message || err?.response?.data?.error || 'Unable to upload image',
      life: 3500,
    });
    if (failure) failure(err?.message || 'Unable to upload image');
  }
};

const determineAssetKind = (file, meta) => {
  if (meta?.filetype === 'image') return 'image';
  if (meta?.filetype === 'media') {
    if (file.type.startsWith('audio/')) return 'audio';
    return 'file';
  }
  return 'file';
};

const handleTinyMceFilePicker = (cb, value, meta) => {
  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.accept = meta?.filetype === 'media' ? 'audio/*,video/*' : meta?.filetype === 'image' ? 'image/*' : '.pdf,.doc,.docx,.ppt,.pptx,.zip';

  input.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    input.value = '';
    if (!file) return;

    try {
      const kind = determineAssetKind(file, meta);
      const entry = await uploadAndRegisterAsset(kind, file);
      addRecentAsset(entry);

      if (meta?.filetype === 'image') {
        cb(entry.url, { alt: file.name });
      } else {
        cb(entry.url, { text: file.name });
      }
    } catch (err) {
      toast.add({
        severity: 'error',
        summary: 'Upload failed',
        detail: err?.message || err?.response?.data?.error || 'Unable to upload file',
        life: 3500,
      });
    }
  });

  input.click();
};

const tinymceInit = {
  license_key: 'gpl',
  base_url: '/tinymce',
  suffix: '.min',
  menubar: true,
  height: 400,
  plugins: 'link lists table code image media autoresize preview fullscreen noneditable',
  toolbar:
    'undo redo | insertQuiz | link image media | blocks | bold italic underline | bullist numlist | table | code | removeformat',
  branding: false,
  convert_urls: false,
  relative_urls: false,

  extended_valid_elements:
    'iframe[src|title|width|height|allowfullscreen|frameborder|allow|referrerpolicy|sandbox],script[src|async|defer],audio[controls|src],source[src|type],div[class|style|data-lesson-id|data-question-id|contenteditable],label[class|style],input[type|disabled|checked|class|style],p[class|style],span[class|style],small[class|style]',
  valid_children: '+body[iframe|script]',
  sandbox_iframes: false,    
  
  automatic_uploads: true,
  file_picker_types: 'image media file',
  images_upload_handler: handleTinyMceImageUpload,
  file_picker_callback: handleTinyMceFilePicker,
  content_style: `
    .cms-quiz {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      background: #f8fafc;
      padding: 10px 12px;
      margin: 8px 0;
      min-height: 40px;
      cursor: default;
    }
    .cms-quiz.mceNonEditable {
      user-select: none;
    }
    .cms-quiz-placeholder {
      font-weight: 600;
      color: #0f172a;
    }
    .cms-quiz-preview {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .cms-quiz-question {
      margin: 0;
      color: #0f172a;
      font-weight: 600;
      line-height: 1.4;
    }
    .cms-quiz-options {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cms-quiz-option {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #1e293b;
      font-size: 13px;
    }
    .cms-quiz-option input {
      margin: 0;
    }
  `,
  setup: (editor) => {
    editor.on('init', () => {
      tinymceEditor.value = editor;
      renderInlineQuizMarkersInEditor(editor);
    });
    editor.on('remove', () => {
      if (tinymceEditor.value === editor) {
        tinymceEditor.value = null;
      }
    });

    editor.ui.registry.addButton('insertQuiz', {
      text: 'Quiz',
      onAction: async () => {
        if (insertingQuiz.value) return;
        insertingQuiz.value = true;
        try {
          openInsertQuizDialog();
        } catch (err) {
          toast.add({
            severity: 'error',
            summary: 'Insert quiz failed',
            detail: err?.response?.data?.error || err?.message || 'Failed to insert quiz',
            life: 3500,
          });
        } finally {
          insertingQuiz.value = false;
        }
      },
      onSetup: (api) => {
        const interval = window.setInterval(() => {
          api.setEnabled(!insertingQuiz.value);
        }, 150);
        return () => window.clearInterval(interval);
      },
    });

    editor.on('SetContent Change Undo Redo', () => {
      renderInlineQuizMarkersInEditor(editor);
      scheduleQuizEmbedScan();
    });
  },
}



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

    if (!lesson.value) {
      loading.value = false;
      return;
    }

    const fallbackText = lesson.value.content_markdown || lesson.value.content_text || '';
    const htmlValue = lesson.value.content_html || toHtmlFallback(fallbackText);

    form.value = {
      title: lesson.value.title,
      contentHtml: htmlValue,
      contentMarkdown: lesson.value.content_markdown || lesson.value.content_text || '',
      videoUrl: lesson.value.video_url || '',
      estimatedMinutes: lesson.value.estimated_minutes || 0,
    };

    loading.value = false;
    updatePlainTextFromEditor();
    refreshDiscoveredQuizIds();
  } catch (err) {
    loading.value = false;
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load lesson'+ err, life: 3000 });
  }
};
const triggerAssetInput = (kind) => {
  const map = { image: imageInputRef, audio: audioInputRef, file: fileInputRef };
  const target = map[kind];
  if (target?.value) {
    target.value.value = '';
    target.value.click();
  }
};

const openMediaLibrary = async () => {
  mediaLibraryVisible.value = true;
  await loadAssetsList();
};

const handleAssetSelection = async (kind, event) => {
  const file = event?.target?.files?.[0];
  if (event?.target) event.target.value = '';
  if (!file) return;
  await processAssetUpload(kind, file);
};

const processAssetUpload = async (kind, file) => {
  assetsUploadProcessing.value = true;
  try {
    const entry = await uploadAndRegisterAsset(kind, file);
    editorInsertContent(entry);
    toast.add({ severity: 'success', summary: 'Uploaded', detail: 'File uploaded and inserted', life: 2500 });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Upload failed',
      detail: err?.message || err?.response?.data?.error || 'Failed to upload asset',
      life: 3500,
    });
  } finally {
    assetsUploadProcessing.value = false;
  }
};

const loadAssetsList = async (force = false) => {
  if (!force && assetsLoaded.value && recentAssets.value.length) return;
  if (assetsLoading.value) return;

  assetsLoading.value = true;
  assetsError.value = false;
  try {
    const rows = await listAssets();
    recentAssets.value = (rows || []).map((row) => ({
      ...row,
      url: resolveAssetUrl(row?.url),
    }));
    assetsLoaded.value = true;
  } catch (err) {
    assetsError.value = true;
    toast.add({
      severity: 'error',
      summary: 'Assets error',
      detail: err?.response?.data?.error || 'Failed to load assets',
      life: 3000,
    });
  } finally {
    assetsLoading.value = false;
  }
};

const refreshAssets = () => loadAssetsList(true);

const handleInsertAsset = (asset) => {
  editorInsertContent(asset);
  toast.add({ severity: 'success', summary: 'Inserted', detail: 'Asset inserted into editor', life: 2000 });
};


const copyAssetUrl = async (url) => {
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    toast.add({ severity: 'success', summary: 'Copied', detail: 'Asset URL copied to clipboard', life: 2000 });
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Copy failed', detail: 'Unable to copy URL', life: 3000 });
  }
};

watch(
  () => mediaLibraryVisible.value,
  (visible) => {
    if (visible) loadAssetsList();
  },
);

watch(
  () => form.value.contentHtml,
  () => {
    updatePlainTextFromEditor();
  },
  { immediate: true },
);

watch(
  () => currentQuizId.value,
  (quizId, prevQuizId) => {
    if (!inlineQuizDialogVisible.value) return;
    if (!quizId || quizId === prevQuizId) return;
    loadInlineQuiz();
  },
);

watch(
  () => quizQuestions.value,
  () => {
    if (!tinymceEditor.value) return;
    renderInlineQuizMarkersInEditor(tinymceEditor.value);
  },
  { deep: true },
);

const formatTimestamp = (value) => (value ? new Date(value).toLocaleString() : '');

const mapQuizQuestionRow = (question) => ({
  ...question,
  id: question.id || question.questionId || question.question_id || null,
  points: question.points ?? 1,
  explanation: question.explanation || '',
  meta: question.meta ?? null,
  quizId: question.quizId || question.quiz_id || null,
  options: question.options || [],
});

const scanQuizEmbedsFromEditor = () => {
  const body = editorRef.value?.editor?.getBody?.();
  if (!body) return [];
  const nodes = body.querySelectorAll('.cms-quiz[data-question-id]');
  const ids = Array.from(nodes)
    .map((node) => node.getAttribute('data-question-id'))
    .filter(Boolean);
  return [...new Set(ids)];
};

const refreshDiscoveredQuizIds = () => {
  discoveredQuizIds.value = scanQuizEmbedsFromEditor();
  if (!currentQuizId.value && discoveredQuizIds.value.length) {
    currentQuizId.value = discoveredQuizIds.value[0];
  }
};

const scheduleQuizEmbedScan = () => {
  if (scanQuizDebounceTimer) clearTimeout(scanQuizDebounceTimer);
  scanQuizDebounceTimer = setTimeout(() => {
    refreshDiscoveredQuizIds();
  }, 250);
};

const loadQuiz = async () => {
  quizLoading.value = true;
  quizError.value = false;
  try {
    const data = await getLessonQuiz(lessonId);
    quizQuestions.value = (data.questions || []).map(mapQuizQuestionRow);
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

const loadInlineQuiz = async () => {
  if (!currentQuizId.value) return;
  inlineQuizLoading.value = true;
  inlineQuizError.value = false;
  inlineSelectedQuestion.value = null;
  try {
    const data = await getQuizById(currentQuizId.value);
    inlineQuizQuestions.value = (data.questions || []).map(mapQuizQuestionRow);
  } catch (err) {
    inlineQuizQuestions.value = [];
    inlineQuizError.value = true;
    toast.add({
      severity: 'error',
      summary: 'Inline quiz error',
      detail: err?.response?.data?.error || err?.message || 'Failed to load inline quiz',
      life: 3500,
    });
  } finally {
    inlineQuizLoading.value = false;
  }
};

const sanitizerConfig = {
  USE_PROFILES: { html: true },
  ADD_TAGS: ['iframe', 'video', 'audio', 'source', 'picture', 'track', 'code', 'pre'],
  ADD_ATTR: [
    'allow',
    'allowfullscreen',
    'frameborder',
    'referrerpolicy',
    'controls',
    'muted',
    'playsinline',
    'data-mce-*',
    'data-lesson-id',
    'data-question-id',
    'contenteditable',
    'class',
    'style',
  ],
};

const saveLesson = async () => {
  if (!form.value.title.trim()) {
    toast.add({ severity: 'warn', summary: 'Title required', detail: 'Lesson title is required', life: 2500 });
    return;
  }

  saving.value = true;
  try {
    const normalizedHtml = stripInlineQuizPreviewFromHtml(form.value.contentHtml || '');
    const sanitizedHtml = DOMPurify.sanitize(normalizedHtml || '', sanitizerConfig);

    const payload = {
      title: form.value.title,
      contentText: form.value.contentMarkdown,
      contentMarkdown: form.value.contentMarkdown,
      contentHtml: sanitizedHtml || null,
      estimatedMinutes: form.value.estimatedMinutes,
    };

    const trimmedVideoUrl = form.value.videoUrl?.trim();
    if (trimmedVideoUrl) payload.videoUrl = trimmedVideoUrl;

    await updateLesson(lessonId, payload);

    toast.add({ severity: 'success', summary: 'Lesson saved', life: 2000 });

    // ✅ reload to refresh the content after saving
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

const questionAdvancedOpen = ref(false);

const openQuestionDialog = (question, context = 'lesson') => {
  questionDialogContext.value = context;
  editingQuizId.value = context === 'inline' ? currentQuizId.value : null;
  editingQuestionId.value = question?.id || null;
  let draftOptions = [
    { optionText: '', isCorrect: true },
    { optionText: '', isCorrect: false },
  ];
  let trueFalseCorrect = '';
  const questionType = question?.questionType || 'single_choice';

  if (question) {
    const sortedQuestionOptions = [...(question.options || [])].sort(
      (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0),
    );
    draftOptions = sortedQuestionOptions.map((option) => ({
      id: option.id || null,
      optionText: option.optionText || '',
      isCorrect: Boolean(option.isCorrect),
      orderIndex: option.orderIndex || null,
    }));

    if (!draftOptions.length && createQuestionOptionTypes.includes(questionType)) {
      draftOptions = [
        { optionText: '', isCorrect: questionType === 'single_choice' },
        { optionText: '', isCorrect: false },
      ];
    }

    const options = question?.options || [];
    const trueOption = options.find(
      (option) => String(option.optionText || '').trim().toLowerCase() === 'true',
    );
    const falseOption = options.find(
      (option) => String(option.optionText || '').trim().toLowerCase() === 'false',
    );
    if (trueOption?.isCorrect) trueFalseCorrect = 'true';
    else if (falseOption?.isCorrect) trueFalseCorrect = 'false';
  } else if (questionType === 'multiple_choice') {
    draftOptions = [buildEmptyQuestionOption(), buildEmptyQuestionOption()];
  } else if (!createQuestionOptionTypes.includes(questionType)) {
    draftOptions = [];
  }

  questionForm.value = {
    questionText: question?.questionText || '',
    questionType,
    points: question?.points ?? 1,
    explanation: question?.explanation || '',
    metaJson: question?.meta ? JSON.stringify(question.meta, null, 2) : '',
    draftOptions: normalizeDraftOrder(draftOptions),
    trueFalseCorrect,
  };
  questionAdvancedOpen.value = false;
  questionDialogVisible.value = true;
};

const closeQuestionDialog = () => {
  questionDialogVisible.value = false;
  questionForm.value = {
    questionText: '',
    questionType: 'single_choice',
    points: 1,
    explanation: '',
    metaJson: '',
    draftOptions: [
      { optionText: '', isCorrect: true },
      { optionText: '', isCorrect: false },
    ],
    trueFalseCorrect: '',
  };
  editingQuestionId.value = null;
  editingQuizId.value = null;
  questionDialogContext.value = 'lesson';
  questionAdvancedOpen.value = false;
};

const saveQuestion = async () => {
  if (!questionForm.value.questionText.trim()) {
    toast.add({ severity: 'warn', summary: 'Text required', detail: 'Question text is required', life: 2500 });
    return;
  }

  if (questionForm.value.points < 0) {
    toast.add({ severity: 'warn', summary: 'Points invalid', detail: 'Points must be 0 or greater', life: 2500 });
    return;
  }
  if (questionDialogContext.value === 'inline' && !currentQuizId.value) {
    toast.add({
      severity: 'warn',
      summary: 'Quiz required',
      detail: 'Select an inline quiz before saving questions',
      life: 2500,
    });
    return;
  }

  const questionType = questionForm.value.questionType;
  const { normalizedOptions, validationError } = normalizeDraftOptions(
    questionType,
    questionForm.value.draftOptions,
  );
  if (createQuestionOptionTypes.includes(questionType)) {
    if (validationError) {
      toast.add({
        severity: 'warn',
        summary: 'Options required',
        detail: validationError,
        life: 2500,
      });
      return;
    }
    questionForm.value.draftOptions = normalizedOptions.map(({ id, optionText, isCorrect }) => ({
      id: id || null,
      optionText,
      isCorrect,
    }));
  } else if (questionType === 'true_false' && !questionForm.value.trueFalseCorrect) {
    toast.add({
      severity: 'warn',
      summary: 'Pending setup',
      detail: 'No correct True/False answer selected yet',
      life: 2500,
    });
  } else {
    questionForm.value.draftOptions = [];
  }

  questionSaving.value = true;
  let savedQuestionId = null;
  try {
    const payload = {
      questionText: questionForm.value.questionText,
      questionType,
      points: questionForm.value.points,
      explanation: questionForm.value.explanation,
    };
    if (questionForm.value.metaJson.trim()) {
      try {
        payload.meta = JSON.parse(questionForm.value.metaJson);
      } catch (parseErr) {
        toast.add({
          severity: 'warn',
          summary: 'Invalid JSON',
          detail: 'Meta must be valid JSON',
          life: 2500,
        });
        return;
      }
    }

    if (editingQuestionId.value) {
      await updateQuizQuestion(editingQuestionId.value, payload);
      savedQuestionId = editingQuestionId.value;
    } else {
      const created =
        questionDialogContext.value === 'inline'
          ? await createQuizQuestionByQuiz(currentQuizId.value, payload)
          : await createQuizQuestion(lessonId, payload);
      savedQuestionId = created?.id || created?.question?.id || null;
      if (!savedQuestionId) {
        throw new Error('Failed to resolve created question id');
      }
    }

    const sourceQuestions =
      questionDialogContext.value === 'inline' ? inlineQuizQuestions.value : quizQuestions.value;
    const existingQuestion =
      sourceQuestions.find((question) => String(question.id) === String(savedQuestionId)) || null;
    const existingOptions = existingQuestion?.options || [];

    if (createQuestionOptionTypes.includes(questionType)) {
      const next = normalizedOptions;
      const originalById = new Map(existingOptions.map((option) => [option.id, option]));
      const nextIds = new Set(next.filter((option) => option.id).map((option) => option.id));

      // a) deletes
      for (const option of existingOptions) {
        if (option?.id && !nextIds.has(option.id)) {
          await deleteQuizOption(option.id);
        }
      }

      // b) creates
      for (let index = 0; index < next.length; index += 1) {
        const option = next[index];
        if (option.id) continue;
        const optionPayload = {
          optionText: option.optionText,
          isCorrect: option.isCorrect,
          orderIndex: index + 1,
        };
        await createQuizOption(savedQuestionId, optionPayload);
      }

      // c) updates
      for (let index = 0; index < next.length; index += 1) {
        const option = next[index];
        if (!option.id) continue;
        const original = originalById.get(option.id);
        if (!original) continue;
        const trimmedOriginalText = (original.optionText || '').trim();
        const originalIsCorrect = Boolean(original.isCorrect);
        const originalOrderIndex = Number(original.orderIndex || index + 1);
        const nextOrderIndex = index + 1;

        if (
          trimmedOriginalText !== option.optionText ||
          originalIsCorrect !== option.isCorrect ||
          originalOrderIndex !== nextOrderIndex
        ) {
          await updateQuizOption(option.id, {
            optionText: option.optionText,
            isCorrect: option.isCorrect,
            orderIndex: nextOrderIndex,
          });
        }
      }
    } else if (questionType === 'true_false') {
      const draftCorrectFromOptions = (questionForm.value.draftOptions || []).find(
        (option) => Boolean(option.isCorrect),
      );
      const desiredCorrect =
        questionForm.value.trueFalseCorrect ||
        (draftCorrectFromOptions
          ? String(draftCorrectFromOptions.optionText || '').trim().toLowerCase()
          : '');

      if (desiredCorrect) {
        let currentOptions = existingOptions;
        if (!currentOptions.length) {
          const freshQuestion = await fetchQuestionFromServer(savedQuestionId);
          currentOptions = freshQuestion?.options || [];
        }

        const trueOption = currentOptions.find(
          (option) => String(option.optionText || '').trim().toLowerCase() === 'true',
        );
        const falseOption = currentOptions.find(
          (option) => String(option.optionText || '').trim().toLowerCase() === 'false',
        );
        if (trueOption && falseOption) {
          if (desiredCorrect === 'true') {
            await updateQuizOption(trueOption.id, { isCorrect: true });
            await updateQuizOption(falseOption.id, { isCorrect: false });
          } else if (desiredCorrect === 'false') {
            await updateQuizOption(trueOption.id, { isCorrect: false });
            await updateQuizOption(falseOption.id, { isCorrect: true });
          }
        }
      }
    } else {
      questionForm.value.draftOptions = [];
    }

    if (questionDialogContext.value === 'inline') {
      await loadInlineQuiz();
      inlineSelectedQuestion.value =
        inlineQuizQuestions.value.find((question) => String(question.id) === String(savedQuestionId)) || null;
    } else {
      await loadQuiz();
      selectedQuestion.value =
        quizQuestions.value.find((question) => String(question.id) === String(savedQuestionId)) || null;
    }
    toast.add({ severity: 'success', summary: 'Question saved', life: 2000 });
    closeQuestionDialog();
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

watch(
  () => questionForm.value.questionType,
  (nextType) => {
    if (!questionDialogVisible.value) return;
    if (nextType === 'true_false') {
      questionForm.value.trueFalseCorrect = '';
      questionForm.value.draftOptions = [];
      return;
    }

    if (questionTypeUsesOptions(nextType)) {
      if (!questionForm.value.draftOptions.length) {
        initializeQuestionFormOptionsByType(nextType);
      } else if (nextType === 'single_choice') {
        const firstCorrectIndex = questionForm.value.draftOptions.findIndex((option) => option.isCorrect);
        if (firstCorrectIndex === -1) {
          questionForm.value.draftOptions = questionForm.value.draftOptions.map((option, index) => ({
            ...option,
            isCorrect: index === 0,
          }));
        } else {
          questionForm.value.draftOptions = questionForm.value.draftOptions.map((option, index) => ({
            ...option,
            isCorrect: index === firstCorrectIndex,
          }));
        }
      }
      return;
    }

    questionForm.value.draftOptions = [];
    questionForm.value.trueFalseCorrect = '';
  },
);

const removeQuestion = async (question) => {
  if (!window.confirm('Delete this question? This cannot be undone.')) return;

  try {
    await deleteQuizQuestion(question.id);
    if (selectedQuestion.value?.id === question.id) selectedQuestion.value = null;
    if (inlineSelectedQuestion.value?.id === question.id) inlineSelectedQuestion.value = null;
    toast.add({ severity: 'info', summary: 'Question deleted', life: 2000 });
    if (inlineQuizDialogVisible.value) {
      await loadInlineQuiz();
    } else {
      await loadQuiz();
    }
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
  const list = inlineQuizDialogVisible.value ? sortedInlineQuestions.value : sortedQuestions.value;
  const index = list.findIndex((item) => item.id === question.id);
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= list.length) return;

  const target = list[targetIndex];
  try {
    await updateQuizQuestion(question.id, { orderIndex: target.orderIndex });
    await updateQuizQuestion(target.id, { orderIndex: question.orderIndex });
    if (inlineQuizDialogVisible.value) {
      await loadInlineQuiz();
    } else {
      await loadQuiz();
    }
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
  const list = inlineQuizDialogVisible.value ? sortedInlineQuestions.value : sortedQuestions.value;
  const index = list.findIndex((item) => item.id === question.id);
  const targetIndex = index + direction;
  return targetIndex >= 0 && targetIndex < list.length;
};

onMounted(async () => {
  await loadLesson();
  await loadQuiz();
  loadAssetsList(true);
  refreshDiscoveredQuizIds();
});

onBeforeUnmount(() => {
  if (scanQuizDebounceTimer) clearTimeout(scanQuizDebounceTimer);
});
</script>

<style scoped>
.lesson-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lesson-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  padding: 2rem;
}

.lesson-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.editor-wrapper {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
}

.editor-wrapper :deep(.tox-tinymce) {
  min-height: 220px;
  border-radius: 0.75rem;
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

.content-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.assets-inline-hint {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: #f8fafc;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.assets-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.asset-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.asset-input-row input[type='file'] {
  flex: 1;
}

.asset-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-top: 1px solid #e5e7eb;
}

.asset-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.asset-preview {
  width: 48px;
  height: 48px;
  min-width: 48px;
  margin-right: 0.75rem;
  border-radius: 0.5rem;
  display: flex;
  flex: 0 0 48px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #eef2ff;
}

.asset-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset-icon {
  font-weight: 600;
  color: #0f172a;
}

.asset-title {
  font-weight: 600;
}

.asset-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  color: #475569;
  font-size: 0.85rem;
}

.asset-actions {
  display: flex;
  gap: 0.35rem;
}

.assets-loading {
  color: #475569;
  font-size: 0.85rem;
}

.assets-error {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  color: #dc2626;
  font-size: 0.9rem;
}

.assets-empty {
  color: #475569;
  font-size: 0.9rem;
}

:deep(.media-library-dialog .p-dialog-content) {
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: min(85vh, 900px);
}

.media-library-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
  gap: 0.75rem;
}

.media-library-header  div{
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.media-library-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.media-library-toolbar {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.media-library-tabs {
  display: flex;
  gap: 0.5rem;
}

.media-library-upload {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.media-library-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.75rem 1rem 1rem;
}

.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.options-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.option-row {
  display: grid;
  grid-template-columns: 4rem 1fr 8rem 3rem;
  gap: 0.5rem;
  align-items: center;
}

.option-order {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-start;
}

.option-input {
  width: 100%;
}

.option-correct {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

:deep(.cms-quiz) {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
  padding: 10px 12px;
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

.inline-quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.question-actions {
  display: flex;
  gap: 0.25rem;
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

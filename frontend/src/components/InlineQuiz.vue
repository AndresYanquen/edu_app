<template>
  <div class="inline-quiz">
    <div v-if="!question" class="inline-quiz__state">
      Quiz question not found.
    </div>
    <div v-else>
      <div class="inline-quiz__header">
        <p class="inline-quiz__question">{{ question.questionText }}</p>
        <small>Selecciona la opción correcta.</small>
      </div>

      <div v-if="attemptsBlocked" class="inline-quiz__blocked" role="status">
        <i class="pi pi-lock"></i>
        <span>{{ attemptsBlockedMessage }}</span>
      </div>

      <div v-if="showsOptions" class="inline-quiz__options">
        <label
          v-for="option in question.options || []"
          :key="option.id"
          class="inline-quiz__option"
          :class="[optionStateClass(option), { 'is-disabled': attemptsBlocked }]"
        >
          <input
            :type="question.questionType === 'multiple_choice' ? 'checkbox' : 'radio'"
            :name="question.questionType === 'multiple_choice' ? undefined : `quiz-${quizKey}`"
            :value="option.id"
            :checked="isOptionSelected(option.id)"
            :disabled="attemptsBlocked"
            @change="handleSelectionChange(option.id, $event.target.checked)"
          />
          <span>{{ option.optionText }}</span>
        </label>
      </div>

      <div v-if="showsOptions" class="inline-quiz__actions">
        <button type="button" class="inline-quiz__btn inline-quiz__btn--ghost" @click="resetQuiz">
          <i class="pi pi-refresh"></i>
          <span>Reintentar</span>
        </button>
        <button
          type="button"
          class="inline-quiz__btn"
          :disabled="attemptsBlocked || !hasSelection || submitting"
          @click="validateQuiz"
        >
          <i class="pi pi-check-circle"></i>
          <span>{{ submitting ? 'Validando...' : 'Validar respuesta' }}</span>
        </button>
      </div>

      <div
        v-if="feedbackText"
        class="inline-quiz__feedback"
        :class="feedbackClass"
        aria-live="polite"
      >
        <i :class="validationState.status === 'correct' ? 'pi pi-check-circle' : 'pi pi-times-circle'"></i>
        <span>{{ feedbackText }}</span>
      </div>

      <small v-if="!showsOptions" class="inline-quiz__state">Unsupported type</small>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue';
import api from '../api/axios';

const props = defineProps({
  lessonId: {
    type: String,
    required: true,
  },
  questionId: {
    type: String,
    required: true,
  },
  question: {
    type: Object,
    default: null,
  },
  initialAnswer: {
    type: Object,
    default: null,
  },
  onAttempted: {
    type: Function,
    default: null,
  },
  previewMode: {
    type: Boolean,
    default: false,
  },
  showFeedback: {
    type: Boolean,
    default: true,
  },
  attemptsBlocked: {
    type: Boolean,
    default: false,
  },
  attemptsBlockedMessage: {
    type: String,
    default: 'Esta lección está cerrada. No puedes realizar nuevos intentos de quiz.',
  },
});
const emit = defineEmits(['attempted']);

const selectedOptionByQuizId = reactive({});
const validationByQuizId = reactive({});
const submittingByQuizId = reactive({});
const initialHydratedByQuizId = reactive({});

const quizKey = computed(() => `${props.lessonId}:${props.questionId}`);
const question = computed(() => props.question);
const selectedAnswer = computed(() => selectedOptionByQuizId[quizKey.value]);
const selectedOptionIds = computed(() =>
  Array.isArray(selectedAnswer.value) ? selectedAnswer.value : [],
);
const selectedOptionId = computed(() =>
  Array.isArray(selectedAnswer.value) ? null : selectedAnswer.value || null,
);
const validationState = computed(
  () => validationByQuizId[quizKey.value] || { status: 'idle', correctOptionIds: [] },
);
const submitting = computed(() => Boolean(submittingByQuizId[quizKey.value]));
const hasSelection = computed(() =>
  question.value?.questionType === 'multiple_choice'
    ? selectedOptionIds.value.length > 0
    : Boolean(selectedOptionId.value),
);

const showsOptions = computed(() =>
  ['single_choice', 'multiple_choice', 'true_false'].includes(question.value?.questionType),
);
const feedbackText = computed(() => {
  if (!props.showFeedback) return '';
  if (validationState.value.status === 'correct') return 'Correcto';
  if (validationState.value.status === 'wrong') return 'Incorrecto';
  return '';
});
const feedbackClass = computed(() =>
  validationState.value.status === 'correct' ? 'is-correct' : 'is-wrong',
);

const initializeQuizState = () => {
  const expectedIsArray = question.value?.questionType === 'multiple_choice';
  const currentValue = selectedOptionByQuizId[quizKey.value];

  if (!(quizKey.value in selectedOptionByQuizId)) {
    selectedOptionByQuizId[quizKey.value] =
      expectedIsArray ? [] : null;
  } else if (expectedIsArray && !Array.isArray(currentValue)) {
    selectedOptionByQuizId[quizKey.value] = [];
  } else if (!expectedIsArray && Array.isArray(currentValue)) {
    selectedOptionByQuizId[quizKey.value] = null;
  }
  if (!(quizKey.value in validationByQuizId)) {
    validationByQuizId[quizKey.value] = { status: 'idle', correctOptionIds: [] };
  }
  if (!(quizKey.value in submittingByQuizId)) {
    submittingByQuizId[quizKey.value] = false;
  }
  if (!(quizKey.value in initialHydratedByQuizId)) {
    initialHydratedByQuizId[quizKey.value] = false;
  }
};

const hydrateInitialAnswer = () => {
  initializeQuizState();
  if (initialHydratedByQuizId[quizKey.value]) return;

  const initial = props.initialAnswer;
  const type = question.value?.questionType;
  if (!initial || !type) {
    initialHydratedByQuizId[quizKey.value] = true;
    return;
  }

  if (type === 'multiple_choice') {
    const ids = Array.isArray(initial.optionIds)
      ? Array.from(new Set(initial.optionIds.filter(Boolean)))
      : initial.optionId
        ? [initial.optionId]
        : [];
    selectedOptionByQuizId[quizKey.value] = ids;
    validationByQuizId[quizKey.value] = {
      status: initial.isCorrect ? 'correct' : 'idle',
      correctOptionIds: initial.isCorrect ? ids : [],
    };
  } else {
    const optionId =
      initial.optionId ||
      (Array.isArray(initial.optionIds) ? initial.optionIds[0] : null) ||
      null;
    selectedOptionByQuizId[quizKey.value] = optionId;
    validationByQuizId[quizKey.value] = {
      status: initial.isCorrect ? 'correct' : 'idle',
      correctOptionIds: initial.isCorrect && optionId ? [optionId] : [],
    };
  }
  initialHydratedByQuizId[quizKey.value] = true;
};

const handleSelectionChange = (optionId, checked) => {
  if (props.attemptsBlocked) return;

  if (question.value?.questionType === 'multiple_choice') {
    const selected = selectedOptionIds.value;
    selectedOptionByQuizId[quizKey.value] = checked
      ? Array.from(new Set([...selected, optionId]))
      : selected.filter((id) => String(id) !== String(optionId));
  } else {
    selectedOptionByQuizId[quizKey.value] = optionId;
  }
  validationByQuizId[quizKey.value] = { status: 'idle', correctOptionIds: [] };
};

const validateQuiz = async () => {
  if (props.attemptsBlocked) return;
  if (!hasSelection.value || submitting.value) return;

  if (props.previewMode) {
    const correctOptionIds = (question.value?.options || [])
      .filter((option) => option.isCorrect)
      .map((option) => option.id);
    const selectedIds =
      question.value?.questionType === 'multiple_choice'
        ? selectedOptionIds.value
        : selectedOptionId.value
          ? [selectedOptionId.value]
          : [];
    const selectedSet = new Set(selectedIds.map(String));
    const correctSet = new Set(correctOptionIds.map(String));
    const isCorrect =
      selectedSet.size === correctSet.size &&
      [...selectedSet].every((id) => correctSet.has(id));

    validationByQuizId[quizKey.value] = {
      status: isCorrect ? 'correct' : 'wrong',
      correctOptionIds,
    };
    return;
  }

  submittingByQuizId[quizKey.value] = true;
  try {
    const payload =
      question.value?.questionType === 'multiple_choice'
        ? { optionIds: selectedOptionIds.value }
        : { optionId: selectedOptionId.value };
    const { data } = await api.post(
      `/lessons/${props.lessonId}/quiz/questions/${props.questionId}/attempt`,
      payload,
    );

    validationByQuizId[quizKey.value] = {
      status: data?.isCorrect ? 'correct' : 'wrong',
      correctOptionIds: data?.correctOptionIds || [],
    };
    const attemptedPayload = {
      lessonId: props.lessonId,
      questionId: props.questionId,
      isCorrect: Boolean(data?.isCorrect),
      scorePercent: data?.scorePercent ?? null,
      selectedOptionIds: data?.selectedOptionIds || [],
    };
    emit('attempted', attemptedPayload);
    if (typeof props.onAttempted === 'function') {
      props.onAttempted(attemptedPayload);
    }
  } catch (err) {
    validationByQuizId[quizKey.value] = { status: 'idle', correctOptionIds: [] };
  } finally {
    submittingByQuizId[quizKey.value] = false;
  }
};

const resetQuiz = () => {
  if (props.attemptsBlocked) return;

  selectedOptionByQuizId[quizKey.value] =
    question.value?.questionType === 'multiple_choice' ? [] : null;
  validationByQuizId[quizKey.value] = { status: 'idle', correctOptionIds: [] };
};

const optionStateClass = (option) => {
  const status = validationState.value.status;
  if (status === 'idle') return '';

  const isSelected =
    question.value?.questionType === 'multiple_choice'
      ? selectedOptionIds.value.some((id) => String(id) === String(option.id))
      : String(option.id) === String(selectedOptionId.value);
  if (!isSelected) return '';

  const isCorrect = validationState.value.correctOptionIds.some(
    (id) => String(id) === String(option.id),
  );

  return isCorrect ? 'is-selected-correct' : 'is-selected-wrong';
};

const isOptionSelected = (optionId) =>
  question.value?.questionType === 'multiple_choice'
    ? selectedOptionIds.value.some((id) => String(id) === String(optionId))
    : String(selectedOptionId.value) === String(optionId);

watch(quizKey, initializeQuizState, { immediate: true });
watch(() => question.value?.questionType, initializeQuizState);
watch([quizKey, () => props.initialAnswer, () => question.value?.questionType], hydrateInitialAnswer, {
  immediate: true,
  deep: true,
});
</script>

<style scoped>
.inline-quiz {
  padding: 0.25rem 0 0;
  background: transparent;
}

.inline-quiz__header {
  margin-bottom: 1.15rem;
}

.inline-quiz__question {
  margin: 0 0 0.35rem;
  color: #0f172a;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.35;
}

.inline-quiz__header small {
  color: #64748b;
  font-size: 0.94rem;
  font-weight: 500;
}

.inline-quiz__options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.inline-quiz__blocked {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin: 0 0 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid #fecaca;
  border-radius: 10px;
  background: #fef2f2;
  color: #991b1b;
  font-weight: 800;
}

.inline-quiz__option {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 56px;
  padding: 1rem 1.15rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
  color: #0f172a;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.inline-quiz__option:hover {
  border-color: #bfdbfe;
  box-shadow: 0 12px 26px rgba(37, 99, 235, 0.1);
  transform: translateY(-1px);
}

.inline-quiz__option.is-disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.inline-quiz__option.is-disabled:hover {
  border-color: #e2e8f0;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
  transform: none;
}

.inline-quiz__option input {
  width: 16px;
  height: 16px;
  accent-color: #4f46e5;
  flex: 0 0 auto;
}

.inline-quiz__option span {
  font-weight: 700;
  line-height: 1.35;
}

.inline-quiz__actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: 1.6rem;
  padding-top: 1.3rem;
  border-top: 1px solid #e2e8f0;
}

.inline-quiz__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  min-height: 44px;
  border: 1px solid #4f46e5;
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
  color: #fff;
  border-radius: 8px;
  padding: 0.72rem 1.25rem;
  cursor: pointer;
  font-weight: 800;
  box-shadow: 0 12px 24px rgba(79, 70, 229, 0.28);
  transition:
    filter 0.18s ease,
    transform 0.18s ease;
}

.inline-quiz__btn:hover:not(:disabled) {
  filter: brightness(1.04);
  transform: translateY(-1px);
}

.inline-quiz__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.inline-quiz__btn--ghost {
  background: #fff;
  color: #1e293b;
  border-color: #cbd5e1;
  box-shadow: none;
}

.inline-quiz__state {
  color: #64748b;
}

.inline-quiz__feedback {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin: 1rem 0 0;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  font-weight: 800;
}

.inline-quiz__feedback.is-correct {
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.inline-quiz__feedback.is-wrong {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.inline-quiz__option.is-selected-correct {
  border-color: #86efac;
  background: #f0fdf4;
}

.inline-quiz__option.is-selected-wrong {
  border-color: #fecaca;
  background: #fef2f2;
}

.inline-quiz__option.is-correct-option {
  outline: 1px solid #16a34a;
  background: #f0fdf4;
}
</style>

<template>
  <div class="inline-quiz">
    <div v-if="!question" class="inline-quiz__state">
      Quiz question not found.
    </div>
    <div v-else>
      <p class="inline-quiz__question">{{ question.questionText }}</p>

      <div v-if="showsOptions" class="inline-quiz__options">
        <label
          v-for="option in question.options || []"
          :key="option.id"
          class="inline-quiz__option"
          :class="optionStateClass(option)"
        >
          <input
            :type="question.questionType === 'multiple_choice' ? 'checkbox' : 'radio'"
            :name="question.questionType === 'multiple_choice' ? undefined : `quiz-${quizKey}`"
            :value="option.id"
            :checked="isOptionSelected(option.id)"
            @change="handleSelectionChange(option.id, $event.target.checked)"
          />
          <span>{{ option.optionText }}</span>
        </label>
      </div>

      <div v-if="showsOptions" class="inline-quiz__actions">
        <button
          type="button"
          class="inline-quiz__btn"
          :disabled="!hasSelection || submitting"
          @click="validateQuiz"
        >
          {{ submitting ? 'Validando...' : 'Validar' }}
        </button>
        <button type="button" class="inline-quiz__btn inline-quiz__btn--ghost" @click="resetQuiz">
          Reintentar
        </button>
      </div>

      <p v-if="feedbackText" class="inline-quiz__feedback" :class="feedbackClass" aria-live="polite">
        {{ feedbackText }}
      </p>

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
  } else {
    const optionId =
      initial.optionId ||
      (Array.isArray(initial.optionIds) ? initial.optionIds[0] : null) ||
      null;
    selectedOptionByQuizId[quizKey.value] = optionId;
  }
  validationByQuizId[quizKey.value] = { status: 'idle', correctOptionIds: [] };
  initialHydratedByQuizId[quizKey.value] = true;
};

const handleSelectionChange = (optionId, checked) => {
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
  if (!hasSelection.value || submitting.value) return;

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
  border: 1px solid #dbeafe;
  border-radius: 0.75rem;
  padding: 0.75rem;
  background: #f8fbff;
}

.inline-quiz__question {
  margin: 0 0 0.75rem;
  font-weight: 600;
}

.inline-quiz__options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.inline-quiz__option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.4rem;
  border-radius: 0.5rem;
}

.inline-quiz__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.inline-quiz__btn {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #fff;
  border-radius: 0.5rem;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
}

.inline-quiz__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.inline-quiz__btn--ghost {
  background: #fff;
  color: #1e293b;
  border-color: #cbd5e1;
}

.inline-quiz__state {
  color: #64748b;
}

.inline-quiz__feedback {
  margin: 0.6rem 0 0;
  font-weight: 600;
}

.inline-quiz__feedback.is-correct {
  color: #15803d;
}

.inline-quiz__feedback.is-wrong {
  color: #b91c1c;
}

.inline-quiz__option.is-selected-correct {
  background: #dcfce7;
}

.inline-quiz__option.is-selected-wrong {
  background: #fee2e2;
}

.inline-quiz__option.is-correct-option {
  outline: 1px solid #16a34a;
  background: #f0fdf4;
}
</style>

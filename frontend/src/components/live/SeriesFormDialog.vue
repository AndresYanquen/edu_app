<template>
  <Dialog
    :visible="visible"
    modal
    :header="dialogTitle"
    :style="{ width: '520px' }"
    @update:visible="(value) => emit('update:visible', value)"
  >
    <div class="form-grid">
      <div class="form-field">
        <label>{{ t('liveSessions.form.title') }}</label>
        <InputText v-model="form.title" :placeholder="t('liveSessions.form.titlePlaceholder')" />
        <small v-if="errors.title" class="field-error">{{ errors.title }}</small>
      </div>
      <div class="form-field">
        <label>{{ t('liveSessions.form.module') }}</label>
        <Dropdown
          v-model="form.moduleId"
          :options="moduleOptions"
          optionLabel="label"
          optionValue="value"
          :placeholder="t('liveSessions.form.modulePlaceholder')"
          showClear
        />
      </div>
      <div class="form-field">
        <label>{{ t('liveSessions.form.classType') }}</label>
        <Dropdown
          v-model="form.classTypeId"
          :options="classTypeOptions"
          optionLabel="label"
          optionValue="value"
          :placeholder="t('liveSessions.form.classTypePlaceholder')"
        />
        <small v-if="errors.classTypeId" class="field-error">{{ errors.classTypeId }}</small>
      </div>
      <div class="form-field">
        <label>{{ t('liveSessions.form.hostTeacher') }}</label>
        <Dropdown
          v-model="form.hostTeacherId"
          :options="teacherOptions"
          optionLabel="label"
          optionValue="value"
          :placeholder="t('liveSessions.form.hostTeacherPlaceholder')"
        />
        <small v-if="errors.hostTeacherId" class="field-error">{{ errors.hostTeacherId }}</small>
      </div>
      <div class="form-field">
        <label>{{ t('liveSessions.form.start') }}</label>
        <Calendar
          v-model="form.dtstart"
          showIcon
          showTime
          hourFormat="24"
          :placeholder="t('liveSessions.form.startPlaceholder')"
        />
        <small v-if="errors.dtstart" class="field-error">{{ errors.dtstart }}</small>
      </div>
      <div class="form-field-inline">
        <div>
          <label>{{ t('liveSessions.form.duration') }}</label>
          <InputNumber
            v-model="form.durationMinutes"
            :min="5"
            :max="300"
            :step="5"
            suffix=" min"
          />
          <small v-if="errors.durationMinutes" class="field-error">{{ errors.durationMinutes }}</small>
        </div>
        <div>
          <label>{{ t('liveSessions.form.timezone') }}</label>
          <InputText v-model="form.timezone" />
          <small class="muted">{{ t('liveSessions.form.timezoneHint') }}</small>
        </div>
      </div>
      <div class="form-field recurrence-field">
        <label>{{ t('liveSessions.form.recurrenceLabel') }}</label>
        <div class="recurrence-days">
          <Button
            v-for="option in weekdayOptions"
            :key="option.value"
            :label="option.label"
            class="day-chip"
            :class="{ active: recurrence.days.includes(option.value) }"
            @click="toggleDay(option.value)"
          />
        </div>
        <div class="recurrence-interval">
          <label>{{ t('liveSessions.form.recurrenceIntervalLabel') }}</label>
          <InputNumber v-model="recurrence.interval" :min="1" :max="4" :showButtons="true" />
          <span class="muted">{{ t('liveSessions.form.recurrenceIntervalHint') }}</span>
        </div>
        <small class="muted">{{ rrulePreview }}</small>
        <small v-if="errors.rrule" class="field-error">{{ errors.rrule }}</small>
      </div>
    <div class="form-field">
      <label>{{ t('liveSessions.form.joinUrl') }}</label>
      <InputText v-model="form.joinUrl" placeholder="https://meet.google.com/..." />
      </div>
      <div class="form-field">
        <label>{{ t('liveSessions.form.hostUrl') }}</label>
        <InputText v-model="form.hostUrl" placeholder="https://meet.google.com/..." />
      </div>
    </div>

    <template #footer>
      <Button
        class="p-button-text"
        :label="t('common.cancel')"
        @click="emit('update:visible', false)"
      />
      <Button
        :label="t('common.save')"
        icon="pi pi-check"
        :loading="loading"
        @click="handleSubmit"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { reactive, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  modules: {
    type: Array,
    default: () => [],
  },
  classTypes: {
    type: Array,
    default: () => [],
  },
  teachers: {
    type: Array,
    default: () => [],
  },
  editing: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:visible', 'submit']);
const { t } = useI18n();

const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const weekdayOrder = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const weekdayOptions = computed(() =>
  weekdayOrder.map((value) => ({
    value,
    label: t(`liveSessions.form.weekdays.${value}`),
  })),
);

const recurrence = reactive({
  interval: 1,
  days: [],
});

const parseRecurrence = (value = '') => {
  const result = { interval: 1, days: [] };
  if (!value) {
    return result;
  }
  value.split(';').forEach((segment) => {
    const [key, val] = segment.split('=');
    if (!key || !val) {
      return;
    }
    if (key === 'INTERVAL') {
      const interval = parseInt(val, 10);
      if (!Number.isNaN(interval) && interval > 0) {
        result.interval = interval;
      }
    }
    if (key === 'BYDAY') {
      const days = val.split(',').map((day) => day.trim()).filter(Boolean);
      result.days = days;
    }
  });
  return result;
};

const applyRecurrenceRrule = (value) => {
  const parsed = parseRecurrence(value);
  recurrence.interval = parsed.interval;
  recurrence.days.splice(0, recurrence.days.length, ...parsed.days);
};

const buildRecurrenceRrule = () => {
  if (!recurrence.days.length) {
    return '';
  }
  const parts = ['FREQ=WEEKLY'];
  if (recurrence.interval && recurrence.interval > 1) {
    parts.push(`INTERVAL=${recurrence.interval}`);
  }
  parts.push(`BYDAY=${recurrence.days.join(',')}`);
  return parts.join(';');
};

const toggleDay = (day) => {
  const index = recurrence.days.indexOf(day);
  if (index > -1) {
    recurrence.days.splice(index, 1);
  } else {
    recurrence.days.push(day);
  }
};

const getWeekdayLabel = (value) =>
  weekdayOptions.value.find((option) => option.value === value)?.label || value;

const rrulePreview = computed(() => {
  if (!recurrence.days.length) {
    return t('liveSessions.form.recurrencePreviewEmpty');
  }
  const dayLabels = recurrence.days.map(getWeekdayLabel).join(', ');
  return t('liveSessions.form.recurrencePreview', {
    interval: recurrence.interval,
    days: dayLabels,
  });
});

const form = reactive({
  title: '',
  moduleId: null,
  classTypeId: null,
  hostTeacherId: null,
  dtstart: null,
  durationMinutes: 30,
  timezone: defaultTimezone,
  rrule: '',
  joinUrl: '',
  hostUrl: '',
});

const errors = reactive({
  title: '',
  classTypeId: '',
  hostTeacherId: '',
  dtstart: '',
  durationMinutes: '',
  rrule: '',
});

const dialogTitle = computed(() =>
  props.editing
    ? t('liveSessions.form.editHeader')
    : t('liveSessions.form.createHeader'),
);

const moduleOptions = computed(() =>
  props.modules.map((module) => ({ label: module.title, value: module.id })),
);
const classTypeOptions = computed(() =>
  props.classTypes.map((type) => ({ label: type.name, value: type.id })),
);
const teacherOptions = computed(() =>
  props.teachers.map((teacher) => ({
    label: teacher.full_name || teacher.fullName || teacher.email,
    value: teacher.id,
  })),
);

const fillForm = () => {
  Object.assign(form, {
    title: '',
    moduleId: null,
    classTypeId: null,
    hostTeacherId: null,
    dtstart: null,
    durationMinutes: 30,
    timezone: defaultTimezone,
    rrule: '',
    joinUrl: '',
    hostUrl: '',
  });
  recurrence.interval = 1;
  recurrence.days.splice(0, recurrence.days.length);

  if (props.editing) {
    form.title = props.editing.title || '';
    form.moduleId = props.editing.moduleId || null;
    form.classTypeId = props.editing.classTypeId || null;
    form.hostTeacherId = props.editing.hostTeacherId || null;
    form.dtstart = props.editing.dtstart ? new Date(props.editing.dtstart) : null;
    form.durationMinutes = props.editing.durationMinutes || 30;
    form.timezone = props.editing.timezone || defaultTimezone;
    form.joinUrl = props.editing.joinUrl || '';
    form.hostUrl = props.editing.hostUrl || '';
    applyRecurrenceRrule(props.editing.rrule || '');
  } else {
    applyRecurrenceRrule('');
  }
  form.rrule = buildRecurrenceRrule();
  clearErrors();
};

const clearErrors = () => {
  Object.keys(errors).forEach((key) => {
    errors[key] = '';
  });
};

const validate = () => {
  clearErrors();
  let valid = true;
  if (!form.title.trim()) {
    errors.title = t('liveSessions.validation.title');
    valid = false;
  }
  if (!form.classTypeId) {
    errors.classTypeId = t('liveSessions.validation.classType');
    valid = false;
  }
  if (!form.hostTeacherId) {
    errors.hostTeacherId = t('liveSessions.validation.hostTeacher');
    valid = false;
  }
  if (!form.dtstart) {
    errors.dtstart = t('liveSessions.validation.dtstart');
    valid = false;
  }
  if (!form.durationMinutes || form.durationMinutes <= 0) {
    errors.durationMinutes = t('liveSessions.validation.duration');
    valid = false;
  }
  if (!recurrence.days.length) {
    errors.rrule = t('liveSessions.validation.recurrenceDays');
    valid = false;
  } else if (!form.rrule.trim()) {
    errors.rrule = t('liveSessions.validation.rrule');
    valid = false;
  }
  return valid;
};

const normalizePayload = () => ({
  title: form.title.trim(),
  moduleId: form.moduleId || null,
  classTypeId: form.classTypeId,
  hostTeacherId: form.hostTeacherId,
  dtstart: form.dtstart ? new Date(form.dtstart).toISOString() : null,
  timezone: form.timezone?.trim() || defaultTimezone,
  durationMinutes: Number(form.durationMinutes),
  rrule: form.rrule.trim(),
  joinUrl: form.joinUrl?.trim() || null,
  hostUrl: form.hostUrl?.trim() || null,
});

const handleSubmit = () => {
  if (!validate()) {
    return;
  }
  emit('submit', normalizePayload());
};

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      fillForm();
    }
  },
);

watch(
  () => props.editing,
  (current, previous) => {
    if (props.visible && current?.id !== previous?.id) {
      fillForm();
    }
  },
);

watch(
  () => [recurrence.interval, recurrence.days.join(',')],
  () => {
    const nextRrule = buildRecurrenceRrule();
    if (form.rrule !== nextRrule) {
      form.rrule = nextRrule;
    }
  },
);
</script>

<style scoped>
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field,
.form-field-inline {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-field-inline {
  flex-direction: row;
  gap: 1rem;
}

.form-field-inline > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.muted {
  color: #6b7280;
  font-size: 0.75rem;
}

.field-error {
  color: #dc2626;
  font-size: 0.75rem;
}
.recurrence-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.recurrence-days {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.day-chip {
  min-width: 2.5rem;
  border-radius: 999px;
}

.day-chip.active {
  background-color: #0ea5e9;
  color: #ffffff;
  border-color: #0ea5e9;
  box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.6);
}

.recurrence-interval {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
</style>

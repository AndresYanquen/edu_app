<template>
  <Dialog
    :visible="visible"
    modal
    :showHeader="false"
    class="live-series-dialog"
    :style="{ width: 'min(980px, 94vw)' }"
    @update:visible="(value) => emit('update:visible', value)"
  >
    <div class="dialog-shell">
      <header class="dialog-header">
        <div class="dialog-heading">
          <div class="dialog-icon">
            <i class="pi pi-video" />
          </div>
          <div>
            <h2>{{ dialogTitle }}</h2>
            <p>{{ props.editing ? 'Actualiza los detalles de esta serie recurrente.' : 'Configura una nueva serie recurrente de clases en vivo.' }}</p>
          </div>
        </div>
        <Button
          icon="pi pi-times"
          class="p-button-text close-button"
          rounded
          @click="emit('update:visible', false)"
        />
      </header>

      <div class="form-grid main-grid">
        <div class="form-field">
          <label>{{ t('liveSessions.form.title') }} <span>*</span></label>
          <span class="field-control">
            <InputText
              v-model="form.title"
              maxlength="100"
              :placeholder="t('liveSessions.form.titlePlaceholder')"
            />
            <small class="char-count">{{ form.title.length }}/100</small>
          </span>
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
          <label>{{ t('liveSessions.form.classType') }} <span>*</span></label>
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
          <label>{{ t('liveSessions.form.hostTeacher') }} <span>*</span></label>
          <Dropdown
            v-model="form.hostTeacherId"
            :options="teacherOptions"
            optionLabel="label"
            optionValue="value"
            :placeholder="t('liveSessions.form.hostTeacherPlaceholder')"
          />
          <small v-if="errors.hostTeacherId" class="field-error">{{ errors.hostTeacherId }}</small>
        </div>
      </div>

      <section class="dialog-section">
        <div class="section-title">
          <i class="pi pi-calendar" />
          <h3>Date & time</h3>
        </div>
        <div class="section-grid">
          <div class="form-field">
            <label>{{ t('liveSessions.form.start') }} <span>*</span></label>
            <Calendar
              v-model="form.dtstart"
              showIcon
              showTime
              hourFormat="24"
              :placeholder="t('liveSessions.form.startPlaceholder')"
            />
            <small v-if="errors.dtstart" class="field-error">{{ errors.dtstart }}</small>
          </div>
          <div class="form-field">
            <label>{{ t('liveSessions.form.end') }} <span>*</span></label>
            <Calendar
              v-model="form.dtend"
              showIcon
              showTime
              hourFormat="24"
              :placeholder="t('liveSessions.form.endPlaceholder')"
            />
            <small v-if="errors.dtend" class="field-error">{{ errors.dtend }}</small>
          </div>
          <div class="form-field">
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
          <div class="form-field">
            <label>{{ t('liveSessions.form.timezone') }}</label>
            <InputText v-model="form.timezone" />
            <small class="muted">{{ t('liveSessions.form.timezoneHint') }}</small>
          </div>
        </div>
      </section>

      <section class="dialog-section recurrence-section">
        <div class="section-title">
          <i class="pi pi-refresh" />
          <h3>{{ t('liveSessions.form.recurrenceLabel') }}</h3>
        </div>
        <div class="form-field recurrence-field">
          <label>Repeat on</label>
          <div class="recurrence-days">
            <button
              v-for="option in weekdayOptions"
              :key="option.value"
              type="button"
              class="day-chip"
              :class="{ active: recurrence.days.includes(option.value) }"
              @click="toggleDay(option.value)"
            >
              <i v-if="recurrence.days.includes(option.value)" class="pi pi-check" />
              <span>{{ option.label }}</span>
            </button>
          </div>
          <small v-if="errors.rrule" class="field-error">{{ errors.rrule }}</small>
        </div>

        <div class="recurrence-row">
          <div class="form-field repeat-field">
            <label>{{ t('liveSessions.form.recurrenceIntervalLabel') }}</label>
            <div class="repeat-controls">
              <InputNumber v-model="recurrence.interval" :min="1" :max="4" :showButtons="true" />
              <span class="unit-box">Week</span>
            </div>
          </div>
        </div>

        <div class="recurrence-summary">
          <i class="pi pi-info-circle" />
          <span>{{ rrulePreview }}</span>
        </div>
      </section>

      <details class="dialog-section additional-section">
        <summary>
          <span>
            <i class="pi pi-cog" />
            Additional options
            <small>(recording, access, notifications)</small>
          </span>
          <i class="pi pi-chevron-down" />
        </summary>
        <div class="section-grid additional-grid">
          <div class="form-field">
            <label>{{ t('liveSessions.form.joinUrl') }}</label>
            <InputText v-model="form.joinUrl" placeholder="https://meet.google.com/..." />
          </div>
          <div class="form-field">
            <label>{{ t('liveSessions.form.hostUrl') }}</label>
            <InputText v-model="form.hostUrl" placeholder="https://meet.google.com/..." />
          </div>
        </div>
      </details>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          class="p-button-outlined"
          :label="t('common.cancel')"
          @click="emit('update:visible', false)"
        />
        <Button
          :label="props.editing ? 'Save changes' : t('common.save')"
          icon="pi pi-check"
          :loading="loading"
          @click="handleSubmit"
        />
      </div>
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
  dtend: null,
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
  dtend: '',
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
    dtend: null,
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
    form.dtend = props.editing.dtend ? new Date(props.editing.dtend) : null;
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
  const startDate = form.dtstart ? new Date(form.dtstart) : null;
  const endDate = form.dtend ? new Date(form.dtend) : null;
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
  } else if (!startDate || Number.isNaN(startDate.getTime())) {
    errors.dtstart = t('liveSessions.validation.invalidDate');
    valid = false;
  }
  if (!form.dtend) {
    errors.dtend = t('liveSessions.validation.dtend');
    valid = false;
  } else if (!endDate || Number.isNaN(endDate.getTime())) {
    errors.dtend = t('liveSessions.validation.invalidDate');
    valid = false;
  }
  if (!form.durationMinutes || form.durationMinutes <= 0) {
    errors.durationMinutes = t('liveSessions.validation.duration');
    valid = false;
  }
  if (
    startDate &&
    endDate &&
    !Number.isNaN(startDate.getTime()) &&
    !Number.isNaN(endDate.getTime())
  ) {
    if (endDate <= startDate) {
      errors.dtend = t('liveSessions.validation.dtendAfterStart');
      valid = false;
    } else if (
      form.durationMinutes &&
      startDate.getTime() + Number(form.durationMinutes) * 60000 > endDate.getTime()
    ) {
      errors.dtend = t('liveSessions.validation.dtendAfterFirstSession');
      valid = false;
    }
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
  dtend: form.dtend ? new Date(form.dtend).toISOString() : null,
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
:global(.live-series-dialog.p-dialog) {
  border: 1px solid var(--app-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

:global(.live-series-dialog .p-dialog-content) {
  padding: 0;
}

:global(.live-series-dialog .p-dialog-footer) {
  border-top: 1px solid var(--app-border);
  padding: 1rem 1.5rem;
}

.dialog-shell {
  background: var(--app-surface);
  max-height: min(78vh, 920px);
  overflow-y: auto;
  padding: 1.5rem;
}

.dialog-header,
.dialog-heading,
.section-title,
.dialog-footer,
.repeat-controls,
.additional-section summary {
  align-items: center;
  display: flex;
}

.dialog-header {
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.dialog-heading {
  gap: 0.9rem;
}

.dialog-icon {
  align-items: center;
  background: var(--brand-primary-soft);
  border-radius: 50%;
  color: var(--brand-primary);
  display: inline-flex;
  height: 3rem;
  justify-content: center;
  width: 3rem;
}

.dialog-icon i {
  font-size: 1.15rem;
}

.dialog-heading h2 {
  color: var(--text-primary);
  font-size: 1.35rem;
  line-height: 1.2;
  margin: 0;
}

.dialog-heading p {
  color: var(--text-muted);
  font-size: 0.92rem;
  margin: 0.45rem 0 0;
}

.close-button {
  color: var(--text-muted);
}

.form-grid,
.section-grid,
.recurrence-row {
  display: grid;
  gap: 1rem 1.4rem;
}

.main-grid,
.section-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}

.form-field label {
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 700;
}

.form-field label span {
  color: #ef4444;
}

.field-control {
  position: relative;
}

.char-count {
  bottom: 0.78rem;
  color: var(--text-muted);
  font-size: 0.75rem;
  position: absolute;
  right: 1rem;
}

.dialog-section {
  border: 1px solid var(--app-border);
  border-radius: var(--radius-sm);
  margin-top: 1rem;
  padding: 1rem;
}

.section-title {
  color: var(--text-primary);
  gap: 0.55rem;
  margin-bottom: 0.9rem;
}

.section-title i {
  color: var(--brand-primary);
  font-size: 1rem;
}

.section-title h3 {
  font-size: 1rem;
  margin: 0;
}

.muted {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.field-error {
  color: #dc2626;
  font-size: 0.8rem;
}

.recurrence-field {
  gap: 0.85rem;
}

.recurrence-days {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(7, minmax(3.5rem, 1fr));
}

.day-chip {
  align-items: center;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  gap: 0.4rem;
  min-height: 2.45rem;
  justify-content: center;
  padding: 0 1rem;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.day-chip i,
.day-chip span {
  color: inherit;
  font-weight: 700;
  line-height: 1;
}

.day-chip.active {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  box-shadow: var(--shadow-sm);
  color: var(--app-surface);
}

.day-chip:not(.active) {
  background: var(--app-surface);
  border-color: var(--app-border);
  color: var(--text-secondary);
}

.day-chip:not(.active) i,
.day-chip:not(.active) span {
  color: var(--text-secondary);
}

.day-chip.active i,
.day-chip.active span {
  color: var(--app-surface);
}

.day-chip:hover {
  border-color: var(--brand-primary);
}

.recurrence-row {
  grid-template-columns: 1fr 1fr 1.2fr;
  margin-top: 1rem;
}

.repeat-controls {
  gap: 0.5rem;
}

.unit-box {
  align-items: center;
  border: 1px solid var(--app-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  display: inline-flex;
  min-height: 2.75rem;
  padding: 0 0.85rem;
}

.unit-box {
  min-width: 9rem;
}

.recurrence-summary {
  align-items: center;
  background: var(--brand-primary-soft);
  border: 1px solid var(--app-border);
  border-radius: var(--radius-sm);
  color: var(--brand-primary);
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.75rem 0.85rem;
}

.additional-section {
  padding: 0;
}

.additional-section summary {
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.98rem;
  font-weight: 700;
  justify-content: space-between;
  list-style: none;
  padding: 1rem;
}

.additional-section summary::-webkit-details-marker {
  display: none;
}

.additional-section summary span {
  align-items: center;
  display: inline-flex;
  gap: 0.65rem;
}

.additional-section summary small {
  color: var(--text-muted);
  font-weight: 500;
}

.additional-grid {
  border-top: 1px solid var(--app-border);
  padding: 1rem;
}

.dialog-footer {
  gap: 1rem;
  justify-content: flex-end;
}

:global(.live-series-dialog .p-inputtext),
:global(.live-series-dialog .p-dropdown),
:global(.live-series-dialog .p-inputnumber),
:global(.live-series-dialog .p-calendar) {
  width: 100%;
}

:global(.live-series-dialog .p-inputtext),
:global(.live-series-dialog .p-dropdown) {
  border-color: var(--app-border);
  border-radius: var(--radius-sm);
  min-height: 2.75rem;
}

:global(.live-series-dialog .p-dropdown-label),
:global(.live-series-dialog .p-inputtext) {
  align-items: center;
  color: var(--text-primary);
  display: flex;
  font-size: 0.92rem;
}

:global(.live-series-dialog .p-button:not(.p-button-text):not(.p-button-outlined)) {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
}

@media (max-width: 760px) {
  .dialog-shell {
    padding: 1.25rem;
  }

  .dialog-header,
  .dialog-footer {
    align-items: flex-start;
  }

  .main-grid,
  .section-grid,
  .recurrence-row {
    grid-template-columns: 1fr;
  }

  .recurrence-days {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

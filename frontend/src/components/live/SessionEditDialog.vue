<template>
  <Dialog
    :visible="visible"
    modal
    :header="t('liveSessions.sessionEdit.title')"
    :style="{ width: '520px' }"
    @update:visible="(value) => emit('update:visible', value)"
  >
    <div class="form-grid">
      <div class="form-field">
        <label>{{ t('liveSessions.form.title') }}</label>
        <InputText v-model="form.title" :placeholder="t('liveSessions.form.titlePlaceholder')" />
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
      </div>
      <div class="form-field">
        <label>{{ t('liveSessions.form.start') }}</label>
        <Calendar
          v-model="form.startsAt"
          showIcon
          showTime
          hourFormat="24"
          :placeholder="t('liveSessions.form.startPlaceholder')"
        />
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
      </div>
      <div class="form-field">
        <label>{{ t('liveSessions.form.statusLabel') }}</label>
        <Dropdown
          v-model="form.status"
          :options="statusOptions"
          optionLabel="label"
          optionValue="value"
          :placeholder="t('liveSessions.form.statusLabel')"
        />
      </div>
      <div class="form-field">
        <label>{{ t('liveSessions.form.publishedLabel') }}</label>
        <InputSwitch v-model="form.published" />
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
      <Button class="p-button-text" :label="t('common.cancel')" @click="emit('update:visible', false)" />
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
import { reactive, watch, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
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
  session: {
    type: Object,
    default: null,
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
});

const emit = defineEmits(['update:visible', 'submit']);
const { t } = useI18n();
const toast = useToast();

const statusOptions = computed(() => [
  { label: t('liveSessions.status.scheduled'), value: 'scheduled' },
  { label: t('liveSessions.status.completed'), value: 'completed' },
  { label: t('liveSessions.status.cancelled'), value: 'cancelled' },
]);

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

const defaultForm = () => ({
  title: '',
  moduleId: null,
  classTypeId: null,
  hostTeacherId: null,
  startsAt: null,
  durationMinutes: 60,
  status: 'scheduled',
  published: false,
  joinUrl: '',
  hostUrl: '',
});

const form = reactive(defaultForm());

const resetForm = () => {
  Object.assign(form, defaultForm());
};

const computeDurationMinutes = (session) => {
  if (!session?.startsAt || !session?.endsAt) {
    return 60;
  }
  const start = new Date(session.startsAt);
  const end = new Date(session.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 60;
  }
  return Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000));
};

watch(
  () => props.session,
  (session) => {
    if (!session) {
      resetForm();
      return;
    }
    form.title = session.title || '';
    form.moduleId = session.moduleId || null;
    form.classTypeId = session.classTypeId || null;
    form.hostTeacherId = session.hostTeacherId || null;
    form.startsAt = session.startsAt ? new Date(session.startsAt) : null;
    form.durationMinutes = computeDurationMinutes(session);
    form.status = session.status || 'scheduled';
    form.published = Boolean(session.published);
    form.joinUrl = session.joinUrl || '';
    form.hostUrl = session.hostUrl || '';
  },
  { immediate: true },
);

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      resetForm();
    }
  },
);

const handleSubmit = () => {
  const session = props.session;
  if (!session) {
    return;
  }
  const payload = {};
  const trimmedTitle = form.title.trim();
  if (trimmedTitle && trimmedTitle !== (session.title || '')) {
    payload.title = trimmedTitle;
  }
  if ((session.moduleId || null) !== (form.moduleId || null)) {
    payload.moduleId = form.moduleId;
  }
  if ((session.classTypeId || null) !== (form.classTypeId || null)) {
    payload.classTypeId = form.classTypeId;
  }
  if ((session.hostTeacherId || null) !== (form.hostTeacherId || null)) {
    payload.hostTeacherId = form.hostTeacherId;
  }
  if (form.startsAt) {
    const isoStart = form.startsAt.toISOString();
    if (isoStart !== session.startsAt) {
      payload.startsAt = isoStart;
    }
  }
  const existingDurationMinutes = computeDurationMinutes(session);
  if (form.durationMinutes !== existingDurationMinutes) {
    payload.durationMinutes = form.durationMinutes;
  }
  if (form.status !== session.status) {
    payload.status = form.status;
  }
  if (form.published !== Boolean(session.published)) {
    payload.published = form.published;
  }
  if ((session.joinUrl || '') !== (form.joinUrl || '')) {
    payload.joinUrl = form.joinUrl || null;
  }
  if ((session.hostUrl || '') !== (form.hostUrl || '')) {
    payload.hostUrl = form.hostUrl || null;
  }

  if (!Object.keys(payload).length) {
    toast.add({
      severity: 'info',
      summary: t('common.notifications.info'),
      detail: t('liveSessions.toasts.noChanges'),
      life: 3000,
    });
    return;
  }

  emit('submit', { sessionId: session.id, payload });
};
</script>

<style scoped>
.form-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.form-field {
  flex: 1 1 48%;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
</style>

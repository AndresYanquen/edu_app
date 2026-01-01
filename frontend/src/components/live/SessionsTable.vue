<template>
  <div class="live-sessions-table">
    <div class="section-header">
      <div>
        <h3>{{ t('liveSessions.sessionsTitle') }}</h3>
        <p class="muted">{{ t('liveSessions.sessionsDescription') }}</p>
      </div>
      <div class="actions">
        <Button
          icon="pi pi-refresh"
          class="p-button-text"
          :label="t('common.reload')"
          :loading="loading"
          @click="emit('refresh')"
        />
      </div>
    </div>

    <div class="filters">
      <div class="filter-field">
        <label>{{ t('liveSessions.filters.range') }}</label>
        <Calendar
          v-model="rangeValue"
          selectionMode="range"
          showIcon
          dateFormat="yy-mm-dd"
        />
        <div class="filter-actions">
          <Button class="p-button-text" :label="t('liveSessions.filters.resetRange')" @click="resetRange" />
          <Button
            :label="t('liveSessions.filters.applyRange')"
            icon="pi pi-check"
            class="p-button-text"
            @click="applyRange"
          />
        </div>
      </div>
      <div class="filter-field">
        <label>{{ t('liveSessions.filters.classType') }}</label>
        <Dropdown
          v-model="filterClassType"
          :options="classTypeOptions"
          optionLabel="label"
          optionValue="value"
          :placeholder="t('liveSessions.filters.anyType')"
          showClear
        />
      </div>
      <div class="filter-field">
        <label>{{ t('liveSessions.filters.module') }}</label>
        <Dropdown
          v-model="filterModule"
          :options="moduleOptions"
          optionLabel="label"
          optionValue="value"
          :placeholder="t('liveSessions.filters.anyModule')"
          showClear
        />
      </div>
      <div class="filter-field">
        <label>{{ t('liveSessions.filters.teacher') }}</label>
        <Dropdown
          v-model="filterTeacher"
          :options="teacherOptions"
          optionLabel="label"
          optionValue="value"
          :placeholder="t('liveSessions.filters.anyTeacher')"
          showClear
        />
      </div>
    </div>

    <DataTable
      :value="filteredSessions"
      :loading="loading"
      responsiveLayout="scroll"
      :emptyMessage="t('liveSessions.sessionsEmpty')"
    >
      <Column :header="t('liveSessions.sessionColumns.startsAt')" style="min-width: 14rem">
        <template #body="{ data }">
          <div class="schedule-cell">
            <strong>{{ formatDate(data.startsAt) }}</strong>
            <small v-if="data.endsAt" class="muted">
              {{ t('liveSessions.sessionColumns.endsAt', { time: formatTime(data.endsAt) }) }}
            </small>
          </div>
        </template>
      </Column>
      <Column field="title" :header="t('liveSessions.sessionColumns.title')" style="min-width: 14rem" />
      <Column :header="t('liveSessions.sessionColumns.type')" style="width: 10rem">
        <template #body="{ data }">
          <Tag :value="data.classTypeName || '—'" severity="info" />
        </template>
      </Column>
      <Column :header="t('liveSessions.sessionColumns.teacher')" style="width: 12rem">
        <template #body="{ data }">
          {{ data.hostTeacherName || t('liveSessions.labels.unassigned') }}
        </template>
      </Column>
      <Column :header="t('liveSessions.sessionColumns.status')" style="width: 10rem">
        <template #body="{ data }">
          <Tag :value="statusLabel(data)" :severity="statusSeverity(data)" />
        </template>
      </Column>
      <Column :header="t('liveSessions.sessionColumns.actions')" style="width: 12rem">
        <template #body="{ data }">
          <Button
            v-if="data.joinUrl"
            :label="t('liveSessions.actions.join')"
            class="p-button-text"
            icon="pi pi-external-link"
            @click="openJoinLink(data.joinUrl)"
          />
          <span v-else class="muted">—</span>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  sessions: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  classTypes: {
    type: Array,
    default: () => [],
  },
  modules: {
    type: Array,
    default: () => [],
  },
  teachers: {
    type: Array,
    default: () => [],
  },
  range: {
    type: Object,
    default: () => ({ from: null, to: null }),
  },
});

const emit = defineEmits(['refresh', 'range-change']);
const { t } = useI18n();

const rangeValue = ref([]);
const filterClassType = ref(null);
const filterModule = ref(null);
const filterTeacher = ref(null);

watch(
  () => props.range,
  (range) => {
    if (range?.from && range?.to) {
      rangeValue.value = [new Date(range.from), new Date(range.to)];
    } else {
      rangeValue.value = [];
    }
  },
  { immediate: true },
);

const classTypeOptions = computed(() =>
  props.classTypes.map((type) => ({ label: type.name, value: type.id })),
);

const moduleOptions = computed(() =>
  props.modules.map((module) => ({ label: module.title, value: module.id })),
);

const teacherOptions = computed(() =>
  props.teachers.map((teacher) => ({
    label: teacher.full_name || teacher.fullName || teacher.email,
    value: teacher.id,
  })),
);

const filteredSessions = computed(() =>
  props.sessions.filter((session) => {
    if (filterClassType.value && session.classTypeId !== filterClassType.value) {
      return false;
    }
    if (filterModule.value && session.moduleId !== filterModule.value) {
      return false;
    }
    if (filterTeacher.value && session.hostTeacherId !== filterTeacher.value) {
      return false;
    }
    return true;
  }),
);

const resetRange = () => {
  rangeValue.value = [];
  emit('range-change', { from: null, to: null });
};

const applyRange = () => {
  if (!rangeValue.value?.length) {
    emit('range-change', { from: null, to: null });
    return;
  }
  const [from, to] = rangeValue.value;
  if (!from || !to) {
    return;
  }
  emit('range-change', {
    from: from.toISOString(),
    to: to.toISOString(),
  });
};

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return value;
  }
};

const formatTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleTimeString();
  } catch (_) {
    return value;
  }
};

const statusLabel = (session) => {
  if (!session.published) {
    return t('liveSessions.status.draft');
  }
  return session.status || t('liveSessions.status.scheduled');
};

const statusSeverity = (session) => {
  if (!session.published) {
    return 'warning';
  }
  switch (session.status) {
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'danger';
    default:
      return 'info';
  }
};

const openJoinLink = (url) => {
  if (!url) return;
  window.open(url, '_blank', 'noopener');
};
</script>

<style scoped>
.live-sessions-table {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.muted {
  color: #6b7280;
  font-size: 0.85rem;
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.filter-actions {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.25rem;
}

.schedule-cell {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
</style>

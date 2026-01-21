<template>
  <div class="live-series-table">
    <div class="section-header">
      <div>
        <h3>{{ t('liveSessions.seriesTitle') }}</h3>
        <p class="muted">{{ t('liveSessions.seriesDescription') }}</p>
      </div>
      <Button
        icon="pi pi-plus"
        :label="t('liveSessions.actions.newSeries')"
        @click="emit('create')"
      />
    </div>

    <DataTable
      :value="seriesList"
      :loading="loading"
      responsiveLayout="scroll"
      :emptyMessage="t('liveSessions.seriesEmpty')"
    >
      <Column field="title" :header="t('liveSessions.columns.title')" style="min-width: 16rem">
        <template #body="{ data }">
          <div class="series-title">
            <strong>{{ data.title }}</strong>
            <small class="muted" v-if="data.timezone">{{ data.timezone }}</small>
          </div>
        </template>
      </Column>
      <Column :header="t('liveSessions.columns.classType')" style="width: 10rem">
        <template #body="{ data }">
          <Tag
            v-if="data.classTypeName"
            :value="data.classTypeName"
            severity="info"
          />
          <Tag
            v-else
            :value="t('liveSessions.labels.unknownType')"
            severity="warning"
          />
        </template>
      </Column>
      <Column :header="t('liveSessions.columns.module')" style="width: 14rem">
        <template #body="{ data }">
          {{ moduleName(data.moduleId) }}
        </template>
      </Column>
      <Column :header="t('liveSessions.columns.teacher')" style="width: 14rem">
        <template #body="{ data }">
          {{ data.hostTeacherName || t('liveSessions.labels.unassigned') }}
        </template>
      </Column>
      <Column :header="t('liveSessions.columns.schedule')" style="width: 18rem">
        <template #body="{ data }">
          <div class="schedule-cell">
            <span>{{ formatDate(data.dtstart) }}</span>
            <small class="muted">{{ data.rrule }}</small>
          </div>
        </template>
      </Column>
      <Column :header="t('liveSessions.columns.published')" style="width: 8rem">
        <template #body="{ data }">
          <InputSwitch
            :modelValue="data.published"
            :disabled="publishLoadingId === data.id"
            @update:modelValue="(value) => emit('toggle-publish', { series: data, value })"
          />
        </template>
      </Column>
      <Column :header="t('liveSessions.columns.actions')" style="width: 15rem">
        <template #body="{ data }">
          <div class="actions">
            <Button
              icon="pi pi-pencil"
              class="p-button-text"
              :label="t('common.edit')"
              @click="emit('edit', data)"
            />
            <Button
              icon="pi pi-refresh"
              class="p-button-text"
              :label="t('liveSessions.actions.generate')"
              :loading="generatingId === data.id"
              @click="emit('generate', data)"
            />
            <Button
              icon="pi pi-sync"
              class="p-button-text"
              :label="t('liveSessions.actions.regenerate')"
              :loading="regeneratingId === data.id"
              @click="emit('regenerate', data)"
            />
            <Button
              icon="pi pi-trash"
              class="p-button-text"
              severity="danger"
              :label="t('liveSessions.actions.deleteSeries')"
              :loading="deletingId === data.id"
              :disabled="deletingId === data.id"
              @click="emit('deleteSeries', data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  series: {
    type: Array,
    default: () => [],
  },
  modules: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  publishLoadingId: {
    type: String,
    default: null,
  },
  generatingId: {
    type: String,
    default: null,
  },
  deletingId: {
    type: String,
    default: null,
  },
  regeneratingId: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['create', 'edit', 'toggle-publish', 'generate', 'regenerate', 'deleteSeries']);
const { t } = useI18n();

const moduleLookup = computed(() => {
  const map = new Map();
  props.modules.forEach((module) => {
    map.set(module.id, module.title);
  });
  return map;
});

const seriesList = computed(() =>
  [...props.series].sort((a, b) => {
    const aDate = a.dtstart ? new Date(a.dtstart).getTime() : 0;
    const bDate = b.dtstart ? new Date(b.dtstart).getTime() : 0;
    return bDate - aDate;
  }),
);

const moduleName = (id) => {
  if (!id) return t('liveSessions.labels.noModule');
  return moduleLookup.value.get(id) || t('liveSessions.labels.noModule');
};

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return value;
  }
};
</script>

<style scoped>
.live-series-table {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.muted {
  color: #6b7280;
  font-size: 0.85rem;
}

.series-title {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.schedule-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
</style>

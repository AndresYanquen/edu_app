<template>
  <Card class="live-sessions-card">
    <template #title>
      <div class="section-header">
        <div>
          <div class="section-title">Live sessions</div>
          <small class="muted">Manage recurring live meetings for each group</small>
        </div>
        <div class="live-session-controls">
          <label>Select group</label>
          <Dropdown
            v-model="liveSessionGroupId"
            :options="liveSessionGroupOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select group"
            :disabled="!courseGroups.length"
          />
        </div>
      </div>
    </template>
    <template #content>
      <div v-if="liveSessionLoading" class="live-session-loading">
        <Skeleton height="2rem" class="mb-2" />
        <Skeleton height="2rem" class="mb-2" />
        <Skeleton height="12rem" />
      </div>
      <div v-else-if="liveSessionError" class="empty-state">
        <p>Unable to load live sessions right now.</p>
        <Button
          label="Reload live sessions"
          icon="pi pi-refresh"
          class="p-button-text"
          @click="loadLiveSessionData"
        />
      </div>
      <div v-else>
        <SeriesTable
          :series="liveSessionSeries"
          :modules="modules"
          :loading="liveSessionSeriesLoading"
          :publishLoadingId="liveSeriesPublishLoadingId"
          :generatingId="liveSeriesGeneratingId"
          :regeneratingId="liveSeriesRegeneratingId"
          :deletingId="liveSeriesDeletingId"
          @create="openLiveSeriesCreate"
          @edit="openLiveSeriesEdit"
          @toggle-publish="handleLiveSeriesPublishToggle"
          @generate="handleLiveSeriesGenerate"
          @regenerate="openRegenerateSeriesDialog"
          @delete-series="handleLiveSeriesDelete"
        />
        <SessionsTable
          :sessions="liveSessionSessions"
          :loading="liveSessionSessionsLoading"
          :classTypes="liveSessionClassTypes"
          :modules="modules"
          :teachers="liveSessionTeachers"
          :range="liveSessionRange"
          @refresh="handleLiveSessionsRefresh"
          @edit="openLiveSessionEdit"
          @range-change="handleLiveSessionsRangeChange"
        />
      </div>
    </template>
  </Card>
</template>

<script setup>
import { inject } from 'vue';
import SeriesTable from '../../../../components/live/SeriesTable.vue';
import SessionsTable from '../../../../components/live/SessionsTable.vue';
import { cmsCourseBuilderContextKey } from '../cmsCourseBuilderContext';

const builder = inject(cmsCourseBuilderContextKey);

const {
  liveSessionGroupId,
  liveSessionGroupOptions,
  courseGroups,
  liveSessionLoading,
  liveSessionError,
  loadLiveSessionData,
  liveSessionSeries,
  modules,
  liveSessionSeriesLoading,
  liveSeriesPublishLoadingId,
  liveSeriesGeneratingId,
  liveSeriesRegeneratingId,
  liveSeriesDeletingId,
  openLiveSeriesCreate,
  openLiveSeriesEdit,
  handleLiveSeriesPublishToggle,
  handleLiveSeriesGenerate,
  openRegenerateSeriesDialog,
  handleLiveSeriesDelete,
  liveSessionSessions,
  liveSessionSessionsLoading,
  liveSessionClassTypes,
  liveSessionTeachers,
  liveSessionRange,
  handleLiveSessionsRefresh,
  openLiveSessionEdit,
  handleLiveSessionsRangeChange,
} = builder;
</script>

<style scoped>
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.live-session-controls {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 220px;
}
</style>


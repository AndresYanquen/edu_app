<template>
  <Card class="live-sessions-card">
    <template #title>
      <div class="section-header">
        <div>
          <div class="section-title">Clases</div>
          <small class="muted">
            {{ liveSessionsReadOnly ? 'Consulta horarios y enlaces de acceso' : 'Manage recurring live meetings for each group' }}
          </small>
        </div>
        <div class="live-session-controls">
          <label>Select group</label>
          <Dropdown
            v-model="liveSessionGroupId"
            :options="liveSessionGroupOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select group"
            :disabled="!liveSessionGroupOptions.length"
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
          v-if="!liveSessionsReadOnly"
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
        <div v-if="liveSessionsReadOnly" class="readonly-live-sessions">
          <div class="readonly-toolbar">
            <div>
              <h3>Sesiones programadas</h3>
              <small class="muted">Consulta tus próximas clases y enlaces de acceso.</small>
            </div>
            <div class="readonly-actions">
              <Calendar
                v-model="readonlyRangeValue"
                selectionMode="range"
                showIcon
                dateFormat="yy-mm-dd"
                placeholder="Selecciona día o rango"
              />
              <Button
                icon="pi pi-check"
                label="Aplicar"
                class="p-button-text"
                @click="applyReadonlyRange"
              />
              <Button
                icon="pi pi-times"
                label="Limpiar"
                class="p-button-text"
                @click="clearReadonlyRange"
              />
              <Button
                icon="pi pi-refresh"
                label="Recargar"
                class="p-button-text"
                :loading="liveSessionSessionsLoading"
                @click="handleLiveSessionsRefresh"
              />
            </div>
          </div>

          <div v-if="!readonlySessions.length" class="empty-state">
            <p>No hay sesiones programadas para este grupo.</p>
          </div>

          <div v-else class="readonly-session-grid">
            <article
              v-for="session in readonlySessions"
              :key="session.id"
              class="readonly-session-card"
              :class="`is-${session.displayStatus}`"
            >
              <div class="session-leading-icon">
                <i
                  class="pi"
                  :class="
                    session.displayStatus === 'live'
                      ? 'pi-video'
                      : session.displayStatus === 'past'
                        ? 'pi-check-circle'
                        : 'pi-calendar-clock'
                  "
                />
              </div>

              <div class="session-main">
                <div class="session-topline">
                  <Tag
                    :value="session.statusLabel"
                    :severity="session.statusSeverity"
                  />
                  <Tag
                    :value="session.classTypeName || 'Live'"
                    severity="info"
                  />
                </div>
                <h4>{{ session.title || 'Clase en vivo' }}</h4>
                <div class="session-details">
                  <span><i class="pi pi-calendar" /> {{ session.dateLabel }}</span>
                  <span><i class="pi pi-clock" /> {{ session.timeLabel }}</span>
                  <span><i class="pi pi-user" /> {{ session.hostTeacherName || 'Instructor pendiente' }}</span>
                </div>
              </div>

              <div class="session-actions">
                <Button
                  icon="pi pi-sign-in"
                  :label="session.displayStatus === 'past' ? 'Cerrada' : 'Ingresar'"
                  class="p-button-text"
                  :disabled="session.displayStatus === 'past' || !session.joinUrl"
                  @click="openJoinLink(session.joinUrl)"
                />
                <a
                  v-if="session.joinUrl"
                  class="session-link"
                  :href="session.joinUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="session.joinUrl"
                >
                  {{ session.joinUrl }}
                </a>
              </div>
            </article>
          </div>
        </div>
        <SessionsTable
          v-else
          :sessions="liveSessionSessions"
          :loading="liveSessionSessionsLoading"
          :classTypes="liveSessionClassTypes"
          :modules="modules"
          :teachers="liveSessionTeachers"
          :range="liveSessionRange"
          :read-only="liveSessionsReadOnly"
          :bulk-deleting="liveSessionsBulkDeleting"
          @refresh="handleLiveSessionsRefresh"
          @edit="openLiveSessionEdit"
          @delete-all="handleLiveSessionsBulkDelete"
          @range-change="handleLiveSessionsRangeChange"
        />
      </div>
    </template>
  </Card>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import SeriesTable from '../../../../components/live/SeriesTable.vue';
import SessionsTable from '../../../../components/live/SessionsTable.vue';
import { cmsCourseBuilderContextKey } from '../cmsCourseBuilderContext';

const builder = inject(cmsCourseBuilderContextKey);

const {
  liveSessionGroupId,
  liveSessionsReadOnly,
  liveSessionGroupOptions,
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
  liveSessionsBulkDeleting,
  handleLiveSessionsRefresh,
  openLiveSessionEdit,
  handleLiveSessionsBulkDelete,
  handleLiveSessionsRangeChange,
} = builder;

const readonlyRangeValue = ref([]);

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatTimeRange = (session) => {
  const startsAt = session.startsAt ? new Date(session.startsAt) : null;
  const endsAt = session.endsAt ? new Date(session.endsAt) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) return 'Hora pendiente';
  const start = startsAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (!endsAt || Number.isNaN(endsAt.getTime())) return start;
  return `${start} - ${endsAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
};

const resolveDisplayStatus = (session) => {
  const now = Date.now();
  const startsAt = session.startsAt ? new Date(session.startsAt).getTime() : null;
  const endsAt = session.endsAt ? new Date(session.endsAt).getTime() : null;
  if (startsAt && endsAt && startsAt <= now && endsAt >= now) return 'live';
  if (endsAt && endsAt < now) return 'past';
  return 'upcoming';
};

const readonlySessions = computed(() =>
  [...(liveSessionSessions.value || [])]
    .sort((a, b) => new Date(a.startsAt || 0) - new Date(b.startsAt || 0))
    .map((session) => {
      const displayStatus = resolveDisplayStatus(session);
      return {
        ...session,
        displayStatus,
        dateLabel: formatDate(session.startsAt),
        timeLabel: formatTimeRange(session),
        statusLabel:
          displayStatus === 'live' ? 'Live' : displayStatus === 'past' ? 'Pasada' : 'Próxima',
        statusSeverity:
          displayStatus === 'live' ? 'success' : displayStatus === 'past' ? 'secondary' : 'info',
      };
    }),
);

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const applyReadonlyRange = () => {
  const [from, to] = readonlyRangeValue.value || [];
  if (!from) {
    clearReadonlyRange();
    return;
  }
  const rangeFrom = startOfDay(from);
  const rangeTo = to ? endOfDay(to) : endOfDay(from);
  handleLiveSessionsRangeChange({
    from: rangeFrom.toISOString(),
    to: rangeTo.toISOString(),
  });
};

const clearReadonlyRange = () => {
  readonlyRangeValue.value = [];
  handleLiveSessionsRangeChange({ from: null, to: null });
};

const openJoinLink = (url) => {
  if (!url) return;
  window.open(url, '_blank', 'noopener');
};
</script>

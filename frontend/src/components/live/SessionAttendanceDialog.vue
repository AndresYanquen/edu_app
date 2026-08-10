<template>
  <Dialog
    :visible="visible"
    modal
    :style="{ width: zoomPreview ? '1180px' : '760px', maxWidth: '96vw' }"
    :header="dialogTitle"
    @update:visible="emit('update:visible', $event)"
    @hide="handleHide"
  >
    <div class="attendance-dialog">
      <div class="attendance-toolbar">
        <div class="attendance-summary">
          <Tag :value="`${presentCount}/${totalCount} presentes`" severity="success" />
          <small class="muted" v-if="sessionStartsAt">{{ formatDate(sessionStartsAt) }}</small>
        </div>
        <div class="attendance-actions">
          <Button
            class="p-button-text"
            label="Marcar todos presentes"
            icon="pi pi-check-circle"
            :disabled="!draftItems.length || loading"
            @click="markAllPresent"
          />
          <Button
            class="p-button-text"
            label="Importar Zoom"
            icon="pi pi-video"
            :loading="importing"
            :disabled="loading || saving || importing || !hasZoomIdentifiers"
            @click="previewZoomImport"
          />
          <Button
            label="Guardar"
            icon="pi pi-save"
            :loading="saving"
            :disabled="loading || !draftItems.length"
            @click="save"
          />
        </div>
      </div>

      <div v-if="zoomPreview" class="zoom-import-workspace">
        <section class="zoom-import-summary">
          <div>
            <h4>Resumen de la importacion</h4>
            <div class="zoom-stat-grid">
              <div class="zoom-stat is-present">
                <span class="zoom-stat__icon"><i class="pi pi-check" /></span>
                <strong>{{ importReadyCount }}</strong>
                <small>Presentes</small>
              </div>
              <div class="zoom-stat is-pending">
                <span class="zoom-stat__icon"><i class="pi pi-user-plus" /></span>
                <strong>{{ unassociatedCount }}</strong>
                <small>Sin asociar</small>
              </div>
              <div class="zoom-stat is-danger">
                <span class="zoom-stat__icon"><i class="pi pi-question" /></span>
                <strong>{{ zoomPreview.ambiguous?.length || 0 }}</strong>
                <small>Ambiguos</small>
              </div>
              <div class="zoom-stat is-total">
                <span class="zoom-stat__icon"><i class="pi pi-users" /></span>
                <strong>{{ zoomPreview.summary?.zoomParticipants || 0 }}</strong>
                <small>Total en Zoom</small>
              </div>
            </div>
          </div>
          <aside class="zoom-preview-card">
            <div>
              <i class="pi pi-video" />
              <strong>Previsualizacion Zoom</strong>
            </div>
            <p>Se encontraron {{ zoomPreview.summary?.zoomParticipants || 0 }} participantes en la reunion.</p>
            <small><i class="pi pi-info-circle" /> Revisa y asocia participantes antes de confirmar.</small>
          </aside>
        </section>

        <section class="zoom-import-controls">
          <div class="zoom-tabs">
            <button
              type="button"
              :class="{ active: zoomTab === 'pending' }"
              @click="zoomTab = 'pending'"
            >
              Por asociar ({{ unassociatedCount }})
            </button>
            <button
              type="button"
              :class="{ active: zoomTab === 'matched' }"
              @click="zoomTab = 'matched'"
            >
              Asociados ({{ associatedCount }})
            </button>
            <button
              type="button"
              :class="{ active: zoomTab === 'unmatched' }"
              @click="zoomTab = 'unmatched'"
            >
              No encontrados ({{ zoomPreview.unmatched?.length || 0 }})
            </button>
          </div>
          <span class="zoom-search">
            <i class="pi pi-search" />
            <InputText v-model="zoomSearch" placeholder="Buscar participante..." />
          </span>
        </section>

        <div class="zoom-import-advice">
          <i class="pi pi-lightbulb" />
          <span><strong>Consejo:</strong> Asocia cada participante de Zoom con un usuario de la plataforma para registrar correctamente la asistencia.</span>
        </div>

        <label v-if="unassociatedCount" class="zoom-discard-option">
          <Checkbox v-model="discardUnassociated" :binary="true" />
          <span>
            <strong>Descartar {{ unassociatedCount }} sin asociar</strong>
            <small>Continuar solo con los {{ associatedCount }} participantes asociados.</small>
          </span>
        </label>

        <div class="zoom-import-table">
          <div class="zoom-import-table__head">
            <span>Participante en Zoom</span>
            <span>Estado</span>
            <span>Asociar con usuario</span>
            <span>Nota</span>
          </div>
          <div
            v-for="row in filteredZoomRows"
            :key="row.key"
            class="zoom-import-table__row"
          >
            <div class="zoom-participant">
              <span class="student-avatar">{{ initials(row.name || row.email) }}</span>
              <div>
                <strong>{{ row.name || 'Sin nombre' }}</strong>
                <small class="muted">{{ row.email || 'Sin email' }}</small>
              </div>
            </div>
            <Tag :value="row.associatedUserId ? 'Asociado' : 'Sin asociar'" :severity="row.associatedUserId ? 'success' : 'warning'" />
            <Dropdown
              v-model="manualAssociations[row.key]"
              :options="studentOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Seleccionar usuario"
              showClear
              class="zoom-user-select"
              :disabled="row.locked"
            />
            <InputText v-model="manualNotes[row.key]" placeholder="Agregar nota..." class="zoom-note-input" />
          </div>
          <div v-if="!filteredZoomRows.length" class="zoom-import-empty-state">
            No hay participantes para mostrar.
          </div>
        </div>
      </div>

      <div v-else-if="!hasZoomIdentifiers" class="zoom-import-empty">
        Para importar desde Zoom, primero edita esta clase y guarda el ID o UUID de la reunion Zoom.
      </div>

      <div v-if="loading && !zoomPreview" class="attendance-loading">
        <Skeleton height="3rem" class="mb-2" />
        <Skeleton height="3rem" class="mb-2" />
        <Skeleton height="3rem" />
      </div>

      <div v-else-if="errorMessage && !zoomPreview" class="attendance-error">
        <p>{{ errorMessage }}</p>
        <Button class="p-button-text" icon="pi pi-refresh" label="Reintentar" @click="load" />
      </div>

      <div v-else-if="!draftItems.length && !zoomPreview" class="attendance-empty">
        No hay estudiantes activos en este grupo.
      </div>

      <div v-else-if="!zoomPreview" class="attendance-list">
        <div v-for="student in draftItems" :key="student.userId" class="attendance-row">
          <div class="student-meta">
            <span class="student-avatar">{{ initials(student.fullName) }}</span>
            <div>
              <strong>{{ student.fullName || student.email }}</strong>
              <small class="muted">{{ student.email }}</small>
            </div>
          </div>

          <div class="row-controls">
            <Dropdown
              v-model="student.status"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Estado"
              class="status-select"
            />
            <InputText v-model="student.note" placeholder="Nota (opcional)" class="note-input" />
          </div>
        </div>
      </div>
    </div>

    <template v-if="zoomPreview" #footer>
      <div class="zoom-import-footer">
        <Button class="p-button-text" label="Cancelar" :disabled="importing" @click="zoomPreview = null" />
        <Button
          label="Confirmar importacion"
          icon="pi pi-check"
          :loading="importing"
          :disabled="!canConfirmZoomImport"
          @click="confirmZoomImport"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useLiveSessionsStore } from '../../stores/liveSessions';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  sessionId: {
    type: String,
    default: '',
  },
  sessionTitle: {
    type: String,
    default: '',
  },
  sessionStartsAt: {
    type: String,
    default: '',
  },
  zoomMeetingId: {
    type: String,
    default: '',
  },
  zoomMeetingUuid: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:visible', 'saved', 'loaded']);
const toast = useToast();
const liveSessionsStore = useLiveSessionsStore();

const draftItems = ref([]);
const errorMessage = ref('');
const zoomPreview = ref(null);
const zoomTab = ref('pending');
const zoomSearch = ref('');
const manualAssociations = ref({});
const manualNotes = ref({});
const discardUnassociated = ref(false);

const statusOptions = [
  { label: 'Presente', value: 'present' },
  { label: 'Ausente', value: 'absent' },
  { label: 'Tarde', value: 'late' },
  { label: 'Excusado', value: 'excused' },
];

const loading = computed(() => Boolean(liveSessionsStore.loadingAttendanceBySession?.[props.sessionId]));
const saving = computed(() => Boolean(liveSessionsStore.savingAttendanceBySession?.[props.sessionId]));
const importing = computed(() => Boolean(liveSessionsStore.importingAttendanceBySession?.[props.sessionId]));
const hasZoomIdentifiers = computed(() => Boolean(props.zoomMeetingId || props.zoomMeetingUuid));
const totalCount = computed(() => draftItems.value.length);
const presentCount = computed(
  () => draftItems.value.filter((item) => item.status === 'present').length,
);
const dialogTitle = computed(() =>
  props.sessionTitle ? `Asistencia · ${props.sessionTitle}` : 'Asistencia',
);
const studentOptions = computed(() =>
  draftItems.value.map((student) => ({
    label: `${student.fullName || student.email}${student.email ? ` · ${student.email}` : ''}`,
    value: student.userId,
    search: `${student.fullName || ''} ${student.email || ''}`.toLowerCase(),
  })),
);
const participantKey = (participant = {}, index = 0, prefix = 'zoom') =>
  [
    prefix,
    participant.participantUuid,
    participant.zoomUserId,
    participant.zoomParticipantId,
    participant.email,
    participant.name,
    index,
  ]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .join(':');
const zoomRows = computed(() => {
  const matched = (zoomPreview.value?.matched || []).map((item, index) => ({
    key: participantKey(item.zoomParticipant, index, 'matched'),
    name: item.zoomParticipant?.name || item.fullName || '',
    email: item.zoomParticipant?.email || item.email || '',
    associatedUserId: item.userId,
    locked: true,
    source: 'matched',
  }));
  const unmatched = (zoomPreview.value?.unmatched || []).map((participant, index) => {
    const key = participantKey(participant, index, 'unmatched');
    return {
      key,
      name: participant.name || '',
      email: participant.email || '',
      associatedUserId: manualAssociations.value[key] || null,
      locked: false,
      source: 'unmatched',
    };
  });
  return [...matched, ...unmatched];
});
const associatedCount = computed(
  () => zoomRows.value.filter((row) => Boolean(row.associatedUserId)).length,
);
const unassociatedCount = computed(
  () => zoomRows.value.filter((row) => !row.associatedUserId).length,
);
const importReadyCount = associatedCount;
const canConfirmZoomImport = computed(
  () => importReadyCount.value > 0 && (!unassociatedCount.value || discardUnassociated.value),
);
const filteredZoomRows = computed(() => {
  const query = zoomSearch.value.trim().toLowerCase();
  return zoomRows.value.filter((row) => {
    if (zoomTab.value === 'pending' && row.associatedUserId) return false;
    if (zoomTab.value === 'matched' && !row.associatedUserId) return false;
    if (zoomTab.value === 'unmatched' && row.source !== 'unmatched') return false;
    if (!query) return true;
    return `${row.name} ${row.email}`.toLowerCase().includes(query);
  });
});

const emitSummary = () => {
  if (!props.sessionId) return;
  emit('loaded', {
    sessionId: props.sessionId,
    presentCount: presentCount.value,
    totalCount: totalCount.value,
  });
};

const mapStudentsToDraft = (students = [], isTaken = false) =>
  students.map((student) => ({
    userId: student.userId,
    fullName: student.fullName || '',
    email: student.email || '',
    status: student.status || (isTaken ? 'present' : null),
    note: student.note || '',
    markedAt: student.markedAt || null,
  }));

const load = async () => {
  if (!props.sessionId) return;
  errorMessage.value = '';
  try {
    const payload = await liveSessionsStore.fetchAttendance(props.sessionId);
    draftItems.value = mapStudentsToDraft(payload?.students || [], payload?.isTaken);
    emitSummary();
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || 'No se pudo cargar la asistencia';
  }
};

const markAllPresent = () => {
  draftItems.value = draftItems.value.map((item) => ({
    ...item,
    status: 'present',
  }));
};

const save = async () => {
  if (!props.sessionId) return;
  const invalid = draftItems.value.find((item) => !item.status);
  if (invalid) {
    toast.add({
      severity: 'warn',
      summary: 'Estado pendiente',
      detail: 'Todos los estudiantes deben tener un estado antes de guardar',
      life: 2500,
    });
    return;
  }

  try {
    await liveSessionsStore.saveAttendance(
      props.sessionId,
      draftItems.value.map((item) => ({
        userId: item.userId,
        status: item.status,
        note: item.note?.trim() || null,
      })),
    );
    await load();
    emit('saved', {
      sessionId: props.sessionId,
      presentCount: presentCount.value,
      totalCount: totalCount.value,
    });
    toast.add({ severity: 'success', summary: 'Asistencia guardada', life: 1800 });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'No se pudo guardar la asistencia',
      life: 3000,
    });
  }
};

const zoomPayload = () => ({
  mode: 'auto',
  meetingId: props.zoomMeetingId || null,
  meetingUuid: props.zoomMeetingUuid || null,
});

const previewZoomImport = async () => {
  if (!props.sessionId) return;
  if (!hasZoomIdentifiers.value) {
    toast.add({
      severity: 'info',
      summary: 'Zoom sin configurar',
      detail: 'Edita esta clase y guarda el ID o UUID de la reunion Zoom antes de importar.',
      life: 3500,
    });
    return;
  }
  zoomPreview.value = null;
  zoomSearch.value = '';
  manualAssociations.value = {};
  manualNotes.value = {};
  discardUnassociated.value = false;
  try {
    zoomPreview.value = await liveSessionsStore.previewZoomAttendance(props.sessionId, zoomPayload());
    zoomTab.value = (zoomPreview.value?.unmatched || []).length ? 'pending' : 'matched';
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error Zoom',
      detail: err?.response?.data?.error || 'No se pudo previsualizar la asistencia de Zoom',
      life: 4000,
    });
  }
};

const confirmZoomImport = async () => {
  if (!props.sessionId || !canConfirmZoomImport.value) {
    if (unassociatedCount.value && !discardUnassociated.value) {
      toast.add({
        severity: 'warn',
        summary: 'Participantes sin asociar',
        detail: 'Asocia los participantes pendientes o activa la opcion para descartarlos.',
        life: 3000,
      });
    }
    return;
  }
  try {
    const manualUserIds = Object.values(manualAssociations.value).filter(Boolean);
    const result = await liveSessionsStore.importZoomAttendance(props.sessionId, {
      ...zoomPayload(),
      manualUserIds,
    });
    await load();
    zoomPreview.value = result;
    emit('saved', {
      sessionId: props.sessionId,
      presentCount: presentCount.value,
      totalCount: totalCount.value,
    });
    toast.add({
      severity: 'success',
      summary: 'Asistencia importada',
      detail: `${result?.updated || 0} estudiantes marcados presentes`,
      life: 2500,
    });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error Zoom',
      detail: err?.response?.data?.error || 'No se pudo importar la asistencia de Zoom',
      life: 4000,
    });
  }
};

const initials = (name = '') =>
  String(name || '')
    .split(' ')
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

const formatDate = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return value;
  }
};

const handleHide = () => {
  errorMessage.value = '';
  zoomPreview.value = null;
  zoomSearch.value = '';
  zoomTab.value = 'pending';
  manualAssociations.value = {};
  manualNotes.value = {};
  discardUnassociated.value = false;
};

watch(
  () => [props.visible, props.sessionId],
  async ([visible, sessionId], previous = []) => {
    const [prevVisible, prevSessionId] = previous;
    if (!visible || !sessionId) return;
    if (visible !== prevVisible || sessionId !== prevSessionId) {
      await load();
    }
  },
);
</script>

<style scoped>
.attendance-dialog {
  display: grid;
  gap: 0.9rem;
}

.attendance-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.attendance-summary,
.attendance-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.attendance-list {
  display: grid;
  gap: 0.65rem;
  max-height: 60vh;
  overflow: auto;
  padding-right: 0.2rem;
}

.zoom-import-workspace {
  display: grid;
  gap: 1.15rem;
}

.zoom-import-summary {
  background: linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%);
  border: 1px solid #e5eefc;
  border-radius: 10px;
  padding: 1rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
  gap: 1rem;
  align-items: stretch;
}

.zoom-import-summary h4 {
  margin: 0 0 0.8rem;
  color: #172554;
}

.zoom-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem;
}

.zoom-stat {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}

.zoom-stat strong,
.zoom-stat small {
  display: block;
}

.zoom-stat strong {
  color: #0f172a;
  font-size: 1.15rem;
}

.zoom-stat__icon {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.zoom-stat.is-present .zoom-stat__icon { background: #dcfce7; color: #16a34a; }
.zoom-stat.is-pending .zoom-stat__icon { background: #ffedd5; color: #ea580c; }
.zoom-stat.is-danger .zoom-stat__icon { background: #fee2e2; color: #dc2626; }
.zoom-stat.is-total .zoom-stat__icon { background: #dbeafe; color: #2563eb; }

.zoom-preview-card {
  background: #eaf2ff;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  padding: 1rem;
  display: grid;
  align-content: center;
  gap: 0.5rem;
}

.zoom-preview-card div {
  display: flex;
  gap: 0.55rem;
  align-items: center;
  color: #172554;
}

.zoom-preview-card p {
  margin: 0;
  color: #334155;
}

.zoom-preview-card small {
  color: #475569;
}

.zoom-import-controls {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.zoom-tabs {
  display: flex;
  gap: 0.3rem;
  border-bottom: 1px solid #e5e7eb;
}

.zoom-tabs button {
  appearance: none;
  border: 0;
  background: transparent;
  color: #64748b;
  font-weight: 700;
  padding: 0.8rem 1rem;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}

.zoom-tabs button.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.zoom-search {
  min-width: 260px;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  padding: 0 0.65rem;
  background: #fff;
}

.zoom-search input {
  border: 0;
  box-shadow: none;
}

.zoom-import-table {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.zoom-import-table__head,
.zoom-import-table__row {
  display: grid;
  grid-template-columns: minmax(240px, 1.5fr) 140px minmax(240px, 1fr) minmax(200px, 0.9fr);
  gap: 0.8rem;
  align-items: center;
}

.zoom-import-table__head {
  padding: 0.8rem 1rem;
  color: #334155;
  font-weight: 800;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.zoom-import-table__row {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #edf2f7;
}

.zoom-import-table__row:last-child {
  border-bottom: 0;
}

.zoom-participant {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}

.zoom-participant strong,
.zoom-participant small {
  display: block;
}

.zoom-user-select,
.zoom-note-input {
  width: 100%;
}

.zoom-import-empty-state {
  padding: 1rem;
  color: #64748b;
}

.zoom-import-advice {
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 0.9rem 1rem;
  color: #1e3a8a;
  background: #f8fbff;
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.zoom-discard-option {
  border: 1px solid #fed7aa;
  border-radius: 8px;
  background: #fff7ed;
  color: #7c2d12;
  padding: 0.85rem 1rem;
  display: flex;
  gap: 0.75rem;
  align-items: center;
  cursor: pointer;
}

.zoom-discard-option span {
  display: grid;
  gap: 0.15rem;
}

.zoom-discard-option small {
  color: #9a3412;
}

.zoom-import-footer {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.zoom-import-list {
  display: grid;
  gap: 0.45rem;
  max-height: 12rem;
  overflow: auto;
}

.zoom-import-row {
  background: #fff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 0.55rem 0.65rem;
}

.zoom-import-note {
  display: grid;
  gap: 0.25rem;
  color: #1f2937;
}

.zoom-import-empty {
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #eff6ff;
  color: #1e3a8a;
  padding: 0.75rem 0.9rem;
}

.attendance-row {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 0.75rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 420px);
  gap: 0.75rem;
  align-items: center;
}

.student-meta {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}

.student-meta strong {
  display: block;
}

.student-meta .muted {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.student-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex: 0 0 2rem;
}

.row-controls {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 0.5rem;
  align-items: center;
}

.status-select,
.note-input {
  width: 100%;
}

.muted {
  color: #6b7280;
  font-size: 0.85rem;
}

.attendance-loading,
.attendance-error,
.attendance-empty {
  padding: 0.5rem 0;
}

@media (max-width: 720px) {
  .zoom-import-summary {
    grid-template-columns: 1fr;
  }

  .zoom-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .zoom-import-table {
    overflow-x: auto;
  }

  .zoom-import-table__head,
  .zoom-import-table__row {
    min-width: 820px;
  }

  .attendance-row {
    grid-template-columns: 1fr;
  }

  .row-controls {
    grid-template-columns: 1fr;
  }
}
</style>

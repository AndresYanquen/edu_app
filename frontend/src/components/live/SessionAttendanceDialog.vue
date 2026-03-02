<template>
  <Dialog
    :visible="visible"
    modal
    :style="{ width: '760px', maxWidth: '96vw' }"
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
            label="Guardar"
            icon="pi pi-save"
            :loading="saving"
            :disabled="loading || !draftItems.length"
            @click="save"
          />
        </div>
      </div>

      <div v-if="loading" class="attendance-loading">
        <Skeleton height="3rem" class="mb-2" />
        <Skeleton height="3rem" class="mb-2" />
        <Skeleton height="3rem" />
      </div>

      <div v-else-if="errorMessage" class="attendance-error">
        <p>{{ errorMessage }}</p>
        <Button class="p-button-text" icon="pi pi-refresh" label="Reintentar" @click="load" />
      </div>

      <div v-else-if="!draftItems.length" class="attendance-empty">
        No hay estudiantes activos en este grupo.
      </div>

      <div v-else class="attendance-list">
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
});

const emit = defineEmits(['update:visible', 'saved', 'loaded']);
const toast = useToast();
const liveSessionsStore = useLiveSessionsStore();

const draftItems = ref([]);
const errorMessage = ref('');

const statusOptions = [
  { label: 'Presente', value: 'present' },
  { label: 'Ausente', value: 'absent' },
  { label: 'Tarde', value: 'late' },
  { label: 'Excusado', value: 'excused' },
];

const loading = computed(() => Boolean(liveSessionsStore.loadingAttendanceBySession?.[props.sessionId]));
const saving = computed(() => Boolean(liveSessionsStore.savingAttendanceBySession?.[props.sessionId]));
const totalCount = computed(() => draftItems.value.length);
const presentCount = computed(
  () => draftItems.value.filter((item) => item.status === 'present').length,
);
const dialogTitle = computed(() =>
  props.sessionTitle ? `Asistencia · ${props.sessionTitle}` : 'Asistencia',
);

const emitSummary = () => {
  if (!props.sessionId) return;
  emit('loaded', {
    sessionId: props.sessionId,
    presentCount: presentCount.value,
    totalCount: totalCount.value,
  });
};

const mapStudentsToDraft = (students = []) =>
  students.map((student) => ({
    userId: student.userId,
    fullName: student.fullName || '',
    email: student.email || '',
    status: student.status || null,
    note: student.note || '',
    markedAt: student.markedAt || null,
  }));

const load = async () => {
  if (!props.sessionId) return;
  errorMessage.value = '';
  try {
    const payload = await liveSessionsStore.fetchAttendance(props.sessionId);
    draftItems.value = mapStudentsToDraft(payload?.students || []);
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
  .attendance-row {
    grid-template-columns: 1fr;
  }

  .row-controls {
    grid-template-columns: 1fr;
  }
}
</style>

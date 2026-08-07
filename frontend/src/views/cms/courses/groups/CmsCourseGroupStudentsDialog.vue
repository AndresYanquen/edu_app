<template>
  <Dialog
    :visible="visible"
    modal
    maximizable
    :draggable="false"
    class="group-students-dialog"
    :style="{ width: 'min(96vw, 1180px)' }"
    @update:visible="$emit('update:visible', $event)"
  >
    <template #header>
      <div class="dialog-heading">
        <div>
          <small class="eyebrow">Estudiantes del grupo</small>
          <h2>{{ group?.name || 'Grupo' }}</h2>
        </div>
      </div>
    </template>

    <div v-if="group" class="group-detail">
      <section class="group-facts" aria-label="Información del grupo">
        <div><small>Horario</small><strong>{{ group.scheduleText || 'Sin horario' }}</strong></div>
        <div><small>Docente</small><strong>{{ teacherNames }}</strong></div>
        <div><small>Estudiantes</small><strong>{{ students.length }} / {{ group.capacity ?? 'Sin límite' }}</strong></div>
        <div>
          <small>Próxima clase</small>
          <strong>{{ nextClassLabel }}</strong>
          <a
            v-if="group.nextClass?.joinUrl"
            :href="group.nextClass.joinUrl"
            target="_blank"
            rel="noopener noreferrer"
          >Abrir enlace</a>
        </div>
      </section>

      <section class="roster-section">
        <div class="roster-toolbar">
          <span class="p-input-icon-left search-field">
            <i class="pi pi-search" />
            <InputText v-model.trim="rosterSearch" placeholder="Buscar por nombre, correo o ID" />
          </span>
          <Dropdown
            v-model="statusFilter"
            :options="statusOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Estado"
            showClear
          />
          <Button label="Agregar estudiantes" icon="pi pi-user-plus" @click="openCandidates" />
        </div>

        <div v-if="selectedStudents.length" class="bulk-actions">
          <strong>{{ selectedStudents.length }} seleccionado{{ selectedStudents.length === 1 ? '' : 's' }}</strong>
          <div class="bulk-action-buttons">
            <Button label="Mover a otro grupo" icon="pi pi-arrow-right-arrow-left" size="small" @click="openBulkMove" />
            <Button label="Retirar del grupo" icon="pi pi-user-minus" severity="danger" size="small" outlined @click="requestBulkRemove" />
            <Button label="Limpiar selección" icon="pi pi-times" size="small" text @click="selectedStudents = []" />
          </div>
        </div>

        <div v-if="operationSummary" class="operation-summary" role="status">
          <strong>Resultado de la operación</strong>
          <span>{{ operationSummary.processed?.length || 0 }} procesados</span>
          <span>{{ operationSummary.skipped?.length || 0 }} omitidos</span>
          <span>{{ operationSummary.failed?.length || 0 }} fallidos</span>
        </div>

        <div v-if="loadingStudents" class="loading-state"><ProgressSpinner /></div>
        <DataTable
          v-else
          v-model:selection="selectedStudents"
          :value="filteredStudents"
          dataKey="studentId"
          responsiveLayout="scroll"
          :paginator="filteredStudents.length > 10"
          :rows="10"
          stripedRows
        >
          <template #empty>No hay estudiantes en este grupo.</template>
          <Column selectionMode="multiple" headerStyle="width: 3rem" />
          <Column header="Estudiante" style="min-width: 11rem">
            <template #body="{ data }">
              <div class="student-cell"><strong>{{ data.fullName }}</strong></div>
            </template>
          </Column>
          <Column field="email" header="Correo" style="min-width: 13rem" />
          <Column header="Inscripción">
            <template #body="{ data }"><Tag :value="data.enrollmentStatus" severity="success" /></template>
          </Column>
          <Column header="Asignado el">
            <template #body="{ data }">{{ formatDate(data.joinedAt) }}</template>
          </Column>
          <Column header="Asistencia">
            <template #body="{ data }">{{ data.attendancePercentage == null ? 'No disponible' : `${data.attendancePercentage}%` }}</template>
          </Column>
          <Column header="Grupo actual">
            <template #body>{{ group.name }}</template>
          </Column>
          <Column header="Acciones" style="min-width: 17rem">
            <template #body="{ data }">
              <Button
                label="Mover"
                icon="pi pi-arrow-right-arrow-left"
                text
                @click="openIndividualMove(data)"
              />
              <Button
                label="Retirar"
                icon="pi pi-user-minus"
                severity="danger"
                text
                @click="requestRemove(data)"
              />
            </template>
          </Column>
        </DataTable>
      </section>
    </div>

    <Dialog
      v-model:visible="candidatesVisible"
      modal
      :draggable="false"
      header="Agregar estudiantes"
      :style="{ width: 'min(96vw, 1120px)' }"
    >
      <div class="candidate-toolbar">
        <span class="p-input-icon-left search-field">
          <i class="pi pi-search" />
          <InputText
            v-model.trim="candidateSearch"
            placeholder="Buscar por nombre, correo o ID de plataforma"
            @keyup.enter="loadCandidates"
          />
        </span>
        <Dropdown
          v-model="candidateGroupFilter"
          :options="candidateFilterOptions"
          optionLabel="label"
          optionValue="value"
        />
        <Button icon="pi pi-search" label="Buscar" outlined @click="loadCandidates" />
      </div>

      <div class="selection-count">
        {{ selectedCandidates.length }} estudiante{{ selectedCandidates.length === 1 ? '' : 's' }} seleccionado{{ selectedCandidates.length === 1 ? '' : 's' }}
      </div>

      <DataTable
        v-model:selection="selectedCandidates"
        :value="filteredCandidates"
        dataKey="studentId"
        :loading="loadingCandidates"
        responsiveLayout="scroll"
        :paginator="filteredCandidates.length > 8"
        :rows="8"
      >
        <template #empty>No hay estudiantes disponibles.</template>
        <Column selectionMode="multiple" headerStyle="width: 3rem" />
        <Column field="fullName" header="Nombre" />
        <Column field="email" header="Correo" />
        <Column field="platformId" header="ID de plataforma" style="min-width: 15rem" />
        <Column header="Grupo actual">
          <template #body="{ data }">{{ data.groupName || 'Sin grupo' }}</template>
        </Column>
        <Column header="Estado">
          <template #body="{ data }">
            <div class="candidate-status">
              <Tag :value="data.groupId ? 'Con grupo' : 'Sin grupo'" :severity="data.groupId ? 'warning' : 'info'" />
              <small>Inscripción: {{ data.enrollmentStatus }}</small>
            </div>
          </template>
        </Column>
        <Column header="Docente">
          <template #body="{ data }">{{ data.currentGroupTeacher || 'Sin docente' }}</template>
        </Column>
        <Column header="Horario">
          <template #body="{ data }">{{ data.currentGroupSchedule || 'Sin horario' }}</template>
        </Column>
      </DataTable>

      <div v-if="moveWarnings.length" class="move-warning" role="alert">
        <div v-for="warning in moveWarnings" :key="warning.studentId">
          <strong>{{ warning.fullName }}:</strong>
          Actualmente pertenece al grupo {{ warning.groupName }}. Al continuar será cambiado al grupo {{ group?.name }}.
        </div>
      </div>

      <template #footer>
        <Button label="Cancelar" text @click="candidatesVisible = false" />
        <Button
          :label="`Agregar ${selectedCandidates.length} estudiante${selectedCandidates.length === 1 ? '' : 's'}`"
          icon="pi pi-check"
          :disabled="!selectedCandidates.length"
          :loading="saving"
          @click="assignSelected"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="bulkMoveVisible"
      modal
      :draggable="false"
      header="Mover estudiantes a otro grupo"
      :style="{ width: 'min(94vw, 960px)' }"
    >
      <p>Selecciona el grupo destino para {{ studentsToMove.length }} estudiante{{ studentsToMove.length === 1 ? '' : 's' }}.</p>
      <DataTable
        v-model:selection="selectedTargetGroup"
        :value="otherGroups"
        dataKey="id"
        selectionMode="single"
        responsiveLayout="scroll"
      >
        <template #empty>No existen otros grupos disponibles en este curso.</template>
        <Column selectionMode="single" headerStyle="width: 3rem" />
        <Column field="name" header="Grupo" />
        <Column header="Docente">
          <template #body="{ data }">{{ groupTeacherNames(data) }}</template>
        </Column>
        <Column header="Horario">
          <template #body="{ data }">{{ data.scheduleText || 'Sin horario' }}</template>
        </Column>
        <Column field="studentsCount" header="Estudiantes" />
        <Column header="Capacidad">
          <template #body="{ data }">{{ data.capacity ?? 'Sin límite' }}</template>
        </Column>
        <Column header="Cupos disponibles">
          <template #body="{ data }">{{ availableSlots(data) }}</template>
        </Column>
      </DataTable>
      <div v-if="selectedTargetGroup && !selectedTargetHasCapacity" class="capacity-warning" role="alert">
        El grupo seleccionado no tiene cupos suficientes para trasladar a {{ studentsToMove.length }} estudiantes.
      </div>
      <template #footer>
        <Button label="Cancelar" text @click="bulkMoveVisible = false" />
        <Button
          :label="`Mover ${studentsToMove.length} estudiante${studentsToMove.length === 1 ? '' : 's'}`"
          icon="pi pi-arrow-right-arrow-left"
          :disabled="!selectedTargetGroup || !selectedTargetHasCapacity"
          :loading="saving"
          @click="confirmBulkMove"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="confirmVisible"
      modal
      :draggable="false"
      header="Confirmar cambio"
      :style="{ width: 'min(92vw, 500px)' }"
    >
      <p>{{ confirmationText }}</p>
      <template #footer>
        <Button label="Cancelar" text @click="confirmVisible = false" />
        <Button label="Confirmar" severity="danger" :loading="saving" @click="applyPendingAction" />
      </template>
    </Dialog>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import {
  getGroupStudents,
  getGroupStudentCandidates,
  updateEnrollmentGroup,
  bulkAssignGroupStudents,
  bulkMoveGroupStudents,
  bulkRemoveGroupStudents,
} from '../../../../api/cms';

const props = defineProps({
  visible: { type: Boolean, default: false },
  group: { type: Object, default: null },
  courseId: { type: [String, Number], required: true },
  groups: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:visible', 'changed']);
const toast = useToast();

const students = ref([]);
const candidates = ref([]);
const selectedCandidates = ref([]);
const selectedStudents = ref([]);
const selectedTargetGroup = ref(null);
const studentsToMove = ref([]);
const loadingStudents = ref(false);
const loadingCandidates = ref(false);
const saving = ref(false);
const rosterSearch = ref('');
const statusFilter = ref(null);
const candidateSearch = ref('');
const candidateGroupFilter = ref('all');
const candidatesVisible = ref(false);
const bulkMoveVisible = ref(false);
const confirmVisible = ref(false);
const pendingAction = ref(null);
const operationSummary = ref(null);

const statusOptions = [
  { label: 'Inscripción activa', value: 'active' },
  { label: 'Inscripción inactiva', value: 'inactive' },
];
const candidateFilterOptions = computed(() => [
  { label: 'Todos', value: 'all' },
  { label: 'Sin grupo', value: 'without_group' },
  { label: 'Con grupo', value: 'with_group' },
  ...props.groups
    .filter((item) => item.id !== props.group?.id)
    .map((item) => ({ label: `Grupo: ${item.name}`, value: item.id })),
]);

const teacherNames = computed(() =>
  props.group?.teachers?.length
    ? props.group.teachers.map((teacher) => teacher.fullName).join(', ')
    : 'Sin docente asignado',
);
const otherGroups = computed(() => props.groups.filter((item) => item.id !== props.group?.id));
const filteredStudents = computed(() => {
  const term = rosterSearch.value.toLowerCase();
  return students.value.filter((student) => {
    const matchesTerm = !term || `${student.fullName} ${student.email} ${student.platformId || student.studentId}`.toLowerCase().includes(term);
    const matchesStatus = !statusFilter.value || student.enrollmentStatus === statusFilter.value;
    return matchesTerm && matchesStatus;
  });
});
const filteredCandidates = computed(() => candidates.value.filter((candidate) => {
  if (candidateGroupFilter.value === 'all') return true;
  if (candidateGroupFilter.value === 'without_group') return !candidate.groupId;
  if (candidateGroupFilter.value === 'with_group') return Boolean(candidate.groupId);
  return candidate.groupId === candidateGroupFilter.value;
}));
const moveWarnings = computed(() => selectedCandidates.value.filter((student) => student.groupId));
const nextClassLabel = computed(() => {
  if (!props.group?.nextClass?.startsAt) return 'No programada';
  const title = props.group.nextClass.title ? `${props.group.nextClass.title} · ` : '';
  return `${title}${formatDateTime(props.group.nextClass.startsAt)}`;
});
const confirmationText = computed(() => {
  const action = pendingAction.value;
  if (!action) return '';
  if (action.type === 'remove') {
    return `¿Retirar a ${action.student.fullName} de ${props.group?.name}? Su inscripción al curso se conservará.`;
  }
  if (action.type === 'bulk-remove') {
    return `¿Retirar ${action.students.length} estudiantes de ${props.group?.name}? Sus inscripciones al curso se conservarán.`;
  }
  return `¿Cambiar a ${action.student.fullName} de ${props.group?.name} a ${action.target.name}?`;
});

const groupTeacherNames = (item) => item.teachers?.length
  ? item.teachers.map((teacher) => teacher.fullName).join(', ')
  : 'Sin docente';
const availableSlots = (item) => item.capacity == null
  ? 'Sin límite'
  : Math.max(0, Number(item.capacity) - Number(item.studentsCount || 0));
const selectedTargetHasCapacity = computed(() => {
  const target = selectedTargetGroup.value;
  if (!target || target.capacity == null) return true;
  return Number(target.capacity) - Number(target.studentsCount || 0) >= studentsToMove.value.length;
});

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value))
  : 'No disponible';
const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'No disponible';

const notifyError = (detail) => toast.add({ severity: 'error', summary: 'No se pudo completar', detail, life: 4000 });

const loadStudents = async () => {
  if (!props.group?.id) return;
  loadingStudents.value = true;
  try {
    const detail = await getGroupStudents(props.group.id);
    students.value = Array.isArray(detail) ? detail : (detail.students || []);
    selectedStudents.value = [];
    if (!Array.isArray(detail) && Array.isArray(detail.availableStudents)) {
      candidates.value = detail.availableStudents;
    }
  } catch (error) {
    notifyError(error.response?.data?.error || 'No fue posible cargar los estudiantes.');
  } finally {
    loadingStudents.value = false;
  }
};

const loadCandidates = async () => {
  if (!props.group?.id) return;
  loadingCandidates.value = true;
  try {
    candidates.value = await getGroupStudentCandidates(props.group.id, { search: candidateSearch.value || undefined });
    selectedCandidates.value = [];
  } catch (error) {
    notifyError(error.response?.data?.error || 'No fue posible buscar estudiantes.');
  } finally {
    loadingCandidates.value = false;
  }
};

const openCandidates = async () => {
  candidatesVisible.value = true;
  await loadCandidates();
};

const persistAssignment = (studentId, groupId) =>
  updateEnrollmentGroup(props.courseId, studentId, { groupId });

const finishChange = async (message) => {
  await loadStudents();
  emit('changed');
  toast.add({ severity: 'success', summary: 'Asignación actualizada', detail: message, life: 3000 });
};

const applyOperationSummary = async (summary, message) => {
  operationSummary.value = summary;
  selectedStudents.value = [];
  selectedCandidates.value = [];
  await loadStudents();
  emit('changed');
  const processed = summary.processed?.length || 0;
  const skipped = summary.skipped?.length || 0;
  const failed = summary.failed?.length || 0;
  toast.add({
    severity: failed ? 'warn' : 'success',
    summary: message,
    detail: `${processed} procesados, ${skipped} omitidos y ${failed} fallidos.`,
    life: 5000,
  });
};

const assignSelected = async () => {
  if (!selectedCandidates.value.length) return;
  saving.value = true;
  try {
    const summary = await bulkAssignGroupStudents(props.courseId, props.group.id, {
      studentIds: selectedCandidates.value.map((student) => student.studentId),
    });
    candidatesVisible.value = false;
    await applyOperationSummary(summary, 'Asignación masiva completada');
  } catch (error) {
    if (error.response?.data?.processed) operationSummary.value = error.response.data;
    notifyError(error.response?.data?.error || 'No fue posible asignar los estudiantes.');
  } finally {
    saving.value = false;
  }
};

const openBulkMove = () => {
  studentsToMove.value = [...selectedStudents.value];
  selectedTargetGroup.value = null;
  bulkMoveVisible.value = true;
};

const openIndividualMove = (student) => {
  studentsToMove.value = [student];
  selectedTargetGroup.value = null;
  bulkMoveVisible.value = true;
};

const confirmBulkMove = async () => {
  if (!selectedTargetGroup.value || !studentsToMove.value.length) return;
  saving.value = true;
  try {
    const summary = await bulkMoveGroupStudents(props.courseId, props.group.id, {
      studentIds: studentsToMove.value.map((student) => student.studentId),
      targetGroupId: selectedTargetGroup.value.id,
    });
    bulkMoveVisible.value = false;
    await applyOperationSummary(summary, 'Traslado masivo completado');
  } catch (error) {
    if (error.response?.data?.processed) operationSummary.value = error.response.data;
    notifyError(error.response?.data?.error || 'No fue posible mover los estudiantes.');
  } finally {
    saving.value = false;
  }
};

const requestRemove = (student) => {
  pendingAction.value = { type: 'remove', student };
  confirmVisible.value = true;
};
const requestBulkRemove = () => {
  pendingAction.value = { type: 'bulk-remove', students: [...selectedStudents.value] };
  confirmVisible.value = true;
};

const applyPendingAction = async () => {
  const action = pendingAction.value;
  if (!action) return;
  saving.value = true;
  try {
    if (action.type === 'bulk-remove') {
      const summary = await bulkRemoveGroupStudents(props.courseId, props.group.id, {
        studentIds: action.students.map((student) => student.studentId),
      });
      confirmVisible.value = false;
      pendingAction.value = null;
      await applyOperationSummary(summary, 'Retiro masivo completado');
      return;
    }
    const targetId = action.type === 'move' ? action.target.id : null;
    await persistAssignment(action.student.studentId, targetId);
    confirmVisible.value = false;
    pendingAction.value = null;
    await finishChange(action.type === 'move' ? 'El estudiante cambió de grupo.' : 'El estudiante fue retirado del grupo.');
  } catch (error) {
    notifyError(error.response?.data?.error || 'No fue posible actualizar el grupo.');
  } finally {
    saving.value = false;
  }
};

watch(
  () => [props.visible, props.group?.id],
  ([isVisible]) => {
    if (isVisible) loadStudents();
  },
);
</script>

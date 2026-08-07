<template>
  <Card class="groups-card">
    <template #title>
      <div class="section-header">
        <div>
          <div class="section-title">Grupos</div>
          <small class="muted">
            {{ canManageGroups ? 'Administra grupos y asignaciones' : 'Consulta y gestiona estudiantes por grupo' }}
          </small>
        </div>
        <Button
          v-if="canManageGroups"
          label="Crear grupo"
          icon="pi pi-plus"
          @click="openGroupDialog()"
        />
      </div>
    </template>
    <template #content>
      <div v-if="loadingGroups">
        <Skeleton height="2rem" class="mb-2" />
        <Skeleton height="2rem" class="mb-2" />
      </div>
      <div v-else-if="!courseGroups.length" class="empty-state">
        No hay grupos registrados.
      </div>
      <DataTable
        v-else
        :value="courseGroups"
        responsiveLayout="scroll"
        dataKey="id"
        :paginator="courseGroups.length > 8"
        :rows="8"
      >
        <Column field="name" header="Grupo" />
        <Column header="Docente" style="min-width: 12rem">
          <template #body="{ data }">
            {{ teacherNames(data) }}
          </template>
        </Column>
        <Column header="Horario" style="min-width: 11rem">
          <template #body="{ data }">{{ data.scheduleText || 'Sin horario' }}</template>
        </Column>
        <Column header="Estudiantes">
          <template #body="{ data }">
            {{ data.studentsCount }}
          </template>
        </Column>
        <Column header="Capacidad">
          <template #body="{ data }">
            {{ data.capacity ?? 'Sin límite' }}
          </template>
        </Column>
        <Column header="Próxima clase" style="min-width: 13rem">
          <template #body="{ data }">
            <div class="next-class">
              <span>{{ formatNextClass(data.nextClass) }}</span>
              <a
                v-if="data.nextClass?.joinUrl"
                :href="data.nextClass.joinUrl"
                target="_blank"
                rel="noopener noreferrer"
              >Abrir enlace</a>
            </div>
          </template>
        </Column>
        <Column header="Acciones" body-style="min-width: 12rem">
          <template #body="{ data }">
            <Button
              label="Ver estudiantes"
              icon="pi pi-users"
              size="small"
              @click="openStudents(data)"
            />
            <Button
              v-if="canManageGroups"
              icon="pi pi-pencil"
              class="p-button-text"
              @click="openGroupDialog(data)"
              aria-label="Edit group"
            />
            <Button
              v-if="canManageGroups"
              icon="pi pi-users"
              class="p-button-text"
              @click="openGroupTeacherDialog(data.id)"
              aria-label="Manage teachers"
            />
            <Button
              v-if="canManageGroups"
              icon="pi pi-trash"
              class="p-button-text p-button-danger"
              severity="danger"
              :loading="deletingGroupId === data.id"
              :disabled="deletingGroupId === data.id"
              @click.stop="openDeleteGroupDialog(data)"
              aria-label="Delete group"
            />
          </template>
        </Column>
      </DataTable>
    </template>
  </Card>

  <CmsCourseGroupStudentsDialog
    v-model:visible="studentsVisible"
    :group="selectedGroup"
    :course-id="courseId"
    :groups="courseGroups"
    @changed="handleStudentsChanged"
  />
</template>

<script setup>
import { inject, ref } from 'vue';
import { cmsCourseBuilderContextKey } from '../cmsCourseBuilderContext';
import CmsCourseGroupStudentsDialog from '../groups/CmsCourseGroupStudentsDialog.vue';

const builder = inject(cmsCourseBuilderContextKey);
const {
  loadingGroups,
  courseGroups,
  courseId,
  canManageGroups,
  openGroupDialog,
  openGroupTeacherDialog,
  deletingGroupId,
  openDeleteGroupDialog,
  refreshGroupList,
} = builder;

const studentsVisible = ref(false);
const selectedGroup = ref(null);

const teacherNames = (group) => group.teachers?.length
  ? group.teachers.map((teacher) => teacher.fullName).join(', ')
  : 'Sin docente';

const formatNextClass = (nextClass) => {
  if (!nextClass?.startsAt) return 'No programada';
  const date = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(nextClass.startsAt));
  return nextClass.title ? `${nextClass.title} · ${date}` : date;
};

const openStudents = (group) => {
  selectedGroup.value = group;
  studentsVisible.value = true;
};

const handleStudentsChanged = async () => {
  const selectedId = selectedGroup.value?.id;
  await refreshGroupList();
  selectedGroup.value = courseGroups.value.find((group) => group.id === selectedId) || selectedGroup.value;
};
</script>

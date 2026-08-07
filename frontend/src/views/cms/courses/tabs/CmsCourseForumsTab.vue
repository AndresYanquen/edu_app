<template>
  <Card class="forums-card">
    <template #title>
      <div class="section-header">
        <div>
          <div class="section-title">Foros</div>
          <small class="muted">Crea y administra foros por curso y por grupo.</small>
        </div>
      </div>
    </template>
    <template #content>
      <div class="forums-toolbar">
        <Dropdown
          v-model="createScope"
          :options="scopeOptions"
          optionLabel="label"
          optionValue="value"
          class="w-14rem"
        />
        <Dropdown
          v-if="createScope === 'group'"
          v-model="createGroupId"
          :options="groupOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Selecciona grupo"
          class="w-18rem"
        />
        <InputText v-model="createTitle" placeholder="Título del foro" class="w-20rem" />
        <Button label="Crear foro" icon="pi pi-plus" :loading="creating" @click="submitCreate" />
      </div>

      <DataTable :value="forums" :loading="loading" responsiveLayout="scroll">
        <Column field="title" header="Título" />
        <Column header="Scope">
          <template #body="{ data }">
            <Tag :value="scopeLabel(data.scope)" severity="info" />
          </template>
        </Column>
        <Column header="Activo">
          <template #body="{ data }">
            <InputSwitch :modelValue="Boolean(data.isActive)" @update:modelValue="toggleActive(data, $event)" />
          </template>
        </Column>
        <Column header="Actualizado">
          <template #body="{ data }">
            {{ formatDate(data.updatedAt || data.createdAt) }}
          </template>
        </Column>
      </DataTable>
    </template>
  </Card>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { createForum, listForums, updateForum } from '../../../../api/forums';
import { cmsCourseBuilderContextKey } from '../cmsCourseBuilderContext';

const builder = inject(cmsCourseBuilderContextKey);
const toast = useToast();

const { courseId, courseGroups } = builder;

const loading = ref(false);
const creating = ref(false);
const forums = ref([]);
const createScope = ref('course');
const createGroupId = ref(null);
const createTitle = ref('');

const scopeOptions = [
  { label: 'Curso', value: 'course' },
  { label: 'Grupo', value: 'group' },
];

const groupOptions = computed(() =>
  (courseGroups.value || []).map((group) => ({
    label: group.scheduleText ? `${group.name} (${group.scheduleText})` : group.name,
    value: group.id,
  })),
);

const scopeLabel = (scope) => {
  if (scope === 'global') return 'Global';
  if (scope === 'group') return 'Grupo';
  return 'Curso';
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const loadForums = async () => {
  loading.value = true;
  try {
    const payload = await listForums({ courseId: courseId.value });
    forums.value = Array.isArray(payload?.items) ? payload.items : [];
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'No se pudieron cargar los foros',
      life: 3200,
    });
  } finally {
    loading.value = false;
  }
};

const submitCreate = async () => {
  const title = String(createTitle.value || '').trim();
  if (!title) return;
  if (createScope.value === 'group' && !createGroupId.value) return;

  creating.value = true;
  try {
    await createForum({
      scope: createScope.value,
      courseId: createScope.value === 'course' ? courseId.value : undefined,
      groupId: createScope.value === 'group' ? createGroupId.value : undefined,
      title,
    });
    createTitle.value = '';
    if (createScope.value === 'group') createGroupId.value = null;
    await loadForums();
    toast.add({ severity: 'success', summary: 'Foro creado', life: 2200 });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'No se pudo crear el foro',
      life: 3200,
    });
  } finally {
    creating.value = false;
  }
};

const toggleActive = async (forum, nextValue) => {
  try {
    await updateForum(forum.id, { isActive: Boolean(nextValue) });
    forum.isActive = Boolean(nextValue);
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'No se pudo actualizar el foro',
      life: 3200,
    });
  }
};

onMounted(async () => {
  await loadForums();
});
</script>

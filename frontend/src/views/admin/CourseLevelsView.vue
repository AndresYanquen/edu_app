<template>
  <section class="admin-levels-view">
    <Card class="card levels-card">
      <template #title>
        <div class="levels-header">
          <div>
            <h2>Niveles de curso</h2>
            <p>Codes that courses may reference</p>
          </div>
          <div class="levels-header__actions">
            <span class="search-input">
              <i class="pi pi-search" />
              <InputText v-model="levelSearch" placeholder="Buscar nivel" />
            </span>
            <Button label="Create level" icon="pi pi-plus" @click="openLevelDialog" />
          </div>
        </div>
      </template>
      <template #content>
        <div v-if="loadingLevels">
          <Skeleton height="2rem" class="mb-2" />
          <Skeleton height="2rem" class="mb-2" />
        </div>
        <div v-else-if="!filteredCourseLevels.length" class="empty-state">
          No course levels defined yet.
        </div>
        <div v-else>
          <DataTable :value="filteredCourseLevels" responsiveLayout="scroll">
            <Column field="code" header="Code" />
            <Column field="label" header="Label" />
            <Column header="Status" style="width: 10rem">
              <template #body="{ data }">
                <Tag
                  :value="data.is_active ? 'Active' : 'Inactive'"
                  :severity="data.is_active ? 'success' : 'warning'"
                />
              </template>
            </Column>
            <Column field="created_at" header="Created" bodyStyle="width: 14rem">
              <template #body="{ data }">
                {{ formatDate(data.created_at) }}
              </template>
            </Column>
            <Column header="Actions" bodyStyle="width: 10rem">
              <template #body="{ data }">
                <Button
                  icon="pi pi-trash"
                  class="p-button-text p-button-danger"
                  severity="danger"
                  size="small"
                  :loading="deletingLevelId === data.id"
                  :disabled="deletingLevelId === data.id"
                  @click="openDeleteLevelDialog(data)"
                  aria-label="Delete level"
                />
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </Card>

    <Dialog v-model:visible="showLevelDialog" modal header="Create level" :style="{ width: '32rem', maxWidth: '95vw' }">
      <div class="level-form-grid">
        <div class="dialog-field">
          <label>Code</label>
          <InputText v-model="levelForm.code" placeholder="A1" />
        </div>
        <div class="dialog-field">
          <label>Label</label>
          <InputText v-model="levelForm.label" placeholder="Beginner" />
        </div>
        <div class="dialog-field switch-field">
          <label>Active</label>
          <InputSwitch v-model="levelForm.isActive" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" class="p-button-text" @click="closeLevelDialog" />
        <Button label="Save" :loading="savingLevel" @click="submitLevelForm" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="confirmDeleteLevelVisible"
      modal
      header="Delete level"
      :style="{ width: '28rem', maxWidth: '95vw' }"
    >
      <p>{{ confirmDeleteLevelMessage }}</p>
      <template #footer>
        <Button label="Cancel" class="p-button-text" @click="closeDeleteLevelDialog" />
        <Button
          label="Delete"
          severity="danger"
          :loading="confirmDeleteLevelLoading"
          @click="confirmDeleteLevel"
        />
      </template>
    </Dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import {
  createCourseLevel,
  deleteCourseLevel,
  listCourseLevels,
} from '../../api/admin';

const toast = useToast();

const courseLevels = ref([]);
const loadingLevels = ref(false);
const levelSearch = ref('');
const levelForm = ref({ code: '', label: '', isActive: true });
const showLevelDialog = ref(false);
const savingLevel = ref(false);
const deletingLevelId = ref(null);
const confirmDeleteLevelVisible = ref(false);
const confirmDeleteLevelId = ref(null);
const confirmDeleteLevelLoading = ref(false);

const filteredCourseLevels = computed(() => {
  const search = (levelSearch.value || '').trim().toLowerCase();
  if (!search) {
    return courseLevels.value;
  }
  return courseLevels.value.filter((level) => {
    const code = (level.code || '').toLowerCase();
    const label = (level.label || '').toLowerCase();
    return code.includes(search) || label.includes(search);
  });
});

const confirmDeleteLevelMessage = computed(() => {
  const level = courseLevels.value.find((entry) => entry.id === confirmDeleteLevelId.value);
  if (!level) {
    return 'Are you sure you want to delete this level?';
  }
  return `Delete level "${level.code}"? Courses that already use it will break.`;
});

const loadCourseLevels = async () => {
  loadingLevels.value = true;
  try {
    courseLevels.value = await listCourseLevels();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to load course levels',
      life: 3500,
    });
  } finally {
    loadingLevels.value = false;
  }
};

const resetLevelForm = () => {
  levelForm.value = { code: '', label: '', isActive: true };
};

const openLevelDialog = () => {
  resetLevelForm();
  showLevelDialog.value = true;
};

const closeLevelDialog = () => {
  showLevelDialog.value = false;
  savingLevel.value = false;
  resetLevelForm();
};

const submitLevelForm = async () => {
  const code = (levelForm.value.code || '').trim();
  const label = (levelForm.value.label || '').trim();
  if (!code || !label) {
    toast.add({
      severity: 'warn',
      summary: 'Missing fields',
      detail: 'Code and label are required',
      life: 2500,
    });
    return;
  }
  savingLevel.value = true;
  try {
    await createCourseLevel({
      code,
      label,
      is_active: levelForm.value.isActive,
    });
    toast.add({
      severity: 'success',
      summary: 'Level created',
      detail: `${code} is now available`,
      life: 2500,
    });
    await loadCourseLevels();
    closeLevelDialog();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to create level',
      life: 3500,
    });
  } finally {
    savingLevel.value = false;
  }
};

const openDeleteLevelDialog = (level) => {
  confirmDeleteLevelId.value = level.id;
  confirmDeleteLevelVisible.value = true;
};

const closeDeleteLevelDialog = () => {
  confirmDeleteLevelVisible.value = false;
  confirmDeleteLevelLoading.value = false;
  confirmDeleteLevelId.value = null;
};

const confirmDeleteLevel = async () => {
  const levelId = confirmDeleteLevelId.value;
  if (!levelId) {
    closeDeleteLevelDialog();
    return;
  }
  confirmDeleteLevelLoading.value = true;
  deletingLevelId.value = levelId;
  try {
    await deleteCourseLevel(levelId);
    toast.add({ severity: 'success', summary: 'Level deleted', life: 2500 });
    courseLevels.value = courseLevels.value.filter((level) => level.id !== levelId);
    closeDeleteLevelDialog();
  } catch (err) {
    const message = err.response?.data?.error || 'Failed to delete level';
    toast.add({ severity: 'error', summary: 'Deletion failed', detail: message, life: 3500 });
  } finally {
    confirmDeleteLevelLoading.value = false;
    deletingLevelId.value = null;
  }
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

onMounted(() => {
  loadCourseLevels();
});
</script>

<style scoped>
.admin-levels-view {
  display: grid;
}

.card {
  background: #fff;
  border-radius: 22px;
  border: 1px solid var(--app-border);
  box-shadow: var(--shadow-sm);
  padding: 1.2rem 1.4rem;
}

.levels-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.levels-header h2 {
  margin: 0;
  font-size: 1.4rem;
}

.levels-header p {
  margin: 0;
  color: var(--text-secondary);
}

.levels-header__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.search-input {
  position: relative;
}

.search-input i {
  position: absolute;
  top: 50%;
  left: 0.8rem;
  transform: translateY(-50%);
  color: #94a3b8;
}

.search-input :deep(.p-inputtext) {
  padding-left: 2.5rem;
  min-width: 14rem;
}

.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.dialog-field label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.level-form-grid {
  display: grid;
  gap: 1rem;
}

.switch-field {
  align-items: flex-start;
}

@media (max-width: 900px) {
  .levels-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

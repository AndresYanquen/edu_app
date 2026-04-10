<template>
  <section class="admin-levels-view">
    <Card class="card levels-card">
      <template #title>
        <div class="levels-header">
          <div class="levels-header__intro">
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

        <div v-else class="table-wrap">
          <DataTable :value="filteredCourseLevels" responsiveLayout="scroll" class="levels-table">
            <Column field="code" header="Code" style="width: 10rem">
              <template #body="{ data }">
                <strong class="level-code">{{ data.code }}</strong>
              </template>
            </Column>

            <Column field="label" header="Label" style="width: 18rem">
              <template #body="{ data }">
                <span class="cell-break">{{ data.label }}</span>
              </template>
            </Column>

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
                <span class="muted cell-break">{{ formatDate(data.created_at) }}</span>
              </template>
            </Column>

            <Column header="Actions" bodyStyle="width: 10rem">
              <template #body="{ data }">
                <div class="actions-row">
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
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="showLevelDialog"
      modal
      header="Create level"
      :style="{ width: '32rem', maxWidth: '95vw' }"
    >
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
        <div class="dialog-footer-actions">
          <Button label="Cancel" class="p-button-text" @click="closeLevelDialog" />
          <Button label="Save" :loading="savingLevel" @click="submitLevelForm" />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="confirmDeleteLevelVisible"
      modal
      header="Delete level"
      :style="{ width: '28rem', maxWidth: '95vw' }"
    >
      <p class="delete-message">{{ confirmDeleteLevelMessage }}</p>

      <template #footer>
        <div class="dialog-footer-actions">
          <Button label="Cancel" class="p-button-text" @click="closeDeleteLevelDialog" />
          <Button
            label="Delete"
            severity="danger"
            :loading="confirmDeleteLevelLoading"
            @click="confirmDeleteLevel"
          />
        </div>
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
.admin-levels-view,
.admin-levels-view * {
  box-sizing: border-box;
  min-width: 0;
}

.admin-levels-view {
  width: 100%;
  display: grid;
  gap: 1rem;
}

.card {
  width: 100%;
  background: #fff;
  border-radius: 22px;
  border: 1px solid var(--app-border);
  box-shadow: var(--shadow-sm);
  padding: 1.2rem 1.4rem;
  overflow: hidden;
}

.levels-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.levels-header__intro {
  min-width: 0;
}

.levels-header h2 {
  margin: 0;
  font-size: 1.4rem;
  line-height: 1.1;
  color: #1e3a5f;
}

.levels-header p {
  margin: 0.3rem 0 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.levels-header__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.search-input {
  position: relative;
  min-width: 0;
}

.search-input i {
  position: absolute;
  top: 50%;
  left: 0.8rem;
  transform: translateY(-50%);
  color: #94a3b8;
  z-index: 1;
}

.search-input :deep(.p-inputtext) {
  width: 100%;
  min-width: 14rem;
  padding-left: 2.5rem;
}

.table-wrap {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.levels-table {
  width: 100%;
}

.levels-table :deep(.p-datatable-table) {
  min-width: 760px;
}

.levels-table :deep(.p-datatable-thead > tr > th),
.levels-table :deep(.p-datatable-tbody > tr > td) {
  font-size: 0.92rem;
  vertical-align: middle;
}

.level-code {
  color: #0f172a;
  line-height: 1.35;
}

.cell-break {
  word-break: break-word;
  overflow-wrap: anywhere;
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

.actions-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dialog-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  width: 100%;
}

.delete-message {
  margin: 0;
  line-height: 1.6;
  color: #334155;
}

.muted {
  color: #64748b;
  font-size: 0.9rem;
}

@media (max-width: 900px) {
  .card {
    padding: 1rem;
    border-radius: 18px;
  }

  .levels-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .levels-header__actions {
    width: 100%;
    justify-content: flex-start;
  }

  .search-input {
    width: 100%;
  }

  .search-input :deep(.p-inputtext) {
    min-width: 0;
  }

  .levels-header__actions :deep(.p-button) {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .admin-levels-view {
    gap: 0.9rem;
  }

  .card {
    padding: 0.9rem;
    border-radius: 16px;
  }

  .levels-header h2 {
    font-size: 1.2rem;
  }

  .levels-header p {
    font-size: 0.92rem;
  }

  .dialog-footer-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .dialog-footer-actions :deep(.p-button) {
    width: 100%;
  }
}
</style>
<template>
  <div class="page">
    <Card>
      <template #title>Your Groups</template>
      <template #content>
        <template v-if="loading">
          <Skeleton height="3rem" class="mb-2" />
          <Skeleton height="3rem" class="mb-2" />
        </template>
        <template v-else-if="error">
          <p>Unable to load groups.</p>
          <Button label="Reload" icon="pi pi-refresh" class="p-button-text" @click="loadGroups" />
        </template>
        <template v-else>
          <div class="table-controls">
            <span class="control-label">Filter</span>
            <InputText v-model="filter" placeholder="Search by group or course" />
          </div>
          <template v-if="groups.length">
            <DataTable :value="filteredGroups" responsiveLayout="scroll">
              <Column field="name" header="Group" />
              <Column field="course_title" header="Course" />
              <Column field="schedule_text" header="Schedule" />
              <Column header="Actions" body-style="min-width:8rem">
                <template #body="{ data }">
                  <Button label="Open" icon="pi pi-arrow-right" @click="openGroup(data.id)" />
                </template>
              </Column>
            </DataTable>
            <div v-if="!filteredGroups.length" class="empty-state">No groups match your search.</div>
          </template>
          <template v-else>
            <Card class="empty-card">
              <template #content>
                <div class="empty-card-content">
                  <i class="pi pi-users"></i>
                  <div>
                    <h4>No groups assigned</h4>
                    <p>You do not have any groups yet.</p>
                  </div>
                </div>
              </template>
            </Card>
          </template>
        </template>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import api from '../api/axios';

const groups = ref([]);
const loading = ref(true);
const error = ref(false);
const filter = ref('');
const router = useRouter();
const toast = useToast();

const loadGroups = async () => {
  loading.value = true;
  error.value = false;
  try {
    const { data } = await api.get('/instructor/groups');
    groups.value = data.map((g) => ({
      id: g.group_id,
      name: g.group_name,
      course_title: g.course_title,
      schedule_text: g.schedule_text,
    }));
  } catch (err) {
    error.value = true;
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load groups', life: 3000 });
  } finally {
    loading.value = false;
  }
};

const openGroup = (id) => {
  router.push(`/instructor/group/${id}`);
};

loadGroups();

const filteredGroups = computed(() => {
  if (!filter.value.trim()) return groups.value;
  const term = filter.value.toLowerCase();
  return groups.value.filter(
    (g) =>
      g.name.toLowerCase().includes(term) ||
      (g.course_title || '').toLowerCase().includes(term),
  );
});
</script>

<style scoped>
.mb-2 {
  margin-bottom: 0.75rem;
}

.table-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.control-label {
  font-size: 0.85rem;
  color: #6b7280;
}

.empty-card-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.empty-card-content i {
  font-size: 2rem;
  color: #94a3b8;
}
</style>

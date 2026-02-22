<template>
  <Card class="posts-card">
    <template #title>
      <div class="section-header">
        <div>
          <div class="section-title">Posts</div>
          <small class="muted">Create and manage course feed posts</small>
        </div>
        <Button label="New post" icon="pi pi-plus" @click="openCreate" />
      </div>
    </template>

    <template #content>
      <div class="posts-toolbar">
        <div class="filter-field">
          <label>Audience</label>
          <Dropdown
            v-model="filters.groupId"
            :options="groupFilterOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="All"
            showClear
          />
        </div>
      </div>

      <div v-if="loading">
        <Skeleton height="6rem" class="mb-2" />
        <Skeleton height="6rem" class="mb-2" />
      </div>

      <div v-else-if="!items.length" class="empty-state">
        No posts found for this course.
      </div>

      <div v-else class="posts-list">
        <Card v-for="item in items" :key="item.id" class="post-item-card">
          <template #title>
            <div class="post-title-row">
              <strong>{{ item.title }}</strong>
              <div class="post-tags">
                <Tag :value="item.groupId ? 'Group' : 'Course'" :severity="item.groupId ? 'info' : 'success'" />
                <Tag v-if="item.groupId" :value="groupName(item.groupId)" severity="contrast" />
              </div>
            </div>
          </template>
          <template #content>
            <p class="post-snippet">{{ snippet(item.body) }}</p>
            <small class="muted">Created: {{ formatDateTime(item.createdAt) }}</small>
          </template>
          <template #footer>
            <div class="post-actions">
              <Button icon="pi pi-pencil" class="p-button-text" @click="openEdit(item)" />
            </div>
          </template>
        </Card>
      </div>

      <div v-if="total > pageSize" class="pagination-row">
        <Button
          label="Previous"
          class="p-button-text"
          :disabled="page <= 1 || loading"
          @click="changePage(page - 1)"
        />
        <small>Page {{ page }} · {{ total }} total</small>
        <Button
          label="Next"
          class="p-button-text"
          :disabled="page * pageSize >= total || loading"
          @click="changePage(page + 1)"
        />
      </div>
    </template>
  </Card>

  <CmsPostDialog
    v-model:visible="dialogVisible"
    :mode="dialogMode"
    :course-id="courseId"
    :groups="normalizedGroups"
    :initial="editingPost"
    @saved="handleSaved"
  />
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { getCoursePosts } from '../../../api/cms';
import CmsPostDialog from './CmsPostDialog.vue';

const props = defineProps({
  courseId: {
    type: String,
    required: true,
  },
  groups: {
    type: Array,
    default: () => [],
  },
});

const toast = useToast();
const loading = ref(false);
const items = ref([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const dialogVisible = ref(false);
const dialogMode = ref('create');
const editingPost = ref(null);

const filters = reactive({
  groupId: null,
});

const normalizedGroups = computed(() =>
  (props.groups || []).map((group) => ({
    id: group.id,
    name: group.name,
    scheduleText: group.scheduleText || group.schedule_text || null,
  })),
);

const groupFilterOptions = computed(() => [
  { label: 'All', value: null },
  ...normalizedGroups.value.map((group) => ({
    label: group.scheduleText ? `${group.name} (${group.scheduleText})` : group.name,
    value: group.id,
  })),
]);

const groupName = (groupId) => {
  const found = normalizedGroups.value.find((group) => group.id === groupId);
  return found?.name || 'Group';
};

const normalizeRows = (payload) => {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map((row) => ({
    id: row.id,
    courseId: row.courseId || row.course_id,
    groupId: row.groupId || row.group_id || null,
    createdByUserId: row.createdByUserId || row.created_by_user_id || null,
    title: row.title || '',
    body: row.body || '',
    createdAt: row.createdAt || row.created_at || null,
    updatedAt: row.updatedAt || row.updated_at || null,
  }));
};

const fetchPosts = async () => {
  if (!props.courseId) return;
  loading.value = true;
  try {
    const payload = await getCoursePosts(props.courseId, {
      page: page.value,
      pageSize: pageSize.value,
      groupId: filters.groupId || undefined,
    });
    items.value = normalizeRows(payload);
    total.value = Number(payload?.total || 0);
  } catch (err) {
    const detail = err?.response?.data?.error || 'Failed to load posts';
    toast.add({ severity: 'error', summary: 'Error', detail, life: 3200 });
  } finally {
    loading.value = false;
  }
};

const changePage = async (nextPage) => {
  if (nextPage < 1) return;
  page.value = nextPage;
  await fetchPosts();
};

const openCreate = () => {
  dialogMode.value = 'create';
  editingPost.value = null;
  dialogVisible.value = true;
};

const openEdit = (post) => {
  dialogMode.value = 'edit';
  editingPost.value = { ...post };
  dialogVisible.value = true;
};

const handleSaved = async () => {
  await fetchPosts();
};

const snippet = (text = '') => {
  const value = String(text || '').trim();
  if (value.length <= 180) return value;
  return `${value.slice(0, 180)}...`;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

watch(
  () => filters.groupId,
  async () => {
    page.value = 1;
    await fetchPosts();
  },
);

onMounted(async () => {
  await fetchPosts();
});
</script>

<style scoped>
.posts-toolbar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.filter-field {
  display: grid;
  gap: 0.35rem;
  min-width: 220px;
}

.posts-list {
  display: grid;
  gap: 0.8rem;
}

.post-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.post-tags {
  display: inline-flex;
  gap: 0.4rem;
}

.post-snippet {
  margin: 0 0 0.5rem;
  color: #334155;
}

.post-actions {
  display: flex;
  justify-content: flex-end;
}

.pagination-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.9rem;
}

.empty-state {
  min-height: 180px;
  display: grid;
  place-content: center;
  color: #64748b;
}
</style>

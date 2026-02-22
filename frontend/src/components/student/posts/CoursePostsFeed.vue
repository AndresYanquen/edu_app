<template>
  <section class="course-posts-feed">
    <div v-if="loading" class="feed-loading">
      <Skeleton height="6rem" class="mb-2" />
      <Skeleton height="6rem" class="mb-2" />
    </div>

    <div v-else-if="!items.length" class="empty-state">
      No posts yet.
    </div>

    <div v-else class="feed-list">
      <Card v-for="post in items" :key="post.id" class="post-card">
        <template #title>
          <div class="post-header">
            <div class="post-title-wrap">
              <span class="author-avatar">{{ getAuthorInitials(post) }}</span>
              <div class="post-title-meta">
                <strong>{{ post.title }}</strong>
                <small class="post-author">{{ getAuthorName(post) }}</small>
              </div>
            </div>
            <Tag :value="post.groupId ? 'Group' : 'Course'" :severity="post.groupId ? 'info' : 'success'" />
          </div>
        </template>
        <template #content>
          <p class="post-body">{{ renderBody(post) }}</p>
          <Button
            v-if="shouldShowToggle(post)"
            class="p-button-text read-more-btn"
            :label="expanded.has(post.id) ? 'Read less' : 'Read more'"
            @click="toggleExpanded(post.id)"
          />
          <small class="post-date">{{ formatDateTime(post.createdAt) }}</small>
        </template>
      </Card>
    </div>

    <div class="feed-pager" v-if="total > limit">
      <Button
        label="Previous"
        class="p-button-text"
        :disabled="offset <= 0 || loadingMore"
        @click="changeOffset(Math.max(0, offset - limit))"
      />
      <small>{{ offset + 1 }}-{{ Math.min(offset + limit, total) }} / {{ total }}</small>
      <Button
        label="Next"
        class="p-button-text"
        :disabled="offset + limit >= total || loadingMore"
        @click="changeOffset(offset + limit)"
      />
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { getCoursePosts } from '../../../api/student';

const props = defineProps({
  courseId: {
    type: String,
    required: true,
  },
});

const toast = useToast();
const loading = ref(false);
const loadingMore = ref(false);
const items = ref([]);
const total = ref(0);
const pagination = reactive({
  limit: 20,
  offset: 0,
});
const expanded = ref(new Set());

const limit = pagination.limit;
const offset = ref(0);

const normalizeRows = (payload) => {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map((row) => ({
    id: row.id,
    courseId: row.courseId || row.course_id,
    groupId: row.groupId || row.group_id || null,
    createdByUserId: row.createdByUserId || row.created_by_user_id || null,
    createdByFullName: row.createdByFullName || row.created_by_full_name || null,
    title: row.title || '',
    body: row.body || '',
    createdAt: row.createdAt || row.created_at || null,
  }));
};

const fetchPosts = async (nextOffset = 0, { append = false } = {}) => {
  if (!props.courseId) return;
  if (append) {
    loadingMore.value = true;
  } else {
    loading.value = true;
  }

  try {
    const payload = await getCoursePosts(props.courseId, {
      limit: pagination.limit,
      offset: nextOffset,
    });
    const rows = normalizeRows(payload);
    items.value = append ? [...items.value, ...rows] : rows;
    pagination.offset = nextOffset;
    offset.value = nextOffset;
    total.value = Number(payload?.total || 0);
  } catch (err) {
    const detail = err?.response?.data?.error || 'Failed to load posts';
    toast.add({ severity: 'error', summary: 'Error', detail, life: 3200 });
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const getAuthorInitials = (post) => {
  const name = String(post?.createdByFullName || '').trim();
  if (!name) {
    const fallback = String(post?.createdByUserId || '').replace(/-/g, '');
    return fallback.slice(0, 2).toUpperCase() || '?';
  }
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]).join('').toUpperCase();
};

const getAuthorName = (post) => {
  const fullName = String(post?.createdByFullName || '').trim();
  if (fullName) {
    return fullName;
  }
  const userId = String(post?.createdByUserId || '').trim();
  if (!userId) {
    return 'Autor desconocido';
  }
  return `Usuario ${userId.slice(0, 8)}`;
};

const shouldShowToggle = (post) => String(post?.body || '').length > 200;

const renderBody = (post) => {
  const text = String(post?.body || '');
  if (expanded.value.has(post.id) || text.length <= 200) {
    return text;
  }
  return `${text.slice(0, 200)}...`;
};

const toggleExpanded = (postId) => {
  const next = new Set(expanded.value);
  if (next.has(postId)) {
    next.delete(postId);
  } else {
    next.add(postId);
  }
  expanded.value = next;
};

const changeOffset = async (nextOffset) => {
  await fetchPosts(nextOffset);
};

watch(
  () => props.courseId,
  async (nextId, previousId) => {
    if (!nextId || nextId === previousId) return;
    expanded.value = new Set();
    await fetchPosts(0);
  },
);

onMounted(async () => {
  await fetchPosts(0);
});
</script>

<style scoped>
.course-posts-feed {
  display: grid;
  gap: 0.8rem;
}

.feed-list {
  display: grid;
  gap: 0.75rem;
}

.post-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
}

.post-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.post-title-meta {
  display: grid;
  gap: 0.1rem;
}

.post-author {
  color: #64748b;
  font-weight: 500;
}

.author-avatar {
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  flex: 0 0 1.9rem;
}

.post-body {
  margin: 0 0 0.5rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.post-date {
  color: #64748b;
}

.feed-pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.empty-state {
  min-height: 200px;
  display: grid;
  place-content: center;
  color: #64748b;
}

.read-more-btn {
  padding: 0;
}
</style>

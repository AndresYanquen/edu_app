<template>
  <section class="forum-board">
    <div class="forum-toolbar">
      <div class="forum-toolbar-left">
        <Dropdown
          v-model="selectedForumId"
          :options="forumOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Selecciona un foro"
          :disabled="loadingForums || !forumOptions.length"
          class="forum-select"
        />
        <Button
          class="p-button-text"
          icon="pi pi-refresh"
          label="Recargar"
          :loading="loadingForums || loadingThreads"
          @click="reload"
        />
      </div>
      <Button
        v-if="selectedForumId"
        icon="pi pi-plus"
        label="Nuevo tema"
        @click="threadDialogVisible = true"
      />
    </div>

    <div v-if="loadingForums || loadingThreads" class="loading-state">
      <Skeleton height="4rem" class="mb-2" />
      <Skeleton height="4rem" class="mb-2" />
      <Skeleton height="4rem" />
    </div>

    <div v-else-if="!forums.length" class="empty-state">
      <i class="pi pi-comments" />
      <p>No hay foros disponibles.</p>
    </div>

    <div v-else-if="!threads.length" class="empty-state">
      <i class="pi pi-inbox" />
      <p>Este foro no tiene temas todavía.</p>
    </div>

    <div v-else class="threads-list">
      <article v-for="thread in threads" :key="thread.id" class="thread-card">
        <div class="thread-card-header">
          <div class="thread-title-wrap">
            <i v-if="thread.isPinned" class="pi pi-thumbtack" />
            <strong>{{ thread.title }}</strong>
          </div>
          <Tag v-if="thread.unread" value="Nuevo" severity="info" />
        </div>
        <p class="thread-body">{{ thread.body }}</p>
        <small class="thread-meta">
          {{ thread.authorName || 'Usuario' }} · {{ formatDateTime(thread.createdAt) }}
          · {{ thread.repliesCount }} respuestas
          <span v-if="isEdited(thread.createdAt, thread.updatedAt)">
            · editado {{ formatDateTime(thread.updatedAt) }}
          </span>
        </small>
        <div v-if="thread.reactionsSummary?.length" class="thread-reactions-summary">
          <Tag
            v-for="item in thread.reactionsSummary"
            :key="`${thread.id}-${item.type}`"
            :value="`${reactionLabel(item.type)} ${item.count}`"
            severity="secondary"
          />
        </div>

        <div class="thread-actions">
          <Button
            v-if="thread.repliesCount > 3"
            class="p-button-text p-button-sm"
            :label="inlineRepliesExpanded[thread.id] ? 'Ver menos' : 'Ver más'"
            @click="toggleInlineRepliesExpanded(thread.id)"
          />
          <Button
            class="p-button-text p-button-sm"
            icon="pi pi-comments"
            label="Comentar"
            @click="openThread(thread)"
          />
          <Button
            v-if="isThreadAuthor(thread)"
            class="p-button-text p-button-sm"
            icon="pi pi-pencil"
            label="Editar"
            @click="openThreadEdit(thread)"
          />
          <Dropdown
            :modelValue="thread.myReaction || null"
            :options="reactionOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Reaccionar"
            showClear
            class="reaction-dropdown"
            @update:modelValue="(value) => handleThreadReaction(thread, value)"
          />
        </div>

        <div class="inline-replies">
          <div v-if="inlineRepliesLoading[thread.id]" class="inline-replies-loading">
            <Skeleton height="2.2rem" class="mb-2" />
            <Skeleton height="2.2rem" />
          </div>

          <div v-else-if="inlineRepliesByThread[thread.id]?.length">
            <article
              v-for="post in getVisibleInlineReplies(thread.id)"
              :key="post.id"
              class="inline-reply-card"
            >
              <div class="inline-reply-head">
                <strong>{{ post.authorName || 'Usuario' }}</strong>
                <small>
                  {{ formatDateTime(post.createdAt) }}
                  <span v-if="isEdited(post.createdAt, post.updatedAt)">
                    · editado {{ formatDateTime(post.updatedAt) }}
                  </span>
                </small>
              </div>
              <p>{{ post.body }}</p>
              <div class="inline-reply-actions">
                <Button
                  v-if="isPostAuthor(post)"
                  class="p-button-text p-button-sm"
                  icon="pi pi-pencil"
                  label="Editar"
                  @click="openPostEdit(post)"
                />
              </div>
            </article>
          </div>

          <p v-else class="inline-empty">Sin respuestas todavía.</p>
        </div>
      </article>
    </div>

    <Dialog v-model:visible="threadDialogVisible" header="Nuevo tema" modal :style="{ width: '36rem' }">
      <div class="dialog-field">
        <label>Título</label>
        <InputText v-model="threadForm.title" placeholder="Escribe el título del tema" />
      </div>
      <div class="dialog-field">
        <label>Contenido</label>
        <Textarea v-model="threadForm.body" rows="5" placeholder="Escribe tu mensaje" />
      </div>
      <template #footer>
        <Button label="Cancelar" class="p-button-text" @click="threadDialogVisible = false" />
        <Button
          label="Publicar"
          icon="pi pi-check"
          :loading="creatingThread"
          @click="submitThread"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="threadDetailVisible"
      :header="activeThread?.title || 'Tema'"
      modal
      :style="{ width: '52rem' }"
    >
      <div v-if="loadingPosts" class="loading-state">
        <Skeleton height="3.5rem" class="mb-2" />
        <Skeleton height="3.5rem" class="mb-2" />
      </div>
      <div v-else class="posts-list">
        <article v-for="post in posts" :key="post.id" class="post-card">
          <div class="post-card-header">
            <strong>{{ post.authorName || 'Usuario' }}</strong>
            <small>
              {{ formatDateTime(post.createdAt) }}
              <span v-if="isEdited(post.createdAt, post.updatedAt)">
                · editado {{ formatDateTime(post.updatedAt) }}
              </span>
            </small>
          </div>
          <p>{{ post.body }}</p>
          <div class="inline-reply-actions">
            <Button
              v-if="isPostAuthor(post)"
              class="p-button-text p-button-sm"
              icon="pi pi-pencil"
              label="Editar"
              @click="openPostEdit(post)"
            />
          </div>
        </article>
      </div>

      <div class="reply-box">
        <label>Responder</label>
        <Textarea v-model="replyBody" rows="3" placeholder="Escribe una respuesta" />
      </div>
      <template #footer>
        <Button label="Cerrar" class="p-button-text" @click="threadDetailVisible = false" />
        <Button label="Enviar respuesta" :loading="creatingReply" @click="submitReply" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="threadEditDialogVisible"
      header="Editar publicación"
      modal
      :style="{ width: '36rem' }"
    >
      <div class="dialog-field">
        <label>Título</label>
        <InputText v-model="threadEditForm.title" placeholder="Edita el título del tema" />
      </div>
      <div class="dialog-field">
        <label>Contenido</label>
        <Textarea v-model="threadEditForm.body" rows="5" placeholder="Edita tu mensaje" />
      </div>
      <template #footer>
        <Button label="Cancelar" class="p-button-text" @click="threadEditDialogVisible = false" />
        <Button label="Guardar" icon="pi pi-check" :loading="savingThreadEdit" @click="saveThreadEdit" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="postEditDialogVisible"
      header="Editar comentario"
      modal
      :style="{ width: '34rem' }"
    >
      <div class="dialog-field">
        <label>Comentario</label>
        <Textarea v-model="postEditForm.body" rows="4" placeholder="Edita tu comentario" />
      </div>
      <template #footer>
        <Button label="Cancelar" class="p-button-text" @click="postEditDialogVisible = false" />
        <Button label="Guardar" icon="pi pi-check" :loading="savingPostEdit" @click="savePostEdit" />
      </template>
    </Dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import Textarea from 'primevue/textarea';
import { useAuthStore } from '../../stores/auth';
import {
  listForums,
  listForumThreads,
  createForumThread,
  updateThread,
  listThreadPosts,
  createThreadPost,
  updatePost,
  markThreadRead,
  setThreadReaction,
  clearThreadReaction,
} from '../../api/forums';

const props = defineProps({
  scope: {
    type: String,
    default: '',
  },
  scopes: {
    type: Array,
    default: () => [],
  },
  courseId: {
    type: String,
    default: '',
  },
  groupId: {
    type: String,
    default: '',
  },
});

const auth = useAuthStore();
const toast = useToast();
const loadingForums = ref(false);
const loadingThreads = ref(false);
const loadingPosts = ref(false);
const creatingThread = ref(false);
const creatingReply = ref(false);

const forums = ref([]);
const threads = ref([]);
const posts = ref([]);
const selectedForumId = ref('');
const activeThread = ref(null);
const threadDialogVisible = ref(false);
const threadDetailVisible = ref(false);
const replyBody = ref('');
const threadEditDialogVisible = ref(false);
const postEditDialogVisible = ref(false);
const savingThreadEdit = ref(false);
const savingPostEdit = ref(false);
const activeThreadEditId = ref('');
const activePostEditId = ref('');

const threadForm = ref({
  title: '',
  body: '',
});
const threadEditForm = ref({
  title: '',
  body: '',
});
const postEditForm = ref({
  body: '',
});
const inlineRepliesExpanded = ref({});
const inlineRepliesByThread = ref({});
const inlineRepliesLoading = ref({});
const reactionOptions = [
  { label: '👍 Me gusta', value: 'like' },
  { label: '❤️ Me encanta', value: 'love' },
  { label: '💡 Útil', value: 'insightful' },
  { label: '🎉 Genial', value: 'celebrate' },
  { label: '🤝 Apoyo', value: 'support' },
];
const currentUserId = computed(() => auth.user?.id || null);

const forumOptions = computed(() =>
  forums.value.map((forum) => ({
    label: forum.title,
    value: forum.id,
  })),
);

const buildForumsParams = () => {
  const params = {};
  if (props.scope && (!Array.isArray(props.scopes) || props.scopes.length <= 1)) {
    params.scope = props.scope;
  }
  if (Array.isArray(props.scopes) && props.scopes.length === 1) {
    params.scope = String(props.scopes[0] || '').trim();
  }
  if (props.courseId) params.courseId = props.courseId;
  if (props.groupId) params.groupId = props.groupId;
  return params;
};

const loadForums = async () => {
  loadingForums.value = true;
  try {
    const payload = await listForums(buildForumsParams());
    let items = Array.isArray(payload?.items) ? payload.items : [];
    if (Array.isArray(props.scopes) && props.scopes.length > 1) {
      const allowed = new Set(props.scopes.map((scope) => String(scope || '').trim()).filter(Boolean));
      items = items.filter((forum) => allowed.has(String(forum?.scope || '').trim()));
    }
    forums.value = items;
    if (!selectedForumId.value || !forums.value.some((forum) => forum.id === selectedForumId.value)) {
      selectedForumId.value = forums.value[0]?.id || '';
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'No se pudieron cargar los foros',
      life: 3200,
    });
  } finally {
    loadingForums.value = false;
  }
};

const loadThreads = async () => {
  if (!selectedForumId.value) {
    threads.value = [];
    return;
  }
  loadingThreads.value = true;
  try {
    const payload = await listForumThreads(selectedForumId.value);
    threads.value = Array.isArray(payload?.items) ? payload.items : [];
    const activeIds = new Set(threads.value.map((thread) => thread.id));
    inlineRepliesExpanded.value = Object.fromEntries(
      Object.entries(inlineRepliesExpanded.value).filter(([id]) => activeIds.has(id)),
    );
    inlineRepliesByThread.value = Object.fromEntries(
      Object.entries(inlineRepliesByThread.value).filter(([id]) => activeIds.has(id)),
    );
    inlineRepliesLoading.value = Object.fromEntries(
      Object.entries(inlineRepliesLoading.value).filter(([id]) => activeIds.has(id)),
    );
    await preloadInlineReplies();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'No se pudieron cargar los temas',
      life: 3200,
    });
  } finally {
    loadingThreads.value = false;
  }
};

const reload = async () => {
  await loadForums();
  await loadThreads();
};

const preloadInlineReplies = async () => {
  const toLoad = threads.value.filter(
    (thread) =>
      thread?.id &&
      Number(thread.repliesCount || 0) > 0 &&
      !inlineRepliesByThread.value[thread.id] &&
      !inlineRepliesLoading.value[thread.id],
  );
  if (!toLoad.length) return;

  await Promise.all(
    toLoad.map(async (thread) => {
      inlineRepliesLoading.value = {
        ...inlineRepliesLoading.value,
        [thread.id]: true,
      };
      try {
        const payload = await listThreadPosts(thread.id);
        inlineRepliesByThread.value = {
          ...inlineRepliesByThread.value,
          [thread.id]: Array.isArray(payload?.items) ? payload.items : [],
        };
      } catch (err) {
        inlineRepliesByThread.value = {
          ...inlineRepliesByThread.value,
          [thread.id]: [],
        };
      } finally {
        inlineRepliesLoading.value = {
          ...inlineRepliesLoading.value,
          [thread.id]: false,
        };
      }
    }),
  );
};

const getVisibleInlineReplies = (threadId) => {
  const all = inlineRepliesByThread.value[threadId] || [];
  if (inlineRepliesExpanded.value[threadId]) return all;
  return all.slice(0, 3);
};

const toggleInlineRepliesExpanded = (threadId) => {
  inlineRepliesExpanded.value = {
    ...inlineRepliesExpanded.value,
    [threadId]: !inlineRepliesExpanded.value[threadId],
  };
};

const reactionLabel = (type) => {
  const found = reactionOptions.find((option) => option.value === type);
  return found ? found.label.split(' ').slice(0, 1).join('') : type;
};

const isEdited = (createdAt, updatedAt) => {
  if (!createdAt || !updatedAt) return false;
  const created = new Date(createdAt);
  const updated = new Date(updatedAt);
  if (Number.isNaN(created.getTime()) || Number.isNaN(updated.getTime())) return false;
  return updated.getTime() - created.getTime() > 1000;
};

const isThreadAuthor = (thread) => Boolean(currentUserId.value && thread?.authorUserId === currentUserId.value);
const isPostAuthor = (post) => Boolean(currentUserId.value && post?.authorUserId === currentUserId.value);

const handleThreadReaction = async (thread, nextValue) => {
  if (!thread?.id) return;
  const previous = thread.myReaction || null;
  const value = nextValue || null;

  // Optimistic update
  thread.myReaction = value;
  const previousSummary = Array.isArray(thread.reactionsSummary)
    ? thread.reactionsSummary.map((item) => ({ ...item }))
    : [];
  const summaryMap = new Map(previousSummary.map((item) => [item.type, Number(item.count || 0)]));
  if (previous) {
    const prevCount = Number(summaryMap.get(previous) || 0) - 1;
    if (prevCount > 0) summaryMap.set(previous, prevCount);
    else summaryMap.delete(previous);
  }
  if (value) {
    summaryMap.set(value, Number(summaryMap.get(value) || 0) + 1);
  }
  thread.reactionsSummary = Array.from(summaryMap.entries()).map(([type, count]) => ({ type, count }));

  try {
    if (value) {
      await setThreadReaction(thread.id, { type: value });
    } else {
      await clearThreadReaction(thread.id);
    }
  } catch (err) {
    thread.myReaction = previous;
    thread.reactionsSummary = previousSummary;
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'No se pudo guardar la reacción',
      life: 3200,
    });
  }
};

const openThreadEdit = (thread) => {
  if (!isThreadAuthor(thread)) return;
  activeThreadEditId.value = thread.id;
  threadEditForm.value = {
    title: thread.title || '',
    body: thread.body || '',
  };
  threadEditDialogVisible.value = true;
};

const saveThreadEdit = async () => {
  const threadId = activeThreadEditId.value;
  const title = String(threadEditForm.value.title || '').trim();
  const body = String(threadEditForm.value.body || '').trim();
  if (!threadId || !title || !body) {
    toast.add({
      severity: 'warn',
      summary: 'Completa los campos',
      detail: 'El título y contenido son obligatorios.',
      life: 2600,
    });
    return;
  }

  savingThreadEdit.value = true;
  try {
    const payload = await updateThread(threadId, { title, body });
    threads.value = threads.value.map((thread) =>
      thread.id === threadId
        ? {
            ...thread,
            title,
            body,
            updatedAt: payload?.updatedAt || new Date().toISOString(),
          }
        : thread,
    );
    if (activeThread.value?.id === threadId) {
      activeThread.value = {
        ...activeThread.value,
        title,
        body,
        updatedAt: payload?.updatedAt || new Date().toISOString(),
      };
    }
    threadEditDialogVisible.value = false;
    toast.add({ severity: 'success', summary: 'Publicación editada', life: 2000 });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'No se pudo editar la publicación',
      life: 3200,
    });
  } finally {
    savingThreadEdit.value = false;
  }
};

const openPostEdit = (post) => {
  if (!isPostAuthor(post)) return;
  activePostEditId.value = post.id;
  postEditForm.value = { body: post.body || '' };
  postEditDialogVisible.value = true;
};

const savePostEdit = async () => {
  const postId = activePostEditId.value;
  const body = String(postEditForm.value.body || '').trim();
  if (!postId || !body) {
    toast.add({
      severity: 'warn',
      summary: 'Comentario vacío',
      detail: 'Debes escribir un comentario para guardar.',
      life: 2600,
    });
    return;
  }

  savingPostEdit.value = true;
  try {
    const updated = await updatePost(postId, { body });
    posts.value = posts.value.map((post) => (post.id === postId ? { ...post, ...updated } : post));
    inlineRepliesByThread.value = Object.fromEntries(
      Object.entries(inlineRepliesByThread.value).map(([threadId, items]) => [
        threadId,
        Array.isArray(items) ? items.map((item) => (item.id === postId ? { ...item, ...updated } : item)) : [],
      ]),
    );
    postEditDialogVisible.value = false;
    toast.add({ severity: 'success', summary: 'Comentario editado', life: 2000 });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'No se pudo editar el comentario',
      life: 3200,
    });
  } finally {
    savingPostEdit.value = false;
  }
};

const submitThread = async () => {
  const title = String(threadForm.value.title || '').trim();
  const body = String(threadForm.value.body || '').trim();
  if (!selectedForumId.value) {
    toast.add({
      severity: 'warn',
      summary: 'Foro no disponible',
      detail: 'Selecciona un foro antes de publicar.',
      life: 2600,
    });
    return;
  }
  if (!title || !body) {
    toast.add({
      severity: 'warn',
      summary: 'Completa los campos',
      detail: 'Debes ingresar título y contenido para publicar.',
      life: 2600,
    });
    return;
  }

  creatingThread.value = true;
  try {
    await createForumThread(selectedForumId.value, { title, body });
    threadDialogVisible.value = false;
    threadForm.value = { title: '', body: '' };
    await loadThreads();
    toast.add({ severity: 'success', summary: 'Tema publicado', life: 2000 });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'No se pudo publicar el tema',
      life: 3200,
    });
  } finally {
    creatingThread.value = false;
  }
};

const openThread = async (thread) => {
  if (!thread?.id) return;
  activeThread.value = thread;
  threadDetailVisible.value = true;
  loadingPosts.value = true;
  try {
    await markThreadRead(thread.id);
    const payload = await listThreadPosts(thread.id);
    posts.value = Array.isArray(payload?.items) ? payload.items : [];
    await loadThreads();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'No se pudo abrir el tema',
      life: 3200,
    });
  } finally {
    loadingPosts.value = false;
  }
};

const submitReply = async () => {
  const body = String(replyBody.value || '').trim();
  if (!activeThread.value?.id || !body) return;
  creatingReply.value = true;
  try {
    await createThreadPost(activeThread.value.id, { body });
    replyBody.value = '';
    const payload = await listThreadPosts(activeThread.value.id);
    posts.value = Array.isArray(payload?.items) ? payload.items : [];
    await loadThreads();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'No se pudo publicar la respuesta',
      life: 3200,
    });
  } finally {
    creatingReply.value = false;
  }
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
};

watch(
  () => selectedForumId.value,
  async () => {
    await loadThreads();
  },
);

watch(
  () => [props.scope, props.courseId, props.groupId],
  async () => {
    await reload();
  },
);

onMounted(async () => {
  await reload();
});
</script>

<style scoped>
.forum-board {
  display: grid;
  gap: 0.8rem;
}

.forum-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
}

.forum-toolbar-left {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.forum-select {
  min-width: 240px;
}

.threads-list {
  display: grid;
  gap: 0.7rem;
}

.thread-card {
  border: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  border-radius: 14px;
  padding: 0.85rem;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
}

.thread-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 12px 26px rgba(37, 99, 235, 0.1);
}

.thread-card-header {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: center;
}

.thread-title-wrap {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}

.thread-body {
  margin: 0.5rem 0;
  color: #334155;
  line-height: 1.45;
}

.thread-meta {
  color: #64748b;
}

.thread-actions {
  margin-top: 0.55rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.thread-reactions-summary {
  margin-top: 0.45rem;
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.reaction-dropdown {
  min-width: 11rem;
}

.reaction-dropdown :deep(.p-dropdown-label) {
  color: #1d4ed8;
  font-weight: 600;
  font-size: 0.875rem;
}

.inline-replies {
  margin-top: 0.6rem;
  border-top: 1px solid #dbe7f5;
  padding-top: 0.65rem;
  display: grid;
  gap: 0.45rem;
}

.inline-reply-card {
  border: 1px solid #dde7f3;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.65rem 0.72rem;
}

.inline-reply-head {
  display: flex;
  justify-content: space-between;
  gap: 0.4rem;
  margin-bottom: 0.3rem;
}

.inline-reply-card p {
  margin: 0;
  color: #334155;
  line-height: 1.45;
}

.inline-reply-actions {
  margin-top: 0.35rem;
  display: flex;
  gap: 0.35rem;
  justify-content: flex-end;
}

.inline-empty {
  margin: 0;
  color: #64748b;
}

.posts-list {
  display: grid;
  gap: 0.6rem;
  margin-bottom: 0.65rem;
}

.post-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.65rem;
}

.post-card-header {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.reply-box {
  display: grid;
  gap: 0.4rem;
}

.dialog-field {
  display: grid;
  gap: 0.35rem;
  margin-bottom: 0.8rem;
}

.empty-state {
  min-height: 160px;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  display: grid;
  place-content: center;
  text-align: center;
  color: #64748b;
  gap: 0.35rem;
}
</style>

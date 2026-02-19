<template>
  <section class="notifications-panel">
    <header class="panel-header">
      <h3>Notificaciones</h3>
      <Button
        label="Marcar todo como leído"
        class="p-button-sm p-button-text"
        :disabled="markingAll || !unreadCount"
        @click="handleMarkAllRead"
      />
    </header>

    <div v-if="loadingInitial" class="loading-state">
      <div v-for="n in 5" :key="n" class="skeleton-item">
        <Skeleton width="100%" height="5rem" borderRadius="12px" />
      </div>
    </div>

    <div v-else-if="!items.length" class="empty-state">
      <i class="pi pi-check-circle" />
      <p>No tienes notificaciones por ahora 🎉</p>
    </div>

    <div v-else class="notifications-list">
      <article
        v-for="item in items"
        :key="item.id"
        class="notification-card"
        :class="{ unread: !item.isRead }"
        @click="handleCardClick(item)"
      >
        <div class="left-col">
          <span v-if="!item.isRead" class="unread-dot" />
        </div>

        <div class="content-col">
          <div class="card-top">
            <strong>{{ item.title }}</strong>
            <span v-if="item.priority === 1" class="urgent-pill">Urgente</span>
          </div>
          <p class="body-preview">{{ item.body }}</p>
          <small class="meta">
            {{ formatDate(item.createdAt) }} · {{ scopeLabel(item.scope) }}
          </small>
        </div>

        <div class="right-col">
          <i class="pi pi-chevron-right" />
        </div>
      </article>

      <div class="load-more" v-if="hasMore">
        <Button
          label="Ver más"
          class="p-button-text"
          :loading="loadingMore"
          @click="loadMore"
        />
      </div>
    </div>

    <AnnouncementDetailDialog
      v-model:visible="detailVisible"
      :announcement="selectedAnnouncement"
      @marked-read="handleMarkedRead"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import AnnouncementDetailDialog from './AnnouncementDetailDialog.vue'
import {
  listAnnouncementNotifications,
  markAllAnnouncementsRead,
  getUnreadAnnouncementCount,
} from '../../api/notifications'

const emit = defineEmits(['unread-change', 'open'])
const toast = useToast()

const pageSize = 20
const page = ref(1)
const items = ref([])
const hasMore = ref(false)
const loadingInitial = ref(true)
const loadingMore = ref(false)
const markingAll = ref(false)
const detailVisible = ref(false)
const selectedAnnouncement = ref(null)

const unreadCount = computed(() => items.value.filter((item) => !item.isRead).length)

const normalizeAnnouncement = (row = {}) => {
  let isRead = false
  if (typeof row.isRead === 'boolean') {
    isRead = row.isRead
  } else if (typeof row.is_read === 'boolean') {
    isRead = row.is_read
  } else if (row.readAt || row.read_at) {
    isRead = true
  }

  return {
    id: row.id,
    scope: row.scope,
    title: row.title || '',
    body: row.body || '',
    createdAt: row.createdAt || row.created_at || null,
    priority: Number(row.priority || 2),
    status: row.status || 'published',
    startsAt: row.startsAt || row.starts_at || null,
    expiresAt: row.expiresAt || row.expires_at || null,
    isRead,
    readAt: row.readAt || row.read_at || null,
    courseId: row.courseId || row.course_id || null,
    groupId: row.groupId || row.group_id || null,
  }
}

const emitUnread = (count = unreadCount.value) => {
  emit('unread-change', count)
}

const fetchUnreadCount = async () => {
  try {
    const data = await getUnreadAnnouncementCount()
    if (typeof data?.count === 'number') {
      emitUnread(data.count)
    }
  } catch (err) {
    // Keep panel functional if unread-count request fails.
  }
}

const fetchPage = async (targetPage = 1) => {
  const isFirst = targetPage === 1
  if (isFirst) {
    loadingInitial.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const payload = await listAnnouncementNotifications({
      page: targetPage,
      pageSize,
    })

    const incoming = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : []

    const normalized = incoming.map(normalizeAnnouncement)

    if (isFirst) {
      items.value = normalized
    } else {
      items.value = [...items.value, ...normalized]
    }

    hasMore.value = normalized.length === pageSize
    page.value = targetPage

    if (isFirst) {
      await fetchUnreadCount()
    } else {
      emitUnread()
    }
  } finally {
    loadingInitial.value = false
    loadingMore.value = false
  }
}

const loadMore = async () => {
  if (!hasMore.value || loadingMore.value) return
  await fetchPage(page.value + 1)
}

const handleMarkAllRead = async () => {
  if (markingAll.value || !items.value.length) return
  markingAll.value = true

  const previous = items.value.map((item) => ({ ...item }))
  items.value = items.value.map((item) => ({ ...item, isRead: true, readAt: item.readAt || new Date().toISOString() }))
  if (selectedAnnouncement.value?.id) {
    selectedAnnouncement.value = {
      ...selectedAnnouncement.value,
      isRead: true,
      readAt: selectedAnnouncement.value.readAt || new Date().toISOString(),
    }
  }
  emitUnread(0)

  try {
    await markAllAnnouncementsRead()
    toast.add({
      severity: 'success',
      summary: 'Listo',
      detail: 'Todas las notificaciones se marcaron como leídas',
      life: 2200,
    })
  } catch (err) {
    items.value = previous
    emitUnread()
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'No se pudieron marcar todas como leídas',
      life: 3200,
    })
  } finally {
    markingAll.value = false
  }
}

const handleCardClick = (item) => {
  selectedAnnouncement.value = item
  detailVisible.value = true
  emit('open', item)
}

const handleMarkedRead = (announcementId) => {
  if (!announcementId) return
  const target = items.value.find((item) => item.id === announcementId)
  if (!target || target.isRead) return
  target.isRead = true
  target.readAt = target.readAt || new Date().toISOString()
  if (selectedAnnouncement.value?.id === announcementId) {
    selectedAnnouncement.value = { ...target }
  }
  emitUnread()
}

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

const scopeLabel = (scope) => {
  if (scope === 'course') return 'Course'
  if (scope === 'group') return 'Group'
  return 'Academy'
}

onMounted(async () => {
  await fetchPage(1)
})
</script>

<style scoped>
.notifications-panel {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  min-height: 100%;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 2;
  padding-bottom: 0.35rem;
}

.panel-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.loading-state,
.notifications-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.notification-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.75rem;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.6rem;
  background: #ffffff;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.notification-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.08);
}

.notification-card.unread {
  background: #f8fbff;
}

.left-col {
  padding-top: 0.2rem;
}

.unread-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #2563eb;
}

.card-top {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
}

.card-top strong {
  font-size: 0.95rem;
}

.urgent-pill {
  font-size: 0.65rem;
  text-transform: uppercase;
  font-weight: 700;
  color: #b91c1c;
  background: #fee2e2;
  border-radius: 999px;
  padding: 0.2rem 0.45rem;
  white-space: nowrap;
}

.body-preview {
  margin: 0.35rem 0;
  color: #475569;
  font-size: 0.9rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta {
  color: #64748b;
}

.right-col {
  color: #94a3b8;
  display: flex;
  align-items: center;
}

.empty-state {
  min-height: 260px;
  display: grid;
  place-content: center;
  gap: 0.5rem;
  color: #64748b;
  text-align: center;
}

.empty-state .pi {
  font-size: 1.4rem;
  color: #22c55e;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0;
}
</style>

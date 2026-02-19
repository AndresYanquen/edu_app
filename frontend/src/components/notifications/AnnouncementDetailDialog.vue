<template>
  <Dialog
    :visible="visible"
    modal
    :style="{ width: '42rem', maxWidth: '96vw' }"
    :contentStyle="{ maxHeight: '70vh', overflowY: 'auto' }"
    @update:visible="(value) => emit('update:visible', value)"
  >
    <template #header>
      <div class="dialog-header">
        <div class="title-block">
          <strong>{{ safeTitle }}</strong>
          <Tag v-if="isUnread" value="No leída" severity="warning" />
        </div>
      </div>
    </template>

    <div class="meta-row">
      <small>{{ createdLabel }}</small>
      <Tag :value="priorityLabel" :severity="prioritySeverity" />
      <Tag v-if="announcement?.status" :value="announcement.status" severity="info" />
    </div>

    <div v-if="visibleWindowLabel" class="visible-window">
      <small>{{ visibleWindowLabel }}</small>
    </div>

    <pre class="announcement-body">{{ safeBody }}</pre>

    <template #footer>
      <Button
        label="Cerrar"
        class="p-button-text"
        :disabled="markingRead"
        @click="emit('update:visible', false)"
      />
      <Button
        v-if="isUnread"
        label="Marcar como leída"
        icon="pi pi-check"
        :loading="markingRead"
        @click="markRead"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import { markAnnouncementRead } from '../../api/notifications'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  announcement: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:visible', 'marked-read'])
const toast = useToast()
const markingRead = ref(false)
const processedIds = new Set()
const inFlightIds = new Set()

const isUnread = computed(() => {
  const id = props.announcement?.id
  if (!id) return false
  if (processedIds.has(id)) return false
  return !Boolean(props.announcement?.isRead || props.announcement?.is_read)
})

const safeTitle = computed(() => props.announcement?.title || 'Notificación')
const safeBody = computed(() => props.announcement?.body || '')

const createdLabel = computed(() => {
  const value = props.announcement?.createdAt || props.announcement?.created_at
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
})

const priorityLabel = computed(() => {
  const priority = Number(props.announcement?.priority || 2)
  if (priority === 1) return 'Alta'
  if (priority === 3) return 'Baja'
  return 'Normal'
})

const prioritySeverity = computed(() => {
  const priority = Number(props.announcement?.priority || 2)
  if (priority === 1) return 'danger'
  if (priority === 3) return 'success'
  return 'warning'
})

const visibleWindowLabel = computed(() => {
  const startsAt = props.announcement?.startsAt || props.announcement?.starts_at
  const expiresAt = props.announcement?.expiresAt || props.announcement?.expires_at

  const format = (value) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  }

  const startLabel = format(startsAt)
  const endLabel = format(expiresAt)

  if (startLabel && endLabel) return `Visible: ${startLabel} - ${endLabel}`
  if (startLabel) return `Visible desde: ${startLabel}`
  if (endLabel) return `Visible hasta: ${endLabel}`
  return ''
})

const markRead = async () => {
  const id = props.announcement?.id
  if (!id || !isUnread.value) return
  if (inFlightIds.has(id)) return

  markingRead.value = true
  inFlightIds.add(id)
  try {
    await markAnnouncementRead(id)
    processedIds.add(id)
    emit('marked-read', id)
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err?.response?.data?.error || 'No se pudo marcar como leída',
      life: 3200,
    })
  } finally {
    inFlightIds.delete(id)
    markingRead.value = false
  }
}

watch(
  () => [props.visible, props.announcement?.id],
  async ([visible]) => {
    if (!visible || !props.announcement?.id) return
    if (!isUnread.value) return
    await markRead()
  },
  { immediate: false },
)
</script>

<style scoped>
.dialog-header {
  width: 100%;
}

.title-block {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.title-block strong {
  font-size: 1.05rem;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.visible-window {
  margin-bottom: 0.75rem;
  color: #475569;
}

.announcement-body {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.45;
  color: #0f172a;
}
</style>

<template>
  <Dialog
    v-model:visible="confirmDeleteVisible"
    header="Confirm deletion"
    modal
    :style="{ width: '28rem' }"
    :closable="!confirmDeleteLoading"
  >
    <p class="confirm-message" v-if="announcementPendingDelete">
      Are you sure you want to delete “{{ announcementPendingDelete.title }}”?
    </p>
    <template #footer>
      <Button
        label="Cancel"
        class="p-button-text"
        :disabled="confirmDeleteLoading"
        @click="closeDeleteDialog"
      />
      <Button
        label="Delete announcement"
        severity="danger"
        :loading="confirmDeleteLoading"
        :disabled="confirmDeleteLoading"
        @click="confirmDeleteAnnouncement"
      />
    </template>
  </Dialog>

  <Card class="announcements-card">
    <template #title>
      <div class="section-header">
        <div>
          <div class="section-title">Announcements</div>
          <small class="muted">Create and manage course announcements</small>
        </div>
        <Button label="New announcement" icon="pi pi-plus" @click="openCreate" />
      </div>
    </template>

    <template #content>
      <div class="announcement-filters">
        <div class="filter-field">
          <label>Status</label>
          <Dropdown
            v-model="filters.status"
            :options="statusOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="All"
          />
        </div>

        <div class="filter-field">
          <label>Priority</label>
          <Dropdown
            v-model="filters.priority"
            :options="priorityOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="All"
          />
        </div>

        <div class="filter-field">
          <label>Visible from</label>
          <Calendar
            v-model="filters.visibleFrom"
            showTime
            dateFormat="yy-mm-dd"
            hourFormat="24"
            showIcon
          />
        </div>

        <div class="filter-field">
          <label>Visible to</label>
          <Calendar
            v-model="filters.visibleTo"
            showTime
            dateFormat="yy-mm-dd"
            hourFormat="24"
            showIcon
          />
        </div>

        <div class="filter-field filter-actions">
          <Button label="Clear" class="p-button-text" @click="clearFilters" />
        </div>
      </div>

      <div v-if="loading">
        <Skeleton height="2.8rem" class="mb-2" />
        <Skeleton height="2.8rem" class="mb-2" />
        <Skeleton height="2.8rem" />
      </div>

      <div v-else-if="!filteredItems.length" class="empty-state">
        No announcements found for this course.
      </div>

      <DataTable
        v-else
        :value="filteredItems"
        responsiveLayout="scroll"
        :paginator="true"
        :rows="pageSize"
        :totalRecords="total"
        :first="(page - 1) * pageSize"
        :rowsPerPageOptions="[10, 20, 50, 100]"
        lazy
        @page="onPage"
      >
        <Column field="title" header="Title" />

        <Column header="Scope">
          <template #body="{ data }">
            <Tag :value="data.scope" severity="info" />
          </template>
        </Column>

        <Column header="Status">
          <template #body="{ data }">
            <Tag :value="data.status" :severity="statusSeverity(data.status)" />
          </template>
        </Column>

        <Column header="Priority">
          <template #body="{ data }">
            <Tag :value="priorityLabel(data.priority)" :severity="prioritySeverity(data.priority)" />
          </template>
        </Column>

        <Column header="Visible">
          <template #body="{ data }">
            <div class="visible-cell">
              <small>From: {{ formatDateTime(data.startsAt) || '-' }}</small>
              <small>To: {{ formatDateTime(data.expiresAt) || '-' }}</small>
            </div>
          </template>
        </Column>

        <Column header="Created">
          <template #body="{ data }">
            {{ formatDateTime(data.createdAt) }}
          </template>
        </Column>

        <Column header="Actions" body-style="min-width: 6rem; text-align:right">
          <template #body="{ data }">
            <Button icon="pi pi-pencil" class="p-button-text" @click="openEdit(data)" />
            <Button
              icon="pi pi-trash"
              class="p-button-text p-button-danger"
              severity="danger"
              :loading="deletingAnnouncementId === data.id"
              :disabled="deletingAnnouncementId === data.id"
              @click="removeAnnouncement(data)"
            />
          </template>
        </Column>
      </DataTable>
    </template>
  </Card>

  <AnnouncementFormDialog
    v-model:visible="dialogVisible"
    :mode="dialogMode"
    :course-id="courseId"
    :initial="editingAnnouncement"
    :groups="normalizedGroups"
    :groups-loading="loadingAnnouncementGroups"
    @saved="handleSaved"
  />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { deleteAnnouncement, getCmsAnnouncements } from '../../../api/cms'
import { listCourseGroups } from '../../../api/groups'
import AnnouncementFormDialog from './AnnouncementFormDialog.vue'

const props = defineProps({
  courseId: {
    type: String,
    required: true,
  },
  groups: {
    type: Array,
    default: () => [],
  },
})

const toast = useToast()
const loading = ref(false)
const items = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const filterTimer = ref(null)
const groupsForAnnouncements = ref([])
const loadingAnnouncementGroups = ref(false)

const filters = reactive({
  status: null,
  priority: null,
  visibleFrom: null,
  visibleTo: null,
})

const dialogVisible = ref(false)
const dialogMode = ref('create')
const editingAnnouncement = ref(null)
const deletingAnnouncementId = ref(null)
const confirmDeleteVisible = ref(false)
const confirmDeleteLoading = ref(false)
const announcementPendingDelete = ref(null)

const statusOptions = [
  { label: 'All', value: null },
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
]

const priorityOptions = [
  { label: 'All', value: null },
  { label: '1 (High)', value: 1 },
  { label: '2 (Normal)', value: 2 },
  { label: '3 (Low)', value: 3 },
]

const toIso = (value) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const normalizeItems = (payload) => {
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.items)
      ? payload.items
      : []

  return rows.map((item) => ({
    id: item.id,
    scope: item.scope,
    title: item.title,
    body: item.body,
    status: item.status,
    priority: Number(item.priority || 2),
    startsAt: item.startsAt || item.starts_at || null,
    expiresAt: item.expiresAt || item.expires_at || null,
    createdAt: item.createdAt || item.created_at || null,
    updatedAt: item.updatedAt || item.updated_at || null,
  }))
}

const filteredItems = computed(() => {
  const from = filters.visibleFrom ? new Date(filters.visibleFrom) : null
  const to = filters.visibleTo ? new Date(filters.visibleTo) : null

  // TODO: move visible range filtering to backend once startsAtFrom/startsAtTo are supported server-side.
  return items.value.filter((item) => {
    if (filters.priority && Number(item.priority) !== Number(filters.priority)) {
      return false
    }

    if (from && item.startsAt) {
      const itemStarts = new Date(item.startsAt)
      if (itemStarts < from) {
        return false
      }
    }

    if (to && item.expiresAt) {
      const itemExpires = new Date(item.expiresAt)
      if (itemExpires > to) {
        return false
      }
    }

    return true
  })
})

const normalizedGroups = computed(() => {
  const source = props.groups?.length ? props.groups : groupsForAnnouncements.value
  return (source || []).map((group) => ({
    id: group.id,
    name: group.name,
    scheduleText: group.scheduleText || group.schedule_text || null,
    status: group.status || null,
  }))
})

const ensureGroupsLoaded = async () => {
  if (props.groups?.length) return
  if (groupsForAnnouncements.value?.length) return

  loadingAnnouncementGroups.value = true
  try {
    const rows = await listCourseGroups(props.courseId)
    groupsForAnnouncements.value = Array.isArray(rows) ? rows : []
  } catch (err) {
    const detail = err?.response?.data?.error || 'Failed to load groups'
    toast.add({ severity: 'warn', summary: 'Warning', detail, life: 3000 })
  } finally {
    loadingAnnouncementGroups.value = false
  }
}

const fetchAnnouncements = async () => {
  if (!props.courseId) return
  loading.value = true

  try {
    const payload = await getCmsAnnouncements({
      courseId: props.courseId,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      startsAtFrom: toIso(filters.visibleFrom) || undefined,
      startsAtTo: toIso(filters.visibleTo) || undefined,
      page: page.value,
      pageSize: pageSize.value,
    })

    items.value = normalizeItems(payload)
    total.value = Number(payload?.total || items.value.length)
  } catch (err) {
    const detail = err?.response?.data?.error || 'Failed to load announcements'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 3500 })
  } finally {
    loading.value = false
  }
}

const onPage = async (event) => {
  page.value = Math.floor(event.first / event.rows) + 1
  pageSize.value = event.rows
  await fetchAnnouncements()
}

const clearFilters = async () => {
  filters.status = null
  filters.priority = null
  filters.visibleFrom = null
  filters.visibleTo = null
  page.value = 1
  await fetchAnnouncements()
}

const openCreate = async () => {
  await ensureGroupsLoaded()
  dialogMode.value = 'create'
  editingAnnouncement.value = null
  dialogVisible.value = true
}

const openEdit = async (announcement) => {
  await ensureGroupsLoaded()
  dialogMode.value = 'edit'
  editingAnnouncement.value = { ...announcement }
  dialogVisible.value = true
}

const handleSaved = async () => {
  await fetchAnnouncements()
}

const closeDeleteDialog = (force = false) => {
  if (confirmDeleteLoading.value && !force) return
  confirmDeleteVisible.value = false
  announcementPendingDelete.value = null
}

const removeAnnouncement = async (announcement) => {
  if (!announcement?.id) return
  if (confirmDeleteVisible.value) return
  announcementPendingDelete.value = announcement
  confirmDeleteVisible.value = true
}

const confirmDeleteAnnouncement = async () => {
  if (!announcementPendingDelete.value?.id) return
  confirmDeleteLoading.value = true
  deletingAnnouncementId.value = announcementPendingDelete.value.id
  try {
    await deleteAnnouncement(announcementPendingDelete.value.id)
    toast.add({ severity: 'success', summary: 'Deleted', detail: 'Announcement deleted', life: 2200 })
    await fetchAnnouncements()
    closeDeleteDialog(true)
  } catch (err) {
    const detail = err?.response?.data?.error || 'Failed to delete announcement'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 3500 })
  } finally {
    confirmDeleteLoading.value = false
    deletingAnnouncementId.value = null
  }
}

const statusSeverity = (status) => {
  if (status === 'published') return 'success'
  if (status === 'archived') return 'warning'
  return 'contrast'
}

const prioritySeverity = (priority) => {
  if (Number(priority) === 1) return 'danger'
  if (Number(priority) === 3) return 'warning'
  return 'info'
}

const priorityLabel = (priority) => {
  if (Number(priority) === 1) return '1 (High)'
  if (Number(priority) === 3) return '3 (Low)'
  return '2 (Normal)'
}

const formatDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

watch(
  () => [filters.status, filters.priority, filters.visibleFrom, filters.visibleTo],
  () => {
    if (filterTimer.value) {
      clearTimeout(filterTimer.value)
    }
    filterTimer.value = setTimeout(async () => {
      page.value = 1
      await fetchAnnouncements()
    }, 250)
  },
)

onMounted(async () => {
  await fetchAnnouncements()
})

onBeforeUnmount(() => {
  if (filterTimer.value) {
    clearTimeout(filterTimer.value)
    filterTimer.value = null
  }
})
</script>

<style scoped>
.announcement-filters {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}

.filter-field {
  display: grid;
  gap: 0.35rem;
}

.filter-actions {
  align-content: end;
}

.visible-cell {
  display: grid;
  gap: 0.15rem;
}

@media (max-width: 1200px) {
  .announcement-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .announcement-filters {
    grid-template-columns: 1fr;
  }
}
</style>

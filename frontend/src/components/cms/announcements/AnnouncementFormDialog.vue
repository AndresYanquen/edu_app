<template>
  <Dialog
    :visible="visible"
    :header="mode === 'edit' ? 'Edit announcement' : 'New announcement'"
    modal
    :style="{ width: '40rem', maxWidth: '96vw' }"
    @update:visible="(value) => emit('update:visible', value)"
  >
    <div class="announcement-form-grid">
      <div class="dialog-field">
        <label>Audiencia</label>
        <div class="audience-row">
          <div class="audience-item">
            <RadioButton v-model="audience" inputId="audience-course" value="course" />
            <label for="audience-course">Curso completo</label>
          </div>
          <div class="audience-item">
            <RadioButton v-model="audience" inputId="audience-group" value="group" />
            <label for="audience-group">Grupo específico</label>
          </div>
        </div>
      </div>

      <div class="dialog-field" v-if="audience === 'group'">
        <label>Grupo</label>
        <Dropdown
          v-model="selectedGroupId"
          :options="groupOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Selecciona un grupo"
          showClear
          :loading="groupsLoading"
          :disabled="groupsLoading"
        />
      </div>

      <div class="dialog-field">
        <label>Título</label>
        <InputText v-model="form.title" placeholder="Título del anuncio" />
      </div>

      <div class="dialog-field">
        <label>Mensaje</label>
        <textarea
          v-model="form.body"
          class="announcement-body"
          rows="6"
          placeholder="Escribe el contenido del anuncio"
        />
      </div>

      <div class="dialog-field dialog-field-half">
        <label>Status</label>
        <Dropdown
          v-model="form.status"
          :options="statusOptions"
          optionLabel="label"
          optionValue="value"
        />
      </div>

      <div class="dialog-field dialog-field-half">
        <label>Priority</label>
        <Dropdown
          v-model="form.priority"
          :options="priorityOptions"
          optionLabel="label"
          optionValue="value"
        />
      </div>

      <div class="dialog-field dialog-field-half">
        <label>Visible from</label>
        <Calendar
          v-model="form.startsAt"
          showTime
          showSeconds
          dateFormat="yy-mm-dd"
          hourFormat="24"
          showIcon
        />
      </div>

      <div class="dialog-field dialog-field-half">
        <label>Visible to</label>
        <Calendar
          v-model="form.expiresAt"
          showTime
          showSeconds
          dateFormat="yy-mm-dd"
          hourFormat="24"
          showIcon
        />
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" class="p-button-text" :disabled="saving" @click="close" />
      <Button
        :label="mode === 'edit' ? 'Save changes' : 'Create announcement'"
        :loading="saving"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { createAnnouncement, updateAnnouncement } from '../../../api/cms'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    default: 'create',
  },
  courseId: {
    type: String,
    required: true,
  },
  groups: {
    type: Array,
    default: () => [],
  },
  groupsLoading: {
    type: Boolean,
    default: false,
  },
  initial: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:visible', 'saved'])
const toast = useToast()
const saving = ref(false)
const audience = ref('course')
const selectedGroupId = ref(null)

const statusOptions = [
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
]

const priorityOptions = [
  { label: '1 (High)', value: 1 },
  { label: '2 (Normal)', value: 2 },
  { label: '3 (Low)', value: 3 },
]

const makeInitialForm = (announcement = null) => ({
  title: announcement?.title || '',
  body: announcement?.body || '',
  status: announcement?.status || 'published',
  priority: Number(announcement?.priority || 2),
  startsAt: announcement?.startsAt ? new Date(announcement.startsAt) : null,
  expiresAt: announcement?.expiresAt ? new Date(announcement.expiresAt) : null,
})

const form = reactive(makeInitialForm())
const groupOptions = computed(() =>
  (props.groups || []).map((group) => ({
    label: group.scheduleText ? `${group.name} (${group.scheduleText})` : group.name,
    value: group.id,
  }))
)

const resetForm = () => {
  Object.assign(form, makeInitialForm(props.mode === 'edit' ? props.initial : null))

  if (props.mode === 'edit' && props.initial?.scope === 'group' && props.initial?.groupId) {
    audience.value = 'group'
    selectedGroupId.value = props.initial.groupId
  } else {
    audience.value = 'course'
    selectedGroupId.value = null
  }
}

watch(
  () => [props.visible, props.mode, props.initial],
  () => {
    if (props.visible) {
      resetForm()
    }
  },
  { deep: true },
)

watch(audience, (next) => {
  if (next === 'course') {
    selectedGroupId.value = null
  }
})

const close = () => {
  emit('update:visible', false)
}

const toIsoOrNull = (value) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const submit = async () => {
  if (!form.title || form.title.trim().length < 3) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Title must be at least 3 chars', life: 2500 })
    return
  }
  if (!form.body || !form.body.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Body is required', life: 2500 })
    return
  }
  if (audience.value === 'group' && !selectedGroupId.value) {
    toast.add({ severity: 'warn', summary: 'Validación', detail: 'Selecciona un grupo', life: 2500 })
    return
  }

  const startsAtIso = toIsoOrNull(form.startsAt)
  const expiresAtIso = toIsoOrNull(form.expiresAt)
  if (startsAtIso && expiresAtIso && new Date(expiresAtIso) <= new Date(startsAtIso)) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Visible to must be later than visible from', life: 3000 })
    return
  }

  const payload = {
    title: form.title.trim(),
    body: form.body.trim(),
    status: form.status,
    priority: Number(form.priority),
    startsAt: startsAtIso,
    expiresAt: expiresAtIso,
  }

  saving.value = true
  try {
    if (props.mode === 'edit' && props.initial?.id) {
      await updateAnnouncement(props.initial.id, payload)
      toast.add({ severity: 'success', summary: 'Saved', detail: 'Announcement updated', life: 2200 })
    } else {
      await createAnnouncement({
        ...payload,
        scope: audience.value === 'group' ? 'group' : 'course',
        courseId: audience.value === 'course' ? props.courseId : null,
        groupId: audience.value === 'group' ? selectedGroupId.value : null,
      })
      toast.add({ severity: 'success', summary: 'Created', detail: 'Announcement created', life: 2200 })
    }

    emit('saved')
    close()
  } catch (err) {
    const detail = err?.response?.data?.error || 'Unable to save announcement'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 3500 })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.announcement-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
}

.dialog-field {
  display: grid;
  gap: 0.35rem;
  grid-column: span 2;
}

.dialog-field-half {
  grid-column: span 1;
}

.audience-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.audience-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.announcement-body {
  width: 100%;
  resize: vertical;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  font: inherit;
}

@media (max-width: 900px) {
  .announcement-form-grid {
    grid-template-columns: 1fr;
  }

  .dialog-field-half {
    grid-column: span 2;
  }
}
</style>

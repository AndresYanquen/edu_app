<template>
  <OverlayPanel ref="panelRef" :dismissable="true" appendTo="body" class="attendance-cell-editor-panel">
    <div class="cell-editor">
      <div class="status-radio-list" role="radiogroup" aria-label="Estado de asistencia">
        <label v-for="opt in options" :key="opt.value" class="status-radio-item">
          <RadioButton v-model="form.status" :inputId="`att-${uid}-${opt.value}`" :value="opt.value" />
          <span>{{ opt.label }}</span>
        </label>
      </div>
      <div class="note-field">
        <label :for="`att-note-${uid}`">Nota</label>
        <InputText :id="`att-note-${uid}`" v-model="form.note" placeholder="Opcional" />
      </div>
      <div class="editor-actions">
        <Button label="Cancelar" class="p-button-text" :disabled="saving" @click="hide" />
        <Button label="Guardar" icon="pi pi-save" :loading="saving" @click="submit" />
      </div>
    </div>
  </OverlayPanel>
</template>

<script setup>
import { ref } from 'vue';
import OverlayPanel from 'primevue/overlaypanel';

const emit = defineEmits(['save']);
const uid = Math.random().toString(36).slice(2);
const panelRef = ref(null);
const form = ref({ status: null, note: '' });
const context = ref(null);

const props = defineProps({
  saving: { type: Boolean, default: false },
});

const options = [
  { value: 'present', label: 'Presente' },
  { value: 'absent', label: 'Ausente' },
  { value: 'late', label: 'Tarde' },
  { value: 'excused', label: 'Justificado' },
];

const open = (event, payload) => {
  context.value = payload || null;
  form.value = {
    status: payload?.status || null,
    note: payload?.note || '',
  };
  panelRef.value?.show(event);
};

const hide = () => {
  panelRef.value?.hide();
};

const submit = () => {
  if (!context.value || !form.value.status) {
    return;
  }
  emit('save', {
    ...context.value,
    status: form.value.status,
    note: String(form.value.note || '').trim(),
  });
};

defineExpose({ open, hide });
</script>

<style scoped>
.cell-editor {
  min-width: 280px;
  display: grid;
  gap: 0.75rem;
}
.status-radio-list {
  display: grid;
  gap: 0.35rem;
}
.status-radio-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.note-field {
  display: grid;
  gap: 0.25rem;
}
.note-field label { font-size: 0.78rem; color: #64748b; }
.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
}
</style>

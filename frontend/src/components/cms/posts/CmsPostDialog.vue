<template>
  <Dialog
    :visible="visible"
    :header="mode === 'edit' ? 'Edit post' : 'New post'"
    modal
    :style="{ width: '40rem', maxWidth: '96vw' }"
    @update:visible="(value) => emit('update:visible', value)"
  >
    <div class="post-form-grid">
      <div class="dialog-field dialog-field-half">
        <label>Target</label>
        <Dropdown
          v-model="form.target"
          :options="targetOptions"
          optionLabel="label"
          optionValue="value"
        />
      </div>

      <div v-if="form.target === 'group'" class="dialog-field dialog-field-half">
        <label>Group</label>
        <Dropdown
          v-model="form.groupId"
          :options="groupOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Select group"
          showClear
        />
      </div>

      <div class="dialog-field">
        <label>Title</label>
        <InputText v-model="form.title" placeholder="Post title" />
      </div>

      <div class="dialog-field">
        <label>Body</label>
        <textarea
          v-model="form.body"
          class="post-body"
          rows="7"
          placeholder="Write the post"
        />
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" class="p-button-text" :disabled="saving" @click="close" />
      <Button
        :label="mode === 'edit' ? 'Save changes' : 'Create post'"
        :loading="saving"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { createCoursePost, updateCoursePost } from '../../../api/cms';

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
  initial: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:visible', 'saved']);
const toast = useToast();
const saving = ref(false);

const targetOptions = [
  { label: 'Course', value: 'course' },
  { label: 'Specific group', value: 'group' },
];

const buildInitialForm = (post = null) => ({
  target: post?.groupId ? 'group' : 'course',
  groupId: post?.groupId || null,
  title: post?.title || '',
  body: post?.body || '',
});

const form = reactive(buildInitialForm());

const groupOptions = computed(() =>
  (props.groups || []).map((group) => ({
    label: group.scheduleText ? `${group.name} (${group.scheduleText})` : group.name,
    value: group.id,
  })),
);

const reset = () => {
  Object.assign(form, buildInitialForm(props.mode === 'edit' ? props.initial : null));
};

watch(
  () => [props.visible, props.mode, props.initial],
  () => {
    if (props.visible) {
      reset();
    }
  },
  { deep: true },
);

watch(
  () => form.target,
  (value) => {
    if (value === 'course') {
      form.groupId = null;
    }
  },
);

const close = () => emit('update:visible', false);

const submit = async () => {
  if (!form.title || form.title.trim().length < 3) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Title must be at least 3 characters', life: 2500 });
    return;
  }
  if (!form.body || !form.body.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Body is required', life: 2500 });
    return;
  }
  if (form.target === 'group' && !form.groupId) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Select a group', life: 2500 });
    return;
  }

  const payload = {
    target: form.target,
    groupId: form.target === 'group' ? form.groupId : null,
    title: form.title.trim(),
    body: form.body.trim(),
  };

  saving.value = true;
  try {
    if (props.mode === 'edit' && props.initial?.id) {
      await updateCoursePost(props.initial.id, payload);
      toast.add({ severity: 'success', summary: 'Saved', detail: 'Post updated', life: 2200 });
    } else {
      await createCoursePost(props.courseId, payload);
      toast.add({ severity: 'success', summary: 'Created', detail: 'Post created', life: 2200 });
    }
    emit('saved');
    close();
  } catch (err) {
    const detail = err?.response?.data?.error || 'Unable to save post';
    toast.add({ severity: 'error', summary: 'Error', detail, life: 3200 });
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.post-form-grid {
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

.post-body {
  width: 100%;
  resize: vertical;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  font: inherit;
}

@media (max-width: 900px) {
  .post-form-grid {
    grid-template-columns: 1fr;
  }

  .dialog-field-half {
    grid-column: span 2;
  }
}
</style>

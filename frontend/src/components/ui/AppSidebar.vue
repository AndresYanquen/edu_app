<template>
  <Sidebar
    class="app-sidebar"
    :visible="modelValue"
    :position="position"
    :dismissable="dismissable"
    :blockScroll="blockScroll"
    :style="{ '--app-sidebar-width': width }"
    @update:visible="onVisibleChange"
    @show="emit('show')"
    @hide="emit('hide')"
    @after-hide="emit('after-hide')"
  >
    <template #header>
      <slot name="header">
        <div class="app-sidebar-header" v-if="title">{{ title }}</div>
      </slot>
    </template>

    <slot />
  </Sidebar>
</template>

<script setup>
import Sidebar from 'primevue/sidebar'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  position: {
    type: String,
    default: 'right',
  },
  width: {
    type: String,
    default: '420px',
  },
  blockScroll: {
    type: Boolean,
    default: true,
  },
  dismissable: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['update:modelValue', 'show', 'hide', 'after-hide'])

const onVisibleChange = (nextVisible) => {
  emit('update:modelValue', nextVisible)
}
</script>

<style scoped>
.app-sidebar :deep(.p-sidebar) {
  width: var(--app-sidebar-width);
  max-width: 95vw;
}

.app-sidebar-header {
  font-weight: 700;
  font-size: 1rem;
}
</style>

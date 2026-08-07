<template>
  <section class="admin-settings-view">
    <Card class="card settings-card">
      <template #title>
        <div class="card-title">
          <h2>Configuración</h2>
          <p>Personaliza los colores globales de la aplicación.</p>
        </div>
      </template>

      <template #content>
        <div v-if="loading" class="settings-loading">
          <ProgressSpinner />
        </div>

        <div v-else class="theme-settings">
          <div class="theme-form">
            <section
              v-for="group in colorGroups"
              :key="group.title"
              class="theme-group"
            >
              <h3>{{ group.title }}</h3>

              <div class="theme-color-grid">
                <label
                  v-for="field in group.fields"
                  :key="field.key"
                  class="theme-color-field"
                >
                  <span>{{ field.label }}</span>
                  <div class="theme-color-control">
                    <input
                      v-model="form.colors[field.key]"
                      type="color"
                      :aria-label="field.label"
                    />
                    <InputText v-model="form.colors[field.key]" />
                  </div>
                </label>
              </div>
            </section>

            <div class="theme-actions">
              <Button
                label="Restaurar valores base"
                icon="pi pi-refresh"
                severity="secondary"
                outlined
                type="button"
                @click="resetDefaults"
              />
              <Button
                label="Guardar tema"
                icon="pi pi-save"
                type="button"
                :loading="saving"
                @click="saveTheme"
              />
            </div>
          </div>

          <aside class="theme-preview" :style="previewStyle">
            <div class="theme-preview__sidebar">
              <div class="theme-preview__brand">Go4+</div>
              <div class="theme-preview__nav is-active">Dashboard</div>
              <div class="theme-preview__nav">Cursos</div>
              <div class="theme-preview__nav">Usuarios</div>
            </div>

            <div class="theme-preview__content">
              <div class="theme-preview__header">
                <div>
                  <span>Vista previa</span>
                  <h3>Panel académico</h3>
                </div>
                <button type="button">Acción</button>
              </div>
              <div class="theme-preview__card">
                <strong>Curso destacado</strong>
                <p>Los componentes usan los tokens centralizados del sistema visual.</p>
                <div class="theme-preview__pill">Activo</div>
              </div>
            </div>
          </aside>
        </div>
      </template>
    </Card>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { getAdminTheme, updateAdminTheme } from '../../api/admin';
import { applyTheme, DEFAULT_THEME, normalizeTheme } from '../../utils/theme';

const toast = useToast();
const loading = ref(false);
const saving = ref(false);
const form = reactive(normalizeTheme(DEFAULT_THEME));

const colorGroups = [
  {
    title: 'Marca',
    fields: [
      { key: 'brandPrimary', label: 'Principal' },
      { key: 'brandPrimaryHover', label: 'Principal hover' },
      { key: 'brandPrimarySoft', label: 'Principal suave' },
      { key: 'brandAccent', label: 'Acento' },
      { key: 'brandAccentStrong', label: 'Acento fuerte' },
      { key: 'brandAccentSoft', label: 'Acento suave' },
    ],
  },
  {
    title: 'Aplicación',
    fields: [
      { key: 'appBg', label: 'Fondo' },
      { key: 'appSurface', label: 'Superficie' },
      { key: 'appSurface2', label: 'Superficie secundaria' },
      { key: 'appBorder', label: 'Borde' },
      { key: 'textPrimary', label: 'Texto principal' },
      { key: 'textSecondary', label: 'Texto secundario' },
      { key: 'textMuted', label: 'Texto tenue' },
    ],
  },
  {
    title: 'Sidebar',
    fields: [
      { key: 'sidebarBg', label: 'Fondo inicial' },
      { key: 'sidebarBg2', label: 'Fondo final' },
      { key: 'sidebarText', label: 'Texto' },
      { key: 'sidebarMuted', label: 'Texto tenue' },
      { key: 'sidebarActiveAccent', label: 'Acento activo' },
    ],
  },
];

const assignTheme = (theme) => {
  const normalized = normalizeTheme(theme);
  form.colors = { ...normalized.colors };
};

const previewStyle = computed(() => ({
  '--preview-brand-primary': form.colors.brandPrimary,
  '--preview-brand-primary-hover': form.colors.brandPrimaryHover,
  '--preview-brand-primary-soft': form.colors.brandPrimarySoft,
  '--preview-brand-accent': form.colors.brandAccent,
  '--preview-app-bg': form.colors.appBg,
  '--preview-app-surface': form.colors.appSurface,
  '--preview-app-border': form.colors.appBorder,
  '--preview-text-primary': form.colors.textPrimary,
  '--preview-text-secondary': form.colors.textSecondary,
  '--preview-text-muted': form.colors.textMuted,
  '--preview-sidebar-bg': form.colors.sidebarBg,
  '--preview-sidebar-bg-2': form.colors.sidebarBg2,
  '--preview-sidebar-text': form.colors.sidebarText,
  '--preview-sidebar-muted': form.colors.sidebarMuted,
  '--preview-sidebar-active-accent': form.colors.sidebarActiveAccent,
}));

const loadTheme = async () => {
  loading.value = true;
  try {
    const theme = await getAdminTheme();
    assignTheme(theme);
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'No se pudo cargar el tema',
      detail: err.response?.data?.error || 'Intenta nuevamente.',
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
};

const resetDefaults = () => {
  assignTheme(DEFAULT_THEME);
};

const saveTheme = async () => {
  saving.value = true;
  try {
    const theme = await updateAdminTheme({ colors: form.colors });
    assignTheme(theme);
    applyTheme(theme);
    toast.add({
      severity: 'success',
      summary: 'Tema actualizado',
      detail: 'Los colores globales se aplicaron correctamente.',
      life: 3000,
    });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'No se pudo guardar',
      detail: err.response?.data?.error || 'Revisa los colores e intenta nuevamente.',
      life: 4500,
    });
  } finally {
    saving.value = false;
  }
};

onMounted(loadTheme);
</script>

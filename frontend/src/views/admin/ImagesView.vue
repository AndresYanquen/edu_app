<template>
  <section class="admin-images-view">
    <Card class="card admin-images-card">
      <template #title>
        <div class="card-title">
          <h2>Gestión de imágenes</h2>
          <p>Revisa imágenes subidas, dónde se usan y reemplaza archivos sin cambiar referencias.</p>
        </div>
      </template>

      <template #content>
        <div class="admin-images-toolbar">
          <span class="admin-images-search">
            <i class="pi pi-search" aria-hidden="true" />
            <InputText
              v-model="filters.search"
              placeholder="Buscar por nombre o URL"
              @keyup.enter="loadImages"
            />
          </span>
          <Button
            label="Buscar"
            icon="pi pi-search"
            type="button"
            :loading="loading"
            @click="loadImages"
          />
        </div>

        <div v-if="loading" class="settings-loading">
          <ProgressSpinner />
        </div>

        <div v-else-if="images.length" class="admin-images-list">
          <article v-for="image in images" :key="image.id" class="admin-image-item">
            <div class="admin-image-preview">
              <img :src="image.url" :alt="image.originalName || 'Imagen'" />
            </div>

            <div class="admin-image-meta">
              <div class="admin-image-title-row">
                <div>
                  <h3>{{ image.originalName || 'Imagen sin nombre' }}</h3>
                  <p>{{ image.url }}</p>
                </div>
                <span class="status-pill status-pill--info">{{ formatBytes(image.sizeBytes) }}</span>
              </div>

              <dl class="admin-image-facts">
                <div>
                  <dt>Tipo</dt>
                  <dd>{{ image.mimeType || 'image/*' }}</dd>
                </div>
                <div>
                  <dt>Origen</dt>
                  <dd>{{ image.storageProvider || 'local' }}</dd>
                </div>
                <div>
                  <dt>Subida</dt>
                  <dd>{{ formatDate(image.createdAt) }}</dd>
                </div>
              </dl>

              <div class="admin-image-courses">
                <strong>Cursos relacionados</strong>
                <div v-if="image.usages?.length" class="admin-image-course-list">
                  <span
                    v-for="usage in image.usages"
                    :key="`${image.id}-${usage.lessonId}`"
                    class="admin-image-course-chip"
                  >
                    {{ usage.courseTitle || 'Curso sin título' }} · {{ usage.lessonTitle || 'Lección' }}
                  </span>
                </div>
                  <p v-else class="muted">No hay relación por biblioteca de assets.</p>
              </div>
            </div>

            <div class="admin-image-actions">
              <input
                :ref="(el) => setFileInputRef(image.id, el)"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                class="admin-image-file-input"
                @change="replaceImage(image, $event)"
              />
              <Button
                icon="pi pi-refresh"
                label="Reemplazar"
                type="button"
                :loading="replacingId === image.id"
                @click="openFilePicker(image.id)"
              />
            </div>
          </article>
        </div>

        <div v-else class="empty-state">
          No hay imágenes para mostrar.
        </div>
      </template>
    </Card>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { listAdminImages, replaceAdminImage, replaceLessonCoverImage } from '../../api/admin';

const toast = useToast();
const loading = ref(false);
const replacingId = ref(null);
const images = ref([]);
const filters = reactive({ search: '' });
const fileInputRefs = new Map();

const setFileInputRef = (id, el) => {
  if (el) {
    fileInputRefs.set(id, el);
  } else {
    fileInputRefs.delete(id);
  }
};

const formatBytes = (value = 0) => {
  if (value === null || value === undefined) return 'Sin dato';
  const size = Number(value || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
};

const loadImages = async () => {
  loading.value = true;
  try {
    images.value = await listAdminImages({ search: filters.search || undefined });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'No se pudieron cargar las imágenes',
      detail: err.response?.data?.error || 'Intenta nuevamente.',
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
};

const openFilePicker = (id) => {
  fileInputRefs.get(id)?.click();
};

const replaceImage = async (image, event) => {
  const [file] = Array.from(event.target.files || []);
  event.target.value = '';
  if (!file) return;

  replacingId.value = image.id;
  try {
    const updated =
      image.sourceType === 'lesson_cover'
        ? await replaceLessonCoverImage(image.lessonId, file)
        : await replaceAdminImage(image.assetId || image.id, file);
    images.value = images.value.map((item) =>
      item.id === image.id
        ? {
            ...item,
            mimeType: updated.mimeType,
            originalName: updated.originalName,
            sizeBytes: updated.sizeBytes,
            storageProvider: updated.storageProvider,
            storagePath: updated.storagePath,
            url: `${updated.url}?v=${Date.now()}`,
          }
        : item,
    );
    toast.add({
      severity: 'success',
      summary: 'Imagen reemplazada',
      detail: 'El archivo fue actualizado correctamente.',
      life: 3000,
    });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'No se pudo reemplazar',
      detail: err.response?.data?.error || 'Revisa el archivo e intenta nuevamente.',
      life: 4500,
    });
  } finally {
    replacingId.value = null;
  }
};

onMounted(loadImages);
</script>

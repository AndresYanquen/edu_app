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

        <div v-else-if="groupedImages.length" class="admin-image-groups">
          <section
            v-for="group in groupedImages"
            :key="group.key"
            class="admin-image-group"
          >
            <header class="admin-image-group__header">
              <div>
                <span>{{ group.courseTitle }}</span>
                <h3>{{ group.lessonTitle }}</h3>
              </div>
              <strong>{{ group.images.length }} imagen{{ group.images.length === 1 ? '' : 'es' }}</strong>
            </header>

            <div class="admin-image-grid">
              <article
                v-for="image in group.images"
                :key="image.viewId"
                class="admin-image-tile"
                role="button"
                tabindex="0"
                @click="openImageDialog(image)"
                @keydown.enter.prevent="openImageDialog(image)"
                @keydown.space.prevent="openImageDialog(image)"
              >
                <img
                  :src="image.url"
                  :alt="image.originalName || 'Imagen'"
                  @error="refreshImageUrl(image)"
                />
              </article>
            </div>
          </section>
        </div>

        <div v-else class="empty-state">
          No hay imágenes para mostrar.
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="imageDialogVisible"
      modal
      header="Detalle de imagen"
      :style="{ width: 'min(42rem, calc(100vw - 2rem))' }"
      class="admin-image-dialog"
    >
      <div v-if="selectedImage" class="admin-image-detail">
        <div class="admin-image-detail__preview">
          <img
            :src="selectedImage.url"
            :alt="selectedImage.originalName || 'Imagen'"
            @error="refreshImageUrl(selectedImage)"
          />
        </div>

        <dl class="admin-image-detail__meta">
          <div>
            <dt>Nombre</dt>
            <dd>{{ selectedImage.originalName || 'Imagen sin nombre' }}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{{ sourceTypeLabel(selectedImage.sourceType) }}</dd>
          </div>
          <div>
            <dt>Peso</dt>
            <dd>{{ formatBytes(selectedImage.sizeBytes) }}</dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>{{ selectedImage.storageProvider || 'local' }}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{{ formatDate(selectedImage.createdAt) }}</dd>
          </div>
          <div>
            <dt>URL</dt>
            <dd class="admin-image-detail__url">{{ selectedImage.url }}</dd>
          </div>
        </dl>

        <input
          ref="dialogFileInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          class="admin-image-file-input"
          @change="replaceSelectedImage"
        />

        <div class="admin-image-detail__actions">
          <Button
            label="Reemplazar"
            icon="pi pi-refresh"
            type="button"
            :loading="replacingId === selectedImage.viewId"
            :disabled="deletingId === selectedImage.viewId"
            @click="dialogFileInputRef?.click()"
          />
          <Button
            :label="deleteConfirmationVisible ? 'Confirmar borrado' : 'Borrar'"
            icon="pi pi-trash"
            severity="danger"
            outlined
            type="button"
            :loading="deletingId === selectedImage.viewId"
            :disabled="replacingId === selectedImage.viewId"
            @click="deleteSelectedImage"
          />
        </div>

        <p v-if="deleteConfirmationVisible" class="admin-image-delete-warning">
          Esta acción quitará la imagen de la lección o referencia donde está asociada.
        </p>
      </div>
    </Dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import Dialog from 'primevue/dialog';
import { useToast } from 'primevue/usetoast';
import {
  deleteAdminImage,
  deleteImageReference,
  deleteLessonCoverImage,
  getAdminImageDownloadUrl,
  listAdminImages,
  replaceAdminImage,
  replaceImageReference,
  replaceLessonCoverImage,
} from '../../api/admin';

const toast = useToast();
const loading = ref(false);
const replacingId = ref(null);
const deletingId = ref(null);
const images = ref([]);
const filters = reactive({ search: '' });
const selectedImage = ref(null);
const imageDialogVisible = ref(false);
const deleteConfirmationVisible = ref(false);
const dialogFileInputRef = ref(null);
const refreshingIds = new Set();
const refreshAttemptedIds = new Set();

const groupedImages = computed(() => {
  const groups = new Map();

  images.value.forEach((image) => {
    const usages = image.usages?.length ? image.usages : [{}];

    usages.forEach((usage, index) => {
      const courseTitle = usage.courseTitle || 'Sin curso asociado';
      const lessonTitle = usage.lessonTitle || 'Sin lección asociada';
      const key = `${usage.courseId || 'none'}:${usage.lessonId || image.sourceType || image.id}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          courseTitle,
          lessonTitle,
          images: [],
        });
      }

      groups.get(key).images.push({
        ...image,
        usage,
        viewId: `${image.id}:${usage.lessonId || usage.courseId || index}`,
      });
    });
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      images: group.images.sort((a, b) =>
        (a.originalName || a.url || '').localeCompare(b.originalName || b.url || ''),
      ),
    }))
    .sort((a, b) =>
      `${a.courseTitle} ${a.lessonTitle}`.localeCompare(`${b.courseTitle} ${b.lessonTitle}`),
    );
});

const sourceTypeLabel = (value) => {
  const labels = {
    asset: 'Asset',
    lesson_cover: 'Portada',
    lesson_content: 'Contenido',
    course_post: 'Post',
    announcement: 'Anuncio',
  };
  return labels[value] || 'Imagen';
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

const openImageDialog = (image) => {
  selectedImage.value = image;
  deleteConfirmationVisible.value = false;
  imageDialogVisible.value = true;
};

const refreshImageUrl = async (image) => {
  if (
    !image?.storagePath ||
    image.storageProvider !== 'r2' ||
    refreshingIds.has(image.id) ||
    refreshAttemptedIds.has(image.id)
  ) {
    return;
  }

  refreshingIds.add(image.id);
  refreshAttemptedIds.add(image.id);
  try {
    const { url } = await getAdminImageDownloadUrl(image.storagePath);
    if (!url) return;

    images.value = images.value.map((item) =>
      item.id === image.id ? { ...item, url } : item,
    );
    if (selectedImage.value?.id === image.id) {
      selectedImage.value = { ...selectedImage.value, url };
    }
  } catch (err) {
    console.warn('No se pudo refrescar la URL de la imagen', err);
  } finally {
    refreshingIds.delete(image.id);
  }
};

const replaceImage = async (image, event) => {
  const [file] = Array.from(event.target.files || []);
  event.target.value = '';
  if (!file) return;

  replacingId.value = image.viewId;
  try {
    const updated =
      image.sourceType === 'lesson_cover'
        ? await replaceLessonCoverImage(image.lessonId, file)
        : image.sourceType === 'asset'
          ? await replaceAdminImage(image.assetId || image.id, file)
          : await replaceImageReference({
              sourceType: image.sourceType,
              entityId: image.entityId || image.lessonId,
              oldUrl: image.referenceUrl || image.storagePath || image.url,
              file,
            });
    images.value = images.value.map((item) =>
      item.id === image.id
        ? {
            ...item,
            mimeType: updated.mimeType,
            originalName: updated.originalName,
            sizeBytes: updated.sizeBytes,
            storageProvider: updated.storageProvider,
            storagePath: updated.storagePath,
            referenceUrl: updated.referenceUrl || updated.url,
            url: `${updated.url}?v=${Date.now()}`,
        }
        : item,
    );
    selectedImage.value =
      selectedImage.value?.id === image.id
        ? {
            ...selectedImage.value,
            mimeType: updated.mimeType,
            originalName: updated.originalName,
            sizeBytes: updated.sizeBytes,
            storageProvider: updated.storageProvider,
            storagePath: updated.storagePath,
            referenceUrl: updated.referenceUrl || updated.url,
            url: `${updated.url}?v=${Date.now()}`,
          }
        : selectedImage.value;
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

const replaceSelectedImage = async (event) => {
  if (!selectedImage.value) return;
  await replaceImage(selectedImage.value, event);
};

const deleteImage = async (image) => {
  deletingId.value = image.viewId;
  try {
    if (image.sourceType === 'lesson_cover') {
      await deleteLessonCoverImage(image.lessonId);
    } else if (image.sourceType === 'asset') {
      await deleteAdminImage(image.assetId || image.id);
    } else {
      await deleteImageReference({
        sourceType: image.sourceType,
        entityId: image.entityId || image.lessonId,
        oldUrl: image.referenceUrl || image.storagePath || image.url,
      });
    }

    images.value = images.value.filter((item) => item.id !== image.id);
    imageDialogVisible.value = false;
    selectedImage.value = null;
    deleteConfirmationVisible.value = false;
    toast.add({
      severity: 'success',
      summary: 'Imagen borrada',
      detail: 'La referencia fue retirada correctamente.',
      life: 3000,
    });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'No se pudo borrar',
      detail: err.response?.data?.error || 'Intenta nuevamente.',
      life: 4500,
    });
  } finally {
    deletingId.value = null;
  }
};

const deleteSelectedImage = async () => {
  if (!selectedImage.value) return;
  if (!deleteConfirmationVisible.value) {
    deleteConfirmationVisible.value = true;
    return;
  }
  await deleteImage(selectedImage.value);
};

onMounted(loadImages);
</script>

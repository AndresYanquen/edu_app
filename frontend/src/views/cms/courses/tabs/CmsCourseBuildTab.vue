<template>
  <Card class="build-card">
    <template #title>
      <div class="section-header">
        <div>
          <div class="section-title">Build</div>
          <small class="muted">Manage modules and lessons inside each module</small>
        </div>
        <Button label="Add module" icon="pi pi-plus" @click="openModuleDialog()" />
      </div>
    </template>

    <template #content>
      <div v-if="loadingModules">
        <Skeleton height="2rem" class="mb-2" />
        <Skeleton height="2rem" class="mb-2" />
      </div>

      <div v-else-if="!modules.length" class="empty-state">No modules yet.</div>

      <Accordion
        v-else
        v-model:activeIndex="activeModuleTabs"
        :multiple="true"
        class="modules-accordion"
        @tab-open="onModuleTabOpen"
      >
        <AccordionTab v-for="(module, index) in modules" :key="module.id">
          <template #header>
            <div class="module-tab-header" @click="selectModuleFromTab(module.id)">
              <div class="module-tab-title">
                <button
                  type="button"
                  class="module-name-btn"
                  @click.stop="openModuleDialog(module)"
                  title="Editar módulo"
                  aria-label="Editar módulo"
                >
                  <span class="module-name">{{ module.title }}</span>
                </button>
                <Tag
                  :value="module.is_published ? 'Published' : 'Draft'"
                  :severity="module.is_published ? 'success' : 'warning'"
                  class="module-status"
                />
              </div>

              <div class="module-tab-actions" @click.stop>
                <Button
                  icon="pi pi-pencil"
                  class="p-button-text"
                  title="Editar módulo"
                  aria-label="Editar módulo"
                  @click="openModuleDialog(module)"
                />
                <Button
                  :icon="module.is_published ? 'pi pi-eye-slash' : 'pi pi-eye'"
                  class="p-button-text"
                  :title="module.is_published ? 'Despublicar módulo' : 'Publicar módulo'"
                  :aria-label="module.is_published ? 'Despublicar módulo' : 'Publicar módulo'"
                  @click="toggleModulePublish(module)"
                />
                <Button
                  icon="pi pi-trash"
                  class="p-button-text p-button-danger"
                  severity="danger"
                  title="Eliminar módulo"
                  aria-label="Eliminar módulo"
                  :loading="deletingModuleId === module.id"
                  :disabled="deletingModuleId === module.id"
                  @click.stop="openDeleteModuleDialog(module)"
                />
                <Button
                  icon="pi pi-arrow-up"
                  class="p-button-text"
                  title="Mover módulo arriba"
                  aria-label="Mover módulo arriba"
                  :disabled="index === 0"
                  @click="reorderModule(module, 'up')"
                />
                <Button
                  icon="pi pi-arrow-down"
                  class="p-button-text"
                  title="Mover módulo abajo"
                  aria-label="Mover módulo abajo"
                  :disabled="index === modules.length - 1"
                  @click="reorderModule(module, 'down')"
                />
              </div>
            </div>
          </template>

          <div class="module-lessons-wrap">
            <div class="lessons-head">
              <div>
                <div class="lessons-title">Lessons · {{ module.title }}</div>
                <small class="muted">
                  {{ (lessonsByModuleId[module.id] || []).length }} lesson(s)
                </small>
              </div>

              <Button
                label="Add lesson"
                icon="pi pi-plus"
                @click="openLessonDialogForModule(module.id)"
              />
            </div>

            <div class="lessons-toolbar">
              <span class="p-input-icon-left lessons-search">
                <i class="pi pi-search" />
                <InputText
                  v-model="lessonFiltersByModuleId[module.id].search"
                  placeholder="Search lessons"
                />
              </span>

              <Dropdown
                v-model="lessonFiltersByModuleId[module.id].status"
                :options="lessonStatusOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="All"
                class="lessons-filter"
              />
            </div>

            <div v-if="lessonsLoadingByModuleId[module.id]" class="lessons-loading">
              <Skeleton height="2rem" class="mb-2" />
              <Skeleton height="2rem" class="mb-2" />
              <Skeleton height="2rem" class="mb-2" />
            </div>

            <div v-else-if="!filteredLessonsForModule(module.id).length" class="empty-state">
              No lessons yet for this module.
            </div>

            <div v-else class="lesson-list-scroll">
              <div
                v-for="(lesson, lessonIndex) in filteredLessonsForModule(module.id)"
                :key="lesson.id"
                class="list-item lesson-item lesson-item--nested"
              >
                <div class="lesson-info">
                  <button
                    type="button"
                    class="item-title-btn"
                    @click="editLesson(lesson)"
                    title="Editar lección"
                    aria-label="Editar lección"
                  >
                    <strong class="item-title">{{ lesson.title }}</strong>
                  </button>
                  <p class="lesson-meta muted">
                    {{ lesson.estimated_minutes || 0 }} min
                    <span class="lesson-dot">•</span>
                    {{ formatLessonTypeLabel(lesson.content_type) }}
                  </p>
                </div>

                <div class="module-actions" @click.stop>
                  <Tag
                    :value="lesson.is_published ? 'Published' : 'Draft'"
                    :severity="lesson.is_published ? 'success' : 'warning'"
                  />
                  <Button
                    icon="pi pi-pencil"
                    class="p-button-text"
                    title="Editar lección"
                    aria-label="Editar lección"
                    @click="editLesson(lesson)"
                  />
                  <Button
                    :icon="lesson.is_published ? 'pi pi-eye-slash' : 'pi pi-eye'"
                    class="p-button-text"
                    :title="lesson.is_published ? 'Despublicar lección' : 'Publicar lección'"
                    :aria-label="lesson.is_published ? 'Despublicar lección' : 'Publicar lección'"
                    @click="toggleLessonPublish(lesson, module.id)"
                  />
                  <Button
                    icon="pi pi-trash"
                    class="p-button-text p-button-danger"
                    severity="danger"
                    title="Eliminar lección"
                    aria-label="Eliminar lección"
                    :loading="deletingLessonId === lesson.id"
                    :disabled="deletingLessonId === lesson.id"
                    @click.stop="openDeleteLessonDialogForModule(module.id, lesson)"
                  />
                  <Button
                    icon="pi pi-arrow-up"
                    class="p-button-text"
                    title="Mover lección arriba"
                    aria-label="Mover lección arriba"
                    :disabled="lessonIndex === 0"
                    @click="reorderLessonForModule(module.id, lesson, 'up')"
                  />
                  <Button
                    icon="pi pi-arrow-down"
                    class="p-button-text"
                    title="Mover lección abajo"
                    aria-label="Mover lección abajo"
                    :disabled="lessonIndex === filteredLessonsForModule(module.id).length - 1"
                    @click="reorderLessonForModule(module.id, lesson, 'down')"
                  />
                </div>
              </div>
            </div>
          </div>
        </AccordionTab>
      </Accordion>
    </template>
  </Card>
</template>

<script setup>
import { inject } from 'vue';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import { cmsCourseBuilderContextKey } from '../cmsCourseBuilderContext';

const builder = inject(cmsCourseBuilderContextKey);

const {
  loadingModules,
  modules,
  activeModuleTabs,
  onModuleTabOpen,
  selectModuleFromTab,
  openModuleDialog,
  toggleModulePublish,
  deletingModuleId,
  reorderModule,
  lessonsByModuleId,
  openLessonDialogForModule,
  lessonFiltersByModuleId,
  lessonStatusOptions,
  lessonsLoadingByModuleId,
  filteredLessonsForModule,
  editLesson,
  toggleLessonPublish,
  deletingLessonId,
  openDeleteModuleDialog,
  openDeleteLessonDialogForModule,
  reorderLessonForModule,
} = builder;

const formatLessonTypeLabel = (value) => {
  const type = String(value || 'activity').toLowerCase();
  if (type === 'banner' || type === 'notice' || type === 'aviso') return 'Aviso';
  if (type === 'content' || type === 'text' || type === 'link' || type === 'file' || type === 'embed') {
    return 'Actividad';
  }
  if (type === 'video') return 'Actividad';
  if (type === 'activity') return 'Actividad';
  if (type === 'assessment') return 'Evaluación';
  return 'Actividad';
};
</script>

<style scoped>
.section-header,
.lessons-head,
.lessons-toolbar,
.module-tab-title,
.module-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-header {
  gap: 0.75rem;
  min-width: 0;
  flex-wrap: wrap;
}

.modules-accordion {
  display: grid;
  gap: 0.8rem;
}

.modules-accordion :deep(.p-accordion-tab) {
  border: none;
  background: transparent;
}

.modules-accordion :deep(.p-accordion-header-link) {
  background: #ffffff;
  border: 1px solid #dbe6f4;
  border-radius: 14px;
  padding: 0.85rem 0.95rem;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03);
}

.modules-accordion :deep(.p-accordion-content) {
  border: none;
  background: transparent;
  padding: 0.5rem 0 0.05rem;
}

.lessons-head {
  margin: 0.25rem 0 0.85rem;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.lessons-toolbar {
  width: 100%;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.lessons-search {
  flex: 1 1 260px;
}

.lessons-search :deep(.p-inputtext) {
  width: 100%;
}

.lessons-filter {
  width: min(220px, 100%);
}

.module-actions {
  gap: 0.35rem;
  flex-wrap: wrap;
}

.module-tab-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.module-tab-title {
  min-width: 0;
  gap: 0.65rem;
  flex: 1;
  justify-content: flex-start;
}

.module-name {
  display: block;
  font-weight: 700;
  color: #0f172a;
  overflow-wrap: anywhere;
}

.module-name-btn,
.item-title-btn {
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  text-align: left;
  cursor: pointer;
}

.module-name-btn:hover .module-name,
.item-title-btn:hover .item-title {
  color: #1d4ed8;
  text-decoration: underline;
}

.module-lessons-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0.2rem 0 0.1rem 1.2rem;
  position: relative;
}

.module-lessons-wrap::before {
  content: '';
  position: absolute;
  left: 0.55rem;
  top: 0.4rem;
  bottom: 0.25rem;
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(180deg, #bfdbfe 0%, #dbeafe 100%);
}

.lessons-title {
  font-weight: 700;
  color: #334155;
}

.lesson-list-scroll {
  display: grid;
  gap: 0.65rem;
}

.lesson-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.9rem;
  border: 1px solid #dce6f4;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
  padding: 0.8rem 0.9rem;
  min-width: 0;
}

.lesson-item--nested {
  margin-left: 0.45rem;
  position: relative;
}

.lesson-item--nested::before {
  content: '';
  position: absolute;
  left: -0.48rem;
  top: 50%;
  transform: translateY(-50%);
  width: 0.4rem;
  height: 2px;
  background: #bfdbfe;
}

.lesson-info {
  min-width: 0;
  flex: 1;
}

.item-title {
  overflow-wrap: anywhere;
}

.lesson-meta {
  margin: 0.25rem 0 0;
  color: #6b7280;
  font-size: 0.85rem;
}

.lesson-dot {
  margin: 0 0.3rem;
}

.lessons-loading,
.empty-state {
  margin-left: 0.45rem;
}

@media (max-width: 900px) {
  .module-lessons-wrap {
    padding-left: 1rem;
  }

  .module-lessons-wrap::before {
    left: 0.45rem;
  }

  .lesson-item--nested {
    margin-left: 0.3rem;
  }

  .lesson-item--nested::before {
    left: -0.36rem;
    width: 0.3rem;
  }
}

@media (max-width: 768px) {
  .build-card :deep(.p-card-body) {
    padding: 0.9rem;
  }

  .section-header {
    align-items: stretch;
  }

  .section-header > div {
    min-width: 0;
  }

  .section-header :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }

  .modules-accordion {
    gap: 0.9rem;
  }

  .modules-accordion :deep(.p-accordion-header-link) {
    padding: 0.85rem;
  }

  .module-tab-header {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    align-items: stretch;
  }

  .module-tab-title {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.55rem;
    align-items: center;
  }

  .module-name-btn {
    min-width: 0;
  }

  .module-name {
    line-height: 1.2;
  }

  .module-tab-actions {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.35rem;
  }

  .module-tab-actions :deep(.p-button),
  .module-actions :deep(.p-button) {
    width: 100%;
    min-width: 0;
    min-height: 2.4rem;
    padding-inline: 0 !important;
    justify-content: center;
  }

  .module-lessons-wrap {
    padding-left: 0;
  }

  .module-lessons-wrap::before,
  .lesson-item--nested::before {
    display: none;
  }

  .lessons-head {
    display: grid;
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .lessons-head :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }

  .lessons-toolbar {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }

  .lessons-search,
  .lessons-filter {
    width: 100%;
    min-width: 0;
  }

  .lesson-item {
    display: grid;
    grid-template-columns: 1fr;
    align-items: flex-start;
    gap: 0.75rem;
    margin-left: 0;
    padding: 0.9rem;
    border-radius: 16px;
  }

  .module-actions {
    display: grid;
    grid-template-columns: auto repeat(5, minmax(0, 1fr));
    gap: 0.35rem;
    width: 100%;
    justify-content: stretch;
    align-items: center;
  }

  .module-actions :deep(.p-tag) {
    justify-self: start;
  }
}

@media (max-width: 430px) {
  .build-card :deep(.p-card-body) {
    padding: 0.75rem;
  }

  .module-tab-title {
    grid-template-columns: 1fr;
  }

  .module-status {
    justify-self: start;
  }

  .module-actions {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .module-actions :deep(.p-tag) {
    grid-column: 1 / -1;
  }

  .lesson-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
}
</style>

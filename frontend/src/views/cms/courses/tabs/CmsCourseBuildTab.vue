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

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
            <div class="module-tab-header" @click.stop="selectModuleFromTab(module.id)">
              <div class="module-tab-title">
                <span class="module-name">{{ module.title }}</span>
                <Tag
                  :value="module.is_published ? 'Published' : 'Draft'"
                  :severity="module.is_published ? 'success' : 'warning'"
                  class="module-status"
                />
              </div>

              <div class="module-tab-actions" @click.stop>
                <Button icon="pi pi-pencil" class="p-button-text" @click="openModuleDialog(module)" />
                <Button
                  :icon="module.is_published ? 'pi pi-eye-slash' : 'pi pi-eye'"
                  class="p-button-text"
                  @click="toggleModulePublish(module)"
                />
                <Button
                  icon="pi pi-trash"
                  class="p-button-text p-button-danger"
                  severity="danger"
                  :loading="deletingModuleId === module.id"
                  :disabled="deletingModuleId === module.id"
                  @click.stop="openDeleteModuleDialog(module)"
                />
                <Button
                  icon="pi pi-arrow-up"
                  class="p-button-text"
                  :disabled="index === 0"
                  @click="reorderModule(module, 'up')"
                />
                <Button
                  icon="pi pi-arrow-down"
                  class="p-button-text"
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
                  <strong class="item-title">{{ lesson.title }}</strong>
                  <p class="lesson-meta muted">{{ lesson.estimated_minutes || 0 }} min</p>
                </div>

                <div class="module-actions" @click.stop>
                  <Tag
                    :value="lesson.is_published ? 'Published' : 'Draft'"
                    :severity="lesson.is_published ? 'success' : 'warning'"
                  />
                  <Button icon="pi pi-pencil" class="p-button-text" @click="editLesson(lesson)" />
                  <Button
                    :icon="lesson.is_published ? 'pi pi-eye-slash' : 'pi pi-eye'"
                    class="p-button-text"
                    @click="toggleLessonPublish(lesson, module.id)"
                  />
                  <Button
                    icon="pi pi-trash"
                    class="p-button-text p-button-danger"
                    severity="danger"
                    :loading="deletingLessonId === lesson.id"
                    :disabled="deletingLessonId === lesson.id"
                    @click.stop="openDeleteLessonDialogForModule(module.id, lesson)"
                  />
                  <Button
                    icon="pi pi-arrow-up"
                    class="p-button-text"
                    :disabled="lessonIndex === 0"
                    @click="reorderLessonForModule(module.id, lesson, 'up')"
                  />
                  <Button
                    icon="pi pi-arrow-down"
                    class="p-button-text"
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

.lessons-head {
  margin: 1rem 0;
}

.lessons-toolbar {
  width: 100%;
}

.module-actions {
  gap: 0.35rem;
}

.module-tab-header {
  width: 80%;
}

.lesson-meta {
  margin: 0.25rem 0 0;
  color: #6b7280;
  font-size: 0.85rem;
}
</style>


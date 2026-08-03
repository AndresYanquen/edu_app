<template>
  <div class="page cms-page lesson-page-pro">
    <Card class="lesson-shell">
      <template #title>
        <div class="lesson-topbar">
          <div class="lesson-topbar-left">
            <Button
              icon="pi pi-arrow-left"
              class="p-button-text"
              @click="goBack"
            />
            <div class="lesson-topbar-copy">
              <p class="lesson-kicker">Lesson editor</p>
              <h1>{{ form.title || "Untitled lesson" }}</h1>
              <div class="lesson-meta">
                <span>{{ lessonTypeLabel }}</span>
                <span v-if="courseId">Course active</span>
                <Tag
                  :value="lesson?.is_published ? 'Published' : 'Draft'"
                  :severity="lesson?.is_published ? 'success' : 'warning'"
                />
              </div>
            </div>
          </div>

          <div class="lesson-topbar-actions" v-if="lesson">
            <Button
              label="Ver como estudiante"
              icon="pi pi-external-link"
              class="p-button-outlined"
              @click="openStudentPreview"
            />
            <Button
              :label="lesson.is_published ? 'Unpublish' : 'Publish'"
              :icon="lesson.is_published ? 'pi pi-eye-slash' : 'pi pi-eye'"
              class="p-button-text"
              @click="togglePublish"
            />
            <Button
              label="Save changes"
              :loading="saving"
              @click="saveLesson"
            />
          </div>
        </div>
      </template>

      <template #content>
        <div v-if="loading" class="lesson-loading">
          <Skeleton height="3rem" class="mb-2" />
          <Skeleton height="10rem" class="mb-2" />
          <Skeleton height="18rem" />
        </div>

        <div v-else-if="!lesson">
          <div class="empty-state">Lesson not found.</div>
        </div>

        <div v-else class="lesson-layout">
          <main class="lesson-main">
            <section class="lesson-hero-card">
              <div class="lesson-hero-copy">
                <p class="lesson-kicker">Now editing</p>
                <h2>{{ form.title || "Untitled lesson" }}</h2>
                <p class="lesson-hero-text">
                  Organiza el contenido por páginas y bloques, mientras ves a la
                  derecha cómo se va a mostrar realmente para el alumno.
                </p>

                <div class="lesson-hero-badges">
                  <span class="lesson-chip">
                    <i class="pi pi-clock"></i>
                    {{ lessonTypeLabel }}
                  </span>
                  <span class="lesson-chip">
                    <i class="pi pi-file-edit"></i>
                    Block editor
                  </span>
                  <span class="lesson-chip">
                    <i class="pi pi-eye"></i>
                    Live preview
                  </span>
                </div>
              </div>
            </section>

            <nav class="lesson-stepper" aria-label="Lesson editor steps">
              <button
                type="button"
                class="lesson-stepper-item"
                :class="{ active: currentStep === 1 }"
                @click="currentStep = 1"
              >
                <span>1</span>
                <strong>Información Básica</strong>
              </button>
              <button
                type="button"
                class="lesson-stepper-item"
                :class="{ active: currentStep === 2 }"
                @click="currentStep = 2"
              >
                <span>2</span>
                <strong>Disponibilidad y entrega</strong>
              </button>
              <button
                type="button"
                class="lesson-stepper-item"
                :class="{ active: currentStep === 3 }"
                @click="currentStep = 3"
              >
                <span>3</span>
                <strong>Constructor de Lección</strong>
              </button>
              <Button
                label="Vista preview"
                icon="pi pi-external-link"
                class="p-button-outlined lesson-stepper-preview"
                @click="openStudentPreview"
              />
            </nav>

            <section v-show="currentStep === 1" class="lesson-section-card lesson-step-panel">
              <div class="section-head">
                <div>
                  <h3>Información de muestra</h3>
                  <div class="dialog-field">
                    <label>Imagen de portada</label>

                    <div class="block-asset-toolbar">
                      <Button
                        label="Subir imagen"
                        icon="pi pi-upload"
                        class="p-button-sm"
                        @click="triggerCoverUpload"
                      />

                      <Button
                        label="Elegir de Media Library"
                        icon="pi pi-images"
                        class="p-button-sm p-button-outlined"
                        @click="openMediaLibraryForCover"
                      />

                      <Button
                        label="Quitar"
                        icon="pi pi-times"
                        class="p-button-sm p-button-text p-button-danger"
                        @click="form.coverImage = ''"
                        :disabled="!form.coverImage"
                      />
                    </div>

                    <div v-if="form.coverImage" class="block-file-preview">
                      <img :src="form.coverImage" class="block-preview-image" />
                    </div>
                  </div>
                  <small>Define los datos principales de la lección</small>
                </div>
              </div>

              <div class="lesson-info-grid">
                <div class="dialog-field">
                  <label>Title</label>
                  <InputText v-model="form.title" placeholder="Lesson title" />
                </div>

                <div class="dialog-field">
                  <label>Tipo</label>
                  <Dropdown
                    v-model="form.contentType"
                    :options="lessonTypeOptions"
                    optionLabel="label"
                    optionValue="value"
                  />
                </div>

              </div>
            </section>

            <section
              v-if="isNoticeType"
              v-show="currentStep === 2"
              class="lesson-section-card lesson-step-panel notice-editor-card"
            >
              <div class="section-head">
                <div>
                  <h3>Contenido del aviso</h3>
                  <small>Configura el mensaje visual que verá el estudiante.</small>
                </div>
              </div>

              <div class="lesson-info-grid">
                <div class="dialog-field">
                  <label>Título</label>
                  <InputText v-model="form.title" placeholder="Título del aviso" />
                </div>

                <div class="dialog-field">
                  <label>Tipo</label>
                  <Dropdown
                    v-model="form.contentType"
                    :options="lessonTypeOptions"
                    optionLabel="label"
                    optionValue="value"
                  />
                </div>
              </div>

              <div class="dialog-field">
                <label>Texto corto</label>
                <Textarea
                  v-model="form.noticeText"
                  rows="4"
                  autoResize
                  placeholder="Escribe el mensaje del aviso..."
                />
              </div>

              <div class="notice-media-grid">
                <div class="dialog-field">
                  <label>Imagen</label>
                  <div class="block-asset-toolbar">
                    <Button
                      label="Subir imagen"
                      icon="pi pi-upload"
                      class="p-button-sm"
                      @click="triggerCoverUpload"
                    />
                    <Button
                      label="Media Library"
                      icon="pi pi-images"
                      class="p-button-sm p-button-outlined"
                      @click="openMediaLibraryForCover"
                    />
                    <Button
                      label="Quitar"
                      icon="pi pi-times"
                      class="p-button-sm p-button-text p-button-danger"
                      @click="form.coverImage = ''"
                      :disabled="!form.coverImage"
                    />
                  </div>
                  <InputText
                    v-model="form.coverImage"
                    placeholder="O pega una URL de imagen"
                  />
                </div>

                <div class="dialog-field">
                  <label>Video opcional</label>
                  <InputText
                    v-model="form.noticeVideoUrl"
                    placeholder="Pega una URL de video"
                  />
                </div>
              </div>

              <div class="lesson-info-grid">
                <div class="dialog-field">
                  <label>Texto del botón</label>
                  <InputText
                    v-model="form.noticeExternalLabel"
                    placeholder="Ej. Abrir recurso"
                  />
                </div>

                <div class="dialog-field">
                  <label>URL destino</label>
                  <InputText
                    v-model="form.noticeExternalUrl"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </section>

            <section
              v-else
              v-show="currentStep === 2"
              class="lesson-section-card lesson-step-panel"
            >
              <div class="section-head">
                <div>
                  <h3>{{ availabilitySectionTitle }}</h3>
                  <small>{{ availabilitySectionHint }}</small>
                </div>
              </div>

              <div class="lesson-info-grid">
                <div class="dialog-field">
                  <label>{{ startDateLabel }}</label>
                  <Calendar
                    v-model="form.availableFrom"
                    :minDate="calendarMinDate"
                    showTime
                    showIcon
                    iconDisplay="input"
                    dateFormat="dd/mm/yy"
                    hourFormat="24"
                    showButtonBar
                    :manualInput="false"
                    placeholder="Sin fecha"
                  />
                </div>

                <div class="dialog-field">
                  <label>{{ endDateLabel }}</label>
                  <Calendar
                    v-model="form.dueAt"
                    :minDate="endDateMinDate"
                    showTime
                    showIcon
                    iconDisplay="input"
                    dateFormat="dd/mm/yy"
                    hourFormat="24"
                    showButtonBar
                    :manualInput="false"
                    placeholder="Sin fecha"
                  />
                </div>
              </div>

              <div v-if="isActivityType" class="lesson-switch-grid">
                <label class="lesson-switch-row">
                  <InputSwitch v-model="form.requiresSubmission" />
                  <span>Requiere entrega</span>
                </label>
                <label class="lesson-switch-row">
                  <InputSwitch v-model="form.allowLateSubmission" />
                  <span>Permitir entrega tarde</span>
                </label>
              </div>

              <div v-if="isActivityType && form.allowLateSubmission" class="lesson-info-grid">
                <div class="dialog-field">
                  <label>Fecha máxima para entrega tardía</label>
                  <Calendar
                    v-model="form.lateUntil"
                    :minDate="lateDateMinDate"
                    showTime
                    showIcon
                    iconDisplay="input"
                    dateFormat="dd/mm/yy"
                    hourFormat="24"
                    showButtonBar
                    :manualInput="false"
                    placeholder="Sin fecha máxima"
                  />
                </div>
              </div>
            </section>

            <section
              v-if="isActivityType || isAssessmentType"
              v-show="currentStep === 3"
              class="lesson-section-card lesson-step-panel"
            >
              <div class="section-head">
                <div>
                  <h3>Lesson pages</h3>
                  <small>Crea la lección por páginas y bloques</small>
                </div>
              </div>

              <div class="lesson-pages-builder">
                <aside class="lesson-pages-sidebar">
                  <div class="lesson-pages-sidebar-head">
                    <div>
                      <strong>Páginas</strong>
                      <small class="muted">
                        Selecciona una página para editar sus bloques.
                      </small>
                    </div>

                    <Button
                      icon="pi pi-plus"
                      class="p-button-sm"
                      aria-label="Add page"
                      @click="addPage"
                    />
                  </div>

                  <div class="lesson-pages-list">
                    <div
                      v-for="(page, pageIndex) in form.contentJson.pages"
                      :key="pageIndex"
                      role="button"
                      tabindex="0"
                      class="lesson-page-nav-item"
                      :class="{ active: activePreviewPage === pageIndex }"
                      @click="activePreviewPage = pageIndex"
                      @keydown.enter="activePreviewPage = pageIndex"
                      @keydown.space.prevent="activePreviewPage = pageIndex"
                    >
                      <span class="lesson-page-nav-number">{{ pageIndex + 1 }}</span>
                      <span class="lesson-page-nav-copy">
                        <strong>{{ getPageDisplayTitle(page, pageIndex) }}</strong>
                        <small>{{ page.blocks.length }} bloque(s)</small>
                      </span>
                      <span class="lesson-page-nav-actions">
                        <Button
                          icon="pi pi-arrow-up"
                          class="p-button-text p-button-sm"
                          @click.stop="movePage(pageIndex, -1)"
                          :disabled="pageIndex === 0"
                        />
                        <Button
                          icon="pi pi-arrow-down"
                          class="p-button-text p-button-sm"
                          @click.stop="movePage(pageIndex, 1)"
                          :disabled="
                            pageIndex === form.contentJson.pages.length - 1
                          "
                        />
                        <Button
                          icon="pi pi-trash"
                          class="p-button-text p-button-sm p-button-danger"
                          @click.stop="removePage(pageIndex)"
                          :disabled="form.contentJson.pages.length <= 1"
                        />
                      </span>
                    </div>
                  </div>

                  <div class="lesson-pages-help">
                    <strong>Constructor de lección</strong>
                    <small>
                      Organiza el contenido por páginas y agrega bloques de
                      texto, imagen, audio, video o quiz.
                    </small>
                  </div>
                </aside>

                <main class="lesson-page-editor">
                  <div class="pages-topbar">
                    <div class="pages-topbar-copy">
                      <strong>Construye la lección por páginas</strong>
                      <small class="muted">
                        Texto, imagen, audio y video. La vista previa se
                        actualiza mientras editas.
                      </small>
                    </div>

                    <div class="pages-topbar-actions">
                      <Button
                        icon="pi pi-images"
                        label="Media Library"
                        class="p-button-outlined"
                        @click="openMediaLibrary"
                      />
                    </div>
                  </div>

                  <div class="pages-builder">
                <div
                  v-for="(page, pageIndex) in form.contentJson.pages"
                  :key="pageIndex"
                  class="page-builder-card"
                  v-show="activePreviewPage === pageIndex"
                >
                  <div class="page-builder-head">
                    <div class="page-builder-head-fields">
                      <div class="dialog-field">
                        <label>Page title</label>
                        <InputText
                          v-model="page.title"
                          placeholder="Page title"
                        />
                      </div>

                      <div class="dialog-field">
                        <label>Layout</label>
                        <Dropdown
                          v-model="page.layout"
                          :options="layoutOptions"
                          optionLabel="label"
                          optionValue="value"
                        />
                      </div>
                    </div>

                    <div class="page-actions">
                      <Button
                        icon="pi pi-arrow-up"
                        class="p-button-text"
                        @click="movePage(pageIndex, -1)"
                        :disabled="pageIndex === 0"
                      />
                      <Button
                        icon="pi pi-arrow-down"
                        class="p-button-text"
                        @click="movePage(pageIndex, 1)"
                        :disabled="
                          pageIndex === form.contentJson.pages.length - 1
                        "
                      />
                      <Button
                        icon="pi pi-trash"
                        class="p-button-text p-button-danger"
                        @click="removePage(pageIndex)"
                        :disabled="form.contentJson.pages.length <= 1"
                      />
                    </div>
                  </div>

                  <div class="blocks-toolbar">
                    <Button
                      label="Texto"
                      icon="pi pi-align-left"
                      class="p-button-text"
                      @click="addBlock(pageIndex, 'text')"
                    />
                    <Button
                      label="Imagen"
                      icon="pi pi-image"
                      class="p-button-text"
                      @click="addBlock(pageIndex, 'image')"
                    />
                    <Button
                      label="Audio"
                      icon="pi pi-volume-up"
                      class="p-button-text"
                      @click="addBlock(pageIndex, 'audio')"
                    />
                    <Button
                      label="Video"
                      icon="pi pi-video"
                      class="p-button-text"
                      @click="addBlock(pageIndex, 'video')"
                    />
                    <Button
                      label="Quiz"
                      icon="pi pi-question-circle"
                      class="p-button-text"
                      @click="addBlock(pageIndex, 'quiz')"
                    />
                  </div>

                  <div v-if="!page.blocks.length" class="empty-state">
                    Esta página aún no tiene bloques.
                  </div>

                  <div v-else class="blocks-list">
                    <article
                      v-for="(block, blockIndex) in page.blocks"
                      :key="blockIndex"
                      class="block-editor-card lesson-content-card"
                    >
                      <header class="block-editor-head lesson-content-card__header">
                        <div class="lesson-content-card__title">
                          <span class="lesson-content-card__handle">
                            <i class="pi pi-bars"></i>
                          </span>
                          <span class="lesson-content-card__badge">
                            {{ block.type }}
                          </span>
                          <small>Bloque {{ blockIndex + 1 }}</small>
                        </div>

                        <div class="question-actions">
                          <Button
                            icon="pi pi-arrow-up"
                            class="p-button-text"
                            @click="moveBlock(pageIndex, blockIndex, -1)"
                            :disabled="blockIndex === 0"
                          />
                          <Button
                            icon="pi pi-arrow-down"
                            class="p-button-text"
                            @click="moveBlock(pageIndex, blockIndex, 1)"
                            :disabled="
                              blockIndex ===
                              form.contentJson.pages[pageIndex].blocks.length -
                                1
                            "
                          />
                          <Button
                            icon="pi pi-trash"
                            class="p-button-text p-button-danger"
                            @click="removeBlock(pageIndex, blockIndex)"
                          />
                        </div>
                      </header>

                      <div class="lesson-content-card__body">
                        <div class="lesson-content-card__section lesson-content-card__section--config">
                          <div class="dialog-field">
                            <label>Block title</label>
                            <InputText
                              v-model="block.title"
                              placeholder="Optional title"
                            />
                          </div>
                        </div>

                        <div v-if="block.type === 'text'" class="lesson-content-card__section">
                          <div class="dialog-field">
                            <div class="text-editor-label-row">
                              <label>Content</label>
                              <Button
                                label="Enlace"
                                icon="pi pi-link"
                                class="p-button-sm p-button-text"
                                @click="insertTextLink(pageIndex, blockIndex)"
                              />
                            </div>
                            <Textarea
                              v-model="block.content"
                              autoResize
                              rows="5"
                              :data-text-block-editor="`${pageIndex}-${blockIndex}`"
                              placeholder="Escribe texto. Selecciona una palabra y usa Enlace para vincularla."
                            />
                          </div>
                        </div>

                      <template
                        v-else-if="
                          block.type === 'image' || block.type === 'audio'
                        "
                      >
                        <div class="lesson-content-card__section lesson-content-card__section--actions">
                          <div class="block-asset-toolbar">
                            <Button
                              :label="
                                block.type === 'image'
                                  ? 'Subir imagen'
                                  : 'Subir audio'
                              "
                              :icon="
                                block.type === 'image'
                                  ? 'pi pi-upload'
                                  : 'pi pi-volume-up'
                              "
                              class="p-button-sm"
                              @click="
                                triggerBlockUpload(
                                  pageIndex,
                                  blockIndex,
                                  block.type,
                                )
                              "
                            />
                            <Button
                              label="Elegir de Media Library"
                              icon="pi pi-images"
                              class="p-button-sm p-button-outlined"
                              @click="
                                openMediaLibraryForBlock(
                                  pageIndex,
                                  blockIndex,
                                  block.type,
                                )
                              "
                            />
                            <Button
                              label="Quitar"
                              icon="pi pi-times"
                              class="p-button-sm p-button-text p-button-danger"
                              @click="clearBlockAsset(pageIndex, blockIndex)"
                              :disabled="!block.src && !block.embedUrl"
                            />
                          </div>
                        </div>

                        <div class="lesson-content-card__section lesson-content-card__section--asset">
                          <div
                            class="block-file-preview"
                            :class="{ empty: !block.src && !block.embedUrl }"
                          >
                            <template v-if="block.src || block.embedUrl">
                              <img
                                v-if="block.type === 'image' && block.src"
                                :src="block.src"
                                alt=""
                                class="block-preview-image"
                              />

                              <audio
                                v-else-if="block.type === 'audio' && block.src"
                                :src="block.src"
                                controls
                                class="block-preview-audio"
                              ></audio>

                              <div class="block-preview-meta">
                                <strong>{{ getBlockPreviewLabel(block) }}</strong>
                                <small class="muted block-url">
                                  {{ block.embedUrl || block.src }}
                                </small>
                              </div>
                            </template>

                            <template v-else>
                              <div class="block-preview-meta">
                                <strong>No file selected yet</strong>
                                <small class="muted">
                                  Usa subir archivo o Media Library para asignar
                                  este bloque.
                                </small>
                              </div>
                            </template>
                          </div>
                        </div>

                        <div class="lesson-content-card__section lesson-content-card__section--config">
                          <div v-if="block.type === 'audio'" class="dialog-field">
                            <label>SoundCloud URL</label>
                            <InputText
                              v-model="block.embedUrl"
                              placeholder="https://soundcloud.com/usuario/audio"
                            />
                          </div>

                          <div class="dialog-field">
                            <label>Caption</label>
                            <InputText
                              v-model="block.caption"
                              placeholder="Optional caption"
                            />
                          </div>
                        </div>
                      </template>

                      <template v-else-if="block.type === 'video'">
                        <div class="lesson-content-card__section lesson-content-card__section--actions">
                          <div class="block-asset-toolbar">
                            <Button
                              label="Subir video"
                              icon="pi pi-upload"
                              class="p-button-sm"
                              @click="
                                triggerBlockUpload(pageIndex, blockIndex, 'video')
                              "
                            />
                            <Button
                              label="Quitar"
                              icon="pi pi-times"
                              class="p-button-sm p-button-text p-button-danger"
                              @click="clearBlockAsset(pageIndex, blockIndex)"
                              :disabled="!block.src"
                            />
                          </div>
                        </div>

                        <div class="lesson-content-card__section lesson-content-card__section--config">
                          <div class="dialog-field">
                            <label>Video URL (opcional)</label>
                            <InputText
                              v-model="block.src"
                              placeholder="https://... o se llenará al subir video"
                            />
                          </div>
                        </div>

                        <div class="lesson-content-card__section lesson-content-card__section--asset">
                          <div
                            class="block-file-preview"
                            :class="{ empty: !block.src }"
                          >
                            <div class="block-preview-meta">
                              <strong>{{ getBlockPreviewLabel(block) }}</strong>
                              <small class="muted block-url">
                                {{
                                  block.src || "Sube un video o pega un enlace."
                                }}
                              </small>
                            </div>
                          </div>
                        </div>

                        <div class="lesson-content-card__section lesson-content-card__section--config">
                          <div class="dialog-field">
                            <label>Caption</label>
                            <InputText
                              v-model="block.caption"
                              placeholder="Optional caption"
                            />
                          </div>
                        </div>
                      </template>

                      <template v-else-if="block.type === 'quiz'">
                        <div class="lesson-content-card__section lesson-content-card__section--config">
                          <div class="dialog-field">
                            <label>Quiz block mode</label>
                            <Dropdown
                              v-model="block.quizMode"
                              :options="[
                                {
                                  label: 'Pregunta individual',
                                  value: 'single_question',
                                },
                                {
                                  label: 'Quiz completo de la lección',
                                  value: 'lesson_quiz',
                                },
                              ]"
                              optionLabel="label"
                              optionValue="value"
                              class="w-full"
                            />
                          </div>

                          <div
                            v-if="block.quizMode === 'single_question'"
                            class="dialog-field"
                          >
                            <label>Seleccionar pregunta</label>
                            <Dropdown
                              v-model="block.questionId"
                              :options="quizQuestionSelectOptions"
                              optionLabel="label"
                              optionValue="value"
                              placeholder="Selecciona una pregunta ya creada"
                              class="w-full"
                            />

                            <small class="muted">
                              Aquí eliges una pregunta del quiz que ya está creada
                              abajo.
                            </small>
                          </div>

                          <div class="dialog-field">
                            <label>Mostrar feedback</label>
                            <Dropdown
                              v-model="block.showFeedback"
                              :options="[
                                { label: 'Sí', value: true },
                                { label: 'No', value: false },
                              ]"
                              optionLabel="label"
                              optionValue="value"
                              class="w-full"
                            />
                          </div>
                        </div>

                        <div class="lesson-content-card__section lesson-content-card__section--asset">
                          <div class="block-file-preview">
                            <div class="block-preview-meta">
                              <strong>
                                {{
                                  block.quizMode === "lesson_quiz"
                                    ? "Quiz completo de la lección"
                                    : "Pregunta individual"
                                }}
                              </strong>

                              <small class="muted">
                                {{
                                  block.quizMode === "lesson_quiz"
                                    ? `${quizQuestions.length} preguntas disponibles`
                                    : block.questionId
                                      ? quizQuestions.find(
                                          (q) =>
                                            String(q.id) ===
                                            String(block.questionId),
                                        )?.questionText || "Pregunta seleccionada"
                                      : "No has seleccionado una pregunta"
                                }}
                              </small>
                            </div>
                          </div>
                        </div>
                      </template>
                      </div>
                    </article>
                  </div>

                  <div class="blocks-toolbar blocks-toolbar-bottom">
                    <span>Agregar bloque</span>
                    <Button
                      label="Texto"
                      icon="pi pi-align-left"
                      class="p-button-text"
                      @click="addBlock(pageIndex, 'text')"
                    />
                    <Button
                      label="Imagen"
                      icon="pi pi-image"
                      class="p-button-text"
                      @click="addBlock(pageIndex, 'image')"
                    />
                    <Button
                      label="Audio"
                      icon="pi pi-volume-up"
                      class="p-button-text"
                      @click="addBlock(pageIndex, 'audio')"
                    />
                    <Button
                      label="Video"
                      icon="pi pi-video"
                      class="p-button-text"
                      @click="addBlock(pageIndex, 'video')"
                    />
                    <Button
                      label="Quiz"
                      icon="pi pi-question-circle"
                      class="p-button-text"
                      @click="addBlock(pageIndex, 'quiz')"
                    />
                  </div>
                </div>
              </div>
                </main>
              </div>
            </section>

            <section
              v-if="isActivityType || isAssessmentType"
              v-show="currentStep === 3"
              class="lesson-section-card lesson-step-panel quiz-card"
            >
              <div class="section-head section-head-split quiz-head-pro">
                <div>
                  <h3>Quiz</h3>
                  <small>
                    Configura las preguntas y mejora la experiencia de
                    evaluación
                  </small>
                </div>

                <div class="quiz-status-box">
                  <span class="quiz-status-label">Status</span>
                  <Tag
                    :value="quizReady ? 'Ready' : 'Needs setup'"
                    :severity="quizReady ? 'success' : 'warning'"
                  />
                </div>
              </div>

              <div class="quiz-overview">
                <div class="quiz-stat-card">
                  <span>Total questions</span>
                  <strong>{{ quizQuestions.length }}</strong>
                </div>
                <div class="quiz-stat-card">
                  <span>Quiz questions</span>
                  <strong>{{ quizQuestions.length }}</strong>
                </div>
                <div class="quiz-stat-card">
                  <span>Readiness</span>
                  <strong>{{ quizReady ? "Complete" : "Pending" }}</strong>
                </div>
              </div>

              <div class="quiz-actions">
                <Button
                  label="Reload"
                  icon="pi pi-refresh"
                  class="p-button-text"
                  @click="loadQuiz"
                  :disabled="quizLoading"
                />
                <Button
                  label="Add question"
                  icon="pi pi-plus"
                  @click="openQuestionDialog()"
                />
              </div>

              <div v-if="quizLoading">
                <Skeleton height="3rem" class="mb-2" />
                <Skeleton height="3rem" class="mb-2" />
              </div>

              <div v-else-if="quizError" class="empty-state">
                Failed to load quiz.
                <Button label="Retry" class="p-button-text" @click="loadQuiz" />
              </div>

              <div v-else>
                <div
                  v-if="!quizQuestions.length"
                  class="empty-state quiz-empty-pro"
                >
                  <div class="empty-quiz-icon">
                    <i class="pi pi-question-circle"></i>
                  </div>
                  <div>
                    <strong>No questions yet</strong>
                    <p>
                      Click “Add question” to start building the lesson quiz.
                    </p>
                  </div>
                </div>

                <div v-else>
                  <DataTable
                    :value="sortedQuestions"
                    v-model:selection="selectedQuestion"
                    selectionMode="single"
                    dataKey="id"
                    class="mb-3 lesson-quiz-table"
                    responsiveLayout="scroll"
                  >
                    <Column field="orderIndex" header="#" style="width: 5rem" />
                    <Column field="questionText" header="Question" />
                    <Column header="Points" style="width: 6rem">
                      <template #body="{ data }">
                        {{ data.points ?? 1 }}
                      </template>
                    </Column>
                    <Column header="Type" style="width: 10rem">
                      <template #body="{ data }">
                        <Tag
                          :value="questionTypeLabel(data.questionType)"
                          severity="info"
                        />
                      </template>
                    </Column>
                    <Column header="Options" style="width: 8rem">
                      <template #body="{ data }">
                        {{ data.options?.length || 0 }}
                      </template>
                    </Column>
                    <Column header="Actions" style="width: 14rem">
                      <template #body="{ data }">
                        <div class="question-actions">
                          <Button
                            icon="pi pi-arrow-up"
                            class="p-button-text"
                            @click.stop="moveQuestion(data, -1)"
                            :disabled="!canMoveQuestion(data, -1)"
                          />
                          <Button
                            icon="pi pi-arrow-down"
                            class="p-button-text"
                            @click.stop="moveQuestion(data, 1)"
                            :disabled="!canMoveQuestion(data, 1)"
                          />
                          <Button
                            icon="pi pi-pencil"
                            class="p-button-text"
                            @click.stop="openQuestionDialog(data)"
                          />
                          <Button
                            icon="pi pi-trash"
                            class="p-button-text p-button-danger"
                            @click.stop="removeQuestion(data)"
                          />
                        </div>
                      </template>
                    </Column>
                  </DataTable>
                </div>
              </div>
            </section>
          </main>

          <aside v-if="false" class="lesson-sidebar">
            <div class="sidebar-card preview-card">
              <div class="preview-card-head">
                <div>
                  <h4>Live preview</h4>
                  <p class="sidebar-save-text">
                    Así va quedando la lección mientras editas.
                  </p>
                </div>
              </div>

              <div class="lesson-preview-shell">
                <template v-if="isNoticeType">
                  <article class="notice-preview-card">
                    <img
                      v-if="form.coverImage"
                      :src="form.coverImage"
                      :alt="form.title"
                      class="notice-preview-image"
                    />
                    <div class="notice-preview-body">
                      <span class="notice-preview-kicker">Aviso</span>
                      <h2>{{ form.title || "Título del aviso" }}</h2>
                      <p v-if="form.noticeText">{{ form.noticeText }}</p>
                      <p v-else class="notice-preview-muted">
                        El texto corto del aviso aparecerá aquí.
                      </p>

                      <div
                        v-if="form.noticeVideoUrl || form.noticeExternalUrl"
                        class="notice-preview-actions"
                      >
                        <a
                          v-if="form.noticeVideoUrl"
                          :href="form.noticeVideoUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ver video
                        </a>
                        <a
                          v-if="form.noticeExternalUrl"
                          :href="form.noticeExternalUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {{ form.noticeExternalLabel || "Abrir enlace" }}
                        </a>
                      </div>

                      <div
                        v-if="form.availableFrom || form.dueAt"
                        class="notice-preview-dates"
                      >
                        <span v-if="form.availableFrom">
                          Desde {{ formatTimestamp(form.availableFrom) }}
                        </span>
                        <span v-if="form.dueAt">
                          Hasta {{ formatTimestamp(form.dueAt) }}
                        </span>
                      </div>
                    </div>
                  </article>
                </template>

                <template v-else>
                <div class="lesson-preview-header">
                  <h2>{{ form.title || "Untitled lesson" }}</h2>
                  <span>{{ lessonTypeLabel }}</span>
                </div>

                <div v-if="!previewPages.length" class="preview-empty">
                  No hay páginas todavía.
                </div>

                <div v-else class="lesson-preview-pages">
                  <div class="preview-tabs">
                    <button
                      v-for="(page, pageIndex) in previewPages"
                      :key="`preview-tab-${pageIndex}`"
                      type="button"
                      class="preview-tab"
                      :class="{ active: activePreviewPage === pageIndex }"
                      @click="activePreviewPage = pageIndex"
                    >
                      {{ getPageDisplayTitle(page, pageIndex) }}
                    </button>
                  </div>

                  <section
                    v-if="currentPreviewPage"
                    class="lesson-preview-page"
                  >
                    <div class="lesson-preview-page-head">
                      <small>Página {{ activePreviewPage + 1 }}</small>
                      <h3>
                        {{
                          getPageDisplayTitle(
                            currentPreviewPage,
                            activePreviewPage,
                          )
                        }}
                      </h3>
                    </div>

                    <div
                      class="lesson-preview-blocks"
                      :class="layoutClass(currentPreviewPage.layout)"
                    >
                      <div
                        v-for="(block, blockIndex) in currentPreviewPage.blocks"
                        :key="`preview-block-${activePreviewPage}-${blockIndex}`"
                        class="lesson-preview-block"
                      >
                        <template v-if="block.type === 'text'">
                          <h4 v-if="block.title">{{ block.title }}</h4>
                          <p
                            v-if="block.content"
                            class="preview-text"
                            v-html="renderTextContent(block.content)"
                          />
                          <div v-else class="preview-empty-inline">
                            Bloque de texto vacío
                          </div>
                        </template>

                        <template v-else-if="block.type === 'image'">
                          <h4 v-if="block.title">{{ block.title }}</h4>
                          <img
                            v-if="block.src"
                            :src="block.src"
                            alt=""
                            class="preview-image"
                          />
                          <div v-else class="preview-empty-inline">
                            Imagen pendiente
                          </div>
                          <p v-if="block.caption" class="preview-caption">
                            {{ block.caption }}
                          </p>
                        </template>

                        <template v-else-if="block.type === 'audio'">
                          <h4 v-if="block.title">{{ block.title }}</h4>

                          <div
                            v-if="isSoundCloudUrl(block.embedUrl)"
                            class="preview-audio-frame"
                          >
                            <iframe
                              :src="normalizeSoundCloudEmbedUrl(block.embedUrl)"
                              allow="autoplay"
                              loading="lazy"
                              frameborder="0"
                            ></iframe>
                          </div>

                          <audio
                            v-else-if="block.src"
                            :src="block.src"
                            controls
                            class="preview-audio"
                          ></audio>

                          <div v-else class="preview-empty-inline">
                            Audio pendiente
                          </div>

                          <p v-if="block.caption" class="preview-caption">
                            {{ block.caption }}
                          </p>
                        </template>

                        <template v-else-if="block.type === 'video'">
                          <h4 v-if="block.title">{{ block.title }}</h4>

                          <div
                            v-if="getPreviewEmbedType(block.src) === 'youtube'"
                            class="preview-video-frame"
                          >
                            <iframe
                              :src="getYoutubeEmbedUrl(block.src)"
                              allow="
                                accelerometer;
                                autoplay;
                                clipboard-write;
                                encrypted-media;
                                gyroscope;
                                picture-in-picture;
                              "
                              allowfullscreen
                            ></iframe>
                          </div>

                          <div
                            v-else-if="
                              getPreviewEmbedType(block.src) === 'vimeo'
                            "
                            class="preview-video-frame"
                          >
                            <iframe
                              :src="getVimeoEmbedUrl(block.src)"
                              allow="autoplay; fullscreen; picture-in-picture"
                              allowfullscreen
                            ></iframe>
                          </div>

                          <div
                            v-else-if="
                              getPreviewEmbedType(block.src) === 'loom'
                            "
                            class="preview-video-frame"
                          >
                            <iframe
                              :src="getLoomEmbedUrl(block.src)"
                              allowfullscreen
                            ></iframe>
                          </div>

                          <div v-else-if="block.src" class="preview-link-box">
                            <a :href="block.src" target="_blank" rel="noopener">
                              Abrir video
                            </a>
                          </div>

                          <div v-else class="preview-empty-inline">
                            Video pendiente
                          </div>

                          <p v-if="block.caption" class="preview-caption">
                            {{ block.caption }}
                          </p>
                        </template>

                        <template v-else-if="block.type === 'quiz'">
                          <h4 v-if="block.title">{{ block.title }}</h4>

                          <div class="preview-quiz-box">
                            <template v-if="block.quizMode === 'lesson_quiz'">
                              <div class="preview-quiz-head">
                                <strong>Quiz de la lección</strong>
                                <small
                                  >{{
                                    sortedQuestions.length
                                  }}
                                  pregunta(s)</small
                                >
                              </div>

                              <div
                                v-for="(question, qIndex) in sortedQuestions"
                                :key="question.id || qIndex"
                                class="preview-quiz-question"
                              >
                                <div class="preview-quiz-question-title">
                                  {{ qIndex + 1 }}.
                                  {{
                                    question.questionText ||
                                    "Pregunta sin texto"
                                  }}
                                </div>

                                <div
                                  v-if="questionUsesOptions(question)"
                                  class="preview-quiz-options"
                                >
                                  <label
                                    v-for="(
                                      option, optIndex
                                    ) in getQuestionOptions(question)"
                                    :key="option.id || optIndex"
                                    class="preview-quiz-option"
                                  >
                                    <input
                                      :type="
                                        question.questionType ===
                                        'multiple_choice'
                                          ? 'checkbox'
                                          : 'radio'
                                      "
                                      :name="`preview-lesson-quiz-${question.id}`"
                                      disabled
                                    />
                                    <span>{{ option.optionText }}</span>
                                  </label>
                                </div>

                                <div v-else class="preview-quiz-answer-box">
                                  <span
                                    v-if="
                                      question.questionType === 'short_text'
                                    "
                                    >Respuesta corta...</span
                                  >
                                  <span
                                    v-else-if="
                                      question.questionType === 'long_text'
                                    "
                                    >Respuesta larga...</span
                                  >
                                  <span
                                    v-else-if="
                                      question.questionType === 'numeric'
                                    "
                                    >Respuesta numérica...</span
                                  >
                                  <span v-else
                                    >Tipo de pregunta no visualizable</span
                                  >
                                </div>
                              </div>
                            </template>

                            <template v-else>
                              <div v-if="getSelectedPreviewQuestion(block)">
                                <div class="preview-quiz-head">
                                  <strong>Pregunta individual</strong>
                                  <small>
                                    {{
                                      questionTypeLabel(
                                        getSelectedPreviewQuestion(block)
                                          ?.questionType || "",
                                      )
                                    }}
                                  </small>
                                </div>

                                <div class="preview-quiz-question">
                                  <div class="preview-quiz-question-title">
                                    {{
                                      getSelectedPreviewQuestion(block)
                                        ?.questionText
                                    }}
                                  </div>

                                  <div
                                    v-if="
                                      questionUsesOptions(
                                        getSelectedPreviewQuestion(block),
                                      )
                                    "
                                    class="preview-quiz-options"
                                  >
                                    <label
                                      v-for="(
                                        option, optIndex
                                      ) in getQuestionOptions(
                                        getSelectedPreviewQuestion(block),
                                      )"
                                      :key="option.id || optIndex"
                                      class="preview-quiz-option"
                                    >
                                      <input
                                        :type="
                                          getSelectedPreviewQuestion(block)
                                            ?.questionType === 'multiple_choice'
                                            ? 'checkbox'
                                            : 'radio'
                                        "
                                        :name="`preview-single-quiz-${block.questionId}`"
                                        disabled
                                      />
                                      <span>{{ option.optionText }}</span>
                                    </label>
                                  </div>

                                  <div v-else class="preview-quiz-answer-box">
                                    <span
                                      v-if="
                                        getSelectedPreviewQuestion(block)
                                          ?.questionType === 'short_text'
                                      "
                                    >
                                      Respuesta corta...
                                    </span>
                                    <span
                                      v-else-if="
                                        getSelectedPreviewQuestion(block)
                                          ?.questionType === 'long_text'
                                      "
                                    >
                                      Respuesta larga...
                                    </span>
                                    <span
                                      v-else-if="
                                        getSelectedPreviewQuestion(block)
                                          ?.questionType === 'numeric'
                                      "
                                    >
                                      Respuesta numérica...
                                    </span>
                                  </div>

                                  <div
                                    v-if="block.showFeedback"
                                    class="preview-quiz-feedback-note"
                                  >
                                    Feedback activado
                                  </div>
                                </div>
                              </div>

                              <div v-else class="preview-empty-inline">
                                No has seleccionado una pregunta todavía.
                              </div>
                            </template>
                          </div>
                        </template>
                      </div>

                      <div
                        v-if="!currentPreviewPage.blocks.length"
                        class="lesson-preview-block preview-empty-inline"
                      >
                        Sin bloques en esta página.
                      </div>
                    </div>
                  </section>
                </div>
                </template>
              </div>
            </div>

            <div class="sidebar-card">
              <h4>Lesson details</h4>

              <div class="sidebar-stat">
                <span>Title</span>
                <strong>{{ form.title || "Untitled" }}</strong>
              </div>

              <div class="sidebar-stat">
                <span>Status</span>
                <strong>{{
                  lesson?.is_published ? "Published" : "Draft"
                }}</strong>
              </div>

              <div class="sidebar-stat">
                <span>Questions</span>
                <strong>{{ quizQuestions.length }}</strong>
              </div>
            </div>

            <div class="sidebar-card">
              <h4>Quick actions</h4>
              <div class="sidebar-actions">
                <Button
                  label="Open Media Library"
                  icon="pi pi-images"
                  class="p-button-outlined w-full"
                  @click="openMediaLibrary"
                />
              </div>
            </div>

            <div class="sidebar-card sidebar-save-card">
              <h4>Save</h4>
              <p class="sidebar-save-text">
                Guarda cuando termines. Este editor ya trabaja sobre la
                estructura nueva por bloques.
              </p>
              <Button
                label="Save changes"
                :loading="saving"
                class="w-full"
                @click="saveLesson"
              />
            </div>
          </aside>
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="questionDialogVisible"
      :header="questionDialogTitle"
      modal
      class="dialog"
      maximizable
      maximized
    >
      <div class="dialog-field">
        <label>Question text</label>
        <InputText
          v-model="questionForm.questionText"
          placeholder="What is...?"
        />
      </div>

      <div class="dialog-field">
        <label>Question type</label>
        <Dropdown
          v-model="questionForm.questionType"
          :options="questionTypeOptions"
          optionLabel="label"
          optionValue="value"
        />
      </div>

      <div v-if="questionDialogUsesOptions" class="dialog-field">
        <label>Options</label>

        <div class="options-editor">
          <div
            v-for="(opt, idx) in questionForm.draftOptions"
            :key="opt.id || idx"
            class="option-row"
          >
            <div class="option-order question-actions">
              <Button
                icon="pi pi-arrow-up"
                class="p-button-text"
                @click="moveQuestionFormOption(idx, -1)"
                :disabled="idx === 0"
              />
              <Button
                icon="pi pi-arrow-down"
                class="p-button-text"
                @click="moveQuestionFormOption(idx, 1)"
                :disabled="idx === questionForm.draftOptions.length - 1"
              />
            </div>

            <InputText
              v-model="opt.optionText"
              placeholder="Option text"
              class="option-input"
            />

            <div class="option-correct checkbox-row">
              <template v-if="questionForm.questionType === 'single_choice'">
                <RadioButton
                  :inputId="`opt-correct-${idx}`"
                  name="correct-option"
                  :value="idx"
                  v-model="singleChoiceCorrectIndex"
                  @update:modelValue="setSingleCorrect(idx)"
                />
                <label :for="`opt-correct-${idx}`" class="muted">Correct</label>
              </template>

              <template v-else>
                <Checkbox
                  :binary="true"
                  v-model="opt.isCorrect"
                  :inputId="`opt-cb-${idx}`"
                />
                <label :for="`opt-cb-${idx}`" class="muted">Correct</label>
              </template>
            </div>

            <Button
              icon="pi pi-trash"
              class="p-button-text p-button-danger"
              @click="removeQuestionFormOption(idx)"
              :disabled="questionForm.draftOptions.length <= 2"
            />
          </div>

          <Button
            icon="pi pi-plus"
            label="Add option"
            class="p-button-text"
            @click="addQuestionFormOption()"
          />
        </div>

        <small class="muted">
          Single choice: select exactly one correct option. Multiple choice:
          select one or more.
        </small>
      </div>

      <div v-if="questionDialogShowsTrueFalseSelector" class="dialog-field">
        <label>Correct answer</label>
        <Dropdown
          v-model="questionForm.trueFalseCorrect"
          :options="trueFalseCorrectOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Select correct answer"
        />
        <small class="muted">
          True/False options are generated automatically; choose the correct
          answer here.
        </small>
      </div>

      <div class="dialog-field">
        <label>Points</label>
        <InputNumber
          v-model.number="questionForm.points"
          :min="0"
          step="0.5"
          showButtons
        />
      </div>

      <div class="dialog-field">
        <label>Explanation</label>
        <Textarea v-model="questionForm.explanation" autoResize />
      </div>

      <Button
        class="p-button-text"
        icon="pi pi-chevron-down"
        label="Advanced"
        @click="questionAdvancedOpen = !questionAdvancedOpen"
      />

      <div v-if="questionAdvancedOpen" class="dialog-field">
        <label>Meta (JSON)</label>
        <Textarea
          v-model="questionForm.metaJson"
          autoResize
          placeholder='{"hint":"Hint text","regex":"^\\d+$"}'
        />
      </div>

      <div class="dialog-actions">
        <Button
          label="Cancel"
          class="p-button-text"
          @click="closeQuestionDialog"
        />
        <Button label="Save" :loading="questionSaving" @click="saveQuestion" />
      </div>
    </Dialog>

    <Dialog
      v-model:visible="mediaLibraryVisible"
      modal
      :dismissableMask="true"
      :closeOnEscape="true"
      :draggable="false"
      :blockScroll="true"
      class="media-library-dialog"
      :style="{ width: 'min(98vw, 1100px)' }"
    >
      <template #header>
        <div class="media-library-header">
          <div>
            <strong>Media Library</strong>
            <small class="muted">Browse and insert existing assets</small>
          </div>
        </div>
      </template>

      <div class="media-library-content">
        <div class="media-library-toolbar">
          <InputText
            v-model="mediaLibrarySearch"
            placeholder="Search assets..."
            aria-label="Search assets"
          />

          <div class="media-library-tabs">
            <Button
              label="Imágenes"
              :class="[
                'p-button-sm',
                mediaLibraryTab === 'image' ? '' : 'p-button-outlined',
              ]"
              @click="mediaLibraryTab = 'image'"
            />
            <Button
              label="Audio"
              :class="[
                'p-button-sm',
                mediaLibraryTab === 'audio' ? '' : 'p-button-outlined',
              ]"
              @click="mediaLibraryTab = 'audio'"
            />
            <Button
              label="Archivos"
              :class="[
                'p-button-sm',
                mediaLibraryTab === 'file' ? '' : 'p-button-outlined',
              ]"
              @click="mediaLibraryTab = 'file'"
            />
          </div>

          <div class="media-library-upload">
            <Button
              label="Upload Image"
              icon="pi pi-image"
              class="p-button-text p-button-sm"
              :disabled="assetsUploadProcessing"
              @click="triggerAssetInput('image')"
            />
            <Button
              label="Upload Audio"
              icon="pi pi-music"
              class="p-button-text p-button-sm"
              :disabled="assetsUploadProcessing"
              @click="triggerAssetInput('audio')"
            />
            <Button
              label="Upload File"
              icon="pi pi-upload"
              class="p-button-text p-button-sm"
              :disabled="assetsUploadProcessing"
              @click="triggerAssetInput('file')"
            />
            <Button
              label="Refresh"
              icon="pi pi-refresh"
              class="p-button-text p-button-sm"
              @click="refreshAssets"
            />
          </div>
        </div>

        <div class="media-library-list">
          <div v-if="assetsUploadProcessing" class="assets-loading">
            Uploading file...
          </div>

          <div v-if="assetsLoading" class="assets-loading">
            <Skeleton height="2rem" class="mb-2" />
            <Skeleton height="2rem" />
          </div>

          <div v-else-if="assetsError" class="assets-error">
            Unable to load assets.
            <Button
              label="Retry"
              class="p-button-text"
              icon="pi pi-refresh"
              @click="refreshAssets"
            />
          </div>

          <div v-else-if="filteredAssets.length" class="assets-list">
            <div
              v-for="asset in filteredAssets"
              :key="asset.assetId"
              class="asset-row"
            >
              <div class="asset-preview">
                <img
                  v-if="assetKindValue(asset) === 'image'"
                  :src="resolveAssetUrl(asset.url)"
                  alt=""
                />
                <div v-else class="asset-icon">
                  {{ asset.kind?.charAt(0)?.toUpperCase() || "?" }}
                </div>
              </div>

              <div class="asset-info">
                <div class="asset-title">
                  {{ asset.originalName || asset.assetId }}
                </div>
                <div class="asset-meta">
                  <Tag :value="asset.kind" severity="info" />
                  <small>{{ asset.mimeType }}</small>
                  <small>{{ formatTimestamp(asset.createdAt) }}</small>
                </div>
              </div>

              <div class="asset-actions">
                <Button
                  icon="pi pi-copy"
                  class="p-button-text p-button-sm"
                  label="Copy"
                  @click="copyAssetUrl(resolveAssetUrl(asset.url))"
                  aria-label="Copy asset URL"
                />
                <Button
                  icon="pi pi-arrow-down"
                  class="p-button-text p-button-sm"
                  label="Insert"
                  @click="handleInsertAsset(asset)"
                  aria-label="Insert asset into editor"
                />
              </div>
            </div>
          </div>

          <div v-else class="assets-empty">
            No assets found for this filter.
          </div>
        </div>
      </div>
    </Dialog>

    <Dialog
      v-model:visible="linkDialogVisible"
      modal
      header="Agregar enlace"
      class="link-editor-dialog"
      :style="{ width: '28rem', maxWidth: 'calc(100vw - 2rem)' }"
    >
      <div class="link-editor-form">
        <div class="dialog-field">
          <label>Texto visible</label>
          <InputText
            v-model="linkForm.text"
            placeholder="Texto que vera el estudiante"
            autofocus
          />
        </div>

        <div class="dialog-field">
          <label>URL</label>
          <InputText
            v-model="linkForm.url"
            placeholder="https://ejemplo.com"
            @keyup.enter="confirmTextLink"
          />
          <small class="muted">Acepta http(s), mailto, tel, /ruta o #ancla.</small>
        </div>
      </div>

      <template #footer>
        <Button
          label="Cancelar"
          class="p-button-text"
          @click="closeLinkDialog"
        />
        <Button
          label="Insertar enlace"
          icon="pi pi-link"
          @click="confirmTextLink"
        />
      </template>
    </Dialog>

    <input
      ref="imageInputRef"
      type="file"
      accept="image/*"
      style="display: none"
      @change="handleAssetSelection('image', $event)"
    />

    <input
      ref="audioInputRef"
      type="file"
      accept="audio/*"
      style="display: none"
      @change="handleAssetSelection('audio', $event)"
    />

    <input
      ref="videoInputRef"
      type="file"
      accept="video/*"
      style="display: none"
      @change="handleAssetSelection('video', $event)"
    />

    <input
      ref="fileInputRef"
      type="file"
      accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
      style="display: none"
      @change="handleAssetSelection('file', $event)"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "primevue/usetoast";
import Textarea from "primevue/textarea";
import DOMPurify from "dompurify";
import { useAuthStore } from "../stores/auth";

import {
  getLesson,
  updateLesson,
  publishLesson,
  unpublishLesson,
  getLessonQuiz,
  createQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
  createQuizOption,
  updateQuizOption,
  deleteQuizOption,
  listAssets,
  uploadAssetFile,
} from "../api/cms";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();

const lessonId = route.params.id;
const moduleId = route.query.moduleId;
const courseId = route.query.courseId;

const lesson = ref(null);
const loading = ref(true);
const saving = ref(false);
const activePreviewPage = ref(0);
const currentStep = ref(1);

const form = ref({
  coverImage: "",
  contentType: "activity",
  title: "",
  noticeText: "",
  noticeVideoUrl: "",
  noticeExternalLabel: "",
  noticeExternalUrl: "",
  contentHtml: "",
  contentMarkdown: "",
  availableFrom: null,
  dueAt: null,
  allowLateSubmission: false,
  lateUntil: null,
  requiresSubmission: false,
  contentJson: {
    pages: [
      {
        title: "Page 1",
        layout: "single-column",
        blocks: [],
      },
    ],
  },
});

const initialLessonSnapshot = ref(null);

const lessonTypeOptions = [
  { label: "Aviso", value: "banner" },
  { label: "Actividad", value: "activity" },
  { label: "Evaluacion", value: "assessment" },
];

const normalizeEditorLessonType = (value) => {
  const type = String(value || "activity").toLowerCase();
  if (type === "banner" || type === "notice" || type === "aviso") return "banner";
  if (type === "assessment" || type === "evaluation") return "assessment";
  return "activity";
};

const isNoticeType = computed(() => form.value.contentType === "banner");
const isActivityType = computed(() => form.value.contentType === "activity");
const isAssessmentType = computed(() => form.value.contentType === "assessment");
const canSavePastLessonDates = computed(() =>
  auth.hasAnyRole(["admin", "content_editor", "instructor", "teacher"]),
);
const lessonTypeLabel = computed(() => {
  if (isNoticeType.value) return "Aviso";
  if (isAssessmentType.value) return "Evaluacion";
  return "Actividad";
});
const availabilitySectionTitle = computed(() => {
  if (isNoticeType.value) return "Programacion";
  if (isAssessmentType.value) return "Apertura de evaluacion";
  return "Disponibilidad y entrega";
});
const availabilitySectionHint = computed(() => {
  if (isNoticeType.value) return "Controla cuando se muestra y cuando desaparece para estudiantes.";
  if (isAssessmentType.value) return "Controla cuando se abre y cierra la evaluacion.";
  return "Controla cuando se abre, vence o cierra esta actividad.";
});
const startDateLabel = computed(() => {
  if (isNoticeType.value) return "Mostrar desde";
  if (isAssessmentType.value) return "Apertura";
  return "Disponible desde";
});
const endDateLabel = computed(() => {
  if (isNoticeType.value) return "Mostrar hasta";
  if (isAssessmentType.value) return "Cierre";
  return "Fecha limite";
});

const mediaLibraryVisible = ref(false);
const assetsLoaded = ref(false);
const assetsLoading = ref(false);
const assetsError = ref(false);
const recentAssets = ref([]);
const mediaLibraryTab = ref("image");
const mediaLibrarySearch = ref("");
const assetsUploadProcessing = ref(false);
const MAX_ASSET_FILE_SIZE = 25 * 1024 * 1024;

const imageInputRef = ref(null);
const audioInputRef = ref(null);
const videoInputRef = ref(null);
const fileInputRef = ref(null);
const pendingBlockTarget = ref(null);
const linkDialogVisible = ref(false);
const pendingLinkTarget = ref(null);
const linkForm = ref({
  text: "",
  url: "",
});

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toIsoOrNull = (value) => {
  const date = toDateOrNull(value);
  return date ? date.toISOString() : null;
};

const maxDate = (...values) =>
  values
    .map((value) => toDateOrNull(value))
    .filter(Boolean)
    .reduce((latest, date) => (!latest || date > latest ? date : latest), null);

const calendarMinDate = computed(() => new Date());
const endDateMinDate = computed(() =>
  maxDate(calendarMinDate.value, form.value.availableFrom),
);
const lateDateMinDate = computed(() =>
  maxDate(calendarMinDate.value, form.value.dueAt),
);

const isValidOptionalUrl = (value) => {
  const text = String(value || "").trim();
  if (!text) return true;
  try {
    const parsed = new URL(text);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

watch(
  () => form.value.allowLateSubmission,
  (enabled) => {
    if (!enabled) {
      form.value.lateUntil = null;
    }
  },
);

watch(
  () => form.value.availableFrom,
  (availableFrom) => {
    if (
      availableFrom &&
      form.value.dueAt &&
      new Date(form.value.dueAt) < new Date(availableFrom)
    ) {
      form.value.dueAt = null;
    }
  },
);

watch(
  () => form.value.dueAt,
  (dueAt) => {
    if (
      dueAt &&
      form.value.lateUntil &&
      new Date(form.value.lateUntil) < new Date(dueAt)
    ) {
      form.value.lateUntil = null;
    }
  },
);

watch(
  () => form.value.contentType,
  (type) => {
    const normalizedType = normalizeEditorLessonType(type);
    if (normalizedType !== form.value.contentType) {
      form.value.contentType = normalizedType;
      return;
    }
    if (normalizedType !== "activity") {
      form.value.requiresSubmission = false;
      form.value.allowLateSubmission = false;
      form.value.lateUntil = null;
    }
  },
);

const quizQuestions = ref([]);
const quizLoading = ref(true);
const quizError = ref(false);
const selectedQuestion = ref(null);
const questionDialogVisible = ref(false);
const questionSaving = ref(false);
const editingQuestionId = ref(null);
const questionAdvancedOpen = ref(false);

const questionForm = ref({
  questionText: "",
  questionType: "single_choice",
  points: 1,
  explanation: "",
  metaJson: "",
  draftOptions: [
    { optionText: "", isCorrect: true },
    { optionText: "", isCorrect: false },
  ],
  trueFalseCorrect: "",
});

const questionTypeOptions = [
  { label: "Single choice", value: "single_choice" },
  { label: "Multiple choice", value: "multiple_choice" },
  { label: "True/False", value: "true_false" },
  { label: "Short text", value: "short_text" },
  { label: "Long text", value: "long_text" },
  { label: "Numeric", value: "numeric" },
];

const layoutOptions = [
  { label: "1 columna", value: "single-column" },
  { label: "2 columnas", value: "two-columns" },
  { label: "Hero izquierda", value: "hero-left" },
];

const createQuestionOptionTypes = ["single_choice", "multiple_choice"];
const syncQuestionOptionTypes = [
  "single_choice",
  "multiple_choice",
  "true_false",
];

const sortedQuestions = computed(() =>
  [...quizQuestions.value].sort(
    (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0),
  ),
);

const quizQuestionSelectOptions = computed(() =>
  sortedQuestions.value.map((question, index) => ({
    label: `${index + 1}. ${question.questionText || "Pregunta sin texto"}`,
    value: question.id,
  })),
);

const questionDialogTitle = computed(() =>
  editingQuestionId.value ? "Edit question" : "Add question",
);

const questionDialogUsesOptions = computed(() =>
  createQuestionOptionTypes.includes(questionForm.value.questionType),
);

const questionDialogShowsTrueFalseSelector = computed(
  () => questionForm.value.questionType === "true_false",
);

const trueFalseCorrectOptions = [
  { label: "True", value: "true" },
  { label: "False", value: "false" },
];

const normalizedMediaLibrarySearch = computed(() =>
  String(mediaLibrarySearch.value || "")
    .trim()
    .toLowerCase(),
);

const filteredAssets = computed(() =>
  recentAssets.value.filter((asset) => {
    if ((mediaLibraryTab.value || "image") !== assetKindValue(asset))
      return false;
    if (!normalizedMediaLibrarySearch.value) return true;

    const haystack = [
      asset.originalName,
      asset.assetId,
      asset.mimeType,
      resolveAssetUrl(asset.url),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedMediaLibrarySearch.value);
  }),
);

const previewPages = computed(() => {
  return [...(form.value.contentJson?.pages || [])];
});

const currentPreviewPage = computed(() => {
  return previewPages.value[activePreviewPage.value] || null;
});

const isSoundCloudUrl = (value) => {
  const url = String(value || "").trim();
  return /(^https?:\/\/)?([^/]+\.)?soundcloud\.com\//i.test(url);
};

const normalizeSoundCloudEmbedUrl = (value) => {
  const raw = String(value || "")
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/visual=true/gi, "visual=false")
    .replace(/show_comments=true/gi, "show_comments=false")
    .replace(/show_user=true/gi, "show_user=false")
    .replace(/show_reposts=true/gi, "show_reposts=false")
    .replace(/show_teaser=true/gi, "show_teaser=false");

  if (!raw) return "";

  if (/w\.soundcloud\.com\/player/i.test(raw)) {
    return raw;
  }

  if (!isSoundCloudUrl(raw)) {
    return raw;
  }

  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(raw)}&visual=false&show_comments=false&show_user=false&show_reposts=false&show_teaser=false`;
};

watch(
  () => form.value.contentJson.pages.length,
  (length) => {
    if (activePreviewPage.value >= length) {
      activePreviewPage.value = Math.max(0, length - 1);
    }
  },
);

watch(
  () => form.value.contentJson.pages,
  () => {
    // fuerza refresco del preview
    activePreviewPage.value = Math.min(
      activePreviewPage.value,
      form.value.contentJson.pages.length - 1,
    );
  },
  { deep: true },
);

const questionReady = (question) => {
  if (!question.questionText?.trim()) return false;

  const options = question.options || [];
  const correctCount = options.filter((opt) => opt.isCorrect).length;

  switch (question.questionType) {
    case "single_choice":
      return options.length >= 2 && correctCount === 1;
    case "multiple_choice":
      return options.length >= 2 && correctCount >= 1;
    case "true_false":
      return options.length === 2 && correctCount === 1;
    case "short_text":
    case "long_text":
    case "numeric":
      return true;
    default:
      return false;
  }
};

const quizReady = computed(() => {
  if (!quizQuestions.value.length) return false;
  return quizQuestions.value.every((question) => questionReady(question));
});

const resolveAssetUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (
    /^https?:\/\//i.test(raw) ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }

  const base = String(
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  ).trim();
  if (!base) return raw;

  try {
    return new URL(raw, base).toString();
  } catch {
    return raw;
  }
};

const assetKindValue = (asset) => {
  const raw = String(asset?.kind || "").toLowerCase();
  if (raw === "images") return "image";
  return raw || "file";
};

const blockTypeLabel = (type) => {
  switch (type) {
    case "image":
      return "Imagen";
    case "audio":
      return "Audio";
    case "video":
      return "Video";
    default:
      return "Texto";
  }
};

const layoutClass = (layout) => {
  if (layout === "two-columns") return "is-two-columns";
  if (layout === "hero-left") return "is-hero-left";
  return "is-single-column";
};

const getPageDisplayTitle = (page, pageIndex) => {
  const title = String(page?.title || "").trim();
  return title || `Página ${pageIndex + 1}`;
};

const createDefaultContentJson = () => ({
  pages: [
    {
      title: "Page 1",
      layout: "single-column",
      blocks: [],
    },
  ],
});

const stripHtml = (value = "") => {
  if (typeof document === "undefined") {
    return String(value || "")
      .replace(/<[^>]*>/g, " ")
      .trim();
  }

  const div = document.createElement("div");
  div.innerHTML = value;
  return (div.textContent || div.innerText || "").trim();
};

const looksLikeHtml = (value = "") =>
  /<\/?[a-z][\s\S]*>/i.test(String(value || ""));

const createTextBlock = (title = "", content = "") => ({
  type: "text",
  title: String(title || "").trim(),
  content: String(content || "").trim(),
});

const createImageBlock = (title = "", src = "", caption = "") => ({
  type: "image",
  title: String(title || "").trim(),
  src: String(src || "").trim(),
  caption: String(caption || "").trim(),
});

const createAudioBlock = (
  title = "",
  src = "",
  caption = "",
  embedUrl = "",
) => ({
  type: "audio",
  title: String(title || "").trim(),
  src: String(src || "").trim(),
  caption: String(caption || "").trim(),
  embedUrl: String(embedUrl || "").trim(),
});

const createVideoBlock = (
  title = "",
  src = "",
  caption = "",
  embedUrl = "",
) => ({
  type: "video",
  title: String(title || "").trim(),
  src: String(src || "").trim(),
  caption: String(caption || "").trim(),
  embedUrl: String(embedUrl || "").trim(),
});

const parseLegacyHtmlToBlocks = (html, fallbackTitle = "") => {
  const raw = String(html || "").trim();
  if (!raw) return [];

  if (typeof document === "undefined") {
    return [createTextBlock(fallbackTitle, stripHtml(raw))];
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = raw;

  const blocks = [];
  let pendingTitle = String(fallbackTitle || "").trim();

  const pushTextIfAny = (text) => {
    const clean = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return;
    blocks.push(createTextBlock(pendingTitle, clean));
    pendingTitle = "";
  };

  const children = Array.from(wrapper.childNodes);

  children.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushTextIfAny(node.textContent || "");
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();

    if (tag === "section") {
      const sectionBlocks = parseLegacyHtmlToBlocks(
        node.innerHTML,
        pendingTitle,
      );
      blocks.push(...sectionBlocks);
      pendingTitle = "";
      return;
    }

    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") {
      const headingText = stripHtml(node.innerHTML);
      if (headingText) {
        pendingTitle = headingText;
      }
      return;
    }

    if (tag === "figure") {
      const img = node.querySelector("img");
      const audio = node.querySelector("audio");
      const iframe = node.querySelector("iframe");
      const video = node.querySelector("video");
      const figcaption = stripHtml(
        node.querySelector("figcaption")?.innerHTML || "",
      );

      if (img?.getAttribute("src")) {
        blocks.push(
          createImageBlock(
            pendingTitle,
            img.getAttribute("src"),
            figcaption || img.getAttribute("alt") || "",
          ),
        );
        pendingTitle = "";
        return;
      }

      if (audio?.getAttribute("src")) {
        blocks.push(
          createAudioBlock(pendingTitle, audio.getAttribute("src"), figcaption),
        );
        pendingTitle = "";
        return;
      }

      if (video?.getAttribute("src")) {
        blocks.push(
          createVideoBlock(pendingTitle, video.getAttribute("src"), figcaption),
        );
        pendingTitle = "";
        return;
      }

      if (iframe?.getAttribute("src")) {
        blocks.push(
          createVideoBlock(
            pendingTitle,
            iframe.getAttribute("src"),
            figcaption,
          ),
        );
        pendingTitle = "";
        return;
      }
    }

    if (tag === "img") {
      const src = node.getAttribute("src") || "";
      if (src) {
        blocks.push(
          createImageBlock(pendingTitle, src, node.getAttribute("alt") || ""),
        );
        pendingTitle = "";
      }
      return;
    }

    if (tag === "audio") {
      const src = node.getAttribute("src") || "";
      if (src) {
        blocks.push(createAudioBlock(pendingTitle, src, ""));
        pendingTitle = "";
      }
      return;
    }

    if (tag === "video" || tag === "iframe") {
      const src = node.getAttribute("src") || "";
      if (src) {
        blocks.push(createVideoBlock(pendingTitle, src, ""));
        pendingTitle = "";
      }
      return;
    }

    if (tag === "p" || tag === "div") {
      const text = stripHtml(node.innerHTML);
      pushTextIfAny(text);
      return;
    }

    const fallbackText = stripHtml(node.innerHTML);
    pushTextIfAny(fallbackText);
  });

  return blocks.filter((block) => {
    if (block.type === "text") return block.title || block.content;
    return block.src;
  });
};

const normalizeEditorContentJson = (rawContentJson) => {
  const fallback = createDefaultContentJson();

  if (
    !rawContentJson ||
    !Array.isArray(rawContentJson.pages) ||
    !rawContentJson.pages.length
  ) {
    return fallback;
  }

  return {
    pages: rawContentJson.pages.map((page, pageIndex) => {
      const normalizedBlocks = Array.isArray(page?.blocks)
        ? page.blocks.flatMap((block) => {
            if (!block || typeof block !== "object") {
              return [createTextBlock("", "")];
            }

            const blockTitle = block.title || "";

            if (block.type === "html") {
              return parseLegacyHtmlToBlocks(block.content || "", blockTitle);
            }

            if (block.type === "text") {
              const rawContent = block.content || "";

              if (looksLikeHtml(rawContent)) {
                return parseLegacyHtmlToBlocks(rawContent, blockTitle);
              }

              return [createTextBlock(blockTitle, rawContent)];
            }

            if (block.type === "image") {
              return [
                createImageBlock(
                  blockTitle,
                  block.src || "",
                  block.caption || "",
                ),
              ];
            }

            if (block.type === "audio") {
              return [
                createAudioBlock(
                  blockTitle,
                  block.src || "",
                  block.caption || "",
                  block.embedUrl || "",
                ),
              ];
            }

            if (block.type === "video") {
              return [
                createVideoBlock(
                  blockTitle,
                  block.src || "",
                  block.caption || "",
                  block.embedUrl || "",
                ),
              ];
            }

            if (block.type === "quiz") {
              return [
                {
                  type: "quiz",
                  title: blockTitle,
                  quizMode: block.quizMode || "single_question",
                  questionId: block.questionId || "",
                  showFeedback: block.showFeedback ?? true,
                },
              ];
            }

            if (block.content && looksLikeHtml(block.content)) {
              return parseLegacyHtmlToBlocks(block.content, blockTitle);
            }

            return [createTextBlock(blockTitle, block.content || "")];
          })
        : [];

      return {
        title: page?.title || `Page ${pageIndex + 1}`,
        layout: page?.layout || "single-column",
        blocks: normalizedBlocks,
      };
    }),
  };
};

const addPage = () => {
  form.value.contentJson.pages.push({
    title: `Page ${form.value.contentJson.pages.length + 1}`,
    layout: "single-column",
    blocks: [],
  });

  activePreviewPage.value = form.value.contentJson.pages.length - 1;
};

const removePage = (pageIndex) => {
  if (form.value.contentJson.pages.length <= 1) return;

  form.value.contentJson.pages.splice(pageIndex, 1);

  if (activePreviewPage.value >= form.value.contentJson.pages.length) {
    activePreviewPage.value = form.value.contentJson.pages.length - 1;
  }
};

const movePage = (pageIndex, direction) => {
  const pages = form.value.contentJson.pages;
  if (!pages) return;

  const targetIndex = pageIndex + direction;

  if (targetIndex < 0 || targetIndex >= pages.length) return;

  const copy = [...pages];
  const [moved] = copy.splice(pageIndex, 1);
  copy.splice(targetIndex, 0, moved);

  form.value.contentJson.pages = copy;

  if (activePreviewPage.value === pageIndex) {
    activePreviewPage.value = targetIndex;
  } else if (activePreviewPage.value === targetIndex) {
    activePreviewPage.value = pageIndex;
  }
};

const addBlock = (pageIndex, type = "text") => {
  const page = form.value.contentJson.pages[pageIndex];
  if (!page) return;

  const baseBlock = {
    type,
    title: "",
  };

  if (type === "text") {
    baseBlock.content = "";
  } else if (type === "quiz") {
    baseBlock.quizMode = "single_question";
    baseBlock.questionId = "";
    baseBlock.showFeedback = true;
  } else {
    baseBlock.src = "";
    baseBlock.caption = "";
    baseBlock.embedUrl = "";
  }

  page.blocks.push(baseBlock);
};

const insertTextLink = (pageIndex, blockIndex) => {
  const block = form.value.contentJson.pages?.[pageIndex]?.blocks?.[blockIndex];
  if (!block || block.type !== "text") return;

  const selector = `[data-text-block-editor="${pageIndex}-${blockIndex}"]`;
  const input = document.querySelector(selector);
  const content = String(block.content || "");
  const start = Number(input?.selectionStart ?? content.length);
  const end = Number(input?.selectionEnd ?? start);
  const selectedText = content.slice(start, end);

  pendingLinkTarget.value = {
    pageIndex,
    blockIndex,
    start,
    end,
  };
  linkForm.value = {
    text: selectedText || "enlace",
    url: "",
  };
  linkDialogVisible.value = true;
};

const closeLinkDialog = () => {
  linkDialogVisible.value = false;
  pendingLinkTarget.value = null;
  linkForm.value = {
    text: "",
    url: "",
  };
};

const confirmTextLink = () => {
  const target = pendingLinkTarget.value;
  if (!target) return;

  const block =
    form.value.contentJson.pages?.[target.pageIndex]?.blocks?.[target.blockIndex];
  if (!block || block.type !== "text") {
    closeLinkDialog();
    return;
  }

  const cleanText = String(linkForm.value.text || "").trim() || "enlace";
  const cleanUrl = String(linkForm.value.url || "").trim();

  if (!isSafeLinkUrl(cleanUrl)) {
    toast.add({
      severity: "warn",
      summary: "Enlace no valido",
      detail: "Usa una URL http(s), mailto, tel, /ruta o #ancla.",
      life: 3000,
    });
    return;
  }

  const content = String(block.content || "");
  const linkText = `[${cleanText}](${cleanUrl})`;

  block.content = `${content.slice(0, target.start)}${linkText}${content.slice(
    target.end,
  )}`;

  closeLinkDialog();

  requestAnimationFrame(() => {
    const selector = `[data-text-block-editor="${target.pageIndex}-${target.blockIndex}"]`;
    const nextInput = document.querySelector(selector);
    if (!nextInput) return;
    const cursorPosition = target.start + linkText.length;
    nextInput.focus();
    nextInput.setSelectionRange(cursorPosition, cursorPosition);
  });
};

const removeBlock = (pageIndex, blockIndex) => {
  const page = form.value.contentJson.pages[pageIndex];
  if (!page) return;
  page.blocks.splice(blockIndex, 1);
};

const moveBlock = (pageIndex, blockIndex, direction) => {
  const page = form.value.contentJson.pages[pageIndex];
  if (!page) return;

  const newIndex = blockIndex + direction;

  if (newIndex < 0 || newIndex >= page.blocks.length) return;

  const blocks = [...page.blocks];
  const [moved] = blocks.splice(blockIndex, 1);
  blocks.splice(newIndex, 0, moved);

  page.blocks = blocks;
};

const getBlockByIndex = (pageIndex, blockIndex) => {
  const page = form.value.contentJson.pages?.[pageIndex];
  if (!page) return null;
  return page.blocks?.[blockIndex] || null;
};

const setBlockAsset = (pageIndex, blockIndex, asset) => {
  const block = getBlockByIndex(pageIndex, blockIndex);
  if (!block || !asset) return;

  block.src = resolveAssetUrl(asset.url);
  if (!block.caption) {
    block.caption = asset.originalName || "";
  }
};

const clearBlockAsset = (pageIndex, blockIndex) => {
  const block = getBlockByIndex(pageIndex, blockIndex);
  if (!block) return;

  block.src = "";
  block.embedUrl = "";
  block.caption = "";
};

const openMediaLibraryForBlock = async (pageIndex, blockIndex, kind) => {
  pendingBlockTarget.value = { pageIndex, blockIndex, kind };

  if (kind === "image") mediaLibraryTab.value = "image";
  else if (kind === "audio") mediaLibraryTab.value = "audio";
  else mediaLibraryTab.value = "file";

  mediaLibraryVisible.value = true;
  await loadAssetsList();
};

const triggerBlockUpload = (pageIndex, blockIndex, kind) => {
  pendingBlockTarget.value = { pageIndex, blockIndex, kind };
  triggerAssetInput(kind);
};

const triggerCoverUpload = () => {
  pendingBlockTarget.value = "cover";
  triggerAssetInput("image");
};

const openMediaLibraryForCover = async () => {
  pendingBlockTarget.value = "cover";
  mediaLibraryTab.value = "image";
  mediaLibraryVisible.value = true;
  await loadAssetsList();
};

const getBlockPreviewLabel = (block) => {
  if (!block?.src && !block?.embedUrl) return "No file selected";
  if (block.type === "image") return "Image selected";
  if (block.type === "audio") {
    return block.embedUrl ? "SoundCloud embed selected" : "Audio selected";
  }
  if (block.type === "video") {
    return block.embedUrl ? "Video embed selected" : "Video selected";
  }
  if (block.type === "quiz") return "Quiz block";
  return "Asset selected";
};

const buildEmptyQuestionOption = () => ({ optionText: "", isCorrect: false });

const normalizeDraftOrder = (options = []) =>
  options.map((option, index) => ({
    ...option,
    orderIndex: index + 1,
  }));

const initializeQuestionFormOptionsByType = (type) => {
  questionForm.value.draftOptions = normalizeDraftOrder([
    { optionText: "", isCorrect: type === "single_choice" },
    { optionText: "", isCorrect: false },
  ]);
};

const addQuestionFormOption = () => {
  questionForm.value.draftOptions = normalizeDraftOrder([
    ...questionForm.value.draftOptions,
    buildEmptyQuestionOption(),
  ]);
};

const removeQuestionFormOption = (index) => {
  if (questionForm.value.draftOptions.length <= 2) return;

  const copy = [...questionForm.value.draftOptions];
  copy.splice(index, 1);

  if (
    questionForm.value.questionType === "single_choice" &&
    !copy.some((option) => option.isCorrect)
  ) {
    copy[0].isCorrect = true;
  }

  questionForm.value.draftOptions = normalizeDraftOrder(copy);
};

const moveQuestionFormOption = (index, dir) => {
  const nextIndex = index + dir;
  if (nextIndex < 0 || nextIndex >= questionForm.value.draftOptions.length)
    return;

  const copy = [...questionForm.value.draftOptions];
  const [item] = copy.splice(index, 1);
  copy.splice(nextIndex, 0, item);
  questionForm.value.draftOptions = normalizeDraftOrder(copy);
};

const setSingleCorrect = (index) => {
  if (questionForm.value.questionType !== "single_choice") return;

  questionForm.value.draftOptions = normalizeDraftOrder(
    questionForm.value.draftOptions.map((option, optionIndex) => ({
      ...option,
      isCorrect: optionIndex === index,
    })),
  );
};

const singleChoiceCorrectIndex = computed({
  get() {
    if (questionForm.value.questionType !== "single_choice") return null;
    return questionForm.value.draftOptions.findIndex(
      (option) => option.isCorrect,
    );
  },
  set(nextIndex) {
    if (typeof nextIndex !== "number") return;
    setSingleCorrect(nextIndex);
  },
});

const normalizeDraftOptions = (type, draftOptions) => {
  const normalizedOptions = (draftOptions || [])
    .map((option) => ({
      id: option.id || null,
      optionText: (option.optionText || "").trim(),
      isCorrect: Boolean(option.isCorrect),
    }))
    .filter((option) => option.optionText !== "");

  if (!createQuestionOptionTypes.includes(type)) {
    return { normalizedOptions };
  }

  if (normalizedOptions.length < 2) {
    return {
      normalizedOptions,
      validationError: "Add at least 2 options",
    };
  }

  if (type === "single_choice") {
    const firstCorrectIndex = normalizedOptions.findIndex(
      (option) => option.isCorrect,
    );
    if (firstCorrectIndex === -1) {
      normalizedOptions[0].isCorrect = true;
    } else {
      normalizedOptions.forEach((option, index) => {
        option.isCorrect = index === firstCorrectIndex;
      });
    }
  }

  if (type === "multiple_choice") {
    const hasCorrect = normalizedOptions.some((option) => option.isCorrect);
    if (!hasCorrect) normalizedOptions[0].isCorrect = true;
  }

  return {
    normalizedOptions: normalizedOptions.map((option, index) => ({
      ...option,
      orderIndex: index + 1,
    })),
  };
};

const fetchQuestionFromServer = async (questionId) => {
  const data = await getLessonQuiz(lessonId);
  return (data.questions || []).find(
    (question) =>
      question.id === questionId || String(question.id) === String(questionId),
  );
};

const questionTypeLabel = (type) => {
  switch (type) {
    case "multiple_choice":
      return "Multiple choice";
    case "true_false":
      return "True/False";
    case "short_text":
      return "Short text";
    case "long_text":
      return "Long text";
    case "numeric":
      return "Numeric";
    default:
      return "Single choice";
  }
};

const getSelectedPreviewQuestion = (block) => {
  if (!block?.questionId) return null;
  return (
    quizQuestions.value.find(
      (q) => String(q.id) === String(block.questionId),
    ) || null
  );
};

const getQuestionOptions = (question) => {
  return [...(question?.options || [])].sort(
    (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0),
  );
};

const questionUsesOptions = (question) => {
  const type = question?.questionType || "";
  return ["single_choice", "multiple_choice", "true_false"].includes(type);
};

const syncSelectedQuestion = () => {
  if (!selectedQuestion.value) return;
  const next = quizQuestions.value.find(
    (q) => q.id === selectedQuestion.value.id,
  );
  selectedQuestion.value = next || null;
};

const getYoutubeEmbedUrl = (rawUrl) => {
  const url = String(rawUrl || "").trim();
  if (!url) return "";

  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/i,
  );

  return match ? `https://www.youtube.com/embed/${match[1]}` : "";
};

const getVimeoEmbedUrl = (rawUrl) => {
  const url = String(rawUrl || "").trim();
  if (!url) return "";

  if (/player\.vimeo\.com\/video\/\d+/i.test(url)) {
    return url;
  }

  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return match ? `https://player.vimeo.com/video/${match[1]}` : "";
};

const getLoomEmbedUrl = (rawUrl) => {
  const url = String(rawUrl || "").trim();
  if (!url) return "";

  const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/i);
  return match ? `https://www.loom.com/embed/${match[1]}` : "";
};

const getPreviewEmbedType = (rawUrl) => {
  if (getYoutubeEmbedUrl(rawUrl)) return "youtube";
  if (getVimeoEmbedUrl(rawUrl)) return "vimeo";
  if (getLoomEmbedUrl(rawUrl)) return "loom";
  return "";
};

const escapeHtmlText = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const isSafeLinkUrl = (value = "") => {
  const url = String(value || "").trim();
  if (!url) return false;
  if (/^(https?:|mailto:|tel:)/i.test(url)) return true;
  return url.startsWith("/") || url.startsWith("#");
};

const renderTextMarkdownLinks = (value = "") =>
  escapeHtmlText(value).replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (fullMatch, label, url) => {
      if (!isSafeLinkUrl(url)) return fullMatch;
      return `<a href="${escapeHtmlText(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    },
  );

const renderTextContent = (value = "") =>
  DOMPurify.sanitize(renderTextMarkdownLinks(value).replace(/\n/g, "<br>"), sanitizerConfig);

const buildEmbedSnippetFromUrl = (rawUrl) => {
  const url = String(rawUrl || "").trim();
  if (!url) return "";

  const youtube = getYoutubeEmbedUrl(url);
  if (youtube) {
    return `
      <figure class="lesson-media lesson-media-video" style="width:100%;max-width:640px;margin:20px auto;">
        <iframe
          src="${youtube}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          style="display:block;width:100%;max-width:100%;aspect-ratio:16/9;border:0;border-radius:20px;background:#000;box-shadow:0 12px 28px rgba(15,23,42,.14);">
        </iframe>
      </figure>
    `;
  }

  const vimeo = getVimeoEmbedUrl(url);
  if (vimeo) {
    return `
      <figure class="lesson-media lesson-media-video" style="width:100%;max-width:640px;margin:20px auto;">
        <iframe
          src="${vimeo}"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen
          style="display:block;width:100%;max-width:100%;aspect-ratio:16/9;border:0;border-radius:20px;background:#000;box-shadow:0 12px 28px rgba(15,23,42,.14);">
        </iframe>
      </figure>
    `;
  }

  const loom = getLoomEmbedUrl(url);
  if (loom) {
    return `
      <figure class="lesson-media lesson-media-video" style="width:100%;max-width:640px;margin:20px auto;">
        <iframe
          src="${loom}"
          allowfullscreen
          style="display:block;width:100%;max-width:100%;aspect-ratio:16/9;border:0;border-radius:20px;background:#000;box-shadow:0 12px 28px rgba(15,23,42,.14);">
        </iframe>
      </figure>
    `;
  }

  if (/soundcloud\.com|w\.soundcloud\.com/i.test(url)) {
    const normalizedSrc = normalizeSoundCloudEmbedUrl(url);

    return `
      <figure class="lesson-media lesson-media-audio" style="width:100%;max-width:760px;margin:24px auto;">
        <iframe
          src="${normalizedSrc}"
          allow="autoplay"
          allowfullscreen
          style="display:block;width:100%;max-width:100%;height:170px;border:0;border-radius:16px;background:#fff;box-shadow:0 10px 24px rgba(15,23,42,.10);">
        </iframe>
      </figure>
    `;
  }

  return "";
};

const buildHtmlFromContentJson = (contentJson) => {
  const pages = Array.isArray(contentJson?.pages) ? contentJson.pages : [];
  if (!pages.length) return "";

  return pages
    .map((page) => {
      const blocks = Array.isArray(page.blocks) ? page.blocks : [];

      const pageTitle = page?.title
        ? `<h2>${escapeHtmlText(page.title)}</h2>`
        : "";

      const blocksHtml = blocks
        .map((block) => {
          if (!block) return "";

          if (block.type === "text") {
            const title = block.title
              ? `<h3>${escapeHtmlText(block.title)}</h3>`
              : "";
            const content = block.content
              ? `<p>${renderTextMarkdownLinks(block.content).replace(/\n/g, "<br>")}</p>`
              : "";
            return `${title}${content}`;
          }

          if (block.type === "image" && block.src) {
            const title = block.title
              ? `<h3>${escapeHtmlText(block.title)}</h3>`
              : "";
            const caption = block.caption
              ? `<figcaption>${escapeHtmlText(block.caption)}</figcaption>`
              : "";

            return `
              ${title}
              <figure class="lesson-media lesson-media-image">
                <img src="${block.src}" alt="${escapeHtmlText(block.caption || block.title || "image")}" />
                ${caption}
              </figure>
            `;
          }

          if (block.type === "audio") {
            const title = block.title
              ? `<h3>${escapeHtmlText(block.title)}</h3>`
              : "";
            const caption = block.caption
              ? `<p>${escapeHtmlText(block.caption)}</p>`
              : "";

            if (block.embedUrl && isSoundCloudUrl(block.embedUrl)) {
              const normalizedEmbed = normalizeSoundCloudEmbedUrl(
                block.embedUrl,
              );

              return `
      ${title}
      <figure class="lesson-media lesson-media-audio">
        <iframe
          src="${normalizedEmbed}"
          allow="autoplay"
          loading="lazy"
          frameborder="0"
          style="display:block;width:100%;max-width:100%;height:166px;border:0;border-radius:16px;">
        </iframe>
      </figure>
      ${caption}
    `;
            }

            if (block.src) {
              return `
      ${title}
      <figure class="lesson-media lesson-media-audio">
        <audio controls src="${block.src}"></audio>
      </figure>
      ${caption}
    `;
            }

            return "";
          }

          if (block.type === "video" && block.src) {
            const title = block.title
              ? `<h3>${escapeHtmlText(block.title)}</h3>`
              : "";
            const caption = block.caption
              ? `<p>${escapeHtmlText(block.caption)}</p>`
              : "";
            const embedHtml = buildEmbedSnippetFromUrl(block.src);

            if (embedHtml) {
              return `${title}${embedHtml}${caption}`;
            }

            return `
              ${title}
              <p>
                <a href="${block.src}" target="_blank" rel="noopener">
                  ${escapeHtmlText(block.caption || "Open video")}
                </a>
              </p>
            `;
          }

          if (block.type === "quiz") {
            const title = block.title
              ? `<h3>${escapeHtmlText(block.title)}</h3>`
              : "";

            if (block.quizMode === "lesson_quiz") {
              return `
      ${title}
      <div
        class="lesson-quiz-marker"
        data-quiz-mode="lesson_quiz"
        data-lesson-id="${escapeHtmlText(String(lessonId || ""))}"
        data-show-feedback="${block.showFeedback ? "true" : "false"}"
      >
        Quiz completo de la lección
      </div>
    `;
            }

            if (block.questionId) {
              return `
      ${title}
      <div
        class="lesson-quiz-marker"
        data-quiz-mode="single_question"
        data-lesson-id="${escapeHtmlText(String(lessonId || ""))}"
        data-question-id="${escapeHtmlText(String(block.questionId))}"
        data-show-feedback="${block.showFeedback ? "true" : "false"}"
      >
        Pregunta individual del quiz
      </div>
    `;
            }

            return `
    ${title}
    <div class="lesson-quiz-marker">
      Bloque quiz sin pregunta seleccionada
    </div>
  `;
          }

          return "";
        })
        .join("");

      return `
        <section class="lesson-page-block" data-layout="${escapeHtmlText(
          page.layout || "single-column",
        )}">
          ${pageTitle}
          ${blocksHtml}
        </section>
      `;
    })
    .join('<div class="page-break"></div>');
};

const recentAssetLimit = 50;

const addRecentAsset = (entry) => {
  recentAssets.value = [
    entry,
    ...recentAssets.value.filter((item) => item.assetId !== entry.assetId),
  ];

  if (recentAssets.value.length > recentAssetLimit) {
    recentAssets.value.pop();
  }

  assetsLoaded.value = true;
};

const uploadAndRegisterAsset = async (kind, file) => {
  if (file.size > MAX_ASSET_FILE_SIZE) {
    throw new Error("File must be 25 MB or smaller");
  }

  const registered = await uploadAssetFile(file);

  const entry = {
    assetId: registered.assetId,
    kind: registered.kind,
    mimeType: registered.mimeType,
    originalName: registered.originalName,
    sizeBytes: registered.sizeBytes,
    storagePath: registered.storagePath,
    url: resolveAssetUrl(registered.url),
    createdAt: registered.createdAt || new Date().toISOString(),
  };

  addRecentAsset(entry);
  return entry;
};

const mapQuizQuestionRow = (question) => ({
  ...question,
  id: question.id || question.questionId || question.question_id || null,
  points: question.points ?? 1,
  explanation: question.explanation || "",
  meta: question.meta ?? null,
  quizId: question.quizId || question.quiz_id || null,
  options: question.options || [],
});

const loadLesson = async () => {
  if (!moduleId) {
    toast.add({
      severity: "warn",
      summary: "Missing module",
      detail: "Open this lesson from the course builder",
      life: 3000,
    });
    loading.value = false;
    return;
  }

  loading.value = true;

  try {
    const lessonData = await getLesson(lessonId);
    lesson.value = lessonData;

    if (!lesson.value) {
      loading.value = false;
      return;
    }

    let parsedContentJson = createDefaultContentJson();

    try {
      const rawJson =
        lesson.value?.content_json ?? lesson.value?.contentJson ?? null;

      if (rawJson && typeof rawJson === "object") {
        parsedContentJson = rawJson;
      } else if (typeof rawJson === "string" && rawJson.trim()) {
        parsedContentJson = JSON.parse(rawJson);
      }

      parsedContentJson = normalizeEditorContentJson(parsedContentJson);
    } catch {
      parsedContentJson = createDefaultContentJson();
    }

    form.value = {
      coverImage:
        lesson.value.cover_image_url ||
        lesson.value.coverImage ||
        lesson.value.image_url ||
        "",
      contentType: normalizeEditorLessonType(
        lesson.value.normalizedType ||
          lesson.value.contentType ||
          lesson.value.content_type,
      ),
      title: lesson.value.title || "",
      noticeText: lesson.value.contentText || lesson.value.content_text || "",
      noticeVideoUrl: lesson.value.videoUrl || lesson.value.video_url || "",
      noticeExternalLabel:
        parsedContentJson?.notice?.externalLabel || "",
      noticeExternalUrl:
        lesson.value.contentUrl ||
        lesson.value.content_url ||
        lesson.value.externalUrl ||
        "",
      contentHtml: "",
      contentMarkdown: "",
      availableFrom: toDateOrNull(
        lesson.value.availableFrom || lesson.value.available_from,
      ),
      dueAt: toDateOrNull(lesson.value.dueAt || lesson.value.due_at),
      allowLateSubmission: Boolean(
        lesson.value.allowLateSubmission ?? lesson.value.allow_late_submission,
      ),
      lateUntil: toDateOrNull(lesson.value.lateUntil || lesson.value.late_until),
      requiresSubmission: Boolean(
        lesson.value.requiresSubmission ?? lesson.value.requires_submission,
      ),
      contentJson: parsedContentJson,
    };

    initialLessonSnapshot.value = normalizeLessonSnapshot(form.value);
  } catch {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Failed to load lesson",
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const loadQuiz = async () => {
  quizLoading.value = true;
  quizError.value = false;

  try {
    const data = await getLessonQuiz(lessonId);
    quizQuestions.value = (data.questions || []).map(mapQuizQuestionRow);
    syncSelectedQuestion();
  } catch (err) {
    quizQuestions.value = [];
    quizError.value = true;
    toast.add({
      severity: "error",
      summary: "Quiz error",
      detail: err?.response?.data?.error || "Failed to load quiz",
      life: 3000,
    });
  } finally {
    quizLoading.value = false;
  }
};

const triggerAssetInput = (kind) => {
  const map = {
    image: imageInputRef,
    audio: audioInputRef,
    video: videoInputRef,
    file: fileInputRef,
  };

  const target = map[kind];
  if (target?.value) {
    target.value.value = "";
    target.value.click();
  }
};

const openMediaLibrary = async () => {
  mediaLibraryVisible.value = true;
  await loadAssetsList();
};

const handleAssetSelection = async (kind, event) => {
  const file = event?.target?.files?.[0];
  if (event?.target) event.target.value = "";
  if (!file) return;

  assetsUploadProcessing.value = true;

  try {
    const entry = await uploadAndRegisterAsset(kind, file);

    if (pendingBlockTarget.value === "cover") {
      form.value.coverImage = resolveAssetUrl(entry.url);
      pendingBlockTarget.value = null;

      toast.add({
        severity: "success",
        summary: "Portada cargada",
        detail: "La imagen de portada fue asignada",
        life: 2500,
      });

      return;
    }

    if (pendingBlockTarget.value) {
      const { pageIndex, blockIndex } = pendingBlockTarget.value;
      setBlockAsset(pageIndex, blockIndex, entry);
      pendingBlockTarget.value = null;

      toast.add({
        severity: "success",
        summary: "Archivo cargado",
        detail: "El archivo se asignó al bloque",
        life: 2500,
      });

      return;
    }

    toast.add({
      severity: "success",
      summary: "Archivo cargado",
      detail: "Disponible en Media Library",
      life: 2500,
    });
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "Upload failed",
      detail:
        err?.message || err?.response?.data?.error || "Failed to upload asset",
      life: 3500,
    });
  } finally {
    assetsUploadProcessing.value = false;
  }
};

const loadAssetsList = async (force = false) => {
  if (!force && assetsLoaded.value && recentAssets.value.length) return;
  if (assetsLoading.value) return;

  assetsLoading.value = true;
  assetsError.value = false;

  try {
    const rows = await listAssets();
    recentAssets.value = (rows || []).map((row) => ({
      ...row,
      url: resolveAssetUrl(row?.url),
    }));
    assetsLoaded.value = true;
  } catch (err) {
    assetsError.value = true;
    toast.add({
      severity: "error",
      summary: "Assets error",
      detail: err?.response?.data?.error || "Failed to load assets",
      life: 3000,
    });
  } finally {
    assetsLoading.value = false;
  }
};

const refreshAssets = () => loadAssetsList(true);

const saveLesson = async () => {
  if (!form.value.title.trim()) {
    toast.add({
      severity: "warn",
      summary: "Title required",
      detail: "Lesson title is required",
      life: 2500,
    });
    return;
  }

  saving.value = true;

  try {
    const now = Date.now();
    const selectedDates = [
      form.value.availableFrom,
      form.value.dueAt,
      form.value.lateUntil,
    ].filter(Boolean);

    if (
      !canSavePastLessonDates.value &&
      selectedDates.some((value) => new Date(value).getTime() < now)
    ) {
      toast.add({
        severity: "warn",
        summary: "Fecha invalida",
        detail: "No puedes guardar fechas anteriores al momento actual",
        life: 3000,
      });
      return;
    }

    if (
      form.value.availableFrom &&
      form.value.dueAt &&
      new Date(form.value.dueAt) < new Date(form.value.availableFrom)
    ) {
      toast.add({
        severity: "warn",
        summary: "Fechas inválidas",
        detail: "La fecha límite no puede ser anterior a la fecha de inicio",
        life: 3000,
      });
      return;
    }

    if (
      form.value.allowLateSubmission &&
      form.value.dueAt &&
      form.value.lateUntil &&
      new Date(form.value.lateUntil) < new Date(form.value.dueAt)
    ) {
      toast.add({
        severity: "warn",
        summary: "Fechas inválidas",
        detail: "La fecha máxima tardía no puede ser anterior a la fecha límite",
        life: 3000,
      });
      return;
    }

    if (
      isNoticeType.value &&
      (!isValidOptionalUrl(form.value.coverImage) ||
        !isValidOptionalUrl(form.value.noticeVideoUrl) ||
        !isValidOptionalUrl(form.value.noticeExternalUrl))
    ) {
      toast.add({
        severity: "warn",
        summary: "URL invalida",
        detail: "Revisa que las URLs del aviso empiecen por http:// o https://",
        life: 3000,
      });
      return;
    }

    const generatedHtmlFromPages = buildHtmlFromContentJson(
      form.value.contentJson,
    );

    const sanitizedHtml = DOMPurify.sanitize(
      generatedHtmlFromPages || "",
      sanitizerConfig,
    );

    const payload = {
      title: form.value.title,
      contentType: form.value.contentType,
      contentText: isNoticeType.value ? form.value.noticeText : "",
      contentMarkdown: isNoticeType.value ? form.value.noticeText : "",
      contentHtml: isNoticeType.value ? "" : sanitizedHtml,
      contentJson: isNoticeType.value
        ? {
            notice: {
              externalLabel: form.value.noticeExternalLabel || "",
            },
          }
        : form.value.contentJson,
      videoUrl: isNoticeType.value
        ? form.value.noticeVideoUrl?.trim() || null
        : null,
      contentUrl: isNoticeType.value
        ? form.value.noticeExternalUrl?.trim() || null
        : null,
      externalUrl: isNoticeType.value
        ? form.value.noticeExternalUrl?.trim() || null
        : null,
      availableFrom: toIsoOrNull(form.value.availableFrom),
      dueAt: toIsoOrNull(form.value.dueAt),
      allowLateSubmission:
        isActivityType.value && Boolean(form.value.allowLateSubmission),
      lateUntil:
        isActivityType.value && form.value.allowLateSubmission && form.value.lateUntil
          ? toIsoOrNull(form.value.lateUntil)
          : null,
      requiresSubmission:
        isActivityType.value && Boolean(form.value.requiresSubmission),
      coverImage: form.value.coverImage,
      cover_image_url: form.value.coverImage,
      image_url: form.value.coverImage,
    };

    const nextSnapshot = normalizeLessonSnapshot(payload);
    const prevSnapshot = initialLessonSnapshot.value;

    const hasChanges =
      !prevSnapshot ||
      nextSnapshot.contentType !== prevSnapshot.contentType ||
      nextSnapshot.title !== prevSnapshot.title ||
      nextSnapshot.contentText !== prevSnapshot.contentText ||
      nextSnapshot.contentHtml !== prevSnapshot.contentHtml ||
      nextSnapshot.contentJson !== prevSnapshot.contentJson ||
      nextSnapshot.videoUrl !== prevSnapshot.videoUrl ||
      nextSnapshot.contentUrl !== prevSnapshot.contentUrl ||
      nextSnapshot.availableFrom !== prevSnapshot.availableFrom ||
      nextSnapshot.dueAt !== prevSnapshot.dueAt ||
      nextSnapshot.allowLateSubmission !== prevSnapshot.allowLateSubmission ||
      nextSnapshot.lateUntil !== prevSnapshot.lateUntil ||
      nextSnapshot.requiresSubmission !== prevSnapshot.requiresSubmission ||
      form.value.coverImage !==
        (lesson.value?.cover_image_url ||
          lesson.value?.coverImage ||
          lesson.value?.image_url ||
          "");

    if (!hasChanges) {
      toast.add({
        severity: "info",
        summary: "No changes",
        detail: "No changes were made to save",
        life: 2200,
      });
      return;
    }

    const patchPayload = {
      coverImage: form.value.coverImage,
      cover_image_url: form.value.coverImage,
      image_url: form.value.coverImage,
    };

    if (!prevSnapshot || nextSnapshot.contentType !== prevSnapshot.contentType) {
      patchPayload.contentType = nextSnapshot.contentType;
    }

    if (!prevSnapshot || nextSnapshot.title !== prevSnapshot.title) {
      patchPayload.title = nextSnapshot.title;
    }

    if (
      !prevSnapshot ||
      nextSnapshot.contentText !== prevSnapshot.contentText
    ) {
      patchPayload.contentText = nextSnapshot.contentText;
      patchPayload.contentMarkdown = nextSnapshot.contentText;
    }

    if (
      !prevSnapshot ||
      nextSnapshot.contentHtml !== prevSnapshot.contentHtml
    ) {
      patchPayload.contentHtml = nextSnapshot.contentHtml;
    }

    if (
      !prevSnapshot ||
      nextSnapshot.contentJson !== prevSnapshot.contentJson
    ) {
      patchPayload.contentJson = payload.contentJson;
    }

    if (!prevSnapshot || nextSnapshot.videoUrl !== prevSnapshot.videoUrl) {
      patchPayload.videoUrl = nextSnapshot.videoUrl;
    }

    if (!prevSnapshot || nextSnapshot.contentUrl !== prevSnapshot.contentUrl) {
      patchPayload.contentUrl = nextSnapshot.contentUrl;
      patchPayload.externalUrl = nextSnapshot.contentUrl;
    }

    if (!prevSnapshot || nextSnapshot.availableFrom !== prevSnapshot.availableFrom) {
      patchPayload.availableFrom = nextSnapshot.availableFrom;
    }

    if (!prevSnapshot || nextSnapshot.dueAt !== prevSnapshot.dueAt) {
      patchPayload.dueAt = nextSnapshot.dueAt;
    }

    if (
      !prevSnapshot ||
      nextSnapshot.allowLateSubmission !== prevSnapshot.allowLateSubmission
    ) {
      patchPayload.allowLateSubmission = nextSnapshot.allowLateSubmission;
    }

    if (!prevSnapshot || nextSnapshot.lateUntil !== prevSnapshot.lateUntil) {
      patchPayload.lateUntil = nextSnapshot.lateUntil;
    }

    if (
      !prevSnapshot ||
      nextSnapshot.requiresSubmission !== prevSnapshot.requiresSubmission
    ) {
      patchPayload.requiresSubmission = nextSnapshot.requiresSubmission;
    }

    await updateLesson(lessonId, patchPayload);
    await loadLesson();

    toast.add({
      severity: "success",
      summary: "Lesson saved",
      detail: "Se guardó correctamente la lección",
      life: 2200,
    });
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err?.response?.data?.error || "Failed to save lesson",
      life: 3500,
    });
  } finally {
    saving.value = false;
  }
};

const handleInsertAsset = (asset) => {
  if (pendingBlockTarget.value === "cover") {
    form.value.coverImage = resolveAssetUrl(asset.url);
    pendingBlockTarget.value = null;
    mediaLibraryVisible.value = false;

    toast.add({
      severity: "success",
      summary: "Portada asignada",
      detail: "La imagen de portada fue asignada",
      life: 2000,
    });

    return;
  }

  if (pendingBlockTarget.value) {
    const { pageIndex, blockIndex } = pendingBlockTarget.value;
    setBlockAsset(pageIndex, blockIndex, asset);
    pendingBlockTarget.value = null;
    mediaLibraryVisible.value = false;

    toast.add({
      severity: "success",
      summary: "Asignado",
      detail: "El archivo se asignó al bloque",
      life: 2000,
    });

    return;
  }

  toast.add({
    severity: "info",
    summary: "Selecciona un destino",
    detail: "Primero elige si la imagen es portada o va dentro de un bloque.",
    life: 2500,
  });
};

const copyAssetUrl = async (url) => {
  if (!url) return;

  try {
    await navigator.clipboard.writeText(url);
    toast.add({
      severity: "success",
      summary: "Copied",
      detail: "Asset URL copied to clipboard",
      life: 2000,
    });
  } catch {
    toast.add({
      severity: "error",
      summary: "Copy failed",
      detail: "Unable to copy URL",
      life: 3000,
    });
  }
};

watch(
  () => mediaLibraryVisible.value,
  (visible) => {
    if (visible) loadAssetsList();
  },
);

const formatTimestamp = (value) =>
  value ? new Date(value).toLocaleString() : "";

const sanitizerConfig = {
  USE_PROFILES: { html: true },
  ADD_TAGS: [
    "iframe",
    "video",
    "audio",
    "source",
    "picture",
    "track",
    "code",
    "pre",
    "figure",
    "figcaption",
  ],
  ADD_ATTR: [
    "allow",
    "allowfullscreen",
    "frameborder",
    "referrerpolicy",
    "controls",
    "muted",
    "playsinline",
    "data-mce-*",
    "data-lesson-id",
    "data-question-id",
    "contenteditable",
    "class",
    "style",
    "width",
    "height",
    "target",
    "rel",
  ],
};

const normalizeLessonSnapshot = (value) => ({
  contentType: normalizeEditorLessonType(value?.contentType),
  title: String(value?.title || "").trim(),
  contentText: String(value?.contentText ?? value?.noticeText ?? ""),
  contentHtml: String(value?.contentHtml || ""),
  contentJson: JSON.stringify(
    normalizeEditorLessonType(value?.contentType) === "banner"
      ? {
          notice: {
            externalLabel:
              value?.noticeExternalLabel ||
              value?.contentJson?.notice?.externalLabel ||
              "",
          },
        }
      : value?.contentJson || createDefaultContentJson(),
  ),
  videoUrl: String(value?.videoUrl ?? value?.noticeVideoUrl ?? ""),
  contentUrl: String(
    value?.contentUrl ?? value?.externalUrl ?? value?.noticeExternalUrl ?? "",
  ),
  availableFrom: toIsoOrNull(value?.availableFrom),
  dueAt: toIsoOrNull(value?.dueAt),
  allowLateSubmission: Boolean(value?.allowLateSubmission),
  lateUntil:
    value?.allowLateSubmission && value?.lateUntil
      ? toIsoOrNull(value?.lateUntil)
      : null,
  requiresSubmission: Boolean(value?.requiresSubmission),
});

const togglePublish = async () => {
  if (!lesson.value) return;

  try {
    if (lesson.value.is_published) {
      await unpublishLesson(lessonId);
      toast.add({
        severity: "info",
        summary: "Lesson unpublished",
        life: 2000,
      });
    } else {
      await publishLesson(lessonId);
      toast.add({
        severity: "success",
        summary: "Lesson published",
        life: 2000,
      });
    }

    await loadLesson();
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err?.response?.data?.error || "Failed to update lesson",
      life: 3500,
    });
  }
};

const goBack = () => {
  router.push(`/cms/courses/${courseId || ""}`);
};

const openStudentPreview = () => {
  if (!courseId || !lessonId) {
    toast.add({
      severity: "warn",
      summary: "No se puede abrir la vista previa",
      detail: "Falta el curso o la leccion en la URL del editor.",
      life: 3000,
    });
    return;
  }

  const routeData = router.resolve({
    name: "lesson",
    params: {
      courseId,
      lessonId,
    },
    query: {
      preview: "1",
    },
  });

  window.open(routeData.href, "_blank", "noopener,noreferrer");
};

const openQuestionDialog = (question) => {
  editingQuestionId.value = question?.id || null;

  let draftOptions = [
    { optionText: "", isCorrect: true },
    { optionText: "", isCorrect: false },
  ];
  let trueFalseCorrect = "";
  const questionType = question?.questionType || "single_choice";

  if (question) {
    const sortedQuestionOptions = [...(question.options || [])].sort(
      (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0),
    );

    draftOptions = sortedQuestionOptions.map((option) => ({
      id: option.id || null,
      optionText: option.optionText || "",
      isCorrect: Boolean(option.isCorrect),
      orderIndex: option.orderIndex || null,
    }));

    if (
      !draftOptions.length &&
      createQuestionOptionTypes.includes(questionType)
    ) {
      draftOptions = [
        { optionText: "", isCorrect: questionType === "single_choice" },
        { optionText: "", isCorrect: false },
      ];
    }

    const options = question?.options || [];
    const trueOption = options.find(
      (option) =>
        String(option.optionText || "")
          .trim()
          .toLowerCase() === "true",
    );
    const falseOption = options.find(
      (option) =>
        String(option.optionText || "")
          .trim()
          .toLowerCase() === "false",
    );

    if (trueOption?.isCorrect) trueFalseCorrect = "true";
    else if (falseOption?.isCorrect) trueFalseCorrect = "false";
  } else if (questionType === "multiple_choice") {
    draftOptions = [buildEmptyQuestionOption(), buildEmptyQuestionOption()];
  } else if (!createQuestionOptionTypes.includes(questionType)) {
    draftOptions = [];
  }

  questionForm.value = {
    questionText: question?.questionText || "",
    questionType,
    points: question?.points ?? 1,
    explanation: question?.explanation || "",
    metaJson: question?.meta ? JSON.stringify(question.meta, null, 2) : "",
    draftOptions: normalizeDraftOrder(draftOptions),
    trueFalseCorrect,
  };

  questionAdvancedOpen.value = false;
  questionDialogVisible.value = true;
};

const closeQuestionDialog = () => {
  questionDialogVisible.value = false;
  questionForm.value = {
    questionText: "",
    questionType: "single_choice",
    points: 1,
    explanation: "",
    metaJson: "",
    draftOptions: [
      { optionText: "", isCorrect: true },
      { optionText: "", isCorrect: false },
    ],
    trueFalseCorrect: "",
  };
  editingQuestionId.value = null;
  questionAdvancedOpen.value = false;
};

const saveQuestion = async () => {
  if (!questionForm.value.questionText.trim()) {
    toast.add({
      severity: "warn",
      summary: "Text required",
      detail: "Question text is required",
      life: 2500,
    });
    return;
  }

  if (questionForm.value.points < 0) {
    toast.add({
      severity: "warn",
      summary: "Points invalid",
      detail: "Points must be 0 or greater",
      life: 2500,
    });
    return;
  }

  const questionType = questionForm.value.questionType;
  const { normalizedOptions, validationError } = normalizeDraftOptions(
    questionType,
    questionForm.value.draftOptions,
  );

  if (createQuestionOptionTypes.includes(questionType)) {
    if (validationError) {
      toast.add({
        severity: "warn",
        summary: "Options required",
        detail: validationError,
        life: 2500,
      });
      return;
    }

    questionForm.value.draftOptions = normalizedOptions.map(
      ({ id, optionText, isCorrect }) => ({
        id: id || null,
        optionText,
        isCorrect,
      }),
    );
  } else if (
    questionType === "true_false" &&
    !questionForm.value.trueFalseCorrect
  ) {
    toast.add({
      severity: "warn",
      summary: "Pending setup",
      detail: "No correct True/False answer selected yet",
      life: 2500,
    });
  } else {
    questionForm.value.draftOptions = [];
  }

  questionSaving.value = true;
  let savedQuestionId = null;

  try {
    const payload = {
      questionText: questionForm.value.questionText,
      questionType,
      points: questionForm.value.points,
      explanation: questionForm.value.explanation,
    };

    if (questionForm.value.metaJson.trim()) {
      try {
        payload.meta = JSON.parse(questionForm.value.metaJson);
      } catch {
        toast.add({
          severity: "warn",
          summary: "Invalid JSON",
          detail: "Meta must be valid JSON",
          life: 2500,
        });
        return;
      }
    }

    if (editingQuestionId.value) {
      await updateQuizQuestion(editingQuestionId.value, payload);
      savedQuestionId = editingQuestionId.value;
    } else {
      const created = await createQuizQuestion(lessonId, payload);
      savedQuestionId = created?.id || created?.question?.id || null;

      if (!savedQuestionId) {
        throw new Error("Failed to resolve created question id");
      }
    }

    const existingQuestion =
      quizQuestions.value.find(
        (question) => String(question.id) === String(savedQuestionId),
      ) || null;

    const existingOptions = existingQuestion?.options || [];

    if (createQuestionOptionTypes.includes(questionType)) {
      const next = normalizedOptions;
      const originalById = new Map(
        existingOptions.map((option) => [option.id, option]),
      );
      const nextIds = new Set(
        next.filter((option) => option.id).map((option) => option.id),
      );

      for (const option of existingOptions) {
        if (option?.id && !nextIds.has(option.id)) {
          await deleteQuizOption(option.id);
        }
      }

      for (let index = 0; index < next.length; index += 1) {
        const option = next[index];
        if (option.id) continue;

        await createQuizOption(savedQuestionId, {
          optionText: option.optionText,
          isCorrect: option.isCorrect,
          orderIndex: index + 1,
        });
      }

      for (let index = 0; index < next.length; index += 1) {
        const option = next[index];
        if (!option.id) continue;

        const original = originalById.get(option.id);
        if (!original) continue;

        const trimmedOriginalText = (original.optionText || "").trim();
        const originalIsCorrect = Boolean(original.isCorrect);
        const originalOrderIndex = Number(original.orderIndex || index + 1);
        const nextOrderIndex = index + 1;

        if (
          trimmedOriginalText !== option.optionText ||
          originalIsCorrect !== option.isCorrect ||
          originalOrderIndex !== nextOrderIndex
        ) {
          await updateQuizOption(option.id, {
            optionText: option.optionText,
            isCorrect: option.isCorrect,
            orderIndex: nextOrderIndex,
          });
        }
      }
    } else if (questionType === "true_false") {
      const draftCorrectFromOptions = (
        questionForm.value.draftOptions || []
      ).find((option) => Boolean(option.isCorrect));

      const desiredCorrect =
        questionForm.value.trueFalseCorrect ||
        (draftCorrectFromOptions
          ? String(draftCorrectFromOptions.optionText || "")
              .trim()
              .toLowerCase()
          : "");

      if (desiredCorrect) {
        let currentOptions = existingOptions;

        if (!currentOptions.length) {
          const freshQuestion = await fetchQuestionFromServer(savedQuestionId);
          currentOptions = freshQuestion?.options || [];
        }

        const trueOption = currentOptions.find(
          (option) =>
            String(option.optionText || "")
              .trim()
              .toLowerCase() === "true",
        );

        const falseOption = currentOptions.find(
          (option) =>
            String(option.optionText || "")
              .trim()
              .toLowerCase() === "false",
        );

        if (trueOption && falseOption) {
          if (desiredCorrect === "true") {
            await updateQuizOption(trueOption.id, { isCorrect: true });
            await updateQuizOption(falseOption.id, { isCorrect: false });
          } else if (desiredCorrect === "false") {
            await updateQuizOption(trueOption.id, { isCorrect: false });
            await updateQuizOption(falseOption.id, { isCorrect: true });
          }
        }
      }
    } else {
      questionForm.value.draftOptions = [];
    }

    await loadQuiz();

    selectedQuestion.value =
      quizQuestions.value.find(
        (question) => String(question.id) === String(savedQuestionId),
      ) || null;

    toast.add({
      severity: "success",
      summary: "Question saved",
      life: 2000,
    });

    closeQuestionDialog();
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err?.response?.data?.error || "Failed to save question",
      life: 3500,
    });
  } finally {
    questionSaving.value = false;
  }
};

watch(
  () => questionForm.value.questionType,
  (nextType) => {
    if (!questionDialogVisible.value) return;

    if (nextType === "true_false") {
      questionForm.value.trueFalseCorrect = "";
      questionForm.value.draftOptions = [];
      return;
    }

    if (syncQuestionOptionTypes.includes(nextType)) {
      if (!questionForm.value.draftOptions.length) {
        initializeQuestionFormOptionsByType(nextType);
      } else if (nextType === "single_choice") {
        const firstCorrectIndex = questionForm.value.draftOptions.findIndex(
          (option) => option.isCorrect,
        );

        if (firstCorrectIndex === -1) {
          questionForm.value.draftOptions = questionForm.value.draftOptions.map(
            (option, index) => ({
              ...option,
              isCorrect: index === 0,
            }),
          );
        } else {
          questionForm.value.draftOptions = questionForm.value.draftOptions.map(
            (option, index) => ({
              ...option,
              isCorrect: index === firstCorrectIndex,
            }),
          );
        }
      }

      return;
    }

    questionForm.value.draftOptions = [];
    questionForm.value.trueFalseCorrect = "";
  },
);

const removeQuestion = async (question) => {
  if (!window.confirm("Delete this question? This cannot be undone.")) return;

  try {
    await deleteQuizQuestion(question.id);

    if (selectedQuestion.value?.id === question.id) {
      selectedQuestion.value = null;
    }

    toast.add({
      severity: "info",
      summary: "Question deleted",
      life: 2000,
    });

    await loadQuiz();
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err?.response?.data?.error || "Failed to delete question",
      life: 3500,
    });
  }
};

const moveQuestion = async (question, direction) => {
  const list = sortedQuestions.value;
  const index = list.findIndex((item) => item.id === question.id);
  const targetIndex = index + direction;

  if (targetIndex < 0 || targetIndex >= list.length) return;

  const target = list[targetIndex];

  try {
    await updateQuizQuestion(question.id, { orderIndex: target.orderIndex });
    await updateQuizQuestion(target.id, { orderIndex: question.orderIndex });
    await loadQuiz();
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err?.response?.data?.error || "Failed to reorder question",
      life: 3500,
    });
  }
};

const canMoveQuestion = (question, direction) => {
  const list = sortedQuestions.value;
  const index = list.findIndex((item) => item.id === question.id);
  const targetIndex = index + direction;
  return targetIndex >= 0 && targetIndex < list.length;
};

onMounted(async () => {
  await loadLesson();
  await loadQuiz();
  loadAssetsList(true);
});
</script>

<style scoped>
.lesson-shell {
  border-radius: 24px;
  overflow: hidden;
}

.lesson-page-pro {
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
}

.lesson-topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.25rem;
  padding: 0.5rem 0 0.25rem;
}

.lesson-topbar-left {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  min-width: 0;
}

.lesson-topbar-copy {
  min-width: 0;
}

.lesson-topbar-copy h1 {
  margin: 0;
  font-size: clamp(1.45rem, 2vw, 2rem);
  line-height: 1.1;
  color: #0f172a;
  word-break: break-word;
}

.lesson-kicker {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #4f46e5;
}

.lesson-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.55rem;
  color: #64748b;
  font-size: 0.92rem;
}

.lesson-topbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  min-width: 0;
}

.lesson-loading {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.lesson-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
  margin-top: 1rem;
}

.lesson-main {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.lesson-hero-card,
.lesson-section-card,
.sidebar-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.04);
}

.lesson-hero-card {
  padding: 1.5rem;
  background: linear-gradient(135deg, #f8fbff 0%, #eef2ff 55%, #ffffff 100%);
  border-color: #e2e8f0;
}

.lesson-hero-copy h2 {
  margin: 0;
  font-size: clamp(1.25rem, 1.8vw, 1.7rem);
  color: #0f172a;
  line-height: 1.15;
}

.lesson-hero-text {
  margin: 0.8rem 0 0;
  color: #64748b;
  line-height: 1.65;
  max-width: 60ch;
}

.lesson-hero-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 1rem;
}

.lesson-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 0.85rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid #dbeafe;
  color: #1e293b;
  font-size: 0.9rem;
  font-weight: 600;
}

.lesson-stepper {
  display: flex;
  align-items: center;
  gap: clamp(1.2rem, 4vw, 4rem);
  padding: 0.35rem 0 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: transparent;
}

.lesson-stepper-item {
  appearance: none;
  border: 0;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: flex-start;
  min-width: 0;
  padding: 0;
  text-align: left;
  transition:
    color 0.18s ease;
}

.lesson-stepper-item span {
  align-items: center;
  background: #eef2f7;
  border-radius: 999px;
  color: #64748b;
  display: inline-flex;
  flex: 0 0 36px;
  font-size: 0.95rem;
  font-weight: 800;
  height: 36px;
  justify-content: center;
  width: 36px;
}

.lesson-stepper-item strong {
  color: inherit;
  font-size: 1rem;
  line-height: 1.2;
  min-width: 0;
  overflow-wrap: anywhere;
}

.lesson-stepper-item:hover {
  color: #2563eb;
}

.lesson-stepper-item.active {
  color: #0f172a;
}

.lesson-stepper-item.active span {
  background: #0f477a;
  color: #ffffff;
}

.lesson-stepper-preview {
  flex: 0 0 auto;
  margin-left: -2.75rem;
  white-space: nowrap;
  background: #0f477a;
  border-color: #0f477a;
  color: #ffffff;
  box-shadow: 0 10px 22px rgba(15, 71, 122, 0.22);
}

.lesson-stepper-preview:hover {
  background: #0b3a64;
  border-color: #0b3a64;
  color: #ffffff;
}

.lesson-step-panel {
  min-height: 360px;
}

.lesson-section-card {
  padding: 1.25rem;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.section-head h3 {
  margin: 0;
  font-size: 1.08rem;
  color: #0f172a;
}

.section-head small {
  color: #64748b;
}

.section-head-split {
  align-items: center;
}

.lesson-info-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 1rem;
}

.notice-editor-card {
  display: grid;
  gap: 1rem;
}

.notice-media-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: 1rem;
}

.lesson-info-grid :deep(.p-calendar) {
  width: 100%;
}

.lesson-switch-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 0.35rem 0 1rem;
}

.lesson-switch-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 44px;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  color: #334155;
  font-weight: 700;
}

.pages-topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.pages-topbar-copy {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
  flex: 1 1 260px;
}

.pages-topbar-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.lesson-pages-builder {
  display: grid;
  grid-template-columns: minmax(240px, 0.34fr) minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.lesson-pages-sidebar {
  position: sticky;
  top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #f8fafc;
}

.lesson-pages-sidebar-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.lesson-pages-sidebar-head div {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.lesson-pages-sidebar-head strong,
.lesson-pages-help strong {
  color: #0f172a;
}

.lesson-pages-list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.lesson-page-nav-item {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  gap: 0.65rem;
  align-items: center;
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #334155;
  cursor: pointer;
  background: transparent;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.lesson-page-nav-item:hover,
.lesson-page-nav-item.active {
  background: #ffffff;
  border-color: #bfdbfe;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
}

.lesson-page-nav-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #64748b;
  font-weight: 800;
}

.lesson-page-nav-item.active .lesson-page-nav-number {
  background: #0f477a;
  color: #ffffff;
}

.lesson-page-nav-copy {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  min-width: 0;
}

.lesson-page-nav-copy strong,
.lesson-page-nav-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lesson-page-nav-copy strong {
  color: #0f172a;
  font-size: 0.94rem;
}

.lesson-page-nav-copy small,
.lesson-pages-help small {
  color: #64748b;
  font-size: 0.84rem;
}

.lesson-page-nav-actions {
  display: flex;
  align-items: center;
  gap: 0.1rem;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.lesson-page-nav-item:hover .lesson-page-nav-actions,
.lesson-page-nav-item.active .lesson-page-nav-actions {
  opacity: 1;
}

.lesson-pages-help {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.9rem;
  border: 1px dashed #bfdbfe;
  border-radius: 12px;
  background: #ffffff;
}

.lesson-page-editor {
  min-width: 0;
}

.quiz-card {
  overflow: hidden;
}

.quiz-head-pro {
  margin-bottom: 1.1rem;
}

.quiz-status-box {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.quiz-status-label {
  font-size: 0.85rem;
  color: #64748b;
}

.quiz-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.9rem;
  margin-bottom: 1rem;
}

.quiz-stat-card {
  padding: 0.95rem 1rem;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.quiz-stat-card span {
  display: block;
  color: #64748b;
  font-size: 0.86rem;
  margin-bottom: 0.35rem;
}

.quiz-stat-card strong {
  font-size: 1.15rem;
  color: #0f172a;
}

.quiz-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.quiz-empty-pro {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px dashed #cbd5e1;
  border-radius: 16px;
  background: #f8fafc;
}

.empty-quiz-icon {
  width: 52px;
  height: 52px;
  min-width: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: #fff;
  color: #6366f1;
  font-size: 1.4rem;
}

.lesson-sidebar {
  position: sticky;
  top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sidebar-card {
  padding: 1.15rem;
}

.sidebar-card h4 {
  margin: 0 0 1rem;
  color: #0f172a;
  font-size: 1rem;
}

.sidebar-stat {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.8rem 0;
  border-top: 1px solid #f1f5f9;
}

.sidebar-stat:first-of-type {
  border-top: 0;
  padding-top: 0;
}

.sidebar-stat span {
  color: #64748b;
  font-size: 0.9rem;
}

.sidebar-stat strong {
  color: #0f172a;
  text-align: right;
  word-break: break-word;
}

.sidebar-actions {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.sidebar-save-text {
  margin: 0 0 1rem;
  color: #64748b;
  line-height: 1.55;
}

.preview-card {
  padding: 0;
  overflow: hidden;
}

.preview-card-head {
  padding: 1rem 1rem 0.25rem;
}

.lesson-preview-shell {
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
  border-top: 1px solid #eef2f7;
  max-height: 78vh;
  overflow: auto;
}

.notice-preview-card {
  overflow: hidden;
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.94), rgba(14, 165, 233, 0.9)),
    #2563eb;
  color: #ffffff;
  box-shadow: 0 18px 38px rgba(37, 99, 235, 0.18);
}

.notice-preview-image {
  width: 100%;
  max-height: 220px;
  object-fit: cover;
  display: block;
}

.notice-preview-body {
  padding: 1rem;
}

.notice-preview-kicker {
  display: inline-flex;
  width: fit-content;
  margin-bottom: 0.55rem;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  font-size: 0.72rem;
  font-weight: 850;
  text-transform: uppercase;
}

.notice-preview-body h2 {
  margin: 0;
  font-size: 1.45rem;
  line-height: 1.1;
}

.notice-preview-body p {
  margin: 0.55rem 0 0;
  color: rgba(255, 255, 255, 0.92);
  line-height: 1.45;
}

.notice-preview-muted {
  opacity: 0.78;
}

.notice-preview-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.85rem;
}

.notice-preview-actions a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  font-weight: 800;
  text-decoration: none;
}

.notice-preview-dates {
  display: grid;
  gap: 0.25rem;
  margin-top: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.82rem;
}

.lesson-preview-header {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem;
}

.lesson-preview-header h2 {
  margin: 0 0 0.35rem;
  font-size: 1.2rem;
  color: #0f172a;
}

.lesson-preview-header span {
  color: #64748b;
  font-size: 0.9rem;
}

.lesson-preview-pages {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.lesson-preview-page {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  padding: 1rem;
}

.lesson-preview-page-head {
  margin-bottom: 0.9rem;
}

.lesson-preview-page-head small {
  display: block;
  color: #64748b;
  margin-bottom: 0.2rem;
}

.lesson-preview-page-head h3 {
  margin: 0;
  color: #0f172a;
  font-size: 1.02rem;
}

.lesson-preview-blocks {
  display: grid;
  gap: 0.9rem;
}

.lesson-preview-blocks.is-single-column {
  grid-template-columns: 1fr;
}

.lesson-preview-blocks.is-two-columns {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.lesson-preview-blocks.is-hero-left {
  grid-template-columns: 1.25fr 0.75fr;
}

.lesson-preview-block {
  border: 1px solid #edf2f7;
  border-radius: 16px;
  padding: 0.95rem;
  background: #fff;
}

.lesson-preview-block h4 {
  margin: 0 0 0.6rem;
  color: #0f172a;
  font-size: 0.98rem;
}

.preview-text {
  margin: 0;
  color: #334155;
  line-height: 1.7;
  white-space: pre-line;
}

.preview-text :deep(a) {
  color: #2563eb;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.text-editor-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.link-editor-form {
  display: grid;
  gap: 1rem;
}

.link-editor-dialog :deep(.p-dialog-content) {
  padding-top: 0.25rem;
}

.preview-image {
  display: block;
  width: 100%;
  border-radius: 12px;
  object-fit: cover;
}

.preview-audio {
  width: 100%;
}

.preview-caption {
  margin: 0.65rem 0 0;
  color: #64748b;
  font-size: 0.9rem;
}

.preview-video-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 14px;
  overflow: hidden;
  background: #0f172a;
}

.preview-video-frame iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.preview-link-box {
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.preview-link-box a {
  color: #4f46e5;
  text-decoration: none;
  font-weight: 600;
}

.preview-empty,
.preview-empty-inline {
  color: #64748b;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  padding: 0.85rem;
}

.w-full {
  width: 100%;
}

.assets-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.asset-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 0;
  border-top: 1px solid #e5e7eb;
  min-width: 0;
}

.asset-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.asset-preview {
  width: 48px;
  height: 48px;
  min-width: 48px;
  border-radius: 0.75rem;
  display: flex;
  flex: 0 0 48px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #eef2ff;
}

.asset-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset-icon {
  font-weight: 600;
  color: #0f172a;
}

.asset-title {
  font-weight: 600;
  color: #0f172a;
  word-break: break-word;
}

.asset-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
  color: #475569;
  font-size: 0.85rem;
}

.asset-actions {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.assets-loading {
  color: #475569;
  font-size: 0.85rem;
}

.assets-error {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  color: #dc2626;
  font-size: 0.9rem;
}

.assets-empty {
  color: #475569;
  font-size: 0.9rem;
}

:deep(.media-library-dialog .p-dialog-content) {
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: min(85vh, 900px);
}

.media-library-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
  gap: 0.75rem;
  min-width: 0;
}

.media-library-header div {
  display: flex;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
}

.media-library-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.media-library-toolbar {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.media-library-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.media-library-upload {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.media-library-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.75rem 1rem 1rem;
}

.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.options-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.option-row {
  display: grid;
  grid-template-columns: 4rem 1fr 8rem 3rem;
  gap: 0.5rem;
  align-items: center;
}

.option-order {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-start;
}

.option-input {
  width: 100%;
}

.option-correct {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

:deep(.lesson-quiz-table .p-datatable-wrapper) {
  border-radius: 16px;
  overflow: auto;
}

:deep(.lesson-quiz-table table) {
  min-width: 780px;
}

:deep(.lesson-quiz-table .p-datatable-thead > tr > th) {
  background: #f8fafc;
  color: #334155;
  border-color: #e2e8f0;
  font-weight: 700;
}

:deep(.lesson-quiz-table .p-datatable-tbody > tr > td) {
  border-color: #eef2f7;
}

.mb-2 {
  margin-bottom: 0.75rem;
}

.question-actions {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.muted {
  color: #64748b;
  margin-bottom: 0.75rem;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.pages-builder {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.page-builder-card {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 1.15rem;
  background: #ffffff;
}

.page-builder-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
  min-width: 0;
}

.page-builder-head-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}

.blocks-toolbar {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.blocks-toolbar-bottom {
  align-items: center;
  margin: 1rem 0 0;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
}

.blocks-toolbar-bottom span {
  color: #64748b;
  font-size: 0.9rem;
  font-weight: 700;
  margin-right: 0.25rem;
}

.blocks-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.block-editor-card {
  border: 0;
  border-radius: 0;
  padding: 0;
  background: transparent;
}

.block-editor-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0;
  min-width: 0;
}

.lesson-content-card {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.lesson-content-card__header {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #eef2f7;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.lesson-content-card__title {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.lesson-content-card__handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: #eef2f7;
  color: #64748b;
  flex: 0 0 auto;
}

.lesson-content-card__badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background: #e0f2fe;
  color: #0f477a;
  font-size: 0.82rem;
  font-weight: 800;
  text-transform: capitalize;
}

.lesson-content-card__title small {
  color: #64748b;
  font-weight: 700;
}

.lesson-content-card__body {
  display: grid;
  gap: 0;
}

.lesson-content-card__section {
  padding: 1rem;
  border-top: 1px solid #f1f5f9;
}

.lesson-content-card__section:first-child {
  border-top: 0;
}

.lesson-content-card__section--config {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.lesson-content-card__section--config > .dialog-field:only-child {
  grid-column: 1 / -1;
}

.lesson-content-card__section--actions {
  padding-block: 0.75rem;
  background: #fbfdff;
}

.lesson-content-card__section--asset {
  background: #f8fafc;
}

.lesson-content-card__section--asset .block-file-preview {
  margin-bottom: 0;
}

.block-asset-toolbar {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0;
}

.block-file-preview {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.9rem;
  background: #ffffff;
  margin-bottom: 0.9rem;
}

.block-file-preview.empty {
  border-style: dashed;
  background: #f8fafc;
}

.block-preview-image {
  display: block;
  width: 100%;
  max-width: 360px;
  border-radius: 10px;
  margin-bottom: 0.75rem;
}

.block-preview-audio {
  width: 100%;
  margin-bottom: 0.75rem;
}

.block-preview-meta {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.block-url {
  word-break: break-all;
}

.preview-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: nowrap;
  overflow-x: auto;
  padding: 0 1rem 1rem;
  scrollbar-width: thin;
}

.preview-tab {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  min-width: max-content;
  border: 1px solid #2563eb;
  background: #ffffff;
  color: #2563eb;
  border-radius: 999px;
  padding: 0.5rem 0.9rem;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preview-tab:hover {
  background: #eff6ff;
  border-color: #2563eb;
  color: #1d4ed8;
}

.preview-tab.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.preview-audio-frame {
  width: 100%;
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.preview-audio-frame iframe {
  display: block;
  width: 100%;
  height: 166px;
  border: 0;
}

.preview-quiz-box {
  border: 1px solid #dbeafe;
  background: #f8fbff;
  border-radius: 14px;
  padding: 1rem;
}

.preview-quiz-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}

.preview-quiz-head strong {
  color: #0f172a;
  font-size: 0.98rem;
}

.preview-quiz-head small {
  color: #64748b;
  font-size: 0.82rem;
}

.preview-quiz-question {
  border: 1px solid #dbeafe;
  background: #ffffff;
  border-radius: 12px;
  padding: 0.9rem;
  margin-top: 0.75rem;
}

.preview-quiz-question:first-child {
  margin-top: 0;
}

.preview-quiz-question-title {
  font-weight: 600;
  color: #0f172a;
  line-height: 1.45;
  margin-bottom: 0.75rem;
}

.preview-quiz-options {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.preview-quiz-option {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #334155;
}

.preview-quiz-option input {
  margin-top: 0.2rem;
}

.preview-quiz-answer-box {
  padding: 0.85rem 0.9rem;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
  color: #64748b;
  font-size: 0.92rem;
}

.preview-quiz-feedback-note {
  margin-top: 0.75rem;
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: #ecfeff;
  color: #0f766e;
  font-size: 0.8rem;
  font-weight: 600;
}

@media (max-width: 1280px) {
  .lesson-layout {
    grid-template-columns: 1fr;
  }

  .lesson-sidebar {
    position: static;
  }

  .lesson-preview-shell {
    max-height: none;
  }
}

@media (max-width: 768px) {
  .lesson-page-pro {
    padding-inline: 0.65rem;
  }

  .lesson-shell :deep(.p-card-body) {
    padding: 0.85rem;
  }

  .lesson-topbar,
  .section-head,
  .page-builder-head,
  .block-editor-head {
    flex-direction: column;
    align-items: stretch;
  }

  .lesson-topbar-left {
    width: 100%;
  }

  .lesson-topbar-actions,
  .pages-topbar-actions,
  .block-asset-toolbar,
  .dialog-actions,
  .asset-actions,
  .media-library-upload {
    width: 100%;
    justify-content: stretch;
  }

  .lesson-topbar-actions :deep(.p-button),
  .pages-topbar-actions :deep(.p-button),
  .block-asset-toolbar :deep(.p-button),
  .dialog-actions :deep(.p-button),
  .media-library-upload :deep(.p-button) {
    flex: 1 1 100%;
    justify-content: center;
  }

  .lesson-topbar-copy h1 {
    font-size: 1.3rem;
  }

  .lesson-layout {
    gap: 1rem;
  }

  .lesson-stepper {
    gap: 1.25rem;
    overflow-x: auto;
    padding-bottom: 0.85rem;
    scrollbar-width: thin;
  }

  .lesson-stepper-item {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .lesson-step-panel {
    min-height: 0;
  }

  .lesson-pages-builder {
    grid-template-columns: 1fr;
  }

  .lesson-pages-sidebar {
    position: static;
  }

  .lesson-page-nav-actions {
    opacity: 1;
  }

  .lesson-content-card__header,
  .lesson-content-card__title {
    align-items: flex-start;
  }

  .lesson-content-card__header {
    flex-direction: column;
  }

  .lesson-content-card__section--config {
    grid-template-columns: 1fr;
  }

  .lesson-section-card,
  .lesson-hero-card,
  .sidebar-card {
    padding: 0.9rem;
    border-radius: 16px;
  }

  .lesson-info-grid,
  .notice-media-grid,
  .lesson-switch-grid,
  .page-builder-head-fields,
  .quiz-overview,
  .option-row {
    grid-template-columns: 1fr;
  }

  .page-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .lesson-preview-blocks.is-two-columns,
  .lesson-preview-blocks.is-hero-left {
    grid-template-columns: 1fr;
  }

  .asset-row {
    align-items: flex-start;
  }

  .asset-actions {
    flex: 0 0 auto;
  }

  .media-library-toolbar {
    padding: 0.85rem;
  }

  .media-library-list {
    padding-inline: 0.85rem;
  }

  .media-library-header div {
    flex-direction: column;
    gap: 0.25rem;
  }

  .question-actions {
    gap: 0.15rem;
  }
}

@media (max-width: 640px) {
  .lesson-page-pro {
    padding-inline: 0.5rem;
  }
}

@media (max-width: 420px) {
  .lesson-topbar-left {
    gap: 0.5rem;
  }

  .lesson-meta {
    gap: 0.45rem;
    font-size: 0.82rem;
  }

  .lesson-chip {
    width: 100%;
    justify-content: center;
  }

  .asset-row {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .asset-actions {
    grid-column: 1 / -1;
    justify-content: stretch;
  }

  .asset-actions :deep(.p-button) {
    flex: 1 1 auto;
    justify-content: center;
  }
}
</style>

# Frontend Style System

## Objetivo

Centralizar los estilos del frontend para que los cambios visuales se hagan desde archivos CSS compartidos, sin buscar reglas repartidas en componentes Vue.

Esta migracion tambien centraliza los overrides de PrimeVue y elimina estilos scoped del dominio CMS.

## Punto de entrada

Los estilos propios de la aplicacion entran desde:

```js
// frontend/src/main.js
import './styles/index.css';
```

`frontend/src/styles/index.css` importa las capas en este orden:

```css
@import './tokens.css';
@import './base.css';
@import './primevue.css';
@import './utilities.css';
@import './layouts.css';
@import './components.css';
@import './domains/shell.css';
@import './domains/cms.css';
@import './domains/attendance.css';
```

## Archivos principales

- `frontend/src/styles/tokens.css`: fuentes, colores base, tokens semanticos, radios, sombras y medidas.
- `frontend/src/styles/base.css`: reset global, body, app root, links, media e inputs nativos.
- `frontend/src/styles/primevue.css`: overrides globales de PrimeVue.
- `frontend/src/styles/utilities.css`: utilidades simples como `empty-state`, `muted`, `mb-2`, `w-full`.
- `frontend/src/styles/layouts.css`: layout base de pagina y encabezados de seccion.
- `frontend/src/styles/components.css`: componentes CSS reutilizables como `list-item` y `status-pill`.
- `frontend/src/styles/domains/shell.css`: layout principal, sidebar desktop, drawer mobile y topbar mobile.
- `frontend/src/styles/domains/cms.css`: estilos del dominio CMS.
- `frontend/src/styles/domains/attendance.css`: estilos de asistencia.

## Archivos eliminados

- `frontend/src/style.css`
- `frontend/src/styles/prime-overrides.css`

Sus reglas fueron movidas a las capas nuevas.

## Tokens agregados

### CMS

Tokens para superficies, bordes, hover y sombras:

```css
--cms-surface
--cms-surface-subtle
--cms-surface-muted
--cms-border
--cms-border-soft
--cms-border-muted
--cms-border-strong
--cms-hover-bg
--cms-shadow-color
--cms-row-shadow
--cms-card-shadow
```

### Attendance

Tokens para estados de asistencia:

```css
--attendance-present-*
--attendance-absent-*
--attendance-late-*
--attendance-excused-*
--attendance-pending-*
```

Cada grupo contiene variantes de fondo, borde y texto segun aplique.

### Info y neutrales

```css
--brand-info-strong
--brand-info-tint
--brand-info-border
--brand-info-focus
--color-gray-500
--color-gray-600
--color-slate-600
```

### Shell y sidebar

Tokens para controlar ancho, fondo, estados y contraste del layout principal:

```css
--shell-bg
--sidebar-width
--sidebar-collapsed-width
--sidebar-width-tablet
--sidebar-collapsed-width-tablet
--topbar-height
--sidebar-bg
--sidebar-bg-2
--sidebar-surface
--sidebar-surface-hover
--sidebar-border
--sidebar-text
--sidebar-muted
--sidebar-subtle
--sidebar-active-bg
--sidebar-active-border
--sidebar-active-accent
--sidebar-danger
--sidebar-shadow
```

## PrimeVue

Los estilos globales de PrimeVue viven en:

```txt
frontend/src/styles/primevue.css
```

Aqui se centralizan reglas de:

- `.p-button`
- `.p-card`
- `.p-panel`
- `.p-dialog`
- `.p-sidebar`
- `.p-datatable`
- `.p-inputtext`
- `.p-dropdown`
- `.p-multiselect`
- `.p-calendar`
- `.p-tag`
- `.p-progressbar`
- `.p-accordion`

Para cambiar un componente PrimeVue en toda la app, modificar este archivo primero.

## CMS y attendance

Ya no quedan bloques `<style>` en:

```txt
frontend/src/views/cms
frontend/src/components/cms
```

Los estilos del dominio CMS se concentran en:

```txt
frontend/src/styles/domains/cms.css
```

Los estilos de asistencia se concentran en:

```txt
frontend/src/styles/domains/attendance.css
```

## Como cambiar estilos ahora

### Cambiar paleta global

Editar `frontend/src/styles/tokens.css`.

Ejemplos:

- Color principal: `--brand-primary`
- Fondo de app: `--app-bg`
- Texto principal: `--text-primary`
- Borde global: `--app-border`

### Cambiar botones PrimeVue

Editar `frontend/src/styles/primevue.css`.

Buscar:

```css
.p-button
```

### Cambiar tablas PrimeVue

Editar `frontend/src/styles/primevue.css`.

Buscar:

```css
.p-datatable
```

### Cambiar CMS

Editar `frontend/src/styles/domains/cms.css`.

Ejemplos:

- Cards CMS: `.courses-card`, `.build-card`, `.groups-card`
- Tablas CMS: `.courses-table`
- Dialogos CMS: `.course-dialog`, `.post-form-grid`, `.announcement-form-grid`
- Live sessions: `.readonly-session-card`

### Cambiar asistencia

Editar `frontend/src/styles/domains/attendance.css`.

Ejemplos:

- Leyenda: `.attendance-legend`, `.legend-chip`
- Grilla semanal: `.attendance-grid-table`, `.attendance-inline-option`
- Vista mensual: `.monthly-student-card`, `.monthly-status-cell`
- Graficas/resumen: `.attendance-overview`, `.overview-card`, `.risk-pill`

### Cambiar sidebar y shell

Editar `frontend/src/styles/domains/shell.css` para estructura y estados visuales.

Editar `frontend/src/styles/tokens.css` para cambios de paleta, anchos y medidas del sidebar.

Ejemplos:

- Fondo del sidebar: `--sidebar-bg`, `--sidebar-bg-2`
- Anchos: `--sidebar-width`, `--sidebar-collapsed-width`
- Activo: `--sidebar-active-bg`, `--sidebar-active-accent`
- Topbar mobile: `--topbar-height`

## Componentes migrados

Se movieron estilos scoped de estos archivos hacia CSS centralizado:

- `frontend/src/views/CmsCourses.vue`
- `frontend/src/views/cms/courses/tabs/CmsCourseBuildTab.vue`
- `frontend/src/views/cms/courses/tabs/CmsCourseSummaryTab.vue`
- `frontend/src/views/cms/courses/tabs/CmsCourseStaffTab.vue`
- `frontend/src/views/cms/courses/tabs/CmsCourseEnrollmentsTab.vue`
- `frontend/src/views/cms/courses/tabs/CmsCourseInstructorsTab.vue`
- `frontend/src/views/cms/courses/tabs/CmsCourseForumsTab.vue`
- `frontend/src/components/cms/posts/CmsCoursePostsTab.vue`
- `frontend/src/components/cms/posts/CmsPostDialog.vue`
- `frontend/src/components/cms/announcements/CmsCourseAnnouncementsTab.vue`
- `frontend/src/components/cms/announcements/AnnouncementFormDialog.vue`
- `frontend/src/views/cms/courses/tabs/CmsCourseGroupsTab.vue`
- `frontend/src/views/cms/courses/groups/CmsCourseGroupStudentsDialog.vue`
- `frontend/src/views/cms/courses/tabs/CmsCourseLiveSessionsTab.vue`
- `frontend/src/views/cms/courses/attendance/components/AttendanceLegend.vue`
- `frontend/src/views/cms/courses/attendance/components/AttendanceCellEditor.vue`
- `frontend/src/views/cms/courses/attendance/components/AttendanceWeekHeader.vue`
- `frontend/src/views/cms/courses/attendance/components/AttendanceWeekGrid.vue`
- `frontend/src/views/cms/courses/attendance/CmsCourseAttendanceTab.vue`
- `frontend/src/views/cms/courses/attendance/components/AttendanceOverviewCharts.vue`
- `frontend/src/components/AppShell.vue`

## Verificacion

Comando usado:

```bash
cd frontend
npm run build
```

El build pasa correctamente.

Queda un warning existente de Vite por chunks grandes. No esta relacionado con la centralizacion de estilos.

## Reglas recomendadas

- Para colores repetidos, agregar o reutilizar tokens en `tokens.css`.
- Para PrimeVue, preferir `primevue.css`.
- Para pantallas CMS, preferir `domains/cms.css`.
- Para asistencia, preferir `domains/attendance.css`.
- Evitar agregar nuevos `<style scoped>` en componentes CMS salvo que el estilo sea realmente unico y no reutilizable.
- Evitar `:deep()` cuando una clase global bajo dominio pueda resolver el caso.

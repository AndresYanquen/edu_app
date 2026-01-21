# Resumen de migraciones

Este documento recopila el propósito principal de cada archivo en `migrations/`, para tener una referencia rápida sobre cómo evoluciona el modelo relacional de la plataforma.

| Archivo | Propósito / contexto clave |
| --- | --- |
| `0001_init.js` | Esquema MVP inicial: usuarios, membresías, cursos, módulos, lecciones, grupos, roles básicos, progresos, assets, anuncios y enums para roles, nivel/cursos/agrupaciones. Incluye índices fundamentales. |
| `0002_refresh_tokens.js` | Añade `refresh_tokens` para tokens rotativos con hash, expiración, revocación y referencias a `users`; indexa `user_id` y `expires_at`. |
| `0003_lesson_content_fields.js` | Agrega campos opcionales `content_text`, `video_url` y `estimated_minutes` a `lessons` si no existían, con reversión que solo elimina los recién añadidos. |
| `0004_quiz_tables.js` | Introduce las tablas `quiz_questions`, `quiz_options` y `quiz_attempts` con restricciones, timestamps e índices para ordenar por lección, pregunta y usuario. |
| `0005_cms_content_states.js` | Añade metadata de publicación (`is_published`, `published_at`, `order_index`, `updated_at`) a cursos, módulos y lecciones, copia `position` a `order_index` y crea `course_instructors`. |
| `0006_quiz_option_meta.js` | Garantiza campos `created_at` y `updated_at` en `quiz_options` con defaults y permite eliminarlos si se revierte. |
| `0007_user_activation.js` | Agrega flags `is_active` y `must_set_password` a `users`, fuerza valores por defecto y crea `user_invites` para tokens de invitación. |
| `0008_course_roles.js` | Reemplaza la tabla `course_instructors` por `roles`, `user_roles` y `course_user_roles`, siembra roles base y migra relaciones a la nueva estructura. |
| `0009_drop_academy_memberships.js` | Elimina la tabla `academy_memberships` histórica y limpia enums huérfanos dentro de una transacción. |
| `0010_lesson_rich_content.js` | Introduce `content_markdown` en `lessons` y replica el texto existente para conservarlo como contenido rico. |
| `0011_class_types.js` | Crea `class_types` para catalogar códigos (conversation, workshop, grammar) con etiquetas, activo y timestamps. |
| `0012_live_session_series.js` | Define `live_session_series` vinculado a grupo/curso/módulo, con reglas RRULE, duración, URLs y referencias a `class_types` y docentes. |
| `0013_live_sessions.js` | Declara `live_sessions` por serie con tiempos concretos, estado (`scheduled`, `cancelled`, `completed`), URLs y los índices necesarios. |
| `0014_add_group_fields.js` | Extiende `groups` con metadatos (código, zona horaria, fechas, capacidad, bandera `is_active`, `updated_at`) y agrega un índice único condicional por código. |
| `0015_course_levels_refactor.js` | Sustituye el ENUM `course_level` por la tabla `course_levels`, migra los cursos a `level_id`, elimina la columna antigua y mantiene reversión que recria el ENUM. |
| `0016_assets_metadata.js` | Amplía `assets` renombrando `path` a `storage_path` y sumando `kind`, `original_name` y `public_url` para más metadata. |
| `0017_lesson_content_html.js` | Añade `content_html` en `lessons`, la llena desde `content_markdown` y la elimina en el rollback. |

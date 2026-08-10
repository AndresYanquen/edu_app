# Academy API

Minimal single-academy backend built with Node.js, Express, PostgreSQL, and Knex. Provides course/cohort management plus JWT access tokens with refresh-cookie rotation.

## Requirements
- Node.js >= 18
- PostgreSQL 14 or newer

## Setup
1. Install deps: `npm install`
2. Copy `cp .env.example .env` and set `DATABASE_URL` (plus other secrets)
3. Reset local DB: `npm run db:reset`
4. Start server: `npm run dev`
5. Health check available at `GET /health`

## Scripts
- `npm run dev` – start API
- `npm run migrate` – latest migrations
- `npm run seed` – seed demo data
- `npm run db:reset` – rollback all, reapply, seed

## CMS Enrollment Management
- `GET /cms/courses/:courseId/enrollments` – current course enrollments with group info.
- `GET /cms/courses/:courseId/students/available` – students eligible to enroll.
- `POST /cms/courses/:courseId/enroll` – enroll a single student (optional group assignment).
- `POST /cms/courses/:courseId/enroll/bulk` – enroll multiple students at once (returns enrolled vs skipped).
- `POST /cms/courses/:courseId/enroll/:studentId/group` – change/remove the student’s group.
- `DELETE /cms/courses/:courseId/enroll/:studentId` – remove student enrollment (and related group rows).

## CMS Asset Uploads
- `POST /cms/courses/:courseId/lessons/:lessonId/assets/upload-image` – upload lesson images through the backend; images are validated, converted to WebP, stored privately in R2, and returned with a short-lived signed URL.
- `POST /cms/courses/:courseId/lessons/:lessonId/assets/upload-url` – request an R2 presigned URL for allowed PDF/audio uploads.
- `GET /cms/assets?kind=<image|audio|file>&search=<term>` – list the most recent 50 assets uploaded by the current user, optionally filtered by kind or filename (case-insensitive partial match). Each item contains `assetId`, `kind`, `mimeType`, `originalName`, `sizeBytes`, `storagePath`, `url`, and `createdAt`.
- `POST /cms/assets/confirm-upload` – after uploading to a backend-issued R2 presigned URL, send `{ courseId, lessonId, storageKey, kind, mimeType, originalName, sizeBytes, storageProvider }` so the backend can verify permissions, confirm the object exists, and persist metadata in the `assets` table.

Lesson uploads use backend-issued R2 presigned URLs. The frontend should not configure or call Supabase Storage directly.

## Authentication
`POST /auth/login` returns a short-lived access token (store in memory) and sets an httpOnly `refresh_token` cookie. Use `Authorization: Bearer <accessToken>` for protected calls, `POST /auth/refresh` to rotate tokens, and `POST /auth/logout` to revoke + clear the cookie.

### Cross-origin sessions
When your frontend runs on a different origin than the API (for example, the Vite dev server on `http://localhost:5173`), browsers only send the `refresh_token` cookie if it is marked as `SameSite=None` and, when the client is served via HTTPS, as `Secure`. The server now defaults to those values, sends the cookie for every path under `/`, and enables `Secure` automatically whenever `FRONTEND_ORIGIN` starts with `https` or when `NODE_ENV` is `production`. If you override `COOKIE_SAMESITE`/`COOKIE_SECURE`, keep them aligned with your deployment so the refresh endpoint can rotate cookies and the session keeps running.

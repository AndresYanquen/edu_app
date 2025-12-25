# Project Context for AI Assistant (Codex)

You are assisting in the development of an educational platform (LMS-style),
similar in overall capabilities to Educabot Aula, but **generic** and reusable for any academy.

## High-level goal

Build an MVP of an academy management platform where:

* The system handles **NO payments** (payments are verified externally).
* All users are created by an **admin** (pre-verified).
* The platform supports courses, lessons, groups (cohorts), instructors, and students.
* The core value is academic structure + content delivery + progress tracking + announcements.

This is NOT a marketplace.
This is NOT multi-tenant SaaS yet (single academy MVP).
This is NOT chat/gamification/certificates (unless requested later).

## Tech stack (fixed decisions)

Backend:

* Node.js (JavaScript only)
* PostgreSQL (local for now)
* Knex.js for migrations + seeds
* Prefer **SQL-first**: use `knex.raw()` for schema creation and complex queries
* REST API (Express or Fastify; pick minimal boilerplate)
* JWT-based authentication (login only; admin-created users)

Frontend:

* Separate project later (not in scope now)

## Database rules (IMPORTANT)

* Use UUID primary keys with Postgres:

  * `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
  * `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
* Enforce constraints (FK, UNIQUE, CHECK) early.
* Prefer explicit join tables for many-to-many.
* Prefer clarity over cleverness.
* Keep queries simple and index-friendly.

## User roles (application-level)

Roles are stored as data; **never** map end-users to Postgres roles.
Roles:

* admin
* instructor
* student

## Core concepts

* Course -> Modules -> Lessons
* Lessons support: text, video, link, file, embed
* Students enroll into Courses
* Courses can have multiple Groups (cohorts)
* Groups have assigned instructors and students
* Progress tracked per user per lesson
* Announcements scoped to academy/course/group

## MVP tables (baseline)

* users
* academy_memberships (single academy; role & status for each user)
* courses
* modules
* lessons
* groups
* group_teachers (join)
* group_students (join)
* enrollments
* lesson_progress (PK: user_id + lesson_id)
* assets
* lesson_assets (join)
* announcements

## Groups meaning

A group is the real teaching unit (cohort/class), e.g.:

* "A1 - Mon/Wed 7pm"
* "Cohort 12 - Bootcamp"
  Usually a student belongs to one group per course.

## MVP flows to support (vertical slice)

Admin:

1. Create users and assign roles
2. Create course/module/lesson
3. Create group for a course
4. Assign instructor(s) to group
5. Assign students to group
6. Enroll student in course

Student:

1. Login
2. List enrolled courses
3. View course -> modules -> lessons
4. Update lesson progress

Instructor:

1. Login
2. List assigned groups
3. View students in group
4. View progress summaries

## Security assumptions

* Backend enforces permissions (admin/instructor/student).
* Frontend only reflects allowed actions.
* JWT contains user_id and role.
* No direct DB access from client.
* Prefer parameterized queries everywhere.

## Coding style expectations

* Keep code explicit and readable.
* Avoid overengineering; MVP first.
* No microservices; single API.
* Keep modules simple: auth, users, courses, groups, progress, announcements.

## When generating code

* DO NOT introduce payments/billing.
* DO NOT introduce multi-academy tenants unless explicitly asked.
* Favor SQL migrations via Knex (migrations/ and seeds/).
* Prefer UUIDs and pgcrypto.
* Ask before adding new tables beyond the MVP baseline.

## First development priorities

1. Knex migration: init schema (all MVP tables + constraints + indexes)
2. Seed data for local dev (admin + instructor + students + sample courses/groups)
3. Minimal auth (admin-created users)
4. Core read flows (courses/modules/lessons)
5. Lesson progress update endpoint

You should help with:

* Database schema (SQL)
* Knex migrations and seeds
* REST endpoints and services
* Query design and indexes
* Refactors when model evolves

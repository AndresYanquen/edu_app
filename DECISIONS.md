# Decisions Log (MVP)

## Product scope (MVP)

* Single academy MVP (not multi-tenant SaaS yet).
* No payment processing in the system.

  * Admin creates users only after external payment verification.
* Core features only:

  * courses/modules/lessons
  * groups (cohorts) with instructors + students
  * enrollments
  * lesson progress tracking
  * announcements (academy/course/group)

## Tech decisions

* Backend: Node.js (JavaScript only)
* Database: PostgreSQL (local initially)
* Migrations/Seeds: Knex.js
* SQL-first approach:

  * Prefer knex.raw() for schema creation and complex queries
  * Keep business logic in backend, constraints in DB

## ID strategy

* Use UUID primary keys across tables.
* Postgres extension:

  * pgcrypto enabled
  * Default id: gen_random_uuid()

## Role strategy

* End-user roles are stored as application data:

  * admin / instructor / student
* Do not create a Postgres role per end user.
* Authorization enforced in backend (and optionally RLS later).

## Naming & structure rules

* Explicit join tables for many-to-many:

  * group_teachers
  * group_students
  * lesson_assets
* Progress stored per user per lesson:

  * lesson_progress primary key: (user_id, lesson_id)

## Out of scope (until requested)

* payments/billing/subscriptions
* chat/forums
* certificates
* gamification
* marketplace features
* multi-academy tenancy
* live video (Zoom/Meet integration)

## Immediate next steps

1. Create Knex init migration with all MVP tables, constraints, and indexes
2. Create seed data for local development
3. Implement minimal auth (login) and core read endpoints

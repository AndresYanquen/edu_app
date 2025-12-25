/**
 * init_mvp.js
 * MVP schema for academy platform (single academy, no payments).
 * SQL-first migration managed by Knex.
 *
 * Tables (MVP):
 * users, academy_memberships, courses, modules, lessons,
 * groups, group_teachers, group_students,
 * enrollments, lesson_progress,
 * assets, lesson_assets,
 * announcements
 *
 * IDs: UUID via pgcrypto/gen_random_uuid()
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async (knex) => {
  await knex.raw(`
    -- UUID generation
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    -- ---------- ENUM TYPES ----------
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('admin', 'instructor', 'student');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE membership_status AS ENUM ('active', 'invited', 'suspended');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE course_status AS ENUM ('draft', 'published', 'archived');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE course_level AS ENUM ('A1','A2','B1','B2','C1','C2');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE lesson_content_type AS ENUM ('video','text','link','file','embed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE group_status AS ENUM ('active','archived');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE enrollment_status AS ENUM ('active','completed','paused');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE progress_status AS ENUM ('not_started','in_progress','done');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE announcement_scope AS ENUM ('academy','course','group');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- ---------- TABLES ----------
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Single-academy MVP: one membership row per user
    CREATE TABLE IF NOT EXISTS academy_memberships (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role user_role NOT NULL,
      status membership_status NOT NULL DEFAULT 'active',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT academy_memberships_user_unique UNIQUE (user_id)
    );

    CREATE TABLE IF NOT EXISTS courses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      level course_level NOT NULL DEFAULT 'A1',
      status course_status NOT NULL DEFAULT 'draft',
      owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      published_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS modules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      position INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT modules_course_position_unique UNIQUE (course_id, position)
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      position INT NOT NULL,
      content_type lesson_content_type NOT NULL DEFAULT 'text',
      content_text TEXT,
      content_url TEXT,
      embed_html TEXT,
      duration_seconds INT,
      is_free_preview BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT lessons_module_position_unique UNIQUE (module_id, position)
    );

    CREATE TABLE IF NOT EXISTS groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status group_status NOT NULL DEFAULT 'active',
      schedule_text TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Join: group -> teachers (users)
    CREATE TABLE IF NOT EXISTS group_teachers (
      group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'lead',
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (group_id, user_id),
      CONSTRAINT group_teachers_role_check CHECK (role IN ('lead','assistant'))
    );

    -- Join: group -> students (users)
    CREATE TABLE IF NOT EXISTS group_students (
      group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      status TEXT NOT NULL DEFAULT 'active',
      PRIMARY KEY (group_id, user_id),
      CONSTRAINT group_students_status_check CHECK (status IN ('active','paused'))
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status enrollment_status NOT NULL DEFAULT 'active',
      enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT enrollments_course_user_unique UNIQUE (course_id, user_id)
    );

    -- Progress is per (user, lesson)
    CREATE TABLE IF NOT EXISTS lesson_progress (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      status progress_status NOT NULL DEFAULT 'not_started',
      progress_percent INT,
      last_seen_at TIMESTAMPTZ,
      PRIMARY KEY (user_id, lesson_id),
      CONSTRAINT lesson_progress_percent_check CHECK (
        progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100)
      )
    );

    -- Reusable uploaded files (PDF/audio/video/etc.)
    CREATE TABLE IF NOT EXISTS assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      storage_provider TEXT NOT NULL DEFAULT 'local',
      path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Join: lesson <-> assets
    CREATE TABLE IF NOT EXISTS lesson_assets (
      lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      PRIMARY KEY (lesson_id, asset_id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      scope announcement_scope NOT NULL DEFAULT 'academy',
      course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
      group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
      created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT announcements_scope_check CHECK (
        (scope = 'academy' AND course_id IS NULL AND group_id IS NULL) OR
        (scope = 'course' AND course_id IS NOT NULL AND group_id IS NULL) OR
        (scope = 'group' AND group_id IS NOT NULL)
      )
    );

    -- ---------- INDEXES ----------
    CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id);
    CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON lessons(module_id);
    CREATE INDEX IF NOT EXISTS idx_lessons_module_position ON lessons(module_id, position);

    CREATE INDEX IF NOT EXISTS idx_groups_course_id ON groups(course_id);

    CREATE INDEX IF NOT EXISTS idx_group_teachers_user_id ON group_teachers(user_id);
    CREATE INDEX IF NOT EXISTS idx_group_students_user_id ON group_students(user_id);

    CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);

    CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson_id ON lesson_progress(lesson_id);

    CREATE INDEX IF NOT EXISTS idx_lesson_assets_asset_id ON lesson_assets(asset_id);

    CREATE INDEX IF NOT EXISTS idx_announcements_course_id ON announcements(course_id);
    CREATE INDEX IF NOT EXISTS idx_announcements_group_id ON announcements(group_id);
  `);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async (knex) => {
  await knex.raw(`
    -- Drop indexes (optional; DROP TABLE would remove most implicitly, but explicit is clean)
    DROP INDEX IF EXISTS idx_announcements_group_id;
    DROP INDEX IF EXISTS idx_announcements_course_id;
    DROP INDEX IF EXISTS idx_lesson_assets_asset_id;
    DROP INDEX IF EXISTS idx_lesson_progress_lesson_id;
    DROP INDEX IF EXISTS idx_enrollments_user_id;
    DROP INDEX IF EXISTS idx_group_students_user_id;
    DROP INDEX IF EXISTS idx_group_teachers_user_id;
    DROP INDEX IF EXISTS idx_groups_course_id;
    DROP INDEX IF EXISTS idx_lessons_module_position;
    DROP INDEX IF EXISTS idx_lessons_module_id;
    DROP INDEX IF EXISTS idx_modules_course_id;

    -- Drop tables in reverse dependency order
    DROP TABLE IF EXISTS announcements;
    DROP TABLE IF EXISTS lesson_assets;
    DROP TABLE IF EXISTS assets;
    DROP TABLE IF EXISTS lesson_progress;
    DROP TABLE IF EXISTS enrollments;
    DROP TABLE IF EXISTS group_students;
    DROP TABLE IF EXISTS group_teachers;
    DROP TABLE IF EXISTS groups;
    DROP TABLE IF EXISTS lessons;
    DROP TABLE IF EXISTS modules;
    DROP TABLE IF EXISTS courses;
    DROP TABLE IF EXISTS academy_memberships;
    DROP TABLE IF EXISTS users;

    -- Drop enums
    DROP TYPE IF EXISTS announcement_scope;
    DROP TYPE IF EXISTS progress_status;
    DROP TYPE IF EXISTS enrollment_status;
    DROP TYPE IF EXISTS group_status;
    DROP TYPE IF EXISTS lesson_content_type;
    DROP TYPE IF EXISTS course_level;
    DROP TYPE IF EXISTS course_status;
    DROP TYPE IF EXISTS membership_status;
    DROP TYPE IF EXISTS user_role;
  `);
};

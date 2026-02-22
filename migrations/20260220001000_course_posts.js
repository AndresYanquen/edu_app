/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS course_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      group_id UUID NULL REFERENCES groups(id) ON DELETE SET NULL,
      created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_course_posts_course_created_at
      ON course_posts(course_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_course_posts_group_created_at
      ON course_posts(group_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_course_posts_course_group_created_at
      ON course_posts(course_id, group_id, created_at DESC);
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_course_posts_course_group_created_at;
    DROP INDEX IF EXISTS idx_course_posts_group_created_at;
    DROP INDEX IF EXISTS idx_course_posts_course_created_at;
    DROP TABLE IF EXISTS course_posts;
  `);
};

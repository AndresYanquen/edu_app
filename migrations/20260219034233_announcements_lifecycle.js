/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  await knex.raw(`
    -- ENUM: announcement_status
    DO $$ BEGIN
      CREATE TYPE announcement_status AS ENUM ('draft','published','archived');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE announcements
      ADD COLUMN IF NOT EXISTS status announcement_status NOT NULL DEFAULT 'published',
      ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 2,
      ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

    -- Optional safety constraint
    ALTER TABLE announcements
      ADD CONSTRAINT announcements_time_check
      CHECK (
        expires_at IS NULL
        OR starts_at IS NULL
        OR expires_at > starts_at
      );

    -- Helpful indexes
    CREATE INDEX IF NOT EXISTS idx_announcements_status
      ON announcements(status);

    CREATE INDEX IF NOT EXISTS idx_announcements_created_at
      ON announcements(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_announcements_expires_at
      ON announcements(expires_at);
  `);
};


/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_announcements_expires_at;
    DROP INDEX IF EXISTS idx_announcements_created_at;
    DROP INDEX IF EXISTS idx_announcements_status;

    ALTER TABLE announcements
      DROP CONSTRAINT IF EXISTS announcements_time_check;

    ALTER TABLE announcements
      DROP COLUMN IF EXISTS expires_at,
      DROP COLUMN IF EXISTS starts_at,
      DROP COLUMN IF EXISTS priority,
      DROP COLUMN IF EXISTS status;

    DROP TYPE IF EXISTS announcement_status;
  `);
};


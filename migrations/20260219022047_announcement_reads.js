/**
 * Create announcement_reads table to track per-user read state
 * for announcements (academy/course/group) without fan-out inserts.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS announcement_reads (
      announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (announcement_id, user_id)
    );

    -- Fast lookups: "what unread announcements does this user have?"
    CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_id
      ON announcement_reads(user_id);

    -- Optional: helpful if you ever query "who read this announcement?"
    CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement_id
      ON announcement_reads(announcement_id);
  `);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async (knex) => {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_announcement_reads_announcement_id;
    DROP INDEX IF EXISTS idx_announcement_reads_user_id;
    DROP TABLE IF EXISTS announcement_reads;
  `);
};

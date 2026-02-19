/**
 * Add ordering index for announcement feeds.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async (knex) => {
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_announcements_created_at
      ON announcements(created_at DESC);
  `);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async (knex) => {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_announcements_created_at;
  `);
};

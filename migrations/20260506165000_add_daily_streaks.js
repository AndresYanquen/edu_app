exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE user_streaks
      ADD COLUMN IF NOT EXISTS current_day_streak INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS best_day_streak INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_active_day DATE NULL;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    ALTER TABLE user_streaks
      DROP COLUMN IF EXISTS last_active_day,
      DROP COLUMN IF EXISTS best_day_streak,
      DROP COLUMN IF EXISTS current_day_streak;
  `);
};


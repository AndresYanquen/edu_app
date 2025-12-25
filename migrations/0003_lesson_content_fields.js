/**
 * Adds richer lesson content fields.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async (knex) => {
  const hasContentText = await knex.schema.hasColumn('lessons', 'content_text');
  if (!hasContentText) {
    await knex.schema.alterTable('lessons', (table) => {
      table.text('content_text');
    });
  }

  const hasVideoUrl = await knex.schema.hasColumn('lessons', 'video_url');
  if (!hasVideoUrl) {
    await knex.schema.alterTable('lessons', (table) => {
      table.text('video_url');
    });
  }

  const hasEstimatedMinutes = await knex.schema.hasColumn('lessons', 'estimated_minutes');
  if (!hasEstimatedMinutes) {
    await knex.schema.alterTable('lessons', (table) => {
      table.integer('estimated_minutes');
    });
  }
};

exports.down = async (knex) => {
  const hasEstimatedMinutes = await knex.schema.hasColumn('lessons', 'estimated_minutes');
  if (hasEstimatedMinutes) {
    await knex.schema.alterTable('lessons', (table) => {
      table.dropColumn('estimated_minutes');
    });
  }

  const hasVideoUrl = await knex.schema.hasColumn('lessons', 'video_url');
  if (hasVideoUrl) {
    await knex.schema.alterTable('lessons', (table) => {
      table.dropColumn('video_url');
    });
  }

  // content_text existed in the base schema, so we leave it intact.
};

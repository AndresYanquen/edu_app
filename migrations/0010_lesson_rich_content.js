/**
 * Adds markdown/rich content support for lessons.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('lessons', 'content_markdown');
  if (!hasColumn) {
    await knex.schema.alterTable('lessons', (table) => {
      table.text('content_markdown').nullable();
    });
    await knex('lessons')
      .whereNull('content_markdown')
      .update({ content_markdown: knex.ref('content_text') });
  }
};

exports.down = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('lessons', 'content_markdown');
  if (hasColumn) {
    await knex.schema.alterTable('lessons', (table) => {
      table.dropColumn('content_markdown');
    });
  }
};

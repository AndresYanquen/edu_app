/**
 * Adds HTML content storage to lessons for the PrimeVue editor output.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('lessons', 'content_html');
  if (!hasColumn) {
    await knex.schema.alterTable('lessons', (table) => {
      table.text('content_html').nullable();
    });
    await knex('lessons')
      .whereNull('content_html')
      .update({ content_html: knex.ref('content_markdown') });
  }
};

exports.down = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('lessons', 'content_html');
  if (hasColumn) {
    await knex.schema.alterTable('lessons', (table) => {
      table.dropColumn('content_html');
    });
  }
};

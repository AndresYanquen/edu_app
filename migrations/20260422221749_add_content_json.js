exports.up = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('lessons', 'content_json');

  if (!hasColumn) {
    await knex.schema.alterTable('lessons', (table) => {
      table.jsonb('content_json').nullable();
    });
  }
};

exports.down = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('lessons', 'content_json');

  if (hasColumn) {
    await knex.schema.alterTable('lessons', (table) => {
      table.dropColumn('content_json');
    });
  }
};
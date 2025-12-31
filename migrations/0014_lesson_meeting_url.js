exports.up = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('lessons', 'meeting_url');
  if (!hasColumn) {
    await knex.schema.alterTable('lessons', (table) => {
      table.text('meeting_url');
    });
  }
};

exports.down = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('lessons', 'meeting_url');
  if (hasColumn) {
    await knex.schema.alterTable('lessons', (table) => {
      table.dropColumn('meeting_url');
    });
  }
};

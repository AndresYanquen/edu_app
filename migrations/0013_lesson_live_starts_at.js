exports.up = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('lessons', 'live_starts_at');
  if (!hasColumn) {
    await knex.schema.alterTable('lessons', (table) => {
      table.timestamp('live_starts_at');
    });
  }
};

exports.down = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('lessons', 'live_starts_at');
  if (hasColumn) {
    await knex.schema.alterTable('lessons', (table) => {
      table.dropColumn('live_starts_at');
    });
  }
};

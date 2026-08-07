exports.up = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('lessons', 'cover_image_url');
  if (!hasColumn) {
    await knex.schema.alterTable('lessons', (table) => {
      table.text('cover_image_url').nullable();
    });
  }
};

exports.down = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('lessons', 'cover_image_url');
  if (hasColumn) {
    await knex.schema.alterTable('lessons', (table) => {
      table.dropColumn('cover_image_url');
    });
  }
};

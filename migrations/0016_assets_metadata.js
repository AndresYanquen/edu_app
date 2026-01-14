exports.up = async (knex) => {
  await knex.schema.alterTable('assets', (table) => {
    table.renameColumn('path', 'storage_path');
    table.text('kind');
    table.text('original_name');
    table.text('public_url');
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('assets', (table) => {
    table.renameColumn('storage_path', 'path');
    table.dropColumn('kind');
    table.dropColumn('original_name');
    table.dropColumn('public_url');
  });
};

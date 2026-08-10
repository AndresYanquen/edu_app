exports.up = async (knex) => {
  const hasTokenVersion = await knex.schema.hasColumn('users', 'token_version');
  if (!hasTokenVersion) {
    await knex.schema.alterTable('users', (table) => {
      table.integer('token_version').notNullable().defaultTo(0);
    });
  }

  await knex.raw('UPDATE users SET token_version = COALESCE(token_version, 0)');
};

exports.down = async (knex) => {
  const hasTokenVersion = await knex.schema.hasColumn('users', 'token_version');
  if (hasTokenVersion) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('token_version');
    });
  }
};

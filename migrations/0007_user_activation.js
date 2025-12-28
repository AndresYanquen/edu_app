/**
 * Adds user activation flags and invite tokens.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async (knex) => {
  const ensureUserColumn = async (column, builder) => {
    const exists = await knex.schema.hasColumn('users', column);
    if (!exists) {
      await knex.schema.alterTable('users', builder);
    }
  };

  await ensureUserColumn('is_active', (table) =>
    table.boolean('is_active').notNullable().defaultTo(true),
  );
  await ensureUserColumn('must_set_password', (table) =>
    table.boolean('must_set_password').notNullable().defaultTo(false),
  );

  await knex.raw('UPDATE users SET is_active = COALESCE(is_active, true)');
  await knex.raw('UPDATE users SET must_set_password = COALESCE(must_set_password, false)');

  const hasInvites = await knex.schema.hasTable('user_invites');
  if (!hasInvites) {
    await knex.schema.createTable('user_invites', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table
        .uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE');
      table.text('token_hash').notNullable().unique();
      table.timestamp('expires_at').notNullable();
      table.timestamp('used_at');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });
  }
};

exports.down = async (knex) => {
  const dropColumn = async (column) => {
    const exists = await knex.schema.hasColumn('users', column);
    if (exists) {
      await knex.schema.alterTable('users', (table) => {
        table.dropColumn(column);
      });
    }
  };

  await dropColumn('must_set_password');
  await dropColumn('is_active');
  await knex.schema.dropTableIfExists('user_invites');
};

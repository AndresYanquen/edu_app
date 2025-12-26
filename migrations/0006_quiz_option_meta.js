/**
 * Ensures quiz option metadata columns exist.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async (knex) => {
  const hasCreatedAt = await knex.schema.hasColumn('quiz_options', 'created_at');
  if (!hasCreatedAt) {
    await knex.schema.alterTable('quiz_options', (table) => {
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });
  }

  const hasUpdatedAt = await knex.schema.hasColumn('quiz_options', 'updated_at');
  if (!hasUpdatedAt) {
    await knex.schema.alterTable('quiz_options', (table) => {
      table
        .timestamp('updated_at')
        .notNullable()
        .defaultTo(knex.fn.now());
    });
  }
};

exports.down = async (knex) => {
  const hasUpdatedAt = await knex.schema.hasColumn('quiz_options', 'updated_at');
  if (hasUpdatedAt) {
    await knex.schema.alterTable('quiz_options', (table) => {
      table.dropColumn('updated_at');
    });
  }

  const hasCreatedAt = await knex.schema.hasColumn('quiz_options', 'created_at');
  if (hasCreatedAt) {
    await knex.schema.alterTable('quiz_options', (table) => {
      table.dropColumn('created_at');
    });
  }
};

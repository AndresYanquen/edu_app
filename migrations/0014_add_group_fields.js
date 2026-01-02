/**
 * Extend the groups table with extra metadata for CMS management.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async (knex) => {
  await knex.schema.alterTable('groups', (table) => {
    table.text('code').nullable();
    table.text('timezone').notNullable().defaultTo('America/Bogota');
    table.date('start_date').nullable();
    table.date('end_date').nullable();
    table.integer('capacity').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.raw(
    `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_course_code_unique
      ON groups(course_id, code)
      WHERE code IS NOT NULL
    `,
  );
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS idx_groups_course_code_unique');

  await knex.schema.alterTable('groups', (table) => {
    table.dropColumn('code');
    table.dropColumn('timezone');
    table.dropColumn('start_date');
    table.dropColumn('end_date');
    table.dropColumn('capacity');
    table.dropColumn('is_active');
    table.dropColumn('updated_at');
  });
};

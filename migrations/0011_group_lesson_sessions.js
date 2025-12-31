/**
 * Adds table for scheduling live sessions per group and lesson.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async (knex) => {
  await knex.schema.createTable('group_lesson_sessions', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('group_id')
      .notNullable()
      .references('id')
      .inTable('groups')
      .onDelete('CASCADE');
    table
      .uuid('lesson_id')
      .notNullable()
      .references('id')
      .inTable('lessons')
      .onDelete('CASCADE');
    table.timestamp('starts_at', { useTz: true }).notNullable();
    table.timestamp('ends_at', { useTz: true }).nullable();
    table.text('meeting_url').notNullable();
    table.integer('unlock_offset_minutes').notNullable().defaultTo(5);
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.unique(['group_id', 'lesson_id']);
    table.index(['group_id']);
    table.index(['lesson_id']);
    table.index(['starts_at']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('group_lesson_sessions');
};

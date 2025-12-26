/**
 * Quiz tables for lessons.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async (knex) => {
  await knex.schema.createTable('quiz_questions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('lesson_id')
      .notNullable()
      .references('id')
      .inTable('lessons')
      .onDelete('CASCADE');
    table.text('question_text').notNullable();
    table.text('question_type').notNullable().defaultTo('single_choice');
    table.integer('order_index').notNullable().defaultTo(1);
    table.check(`question_type IN ('single_choice','true_false')`);
    table.timestamps(false, true);
  });

  await knex.schema.alterTable('quiz_questions', (table) => {
    table.index(['lesson_id', 'order_index'], 'idx_quiz_questions_lesson_order');
  });

  await knex.schema.createTable('quiz_options', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('question_id')
      .notNullable()
      .references('id')
      .inTable('quiz_questions')
      .onDelete('CASCADE');
    table.text('option_text').notNullable();
    table.boolean('is_correct').notNullable().defaultTo(false);
    table.integer('order_index').notNullable().defaultTo(1);
  });

  await knex.schema.alterTable('quiz_options', (table) => {
    table.index(['question_id', 'order_index'], 'idx_quiz_options_question_order');
  });

  await knex.schema.createTable('quiz_attempts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .uuid('lesson_id')
      .notNullable()
      .references('id')
      .inTable('lessons')
      .onDelete('CASCADE');
    table.integer('score_percent').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('quiz_attempts', (table) => {
    table.index(['user_id', 'lesson_id', 'created_at'], 'idx_quiz_attempts_user_lesson_created');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('quiz_attempts');
  await knex.schema.dropTableIfExists('quiz_options');
  await knex.schema.dropTableIfExists('quiz_questions');
};

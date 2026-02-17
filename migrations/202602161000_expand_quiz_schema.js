const TABLE_NAME_QUESTIONS = 'quiz_questions';
const TABLE_NAME_OPTIONS = 'quiz_options';
const TABLE_NAME_ATTEMPTS = 'quiz_attempts';
const TABLE_NAME_ATTEMPT_ANSWERS = 'quiz_attempt_answers';

exports.up = async (knex) => {
  await knex.schema.alterTable(TABLE_NAME_QUESTIONS, (table) => {
    table.decimal('points', 8, 3).notNullable().defaultTo(1);
    table.text('explanation').nullable();
    table.jsonb('meta').nullable();
  });

  await knex.raw(`
    ALTER TABLE ${TABLE_NAME_QUESTIONS} DROP CONSTRAINT IF EXISTS quiz_questions_question_type_check;
    ALTER TABLE ${TABLE_NAME_QUESTIONS} ADD CONSTRAINT quiz_questions_question_type_check
      CHECK (question_type IN ('single_choice','multiple_choice','true_false','short_text','long_text','numeric'));
  `);

  await knex.schema.alterTable(TABLE_NAME_OPTIONS, (table) => {
    table.decimal('points', 8, 3).notNullable().defaultTo(0);
    table.text('feedback').nullable();
    table.jsonb('meta').nullable();
  });

  await knex.schema.alterTable(TABLE_NAME_ATTEMPTS, (table) => {
    table.integer('attempt_number').notNullable().defaultTo(1);
    table.text('status').notNullable().defaultTo('submitted');
    table.timestamp('started_at').nullable();
    table.timestamp('submitted_at').nullable();
    table.timestamp('graded_at').nullable();
    table.decimal('score_raw', 8, 3).nullable();
    table.boolean('passed').nullable();
    table.jsonb('metadata').nullable();
  });

  await knex.schema.createTable(TABLE_NAME_ATTEMPT_ANSWERS, (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('attempt_id')
      .notNullable()
      .references('id')
      .inTable(TABLE_NAME_ATTEMPTS)
      .onDelete('CASCADE');
    table
      .uuid('question_id')
      .notNullable()
      .references('id')
      .inTable(TABLE_NAME_QUESTIONS)
      .onDelete('CASCADE');
    table
      .uuid('selected_option_id')
      .notNullable()
      .references('id')
      .inTable(TABLE_NAME_OPTIONS)
      .onDelete('CASCADE');
    table.boolean('correct').nullable();
    table.decimal('points_awarded', 8, 3).nullable();
    table.jsonb('meta').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    CREATE UNIQUE INDEX idx_quiz_attempt_answers_attempt_question_option
    ON ${TABLE_NAME_ATTEMPT_ANSWERS} (attempt_id, question_id, selected_option_id);
  `);
  await knex.raw(`
    CREATE INDEX idx_quiz_attempt_answers_attempt ON ${TABLE_NAME_ATTEMPT_ANSWERS} (attempt_id);
  `);
  await knex.raw(`
    CREATE INDEX idx_quiz_attempt_answers_question ON ${TABLE_NAME_ATTEMPT_ANSWERS} (question_id);
  `);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists(TABLE_NAME_ATTEMPT_ANSWERS);

  await knex.schema.alterTable(TABLE_NAME_ATTEMPTS, (table) => {
    table.dropColumn('attempt_number');
    table.dropColumn('status');
    table.dropColumn('started_at');
    table.dropColumn('submitted_at');
    table.dropColumn('graded_at');
    table.dropColumn('score_raw');
    table.dropColumn('passed');
    table.dropColumn('metadata');
  });

  await knex.schema.alterTable(TABLE_NAME_OPTIONS, (table) => {
    table.dropColumn('points');
    table.dropColumn('feedback');
    table.dropColumn('meta');
  });

  await knex.schema.alterTable(TABLE_NAME_QUESTIONS, (table) => {
    table.dropColumn('points');
    table.dropColumn('explanation');
    table.dropColumn('meta');
  });

  await knex.raw(`
    ALTER TABLE ${TABLE_NAME_QUESTIONS} DROP CONSTRAINT IF EXISTS quiz_questions_question_type_check;
    ALTER TABLE ${TABLE_NAME_QUESTIONS} ADD CONSTRAINT quiz_questions_question_type_check
      CHECK (question_type IN ('single_choice','true_false'));
  `);
};

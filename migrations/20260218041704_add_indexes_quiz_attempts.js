/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  // 1️⃣ Índice principal por usuario + lección + fecha
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_lesson_created
    ON quiz_attempts (user_id, lesson_id, created_at DESC);
  `);

  // 2️⃣ Índice parcial para inline
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_quiz_attempts_inline_user_lesson_created
    ON quiz_attempts (user_id, lesson_id, created_at DESC)
    WHERE (metadata->>'source') = 'inline';
  `);

  // 3️⃣ Índice en answers por attempt
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_quiz_attempt_answers_attempt
    ON quiz_attempt_answers (attempt_id);
  `);

  // 4️⃣ Índice por question_id (útil para retención)
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_quiz_attempt_answers_question
    ON quiz_attempt_answers (question_id);
  `);
};

exports.down = async function (knex) {
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_quiz_attempts_user_lesson_created;`);
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_quiz_attempts_inline_user_lesson_created;`);
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_quiz_attempt_answers_attempt;`);
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_quiz_attempt_answers_question;`);
};

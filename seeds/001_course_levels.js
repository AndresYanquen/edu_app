const BASE_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function (knex) {
  await knex('course_levels')
    .insert(
      BASE_LEVELS.map((code) => ({
        id: knex.raw('gen_random_uuid()'),
        code,
        label: code,
        is_active: true,
      })),
    )
    .onConflict('code')
    .ignore();
};

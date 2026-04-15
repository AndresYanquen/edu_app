const BASE_CLASS_TYPES = [
  { code: 'lecture', label: 'Lecture' },
  { code: 'lab', label: 'Lab' },
  { code: 'workshop', label: 'Workshop' },
  { code: 'mentoring', label: 'Mentoring' },
];

/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function (knex) {
  await knex('class_types')
    .insert(
      BASE_CLASS_TYPES.map((item) => ({
        id: knex.raw('gen_random_uuid()'),
        code: item.code,
        label: item.label,
        is_active: true,
      })),
    )
    .onConflict('code')
    .merge({
      label: knex.raw('EXCLUDED.label'),
      is_active: true,
      updated_at: knex.fn.now(),
    });
};

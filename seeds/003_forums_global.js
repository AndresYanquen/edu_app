/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function seed(knex) {
  const exists = await knex('forums')
    .where({ scope: 'global', title: 'Comunidad Academy' })
    .first('id');
  if (exists) return;

  await knex('forums').insert({
    id: knex.raw('gen_random_uuid()'),
    scope: 'global',
    title: 'Comunidad Academy',
    description: 'Espacio global para compartir dudas, recursos y anuncios entre estudiantes y staff.',
    is_active: true,
  });
};

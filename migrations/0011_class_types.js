exports.up = function (knex) {
  return knex.schema.createTable('class_types', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('code').notNullable().unique(); // conversation, workshop, grammar
    table.string('label').notNullable();         // Conversacional, Taller, Gramática
    table.boolean('is_active').notNullable().defaultTo(true);

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('class_types');
};

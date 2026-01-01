exports.up = function (knex) {
  return knex.schema.createTable('live_sessions', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.uuid('series_id')
      .notNullable()
      .references('id')
      .inTable('live_session_series')
      .onDelete('CASCADE');

    table.uuid('group_id')
      .notNullable()
      .references('id')
      .inTable('groups')
      .onDelete('CASCADE');

    table.uuid('module_id')
      .nullable()
      .references('id')
      .inTable('modules')
      .onDelete('SET NULL');

    table.uuid('class_type_id')
      .notNullable()
      .references('id')
      .inTable('class_types');

    table.uuid('host_teacher_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');

    table.timestamp('starts_at', { useTz: true }).notNullable();
    table.timestamp('ends_at', { useTz: true }).notNullable();

    table.boolean('published').notNullable().defaultTo(false);
    table.string('status').notNullable().defaultTo('scheduled'); // scheduled | cancelled | completed

    table.text('join_url').nullable();
    table.text('host_url').nullable();

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['group_id', 'starts_at']);
    table.index(['series_id']);
    table.index(['host_teacher_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('live_sessions');
};

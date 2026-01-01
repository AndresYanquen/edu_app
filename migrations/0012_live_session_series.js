exports.up = function (knex) {
  return knex.schema.createTable('live_session_series', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.uuid('group_id')
      .notNullable()
      .references('id')
      .inTable('groups')
      .onDelete('CASCADE');

    table.uuid('course_id')
      .notNullable()
      .references('id')
      .inTable('courses')
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

    table.string('title').notNullable(); // ej: "iTalk A2", "Taller Básico"

    table.string('timezone').notNullable().defaultTo('America/Bogota');
    table.text('rrule').notNullable(); // iCal RRULE
    table.timestamp('dtstart', { useTz: true }).notNullable();
    table.integer('duration_minutes').notNullable();

    table.boolean('published').notNullable().defaultTo(false);

    table.text('join_url').nullable();
    table.text('host_url').nullable();

    table.uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('users');

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['group_id']);
    table.index(['course_id']);
    table.index(['module_id']);
    table.index(['host_teacher_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('live_session_series');
};

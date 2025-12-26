/**
 * Adds draft/publish metadata and instructor assignments.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async (knex) => {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  const addColumnIfMissing = async (tableName, columnName, builder) => {
    const exists = await knex.schema.hasColumn(tableName, columnName);
    if (!exists) {
      await knex.schema.alterTable(tableName, builder);
    }
  };

  await addColumnIfMissing('courses', 'is_published', (table) =>
    table.boolean('is_published').notNullable().defaultTo(false),
  );
  await addColumnIfMissing('courses', 'published_at', (table) => table.timestamp('published_at'));
  await addColumnIfMissing('courses', 'updated_at', (table) =>
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now()),
  );

  await addColumnIfMissing('modules', 'is_published', (table) =>
    table.boolean('is_published').notNullable().defaultTo(false),
  );
  await addColumnIfMissing('modules', 'published_at', (table) => table.timestamp('published_at'));
  await addColumnIfMissing('modules', 'order_index', (table) =>
    table.integer('order_index').notNullable().defaultTo(1),
  );
  await addColumnIfMissing('modules', 'updated_at', (table) =>
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now()),
  );

  await addColumnIfMissing('lessons', 'is_published', (table) =>
    table.boolean('is_published').notNullable().defaultTo(false),
  );
  await addColumnIfMissing('lessons', 'published_at', (table) => table.timestamp('published_at'));
  await addColumnIfMissing('lessons', 'order_index', (table) =>
    table.integer('order_index').notNullable().defaultTo(1),
  );
  await addColumnIfMissing('lessons', 'updated_at', (table) =>
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now()),
  );

  await knex.raw('UPDATE modules SET order_index = position WHERE position IS NOT NULL');
  await knex.raw('UPDATE lessons SET order_index = position WHERE position IS NOT NULL');

  const hasCourseInstructors = await knex.schema.hasTable('course_instructors');
  if (!hasCourseInstructors) {
    await knex.schema.createTable('course_instructors', (table) => {
      table
        .uuid('course_id')
        .notNullable()
        .references('id')
        .inTable('courses')
        .onDelete('CASCADE');
      table
        .uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE');
      table.primary(['course_id', 'user_id']);
    });
  }
};

exports.down = async (knex) => {
  const dropColumnIfExists = async (tableName, columnName) => {
    const exists = await knex.schema.hasColumn(tableName, columnName);
    if (exists) {
      await knex.schema.alterTable(tableName, (table) => {
        table.dropColumn(columnName);
      });
    }
  };

  await knex.schema.dropTableIfExists('course_instructors');

  await dropColumnIfExists('lessons', 'updated_at');
  await dropColumnIfExists('lessons', 'order_index');
  await dropColumnIfExists('lessons', 'published_at');
  await dropColumnIfExists('lessons', 'is_published');

  await dropColumnIfExists('modules', 'updated_at');
  await dropColumnIfExists('modules', 'order_index');
  await dropColumnIfExists('modules', 'published_at');
  await dropColumnIfExists('modules', 'is_published');

  await dropColumnIfExists('courses', 'updated_at');
  await dropColumnIfExists('courses', 'published_at');
  await dropColumnIfExists('courses', 'is_published');
};

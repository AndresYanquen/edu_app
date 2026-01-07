/**
 * Replace the rigid course_level ENUM with a flexible course_levels table.
 * Migrates existing course.level values into the new relationship.
 *
 * @param {import('knex').Knex} knex
 */
const BASE_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

exports.up = async (knex) => {
  await knex.schema.createTable('course_levels', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('code').notNullable().unique();
    table.text('label').notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex('course_levels').insert(
    BASE_LEVELS.map((code) => ({
      code,
      label: code,
    })),
  );

  await knex.schema.alterTable('courses', (table) => {
    table
      .uuid('level_id')
      .references('id')
      .inTable('course_levels')
      .onDelete('SET NULL')
      .nullable();
  });

  await knex.raw(`
    UPDATE courses
    SET level_id = cl.id
    FROM course_levels cl
    WHERE courses.level::text = cl.code
  `);

  await knex.raw('ALTER TABLE courses ALTER COLUMN level_id SET NOT NULL');

  await knex.schema.alterTable('courses', (table) => {
    table.dropColumn('level');
  });

};

exports.down = async (knex) => {
  await knex.raw(`
  DO $$
  BEGIN
    CREATE TYPE course_level AS ENUM ('A1','A2','B1','B2','C1','C2');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  `);

  await knex.schema.alterTable('courses', (table) => {
    table
      .enu('level', ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], {
        useNative: true,
        enumName: 'course_level',
        existingType: true,
      })
      .notNullable()
      .defaultTo('A1');
  });

  await knex.raw(`
    UPDATE courses c
    SET level =
      CASE
        WHEN cl.code IN ('A1','A2','B1','B2','C1','C2') THEN cl.code::course_level
        ELSE 'A1'::course_level
      END
    FROM course_levels cl
    WHERE c.level_id = cl.id
  `);


  await knex.schema.alterTable('courses', (table) => {
    table.dropColumn('level_id');
  });

  await knex.schema.dropTableIfExists('course_levels');
};

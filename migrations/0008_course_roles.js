/**
 * Introduce global and course-scoped roles with seed data + migrations.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async (knex) => {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  const ensureTable = async (tableName, builder) => {
    const exists = await knex.schema.hasTable(tableName);
    if (!exists) {
      await knex.schema.createTable(tableName, builder);
    }
  };

  await ensureTable('roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('name').notNullable().unique();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await ensureTable('user_roles', (table) => {
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .uuid('role_id')
      .notNullable()
      .references('id')
      .inTable('roles')
      .onDelete('CASCADE');
    table.primary(['user_id', 'role_id']);
  });

  await ensureTable('course_user_roles', (table) => {
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
    table
      .uuid('role_id')
      .notNullable()
      .references('id')
      .inTable('roles')
      .onDelete('CASCADE');
    table.primary(['course_id', 'user_id', 'role_id']);
    table.index(['course_id', 'user_id'], 'course_user_roles_course_user_idx');
    table.index(['user_id', 'role_id'], 'course_user_roles_user_role_idx');
  });

  const roleNames = [
    'admin',
    'instructor',
    'student',
    'content_editor',
    'enrollment_manager',
  ];

  await knex('roles')
    .insert(roleNames.map((name) => ({ name })))
    .onConflict('name')
    .ignore();

  await knex.raw(`
    INSERT INTO user_roles (user_id, role_id)
    SELECT am.user_id, r.id
    FROM academy_memberships am
    JOIN roles r ON r.name = am.role::text
    ON CONFLICT DO NOTHING
  `);

  const hasCourseInstructors = await knex.schema.hasTable('course_instructors');
  if (hasCourseInstructors) {
    await knex.raw(`
      INSERT INTO course_user_roles (course_id, user_id, role_id)
      SELECT ci.course_id, ci.user_id, r.id
      FROM course_instructors ci
      JOIN roles r ON r.name = 'instructor'
      ON CONFLICT DO NOTHING
    `);
  }

  const hasGroupTeachers = await knex.schema.hasTable('group_teachers');
  if (hasGroupTeachers) {
    await knex.raw(`
      INSERT INTO course_user_roles (course_id, user_id, role_id)
      SELECT DISTINCT g.course_id, gt.user_id, r.id
      FROM group_teachers gt
      JOIN groups g ON g.id = gt.group_id
      JOIN roles r ON r.name = 'instructor'
      ON CONFLICT DO NOTHING
    `);
  }

  if (hasCourseInstructors) {
    await knex.schema.dropTable('course_instructors');
  }
};

exports.down = async (knex) => {
  const recreateCourseInstructors = async () => {
    const exists = await knex.schema.hasTable('course_instructors');
    if (!exists) {
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

  await recreateCourseInstructors();

  const instructorRole = await knex('roles').where({ name: 'instructor' }).first();
  if (instructorRole) {
    await knex.raw(`
      INSERT INTO course_instructors (course_id, user_id)
      SELECT cur.course_id, cur.user_id
      FROM course_user_roles cur
      WHERE cur.role_id = ?
      ON CONFLICT DO NOTHING
    `, [instructorRole.id]);
  }

  await knex.schema.dropTableIfExists('course_user_roles');
  await knex.schema.dropTableIfExists('user_roles');
  await knex.schema.dropTableIfExists('roles');
};

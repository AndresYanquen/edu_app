/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('forums', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('scope').notNullable(); // global | course | group
    table.uuid('course_id').nullable().references('id').inTable('courses').onDelete('CASCADE');
    table.uuid('group_id').nullable().references('id').inTable('groups').onDelete('CASCADE');
    table.text('title').notNullable();
    table.text('description').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check("scope IN ('global','course','group')");
    table.check(`
      (scope = 'global' AND course_id IS NULL AND group_id IS NULL) OR
      (scope = 'course' AND course_id IS NOT NULL AND group_id IS NULL) OR
      (scope = 'group' AND group_id IS NOT NULL)
    `);
  });

  await knex.schema.alterTable('forums', (table) => {
    table.index(['scope'], 'idx_forums_scope');
    table.index(['course_id'], 'idx_forums_course');
    table.index(['group_id'], 'idx_forums_group');
  });

  await knex.schema.createTable('forum_threads', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('forum_id').notNullable().references('id').inTable('forums').onDelete('CASCADE');
    table.uuid('author_user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.text('title').notNullable();
    table.text('body').notNullable();
    table.boolean('is_pinned').notNullable().defaultTo(false);
    table.boolean('is_locked').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('forum_threads', (table) => {
    table.index(['forum_id', 'is_pinned', 'created_at'], 'idx_forum_threads_forum_pinned_created');
  });

  await knex.schema.createTable('forum_posts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('thread_id').notNullable().references('id').inTable('forum_threads').onDelete('CASCADE');
    table.uuid('author_user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.uuid('parent_post_id').nullable().references('id').inTable('forum_posts').onDelete('CASCADE');
    table.text('body').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('forum_posts', (table) => {
    table.index(['thread_id', 'created_at'], 'idx_forum_posts_thread_created');
    table.index(['parent_post_id'], 'idx_forum_posts_parent');
  });

  await knex.schema.createTable('forum_reads', (table) => {
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('thread_id').notNullable().references('id').inTable('forum_threads').onDelete('CASCADE');
    table.timestamp('last_read_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(['user_id', 'thread_id']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('forum_reads');
  await knex.schema.dropTableIfExists('forum_posts');
  await knex.schema.dropTableIfExists('forum_threads');
  await knex.schema.dropTableIfExists('forums');
};

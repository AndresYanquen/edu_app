/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('forum_reactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('thread_id').notNullable().references('id').inTable('forum_threads').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('reaction_type').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['thread_id', 'user_id'], { indexName: 'uniq_forum_reactions_thread_user' });
    table.check("reaction_type IN ('like','love','insightful','celebrate','support')");
  });

  await knex.schema.alterTable('forum_reactions', (table) => {
    table.index(['thread_id'], 'idx_forum_reactions_thread');
    table.index(['user_id'], 'idx_forum_reactions_user');
    table.index(['thread_id', 'reaction_type'], 'idx_forum_reactions_thread_type');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('forum_reactions');
};


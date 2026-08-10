exports.up = async (knex) => {
  const hasDeletedAt = await knex.schema.hasColumn('assets', 'deleted_at');
  if (!hasDeletedAt) {
    await knex.schema.alterTable('assets', (table) => {
      table.timestamp('deleted_at', { useTz: true });
      table.uuid('deleted_by_user_id').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  const hasJobs = await knex.schema.hasTable('asset_delete_jobs');
  if (!hasJobs) {
    await knex.schema.createTable('asset_delete_jobs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('asset_id').references('id').inTable('assets').onDelete('SET NULL');
      table.text('storage_provider').notNullable();
      table.text('storage_path').notNullable();
      table.text('status').notNullable().defaultTo('pending');
      table.integer('attempts').notNullable().defaultTo(0);
      table.text('last_error');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('processed_at', { useTz: true });
      table.timestamp('next_attempt_at', { useTz: true });
      table.index(['status', 'next_attempt_at'], 'idx_asset_delete_jobs_status_next_attempt');
      table.index(['asset_id'], 'idx_asset_delete_jobs_asset_id');
    });
  }
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('asset_delete_jobs');

  const hasDeletedAt = await knex.schema.hasColumn('assets', 'deleted_at');
  if (hasDeletedAt) {
    await knex.schema.alterTable('assets', (table) => {
      table.dropColumn('deleted_at');
      table.dropColumn('deleted_by_user_id');
    });
  }
};

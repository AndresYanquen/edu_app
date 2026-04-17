/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const hasLastSeenAt = await knex.schema.hasColumn('users', 'last_seen_at');
  if (!hasLastSeenAt) {
    await knex.schema.alterTable('users', (table) => {
      table.timestamp('last_seen_at', { useTz: true }).nullable();
    });
  }

  const hasLastSeenSource = await knex.schema.hasColumn('users', 'last_seen_source');
  if (!hasLastSeenSource) {
    await knex.schema.alterTable('users', (table) => {
      table.text('last_seen_source').nullable();
    });
  }

  const hasLastSeenIp = await knex.schema.hasColumn('users', 'last_seen_ip');
  if (!hasLastSeenIp) {
    await knex.schema.alterTable('users', (table) => {
      table.specificType('last_seen_ip', 'inet').nullable();
    });
  }

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON users (last_seen_at)');
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_users_last_seen_at');

  const hasLastSeenIp = await knex.schema.hasColumn('users', 'last_seen_ip');
  if (hasLastSeenIp) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('last_seen_ip');
    });
  }

  const hasLastSeenSource = await knex.schema.hasColumn('users', 'last_seen_source');
  if (hasLastSeenSource) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('last_seen_source');
    });
  }

  const hasLastSeenAt = await knex.schema.hasColumn('users', 'last_seen_at');
  if (hasLastSeenAt) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('last_seen_at');
    });
  }
};

/**
 * Remove legacy academy_memberships table + orphaned enums.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async (knex) => {
  await knex.transaction(async (trx) => {
    const { rows: enumRows } = await trx.raw(
      `
        SELECT DISTINCT t.typname AS enum_name
        FROM pg_type t
        JOIN pg_attribute a ON a.atttypid = t.oid
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE t.typtype = 'e'
          AND n.nspname = 'public'
          AND c.relname = 'academy_memberships'
          AND a.attnum > 0
          AND NOT a.attisdropped
      `,
    );

    await trx.raw('DROP TABLE IF EXISTS academy_memberships CASCADE');

    for (const row of enumRows) {
      const enumName = row.enum_name;
      if (!enumName) continue;

      const { rows: usageRows } = await trx.raw(
        `
          SELECT COUNT(*)::int AS usage_count
          FROM pg_type t
          JOIN pg_attribute a ON a.atttypid = t.oid
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE t.typtype = 'e'
            AND t.typname = ?
            AND n.nspname = 'public'
            AND a.attnum > 0
            AND NOT a.attisdropped
        `,
        [enumName],
      );

      const usageCount = usageRows[0]?.usage_count ?? 0;
      if (usageCount === 0) {
        await trx.raw('DROP TYPE IF EXISTS ?? CASCADE', [enumName]);
      }
    }
  });
};

exports.down = async () => {
  // Legacy membership table is intentionally removed; no-op
};

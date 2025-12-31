/**
 * Adds the 'live' option to lesson_content_type enum if missing.
 */

exports.up = async (knex) => {
  await knex.raw("ALTER TYPE lesson_content_type ADD VALUE IF NOT EXISTS 'live'");
};

exports.down = async () => {
  // Enum values cannot be removed easily without recreating the type.
  // Keeping no-op down migration to avoid destructive operations.
};

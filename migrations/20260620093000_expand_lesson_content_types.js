exports.up = async (knex) => {
  await knex.raw(`
    ALTER TYPE lesson_content_type ADD VALUE IF NOT EXISTS 'banner';
    ALTER TYPE lesson_content_type ADD VALUE IF NOT EXISTS 'content';
    ALTER TYPE lesson_content_type ADD VALUE IF NOT EXISTS 'activity';
    ALTER TYPE lesson_content_type ADD VALUE IF NOT EXISTS 'assessment';
  `);
};

exports.down = async () => {
  // PostgreSQL does not support removing enum values safely without rebuilding
  // the type. Keep this migration additive for compatibility with existing data.
};

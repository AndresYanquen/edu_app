exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS leah_saml_sso_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_leah_saml_sso_tokens_user_id
      ON leah_saml_sso_tokens(user_id);

    CREATE INDEX IF NOT EXISTS idx_leah_saml_sso_tokens_expires_at
      ON leah_saml_sso_tokens(expires_at);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_leah_saml_sso_tokens_expires_at;
    DROP INDEX IF EXISTS idx_leah_saml_sso_tokens_user_id;
    DROP TABLE IF EXISTS leah_saml_sso_tokens;
  `);
};

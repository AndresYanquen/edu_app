exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS live_session_attendance_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'finalized',
      taken_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT live_session_attendance_runs_status_check CHECK (status IN ('draft', 'finalized')),
      CONSTRAINT live_session_attendance_runs_live_session_unique UNIQUE (live_session_id)
    );

    CREATE INDEX IF NOT EXISTS idx_live_session_attendance_runs_session_id
      ON live_session_attendance_runs(live_session_id);

    CREATE INDEX IF NOT EXISTS idx_live_session_attendance_runs_status
      ON live_session_attendance_runs(status);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_live_session_attendance_runs_status;
    DROP INDEX IF EXISTS idx_live_session_attendance_runs_session_id;
    DROP TABLE IF EXISTS live_session_attendance_runs;
  `);
};


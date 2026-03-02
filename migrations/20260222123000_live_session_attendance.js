exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS live_session_attendance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'present',
      note TEXT NULL,
      marked_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT live_session_attendance_status_check CHECK (status IN ('present', 'absent', 'late', 'excused')),
      CONSTRAINT live_session_attendance_unique_session_user UNIQUE (live_session_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_live_session_attendance_session_id
      ON live_session_attendance(live_session_id);

    CREATE INDEX IF NOT EXISTS idx_live_session_attendance_user_id
      ON live_session_attendance(user_id);

    CREATE INDEX IF NOT EXISTS idx_live_session_attendance_session_status
      ON live_session_attendance(live_session_id, status);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_live_session_attendance_session_status;
    DROP INDEX IF EXISTS idx_live_session_attendance_user_id;
    DROP INDEX IF EXISTS idx_live_session_attendance_session_id;
    DROP TABLE IF EXISTS live_session_attendance;
  `);
};

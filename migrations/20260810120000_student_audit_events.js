exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS student_audit_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      source_group_id UUID NULL REFERENCES groups(id) ON DELETE SET NULL,
      target_group_id UUID NULL REFERENCES groups(id) ON DELETE SET NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT student_audit_events_type_check CHECK (
        event_type IN (
          'student_enrolled',
          'student_unenrolled',
          'student_group_assigned',
          'student_group_moved',
          'student_group_removed',
          'student_enrolled_imported'
        )
      )
    );

    CREATE INDEX IF NOT EXISTS idx_student_audit_events_course_created
      ON student_audit_events(course_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_student_audit_events_student_created
      ON student_audit_events(student_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_student_audit_events_actor_created
      ON student_audit_events(actor_user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_student_audit_events_event_type
      ON student_audit_events(event_type);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_student_audit_events_event_type;
    DROP INDEX IF EXISTS idx_student_audit_events_actor_created;
    DROP INDEX IF EXISTS idx_student_audit_events_student_created;
    DROP INDEX IF EXISTS idx_student_audit_events_course_created;
    DROP TABLE IF EXISTS student_audit_events;
  `);
};

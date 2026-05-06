exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS gamification_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id UUID NULL REFERENCES courses(id) ON DELETE SET NULL,
      group_id UUID NULL REFERENCES groups(id) ON DELETE SET NULL,
      actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      event_key TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT gamification_events_event_key_unique UNIQUE (event_key)
    );

    CREATE INDEX IF NOT EXISTS idx_gamification_events_user_occurred
      ON gamification_events(user_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_gamification_events_course_occurred
      ON gamification_events(course_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_gamification_events_type
      ON gamification_events(event_type);

    CREATE TABLE IF NOT EXISTS points_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_event_id UUID NOT NULL REFERENCES gamification_events(id) ON DELETE CASCADE,
      rule_code TEXT NOT NULL,
      points_delta INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT points_ledger_event_rule_unique UNIQUE (source_event_id, rule_code)
    );

    CREATE INDEX IF NOT EXISTS idx_points_ledger_user_created
      ON points_ledger(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS weekly_user_stats (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      week_start DATE NOT NULL,
      points_total INTEGER NOT NULL DEFAULT 0,
      lessons_done INTEGER NOT NULL DEFAULT 0,
      quizzes_passed INTEGER NOT NULL DEFAULT 0,
      sessions_attended INTEGER NOT NULL DEFAULT 0,
      sessions_late INTEGER NOT NULL DEFAULT 0,
      sessions_excused INTEGER NOT NULL DEFAULT 0,
      attendance_taken_count INTEGER NOT NULL DEFAULT 0,
      active_events INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, week_start)
    );

    CREATE INDEX IF NOT EXISTS idx_weekly_user_stats_week
      ON weekly_user_stats(week_start);
    CREATE INDEX IF NOT EXISTS idx_weekly_user_stats_points
      ON weekly_user_stats(week_start, points_total DESC);

    CREATE TABLE IF NOT EXISTS user_streaks (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      current_week_streak INTEGER NOT NULL DEFAULT 0,
      best_week_streak INTEGER NOT NULL DEFAULT 0,
      last_active_week_start DATE NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_weekly_user_stats_points;
    DROP INDEX IF EXISTS idx_weekly_user_stats_week;
    DROP TABLE IF EXISTS user_streaks;
    DROP TABLE IF EXISTS weekly_user_stats;
    DROP INDEX IF EXISTS idx_points_ledger_user_created;
    DROP TABLE IF EXISTS points_ledger;
    DROP INDEX IF EXISTS idx_gamification_events_type;
    DROP INDEX IF EXISTS idx_gamification_events_course_occurred;
    DROP INDEX IF EXISTS idx_gamification_events_user_occurred;
    DROP TABLE IF EXISTS gamification_events;
  `);
};


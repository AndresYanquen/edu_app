const pool = require('../db');
const STREAK_TIMEZONE = process.env.GAMIFICATION_STREAK_TIMEZONE || 'America/Bogota';

const RULES = {
  lesson_completed_student: { ruleCode: 'lesson_done_v1', points: 10, active: true, bucket: 'lessons_done' },
  quiz_passed_student: { ruleCode: 'quiz_passed_v1', points: 15, active: true, bucket: 'quizzes_passed' },
  attendance_present_student: { ruleCode: 'attendance_present_v1', points: 8, active: true, bucket: 'sessions_attended' },
  attendance_late_student: { ruleCode: 'attendance_late_v1', points: 5, active: true, bucket: 'sessions_late' },
  attendance_excused_student: { ruleCode: 'attendance_excused_v1', points: 2, active: true, bucket: 'sessions_excused' },
  attendance_taken_teacher: { ruleCode: 'attendance_taken_v1', points: 3, active: true, bucket: 'attendance_taken_count' },
};

const addDaysUtc = (isoDate, days) => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const resolveWeekStart = (inputDate = new Date()) => {
  const date = inputDate instanceof Date ? new Date(inputDate) : new Date(inputDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const utcDay = date.getUTCDay();
  const offset = utcDay === 0 ? -6 : 1 - utcDay;
  date.setUTCDate(date.getUTCDate() + offset);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
};

const resolveSafeWeekStart = (inputDate) => {
  if (!inputDate) return resolveWeekStart(new Date());
  if (typeof inputDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
    const parsed = new Date(`${inputDate}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return resolveWeekStart(parsed);
    }
  }
  return resolveWeekStart(inputDate);
};

const recomputeUserStreak = async (client, userId, referenceWeekStart) => {
  const weekStart = referenceWeekStart || resolveWeekStart(new Date());
  if (!weekStart) return;

  const rowsRes = await client.query(
    `
      SELECT DISTINCT DATE_TRUNC('week', week_start::timestamp)::date AS week_start
      FROM weekly_user_stats
      WHERE user_id = $1
        AND DATE_TRUNC('week', week_start::timestamp)::date <= $2::date
        AND active_events > 0
      ORDER BY week_start DESC
      LIMIT 260
    `,
    [userId, weekStart],
  );

  let currentWeekStreak = 0;
  let bestWeekStreak = 0;
  let currentDayStreak = 0;
  let bestDayStreak = 0;
  let lastActiveDay = null;

  if (rowsRes.rows.length) {
    const weeks = rowsRes.rows
      .map((row) => {
        if (!row.week_start) return null;
        const value = row.week_start instanceof Date
          ? row.week_start.toISOString().slice(0, 10)
          : String(row.week_start).slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
      })
      .filter(Boolean);
    let prev = null;
    let running = 0;
    for (const wk of weeks) {
      const weekDate = new Date(`${wk}T00:00:00.000Z`);
      if (!prev) {
        running = 1;
      } else {
        const prevDate = new Date(`${prev}T00:00:00.000Z`);
        const diffDays = Math.round((prevDate.getTime() - weekDate.getTime()) / (24 * 60 * 60 * 1000));
        running = diffDays === 7 ? running + 1 : 1;
      }
      if (running > bestWeekStreak) bestWeekStreak = running;
      prev = wk;
    }

    const first = weeks[0];
    if (first === weekStart) {
      currentWeekStreak = 1;
      let expected = new Date(`${weekStart}T00:00:00.000Z`);
      for (let i = 1; i < weeks.length; i += 1) {
        expected = new Date(expected.getTime() - 7 * 24 * 60 * 60 * 1000);
        const expectedKey = expected.toISOString().slice(0, 10);
        if (weeks[i] === expectedKey) {
          currentWeekStreak += 1;
        } else {
          break;
        }
      }
    }
  }

  const dayRowsRes = await client.query(
    `
      SELECT DISTINCT ((ge.occurred_at AT TIME ZONE $2)::date) AS active_day
      FROM points_ledger pl
      JOIN gamification_events ge ON ge.id = pl.source_event_id
      WHERE pl.user_id = $1
      ORDER BY active_day DESC
      LIMIT 730
    `,
    [userId, STREAK_TIMEZONE],
  );

  const activeDays = dayRowsRes.rows
    .map((row) => {
      if (!row.active_day) return null;
      return row.active_day instanceof Date
        ? row.active_day.toISOString().slice(0, 10)
        : String(row.active_day).slice(0, 10);
    })
    .filter(Boolean);

  if (activeDays.length) {
    lastActiveDay = activeDays[0];
    let prev = null;
    let running = 0;
    for (const day of activeDays) {
      const dayDate = new Date(`${day}T00:00:00.000Z`);
      if (!prev) {
        running = 1;
      } else {
        const prevDate = new Date(`${prev}T00:00:00.000Z`);
        const diffDays = Math.round((prevDate.getTime() - dayDate.getTime()) / (24 * 60 * 60 * 1000));
        running = diffDays === 1 ? running + 1 : 1;
      }
      if (running > bestDayStreak) bestDayStreak = running;
      prev = day;
    }

    const nowLocalDateRes = await client.query(`SELECT (now() AT TIME ZONE $1)::date AS current_day`, [
      STREAK_TIMEZONE,
    ]);
    const nowLocalDay = nowLocalDateRes.rows[0]?.current_day;
    const nowLocalDayKey = nowLocalDay instanceof Date
      ? nowLocalDay.toISOString().slice(0, 10)
      : String(nowLocalDay || '').slice(0, 10);

    if (activeDays[0] === nowLocalDayKey) {
      currentDayStreak = 1;
      let expected = new Date(`${nowLocalDayKey}T00:00:00.000Z`);
      for (let i = 1; i < activeDays.length; i += 1) {
        expected = new Date(expected.getTime() - 24 * 60 * 60 * 1000);
        const expectedKey = expected.toISOString().slice(0, 10);
        if (activeDays[i] === expectedKey) {
          currentDayStreak += 1;
        } else {
          break;
        }
      }
    }
  }

  await client.query(
    `
      INSERT INTO user_streaks (
        user_id,
        current_week_streak,
        best_week_streak,
        last_active_week_start,
        current_day_streak,
        best_day_streak,
        last_active_day,
        updated_at
      )
      VALUES ($1, $2, $3, $4::date, $5, $6, $7::date, now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        current_week_streak = EXCLUDED.current_week_streak,
        best_week_streak = GREATEST(user_streaks.best_week_streak, EXCLUDED.best_week_streak),
        last_active_week_start = EXCLUDED.last_active_week_start,
        current_day_streak = EXCLUDED.current_day_streak,
        best_day_streak = GREATEST(user_streaks.best_day_streak, EXCLUDED.best_day_streak),
        last_active_day = EXCLUDED.last_active_day,
        updated_at = now()
    `,
    [userId, currentWeekStreak, bestWeekStreak, weekStart, currentDayStreak, bestDayStreak, lastActiveDay],
  );
};

const applyWeeklyStats = async (client, userId, occurredAt, pointsDelta, bucket, active) => {
  const weekStart = resolveWeekStart(occurredAt);
  if (!weekStart) return;

  const counters = {
    lessons_done: 0,
    quizzes_passed: 0,
    sessions_attended: 0,
    sessions_late: 0,
    sessions_excused: 0,
    attendance_taken_count: 0,
  };
  if (bucket && Object.prototype.hasOwnProperty.call(counters, bucket)) {
    counters[bucket] = 1;
  }

  await client.query(
    `
      INSERT INTO weekly_user_stats (
        user_id,
        week_start,
        points_total,
        lessons_done,
        quizzes_passed,
        sessions_attended,
        sessions_late,
        sessions_excused,
        attendance_taken_count,
        active_events,
        updated_at
      )
      VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, now())
      ON CONFLICT (user_id, week_start)
      DO UPDATE SET
        points_total = weekly_user_stats.points_total + EXCLUDED.points_total,
        lessons_done = weekly_user_stats.lessons_done + EXCLUDED.lessons_done,
        quizzes_passed = weekly_user_stats.quizzes_passed + EXCLUDED.quizzes_passed,
        sessions_attended = weekly_user_stats.sessions_attended + EXCLUDED.sessions_attended,
        sessions_late = weekly_user_stats.sessions_late + EXCLUDED.sessions_late,
        sessions_excused = weekly_user_stats.sessions_excused + EXCLUDED.sessions_excused,
        attendance_taken_count = weekly_user_stats.attendance_taken_count + EXCLUDED.attendance_taken_count,
        active_events = weekly_user_stats.active_events + EXCLUDED.active_events,
        updated_at = now()
    `,
    [
      userId,
      weekStart,
      pointsDelta,
      counters.lessons_done,
      counters.quizzes_passed,
      counters.sessions_attended,
      counters.sessions_late,
      counters.sessions_excused,
      counters.attendance_taken_count,
      active ? 1 : 0,
    ],
  );

  if (active) {
    await recomputeUserStreak(client, userId, weekStart);
  }
};

const backfillUserGamification = async (userId) => {
  // Backfill legacy lesson completions that predate gamification hooks.
  const lessonRes = await pool.query(
    `
      SELECT
        lp.lesson_id,
        m.course_id,
        lp.last_seen_at
      FROM lesson_progress lp
      JOIN lessons l ON l.id = lp.lesson_id
      JOIN modules m ON m.id = l.module_id
      LEFT JOIN gamification_events ge
        ON ge.user_id = lp.user_id
       AND ge.event_type = 'lesson_completed_student'
       AND ge.event_key = CONCAT('lesson_done:', lp.user_id, ':', lp.lesson_id)
      WHERE lp.user_id = $1
        AND lp.status = 'done'
        AND ge.id IS NULL
      ORDER BY lp.last_seen_at ASC NULLS LAST
      LIMIT 500
    `,
    [userId],
  );

  for (const row of lessonRes.rows) {
    await recordGamificationEvent({
      userId,
      courseId: row.course_id,
      groupId: null,
      actorUserId: userId,
      eventType: 'lesson_completed_student',
      eventKey: `lesson_done:${userId}:${row.lesson_id}`,
      occurredAt: row.last_seen_at || new Date(),
      meta: { lessonId: row.lesson_id, source: 'backfill_lesson_progress' },
    });
  }

  // Backfill legacy passed quiz attempts that predate gamification hooks.
  const quizRes = await pool.query(
    `
      SELECT
        qa.lesson_id,
        qa.submitted_at,
        m.course_id
      FROM quiz_attempts qa
      JOIN lessons l ON l.id = qa.lesson_id
      JOIN modules m ON m.id = l.module_id
      LEFT JOIN gamification_events ge
        ON ge.user_id = qa.user_id
       AND ge.event_type = 'quiz_passed_student'
       AND ge.event_key = CONCAT('quiz_pass:', qa.user_id, ':', qa.lesson_id)
      WHERE qa.user_id = $1
        AND qa.passed = true
        AND ge.id IS NULL
      ORDER BY qa.submitted_at ASC NULLS LAST
      LIMIT 500
    `,
    [userId],
  );

  for (const row of quizRes.rows) {
    await recordGamificationEvent({
      userId,
      courseId: row.course_id,
      groupId: null,
      actorUserId: userId,
      eventType: 'quiz_passed_student',
      eventKey: `quiz_pass:${userId}:${row.lesson_id}`,
      occurredAt: row.submitted_at || new Date(),
      meta: { lessonId: row.lesson_id, source: 'backfill_quiz_attempt' },
    });
  }
};

const recordGamificationEvent = async (params, client = null) => {
  const {
    userId,
    courseId = null,
    groupId = null,
    actorUserId = null,
    eventType,
    eventKey,
    occurredAt = new Date(),
    meta = {},
  } = params || {};

  if (!userId || !eventType || !eventKey) {
    return { created: false, skipped: true, reason: 'missing-params' };
  }

  const rule = RULES[eventType];
  if (!rule) {
    return { created: false, skipped: true, reason: 'unknown-event-type' };
  }

  const dbClient = client || (await pool.connect());
  const ownClient = !client;

  try {
    if (ownClient) await dbClient.query('BEGIN');

    const eventRes = await dbClient.query(
      `
        INSERT INTO gamification_events (
          user_id,
          course_id,
          group_id,
          actor_user_id,
          event_type,
          event_key,
          occurred_at,
          meta,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now())
        ON CONFLICT (event_key) DO NOTHING
        RETURNING id
      `,
      [
        userId,
        courseId,
        groupId,
        actorUserId,
        eventType,
        eventKey,
        occurredAt,
        JSON.stringify(meta || {}),
      ],
    );

    const eventId = eventRes.rows[0]?.id;
    if (!eventId) {
      if (ownClient) await dbClient.query('COMMIT');
      return { created: false, skipped: true, reason: 'duplicate-event' };
    }

    await dbClient.query(
      `
        INSERT INTO points_ledger (
          user_id,
          source_event_id,
          rule_code,
          points_delta,
          created_at
        )
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (source_event_id, rule_code) DO NOTHING
      `,
      [userId, eventId, rule.ruleCode, rule.points],
    );

    await applyWeeklyStats(
      dbClient,
      userId,
      occurredAt,
      rule.points,
      rule.bucket,
      Boolean(rule.active),
    );

    if (ownClient) await dbClient.query('COMMIT');

    return { created: true, eventId, points: rule.points, ruleCode: rule.ruleCode };
  } catch (err) {
    if (ownClient) {
      await dbClient.query('ROLLBACK');
    }
    throw err;
  } finally {
    if (ownClient) {
      dbClient.release();
    }
  }
};

const getUserGamificationSummary = async (userId, options = {}) => {
  await backfillUserGamification(userId);

  const weekStart = resolveSafeWeekStart(options.weekStart);
  const weekEndExclusive = addDaysUtc(weekStart, 7);

  const [weeklyRes, lifetimeRes, streakRes] = await Promise.all([
    pool.query(
      `
        SELECT
          COALESCE(SUM(points_total), 0)::int AS points_total,
          COALESCE(SUM(lessons_done), 0)::int AS lessons_done,
          COALESCE(SUM(quizzes_passed), 0)::int AS quizzes_passed,
          COALESCE(SUM(sessions_attended), 0)::int AS sessions_attended,
          COALESCE(SUM(sessions_late), 0)::int AS sessions_late,
          COALESCE(SUM(sessions_excused), 0)::int AS sessions_excused,
          COALESCE(SUM(attendance_taken_count), 0)::int AS attendance_taken_count,
          COALESCE(SUM(active_events), 0)::int AS active_events
        FROM weekly_user_stats
        WHERE user_id = $1
          AND DATE_TRUNC('week', week_start::timestamp)::date = $2::date
      `,
      [userId, weekStart],
    ),
    pool.query(
      `
        SELECT
          COALESCE(SUM(points_delta), 0)::int AS total_points,
          COUNT(*)::int AS events_count
        FROM points_ledger
        WHERE user_id = $1
      `,
      [userId],
    ),
    pool.query(
      `
        SELECT
          current_week_streak,
          best_week_streak,
          last_active_week_start,
          current_day_streak,
          best_day_streak,
          last_active_day
        FROM user_streaks
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId],
    ),
  ]);

  const weekly = weeklyRes.rows[0] || null;
  const lifetime = lifetimeRes.rows[0] || {};
  let streak = streakRes.rows[0] || null;

  // Self-heal stale streak rows: if current week has activity but streak is 0 or out of sync,
  // recompute and return the fresh value.
  const weeklyActiveEvents = Number(weekly?.active_events || 0);
  const storedCurrentStreak = Number(streak?.current_week_streak || 0);
  const storedLastWeek = streak?.last_active_week_start || null;
  const needsStreakRecompute =
    weeklyActiveEvents > 0 &&
    (storedCurrentStreak < 1 || String(storedLastWeek || '') !== String(weekStart));

  if (needsStreakRecompute) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await recomputeUserStreak(client, userId, weekStart);
      const freshRes = await client.query(
        `
          SELECT
            current_week_streak,
            best_week_streak,
            last_active_week_start,
            current_day_streak,
            best_day_streak,
            last_active_day
          FROM user_streaks
          WHERE user_id = $1
          LIMIT 1
        `,
        [userId],
      );
      await client.query('COMMIT');
      streak = freshRes.rows[0] || streak;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  return {
    weekStart,
    weekEndExclusive,
    lifetime: {
      totalPoints: Number(lifetime.total_points || 0),
      eventsCount: Number(lifetime.events_count || 0),
    },
    weekly: {
      pointsTotal: Number(weekly?.points_total || 0),
      lessonsDone: Number(weekly?.lessons_done || 0),
      quizzesPassed: Number(weekly?.quizzes_passed || 0),
      sessionsAttended: Number(weekly?.sessions_attended || 0),
      sessionsLate: Number(weekly?.sessions_late || 0),
      sessionsExcused: Number(weekly?.sessions_excused || 0),
      attendanceTakenCount: Number(weekly?.attendance_taken_count || 0),
      activeEvents: Number(weekly?.active_events || 0),
    },
    streak: {
      currentWeekStreak: Number(streak?.current_week_streak || 0),
      bestWeekStreak: Number(streak?.best_week_streak || 0),
      lastActiveWeekStart: streak?.last_active_week_start || null,
      currentDayStreak: Number(streak?.current_day_streak || 0),
      bestDayStreak: Number(streak?.best_day_streak || 0),
      lastActiveDay: streak?.last_active_day || null,
    },
  };
};

const getCourseLeaderboard = async (courseId, options = {}) => {
  const weekStart = resolveSafeWeekStart(options.weekStart);
  const limit = Math.max(1, Math.min(Number(options.limit || 20), 100));

  const { rows } = await pool.query(
    `
      SELECT
        w.user_id,
        u.full_name,
        u.email,
        w.points_total,
        w.lessons_done,
        w.quizzes_passed,
        w.sessions_attended,
        w.sessions_late,
        w.sessions_excused,
        w.attendance_taken_count,
        COALESCE(us.current_week_streak, 0) AS current_week_streak
      FROM weekly_user_stats w
      JOIN users u ON u.id = w.user_id
      LEFT JOIN user_streaks us ON us.user_id = w.user_id
      WHERE w.week_start = $1::date
        AND (
          EXISTS (
            SELECT 1
            FROM enrollments e
            WHERE e.user_id = w.user_id
              AND e.course_id = $2
          )
          OR EXISTS (
            SELECT 1
            FROM groups g
            JOIN group_teachers gt ON gt.group_id = g.id
            WHERE g.course_id = $2
              AND gt.user_id = w.user_id
          )
        )
      ORDER BY w.points_total DESC, u.full_name ASC
      LIMIT $3
    `,
    [weekStart, courseId, limit],
  );

  return {
    weekStart,
    leaderboard: rows.map((row) => ({
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      pointsTotal: Number(row.points_total || 0),
      lessonsDone: Number(row.lessons_done || 0),
      quizzesPassed: Number(row.quizzes_passed || 0),
      sessionsAttended: Number(row.sessions_attended || 0),
      sessionsLate: Number(row.sessions_late || 0),
      sessionsExcused: Number(row.sessions_excused || 0),
      attendanceTakenCount: Number(row.attendance_taken_count || 0),
      currentWeekStreak: Number(row.current_week_streak || 0),
    })),
  };
};

const getAdminGamificationOverview = async (options = {}) => {
  const weekStart = resolveSafeWeekStart(options.weekStart);
  const [weeklyRes, lifetimeRes] = await Promise.all([
    pool.query(
      `
        SELECT
          COALESCE(SUM(points_total), 0)::int AS week_points_total,
          COALESCE(SUM(active_events), 0)::int AS week_events_total,
          COUNT(*)::int AS active_users_count
        FROM weekly_user_stats
        WHERE week_start = $1::date
      `,
      [weekStart],
    ),
    pool.query(
      `
        SELECT
          COALESCE(SUM(points_delta), 0)::int AS lifetime_points_total,
          COUNT(*)::int AS lifetime_events_total,
          COUNT(DISTINCT user_id)::int AS users_with_points
        FROM points_ledger
      `,
    ),
  ]);

  const weekly = weeklyRes.rows[0] || {};
  const lifetime = lifetimeRes.rows[0] || {};
  return {
    weekStart,
    weekly: {
      pointsTotal: Number(weekly.week_points_total || 0),
      eventsTotal: Number(weekly.week_events_total || 0),
      activeUsersCount: Number(weekly.active_users_count || 0),
    },
    lifetime: {
      pointsTotal: Number(lifetime.lifetime_points_total || 0),
      eventsTotal: Number(lifetime.lifetime_events_total || 0),
      usersWithPoints: Number(lifetime.users_with_points || 0),
    },
  };
};

module.exports = {
  RULES,
  resolveWeekStart,
  recordGamificationEvent,
  getUserGamificationSummary,
  getCourseLeaderboard,
  getAdminGamificationOverview,
};

const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireGlobalRoleAny, hasGlobalRole } = require('../middleware/roles');
const { uuidSchema, formatZodError } = require('../utils/validators');
const { canEditCourse } = require('../utils/cmsPermissions');
const {
  ensureCourseExists,
  hasCourseRole: hasScopedCourseRole,
  isGroupTeacher,
} = require('../utils/roleService');

const FALLBACK_LEVEL_CODE = 'A1';
const COURSE_LEVEL_JOIN = 'LEFT JOIN course_levels cl ON cl.id = c.level_id';
const WEEK_ATTENDANCE_ALLOWED_STATUS = new Set(['present', 'absent', 'late', 'excused']);
const WEEK_ATTENDANCE_EXCEPTION_STATUSES = new Set(['absent', 'late', 'excused']);

const router = express.Router();

router.use(auth);

const mapCoursePostRow = (row) => ({
  id: row.id,
  courseId: row.course_id,
  groupId: row.group_id || null,
  createdByUserId: row.created_by_user_id || null,
  createdByFullName: row.created_by_full_name || null,
  title: row.title,
  body: row.body,
  createdAt: row.created_at,
});

const isValidWeekStartString = (value) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const toUtcIsoDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const parseWeekStart = (input) => {
  if (!isValidWeekStartString(input)) {
    return null;
  }
  const parsed = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const isUtcMonday = (date) => date instanceof Date && date.getUTCDay() === 1;

const buildAttendanceDays = (weekStartDate) => {
  const start = new Date(weekStartDate.getTime());
  start.setUTCHours(0, 0, 0, 0);
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const current = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    days.push({ date: toUtcIsoDate(current), sessions: [] });
  }
  return days;
};

const resolveAttendanceGroupForCourse = async (courseId, groupIdRaw) => {
  if (groupIdRaw) {
    const parsedGroupId = uuidSchema.safeParse(groupIdRaw);
    if (!parsedGroupId.success) {
      return { error: 'groupId must be a valid UUID', status: 400 };
    }
    const groupRes = await pool.query(
      `
        SELECT id, course_id, name, status
        FROM groups
        WHERE id = $1
        LIMIT 1
      `,
      [parsedGroupId.data],
    );
    const group = groupRes.rows[0];
    if (!group || group.course_id !== courseId) {
      return { error: 'Group not found for this course', status: 404 };
    }
    return { group };
  }

  const groupsRes = await pool.query(
    `
      SELECT id, course_id, name, status
      FROM groups
      WHERE course_id = $1
      ORDER BY created_at ASC, name ASC
    `,
    [courseId],
  );

  if (!groupsRes.rows.length) {
    return { group: null };
  }
  if (groupsRes.rows.length > 1) {
    return { error: 'groupId requerido', status: 400 };
  }
  return { group: groupsRes.rows[0] };
};

const ensureCourseAttendanceAccess = async (req, courseId, groupId = null) => {
  if (hasGlobalRole(req.user, 'admin')) {
    return { allowed: true };
  }

  const course = await ensureCourseExists(courseId);
  if (!course) {
    return { allowed: false, status: 404, error: 'Course not found' };
  }

  if (course.owner_user_id === req.user.id) {
    return { allowed: true, course };
  }

  const hasCourseRole =
    (await hasScopedCourseRole(req.user.id, courseId, ['instructor', 'enrollment_manager'])) ||
    false;
  if (hasCourseRole) {
    return { allowed: true, course };
  }

  if (groupId) {
    const teacher = await isGroupTeacher(req.user.id, groupId);
    if (teacher) {
      return { allowed: true, course };
    }
  }

  return { allowed: false, status: 403, error: 'You are not allowed to view course attendance' };
};

const markAttendanceRunsFinalized = async (client, sessionIds, userId) => {
  if (!Array.isArray(sessionIds) || !sessionIds.length) {
    return;
  }

  const values = [];
  const placeholders = [];
  sessionIds.forEach((sessionId, index) => {
    const base = index * 2;
    placeholders.push(`($${base + 1}, 'finalized', $${base + 2}, now(), now(), now())`);
    values.push(sessionId, userId);
  });

  await client.query(
    `
      INSERT INTO live_session_attendance_runs (
        live_session_id,
        status,
        taken_by,
        taken_at,
        created_at,
        updated_at
      )
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (live_session_id)
      DO UPDATE SET
        status = 'finalized',
        taken_by = EXCLUDED.taken_by,
        taken_at = now(),
        updated_at = now()
    `,
    values,
  );
};

router.get('/:courseId/attendance', async (req, res) => {
  const parsedCourseId = uuidSchema.safeParse(req.params.courseId);
  if (!parsedCourseId.success) {
    return res.status(400).json({ error: formatZodError(parsedCourseId.error) });
  }

  const courseId = parsedCourseId.data;
  const weekStartRaw = String(req.query.weekStart || '').trim();
  const weekStartDate = parseWeekStart(weekStartRaw);
  if (!weekStartDate) {
    return res.status(400).json({ error: 'weekStart is required and must be YYYY-MM-DD' });
  }
  if (!isUtcMonday(weekStartDate)) {
    return res.status(400).json({ error: 'weekStart must be a Monday (YYYY-MM-DD)' });
  }
  const weekStart = toUtcIsoDate(weekStartDate);

  try {
    const groupResolution = await resolveAttendanceGroupForCourse(
      courseId,
      req.query.groupId ? String(req.query.groupId) : null,
    );
    if (groupResolution.error) {
      return res.status(groupResolution.status || 400).json({ error: groupResolution.error });
    }
    const group = groupResolution.group;

    const access = await ensureCourseAttendanceAccess(req, courseId, group?.id || null);
    if (!access.allowed) {
      return res.status(access.status || 403).json({ error: access.error || 'Forbidden' });
    }

    const days = buildAttendanceDays(weekStartDate);
    if (!group?.id) {
      return res.json({
        courseId,
        groupId: null,
        weekStart,
        days,
        students: [],
        stats: {
          totalStudents: 0,
          totalSessions: 0,
          takenSessions: 0,
          presentPct: null,
          atRiskCount: 0,
          hasAttendanceRecords: false,
        },
      });
    }

    const rosterRes = await pool.query(
      `
        SELECT u.id AS user_id, u.full_name, u.email
        FROM group_students gs
        JOIN users u ON u.id = gs.user_id
        WHERE gs.group_id = $1
          AND gs.status = 'active'
        ORDER BY u.full_name ASC
      `,
      [group.id],
    );

    const sessionsRes = await pool.query(
      `
        SELECT
          ls.id AS session_id,
          ls.starts_at,
          s.title
        FROM live_sessions ls
        JOIN groups g ON g.id = ls.group_id
        LEFT JOIN live_session_series s ON s.id = ls.series_id
        WHERE g.course_id = $1
          AND ls.group_id = $2
          AND ls.starts_at >= $3::date
          AND ls.starts_at < ($3::date + INTERVAL '7 days')
        ORDER BY ls.starts_at ASC
      `,
      [courseId, group.id, weekStart],
    );

    const sessionIds = sessionsRes.rows.map((row) => row.session_id);
    let attendanceRows = [];
    if (sessionIds.length) {
      const attendanceRes = await pool.query(
        `
          SELECT live_session_id, user_id, status, note
          FROM live_session_attendance
          WHERE live_session_id = ANY($1::uuid[])
        `,
        [sessionIds],
      );
      attendanceRows = attendanceRes.rows;
    }

    let attendanceRunRows = [];
    if (sessionIds.length) {
      const attendanceRunRes = await pool.query(
        `
          SELECT live_session_id, taken_at, taken_by, status
          FROM live_session_attendance_runs
          WHERE live_session_id = ANY($1::uuid[])
        `,
        [sessionIds],
      );
      attendanceRunRows = attendanceRunRes.rows;
    }

    const attendanceRunBySessionId = new Map(
      attendanceRunRows.map((row) => [
        row.live_session_id,
        {
          isTaken: row.status === 'finalized',
          takenAt: row.taken_at ? row.taken_at.toISOString() : null,
          takenBy: row.taken_by || null,
        },
      ]),
    );

    const dayIndex = new Map(days.map((day, idx) => [day.date, idx]));
    sessionsRes.rows.forEach((row) => {
      const key = toUtcIsoDate(row.starts_at);
      const idx = dayIndex.get(key);
      if (idx === undefined) return;
      const runMeta = attendanceRunBySessionId.get(row.session_id) || {
        isTaken: false,
        takenAt: null,
        takenBy: null,
      };
      days[idx].sessions.push({
        sessionId: row.session_id,
        startsAt: row.starts_at ? row.starts_at.toISOString() : null,
        title: row.title || null,
        isTaken: runMeta.isTaken,
        attendanceTakenAt: runMeta.takenAt,
        attendanceTakenBy: runMeta.takenBy,
      });
    });

    const attendanceByUser = new Map();
    for (const row of attendanceRows) {
      if (!attendanceByUser.has(row.user_id)) {
        attendanceByUser.set(row.user_id, {});
      }
      attendanceByUser.get(row.user_id)[row.live_session_id] = {
        status: row.status,
        ...(row.note ? { note: row.note } : {}),
      };
    }

    let atRiskCount = 0;
    const students = rosterRes.rows.map((row) => {
      const bySession = attendanceByUser.get(row.user_id) || {};
      const absences = Object.values(bySession).filter((cell) => cell?.status === 'absent').length;
      if (absences >= 2) {
        atRiskCount += 1;
      }
      return {
        userId: row.user_id,
        fullName: row.full_name,
        email: row.email,
        bySession,
      };
    });

    const totalStudents = students.length;
    const totalSessions = sessionIds.length;
    const takenSessionIds = sessionIds.filter(
      (sessionId) => attendanceRunBySessionId.get(sessionId)?.isTaken,
    );
    let presentCount = 0;
    if (students.length && takenSessionIds.length) {
      students.forEach((student) => {
        takenSessionIds.forEach((sessionId) => {
          const cell = student.bySession[sessionId];
          if (!cell || cell.status === 'present') {
            presentCount += 1;
          }
        });
      });
    }
    const denominator = totalStudents * takenSessionIds.length;
    const presentPct = denominator > 0 ? (presentCount / denominator) * 100 : null;

    return res.json({
      courseId,
      groupId: group.id,
      weekStart,
      days,
      students,
      stats: {
        totalStudents,
        totalSessions,
        takenSessions: takenSessionIds.length,
        presentPct,
        atRiskCount,
        hasAttendanceRecords: takenSessionIds.length > 0,
      },
    });
  } catch (err) {
    console.error('Failed to load course attendance week', err);
    return res.status(500).json({ error: 'Failed to load course attendance' });
  }
});

router.put('/:courseId/attendance/week', async (req, res) => {
  const parsedCourseId = uuidSchema.safeParse(req.params.courseId);
  if (!parsedCourseId.success) {
    return res.status(400).json({ error: formatZodError(parsedCourseId.error) });
  }

  const courseId = parsedCourseId.data;
  const body = req.body || {};
  const weekStartDate = parseWeekStart(String(body.weekStart || '').trim());
  if (!weekStartDate) {
    return res.status(400).json({ error: 'weekStart is required and must be YYYY-MM-DD' });
  }
  if (!isUtcMonday(weekStartDate)) {
    return res.status(400).json({ error: 'weekStart must be a Monday (YYYY-MM-DD)' });
  }
  const weekStart = toUtcIsoDate(weekStartDate);

  const updates = Array.isArray(body.updates) ? body.updates : null;
  if (!updates) {
    return res.status(400).json({ error: 'updates must be an array' });
  }
  if (!updates.length) {
    return res.json({ updated: 0 });
  }

  try {
    const groupResolution = await resolveAttendanceGroupForCourse(courseId, body.groupId || null);
    if (groupResolution.error) {
      return res.status(groupResolution.status || 400).json({ error: groupResolution.error });
    }
    const group = groupResolution.group;
    if (!group?.id) {
      return res.status(400).json({ error: 'groupId is required when no default group can be resolved' });
    }

    const access = await ensureCourseAttendanceAccess(req, courseId, group.id);
    if (!access.allowed) {
      return res.status(access.status || 403).json({ error: access.error || 'Forbidden' });
    }

    const normalized = [];
    const uniqueKey = new Set();
    for (const item of updates) {
      const parsedSessionId = uuidSchema.safeParse(item?.sessionId);
      const parsedUserId = uuidSchema.safeParse(item?.userId);
      if (!parsedSessionId.success || !parsedUserId.success) {
        return res.status(400).json({ error: 'Each update must include valid sessionId and userId' });
      }
      const status = String(item?.status || '').trim().toLowerCase();
      if (!WEEK_ATTENDANCE_ALLOWED_STATUS.has(status)) {
        return res.status(400).json({ error: `Invalid attendance status: ${status}` });
      }
      const dedupeKey = `${parsedSessionId.data}:${parsedUserId.data}`;
      if (uniqueKey.has(dedupeKey)) {
        continue;
      }
      uniqueKey.add(dedupeKey);
      normalized.push({
        sessionId: parsedSessionId.data,
        userId: parsedUserId.data,
        status,
        note:
          item?.note === undefined || item?.note === null
            ? null
            : String(item.note).trim().slice(0, 1000) || null,
      });
    }

    const sessionIds = [...new Set(normalized.map((item) => item.sessionId))];
    const validSessionsRes = await pool.query(
      `
        SELECT ls.id
        FROM live_sessions ls
        JOIN groups g ON g.id = ls.group_id
        WHERE g.course_id = $1
          AND ls.group_id = $2
          AND ls.id = ANY($3::uuid[])
          AND ls.starts_at >= $4::date
          AND ls.starts_at < ($4::date + INTERVAL '7 days')
      `,
      [courseId, group.id, sessionIds, weekStart],
    );
    const validSessionIds = new Set(validSessionsRes.rows.map((row) => row.id));
    if (validSessionIds.size !== sessionIds.length) {
      return res.status(400).json({ error: 'One or more sessions are invalid for this course/group/week' });
    }

    const rosterRes = await pool.query(
      `
        SELECT user_id
        FROM group_students
        WHERE group_id = $1
          AND status = 'active'
      `,
      [group.id],
    );
    const rosterUserIds = new Set(rosterRes.rows.map((row) => row.user_id));
    const invalidUpdateUser = normalized.find((item) => !rosterUserIds.has(item.userId));
    if (invalidUpdateUser) {
      return res.status(400).json({ error: 'One or more users are not active in the selected group' });
    }

    const touchedSessionIds = [...new Set(normalized.map((item) => item.sessionId))];
    const presentItems = normalized.filter((item) => item.status === 'present');
    const exceptionItems = normalized.filter((item) =>
      WEEK_ATTENDANCE_EXCEPTION_STATUSES.has(item.status),
    );

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await markAttendanceRunsFinalized(client, touchedSessionIds, req.user.id);

      let updatedCount = 0;

      if (presentItems.length) {
        const deleteSessionIds = presentItems.map((item) => item.sessionId);
        const deleteUserIds = presentItems.map((item) => item.userId);
        const deleteRes = await client.query(
          `
            DELETE FROM live_session_attendance
            WHERE (live_session_id, user_id) IN (
              SELECT *
              FROM unnest($1::uuid[], $2::uuid[])
            )
          `,
          [deleteSessionIds, deleteUserIds],
        );
        updatedCount += deleteRes.rowCount || 0;
      }

      if (exceptionItems.length) {
        const values = [];
        const placeholders = [];
        exceptionItems.forEach((item, index) => {
          const base = index * 5;
          placeholders.push(
            `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, now(), now(), now())`,
          );
          values.push(item.sessionId, item.userId, item.status, item.note, req.user.id);
        });

        const upsertRes = await client.query(
          `
            INSERT INTO live_session_attendance (
              live_session_id,
              user_id,
              status,
              note,
              marked_by,
              marked_at,
              created_at,
              updated_at
            )
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (live_session_id, user_id)
            DO UPDATE SET
              status = EXCLUDED.status,
              note = EXCLUDED.note,
              marked_by = EXCLUDED.marked_by,
              marked_at = now(),
              updated_at = now()
          `,
          values,
        );
        updatedCount += upsertRes.rowCount || exceptionItems.length;
      }

      await client.query('COMMIT');
      return res.json({ updated: updatedCount || normalized.length });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Failed to save course attendance week', err);
    return res.status(500).json({ error: 'Failed to save course attendance week' });
  }
});

router.get('/:courseId/posts', async (req, res) => {
  const parsedCourseId = uuidSchema.safeParse(req.params.courseId);
  if (!parsedCourseId.success) {
    return res.status(400).json({ error: formatZodError(parsedCourseId.error) });
  }

  const courseId = parsedCourseId.data;
  const userId = req.user.id;
  const limitRaw = Number.parseInt(req.query.limit, 10);
  const offsetRaw = Number.parseInt(req.query.offset, 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;

  try {
    const canPreviewAsStaff =
      hasGlobalRole(req.user, 'admin') || (await canEditCourse(courseId, req.user));

    if (!canPreviewAsStaff) {
      const enrollment = await pool.query(
        `
          SELECT 1
          FROM enrollments
          WHERE course_id = $1
            AND user_id = $2
            AND status = 'active'
          LIMIT 1
        `,
        [courseId, userId],
      );

      if (!enrollment.rows.length) {
        return res.status(403).json({ error: 'You are not actively enrolled in this course' });
      }
    }

    const visibilityClause = canPreviewAsStaff
      ? 'TRUE'
      : `
        (
          cp.group_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM group_students gs
            WHERE gs.group_id = cp.group_id
              AND gs.user_id = $2
              AND gs.status = 'active'
          )
          OR EXISTS (
            SELECT 1
            FROM group_teachers gt
            WHERE gt.group_id = cp.group_id
              AND gt.user_id = $2
          )
        )
      `;
    const totalParams = canPreviewAsStaff ? [courseId] : [courseId, userId];
    const dataParams = canPreviewAsStaff
      ? [courseId, limit, offset]
      : [courseId, userId, limit, offset];

    const totalResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM course_posts cp
        WHERE cp.course_id = $1
          AND ${visibilityClause}
      `,
      totalParams,
    );

    const dataResult = await pool.query(
      `
        SELECT
          cp.id,
          cp.course_id,
          cp.group_id,
          cp.created_by_user_id,
          u.full_name AS created_by_full_name,
          cp.title,
          cp.body,
          cp.created_at
        FROM course_posts cp
        LEFT JOIN users u ON u.id = cp.created_by_user_id
        WHERE cp.course_id = $1
          AND ${visibilityClause}
        ORDER BY cp.created_at DESC
        LIMIT $${canPreviewAsStaff ? 2 : 3}
        OFFSET $${canPreviewAsStaff ? 3 : 4}
      `,
      dataParams,
    );

    return res.json({
      data: dataResult.rows.map(mapCoursePostRow),
      limit,
      offset,
      total: Number(totalResult.rows[0]?.total || 0),
    });
  } catch (err) {
    console.error('Failed to fetch course posts', err);
    return res.status(500).json({ error: 'Failed to fetch course posts' });
  }
});

router.get('/:id', requireGlobalRoleAny(['admin', 'instructor', 'student']), async (req, res) => {
  const courseId = req.params.id;
  const { id: userId } = req.user;
  const isAdmin = hasGlobalRole(req.user, 'admin');
  const isInstructor = hasGlobalRole(req.user, 'instructor');
  const isStudent = hasGlobalRole(req.user, 'student');
  const isPreview =
    req.query.preview === '1' || req.query.preview === 'true';

  try {
    const courseRes = await pool.query(
      `
        SELECT
          c.id,
          c.title,
          c.description,
          COALESCE(cl.code, '${FALLBACK_LEVEL_CODE}') AS level,
          c.status,
          c.owner_user_id,
          c.created_at,
          c.published_at,
          c.is_published,
          c.updated_at
        FROM courses c
        ${COURSE_LEVEL_JOIN}
        WHERE c.id = $1
        LIMIT 1
      `,
      [courseId],
    );

    const course = courseRes.rows[0];
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (isPreview) {
      const allowed = isAdmin || (await canEditCourse(courseId, req.user));
      if (!allowed) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else if (isStudent && !isAdmin && !isInstructor) {
      if (!course.is_published) {
        return res.status(404).json({ error: 'Course not found' });
      }
      const enrollment = await pool.query(
        `
          SELECT 1
          FROM enrollments
          WHERE course_id = $1 AND user_id = $2
          LIMIT 1
        `,
        [courseId, userId],
      );
      if (!enrollment.rows.length) {
        return res.status(403).json({ error: 'You are not enrolled in this course' });
      }
    } else if (!isAdmin) {
      let allowed = course.owner_user_id === userId;
      if (!allowed) {
        const teaching = await pool.query(
          `
            SELECT 1
            FROM group_teachers gt
            JOIN groups g ON g.id = gt.group_id
            WHERE gt.user_id = $1 AND g.course_id = $2
            LIMIT 1
          `,
          [userId, courseId],
        );
        allowed = teaching.rows.length > 0;
      }

      if (!allowed) {
        return res.status(403).json({ error: 'You are not assigned to this course' });
      }
    }

    const modulesRes = await pool.query(
      `
        SELECT id, title, position, order_index, is_published
        FROM modules
        WHERE course_id = $1
        ORDER BY order_index ASC
      `,
      [courseId],
    );

    let modules = modulesRes.rows.map((module) => ({
      ...module,
      lessons: [],
    }));

    if (!isPreview && isStudent && !isAdmin && !isInstructor) {
      modules = modules.filter((module) => module.is_published);
    }

    const moduleIds = modules.map((m) => m.id);
    let lessons = [];
    if (moduleIds.length > 0) {
      const lessonsRes = await pool.query(
        `
          SELECT
            l.id,
            l.module_id,
            l.title,
            l.position,
            l.content_type,
            l.content_text,
            l.content_markdown,
            l.content_html,
            l.video_url,
            l.content_url,
            l.embed_html,
            l.duration_seconds,
            l.estimated_minutes,
            l.is_free_preview,
            l.is_published,
            l.order_index
          FROM lessons l
          WHERE l.module_id = ANY($1::uuid[])
          ORDER BY l.order_index ASC
        `,
        [moduleIds],
      );
      lessons = lessonsRes.rows;

      if (!isPreview && isStudent && !isAdmin && !isInstructor) {
        lessons = lessons.filter((lesson) => lesson.is_published);
      }
    }

    const lessonIds = lessons.map((lesson) => lesson.id);
    const assetsByLesson = {};
    if (lessonIds.length > 0) {
      const assetsRes = await pool.query(
        `
          SELECT
            la.lesson_id,
            a.id,
            a.kind,
            a.mime_type,
            a.original_name,
            a.size_bytes,
            a.storage_path,
            a.public_url,
            a.storage_provider
          FROM lesson_assets la
          JOIN assets a ON a.id = la.asset_id
          WHERE la.lesson_id = ANY($1::uuid[])
          ORDER BY a.created_at ASC
        `,
        [lessonIds],
      );

      for (const row of assetsRes.rows) {
        if (!assetsByLesson[row.lesson_id]) {
          assetsByLesson[row.lesson_id] = [];
        }
        assetsByLesson[row.lesson_id].push({
          id: row.id,
          kind: row.kind,
          mimeType: row.mime_type,
          originalName: row.original_name,
          sizeBytes: row.size_bytes,
          storagePath: row.storage_path,
          url: row.public_url,
          storageProvider: row.storage_provider,
        });
      }
    }

    const moduleMap = modules.reduce((acc, module) => {
      acc[module.id] = module;
      return acc;
    }, {});

    for (const lesson of lessons) {
      const module = moduleMap[lesson.module_id];
      if (module) {
        module.lessons.push({
          id: lesson.id,
          title: lesson.title,
          position: lesson.position,
          contentType: lesson.content_type,
          contentText: lesson.content_text,
          contentMarkdown: lesson.content_markdown,
          contentHtml: lesson.content_html,
          videoUrl: lesson.video_url,
          contentUrl: lesson.content_url,
          embedHtml: lesson.embed_html,
          durationSeconds: lesson.duration_seconds,
          estimatedMinutes: lesson.estimated_minutes,
          isFreePreview: lesson.is_free_preview,
          orderIndex: lesson.order_index,
          isPublished: lesson.is_published,
          assets: assetsByLesson[lesson.id] || [],
        });
      }
    }

    return res.json({
      ...course,
      modules: modules.map((module) => ({
        ...module,
        lessons: module.lessons,
      })),
    });
  } catch (err) {
    console.error('Failed to fetch course detail', err);
    return res.status(500).json({ error: 'Failed to fetch course' });
  }
});

/**
 * Example:
 * curl -H "Authorization: Bearer $TOKEN" \
 *   "http://localhost:3000/courses/<courseId>/progress?studentId=<studentId>"
 */
router.get(
  '/:id/progress',
  requireGlobalRoleAny(['student', 'instructor', 'admin']),
  async (req, res) => {
  const courseId = req.params.id;
  const { id: userId } = req.user;
  const isAdmin = hasGlobalRole(req.user, 'admin');
  const isInstructor = hasGlobalRole(req.user, 'instructor');
  const isStudent = hasGlobalRole(req.user, 'student');
  let targetStudentId = req.query.studentId;

  if (targetStudentId) {
    const validation = uuidSchema.safeParse(targetStudentId);
    if (!validation.success) {
      return res.status(400).json({ error: formatZodError(validation.error) });
    }
    targetStudentId = validation.data;
  }

  try {
    const courseRes = await pool.query(
      'SELECT id, owner_user_id FROM courses WHERE id = $1 LIMIT 1',
      [courseId],
    );
    const course = courseRes.rows[0];
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (isStudent && !isAdmin && !isInstructor) {
      if (targetStudentId && targetStudentId !== userId) {
        return res.status(403).json({ error: 'Students can only view their own progress' });
      }
      targetStudentId = userId;

      const enrollment = await pool.query(
        'SELECT 1 FROM enrollments WHERE course_id = $1 AND user_id = $2 LIMIT 1',
        [courseId, userId],
      );
      if (!enrollment.rows.length) {
        return res.status(403).json({ error: 'You are not enrolled in this course' });
      }
    } else if (isInstructor && !isAdmin) {
      if (!targetStudentId) {
        return res.status(400).json({ error: 'studentId query parameter is required' });
      }

      let allowed = course.owner_user_id === userId;
      if (!allowed) {
        const assignment = await pool.query(
          `
            SELECT 1
            FROM group_teachers gt
            JOIN groups g ON g.id = gt.group_id
            WHERE gt.user_id = $1 AND g.course_id = $2
            LIMIT 1
          `,
          [userId, courseId],
        );
        allowed = assignment.rows.length > 0;
      }
      if (!allowed) {
        return res.status(403).json({ error: 'You are not assigned to this course' });
      }

      const teachesStudent = await pool.query(
        `
          SELECT 1
          FROM group_teachers gt
          JOIN groups g ON g.id = gt.group_id
          JOIN group_students gs ON gs.group_id = g.id
          WHERE gt.user_id = $1
            AND g.course_id = $2
            AND gs.user_id = $3
          LIMIT 1
        `,
        [userId, courseId, targetStudentId],
      );

      if (!teachesStudent.rows.length) {
        return res.status(403).json({ error: 'Student is not in your groups for this course' });
      }
    } else if (isAdmin) {
      if (!targetStudentId) {
        return res.status(400).json({ error: 'studentId query parameter is required' });
      }
    }

    const studentEnrollment = await pool.query(
      'SELECT 1 FROM enrollments WHERE course_id = $1 AND user_id = $2 LIMIT 1',
      [courseId, targetStudentId],
    );
    if (!studentEnrollment.rows.length) {
      return res.status(404).json({ error: 'Student is not enrolled in this course' });
    }

    const lessonsRes = await pool.query(
      `
        SELECT
          l.id,
          l.title
        FROM lessons l
        JOIN modules m ON m.id = l.module_id
        WHERE m.course_id = $1
        ORDER BY m.position ASC, l.position ASC
      `,
      [courseId],
    );
    const lessons = lessonsRes.rows;
    const totalLessons = lessons.length;

    const completionRes = await pool.query(
      `
        SELECT lp.lesson_id
        FROM lesson_progress lp
        JOIN lessons l ON l.id = lp.lesson_id
        JOIN modules m ON m.id = l.module_id
        WHERE lp.user_id = $1
          AND lp.status = 'done'
          AND m.course_id = $2
      `,
      [targetStudentId, courseId],
    );

    const doneLessonIds = new Set(completionRes.rows.map((row) => row.lesson_id));
    const completedLessons = doneLessonIds.size;

    const percent =
      totalLessons === 0 ? 0 : Math.floor((completedLessons * 100) / totalLessons);

    const completedLessonDetails = lessons
      .filter((lesson) => doneLessonIds.has(lesson.id))
      .map(({ id, title }) => ({ id, title }));
    const nextLesson = lessons.find((lesson) => !doneLessonIds.has(lesson.id)) || null;

    return res.json({
      courseId,
      totalLessons,
      completedLessons,
      percent,
      nextLessonId: nextLesson ? nextLesson.id : null,
      nextLessonTitle: nextLesson ? nextLesson.title : null,
      completedLessonDetails,
    });
  } catch (err) {
    console.error('Failed to load course progress', err);
    return res.status(500).json({ error: 'Failed to load course progress' });
  }
  },
);

module.exports = router;

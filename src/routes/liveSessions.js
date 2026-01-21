const express = require('express');
const { RRule } = require('rrule');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireGlobalRoleAny, hasGlobalRole } = require('../middleware/roles');
const { hasCourseRole, isGroupTeacher } = require('../utils/roleService');
const {
  liveSeriesCreateSchema,
  liveSeriesUpdateSchema,
  liveSessionUpdateSchema,
  formatZodError,
  uuidSchema,
} = require('../utils/validators');

const router = express.Router();

router.use(auth);

// Returns all class types for instructors/admins
router.get(
  '/class-types',
  requireGlobalRoleAny(['instructor', 'admin']),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, code, label, is_active FROM class_types ORDER BY label ASC',
      );
      return res.json(
        rows.map((row) => ({
          id: row.id,
          name: row.label,
          code: row.code,
          isActive: typeof row.is_active === 'boolean' ? row.is_active : true,
        })),
      );
    } catch (err) {
      console.error('Failed to load class types', err);
      return res.status(500).json({ error: 'Failed to load class types' });
    }
  },
);

const INSTRUCTOR_ROLE = ['instructor'];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const mapSeriesRow = (row) => ({
  id: row.id,
  groupId: row.group_id,
  courseId: row.course_id,
  moduleId: row.module_id,
  classTypeId: row.class_type_id,
  classTypeName: row.class_type_name || null,
  hostTeacherId: row.host_teacher_id,
  hostTeacherName: row.host_teacher_name || null,
  title: row.title,
  timezone: row.timezone,
  rrule: row.rrule,
  dtstart: row.dtstart ? row.dtstart.toISOString() : null,
  durationMinutes: row.duration_minutes,
  published: row.published,
  joinUrl: row.join_url || null,
  hostUrl: row.host_url || null,
  createdBy: row.created_by || null,
  createdAt: row.created_at ? row.created_at.toISOString() : null,
  updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
});

const mapSessionRow = (row) => ({
  id: row.id,
  seriesId: row.series_id,
  groupId: row.group_id,
  moduleId: row.module_id,
  classTypeId: row.class_type_id,
  classTypeName: row.class_type_name || null,
  hostTeacherId: row.host_teacher_id,
  hostTeacherName: row.host_teacher_name || null,
  startsAt: row.starts_at ? row.starts_at.toISOString() : null,
  endsAt: row.ends_at ? row.ends_at.toISOString() : null,
  published: row.published,
  status: row.status,
  joinUrl: row.join_url || null,
  hostUrl: row.host_url || null,
  createdAt: row.created_at ? row.created_at.toISOString() : null,
  updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
  courseId: row.course_id || null,
});

const loadGroup = async (groupId) => {
  const { rows } = await pool.query('SELECT id, course_id FROM groups WHERE id = $1 LIMIT 1', [
    groupId,
  ]);
  return rows[0] || null;
};

const ensureInstructorForGroup = async (req, res, group) => {
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return null;
  }

  if (hasGlobalRole(req.user, 'admin')) {
    return { isAdmin: true, group };
  }

  const hasInstructor = await hasCourseRole(req.user.id, group.course_id, INSTRUCTOR_ROLE);
  if (!hasInstructor) {
    res.status(403).json({ error: 'You are not allowed to manage this group' });
    return null;
  }

  const teacher = await isGroupTeacher(req.user.id, group.id);
  if (!teacher) {
    res.status(403).json({ error: 'You must be a teacher in this group' });
    return null;
  }

  return { isAdmin: false, group };
};

const ensureHostBelongsToGroup = async (groupId, hostTeacherId) => {
  if (!hostTeacherId) {
    return false;
  }
  const { rows } = await pool.query(
    `
      SELECT 1
      FROM group_teachers
      WHERE group_id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [groupId, hostTeacherId],
  );
  return rows.length > 0;
};

const ensureModuleInCourse = async (moduleId, courseId) => {
  if (!moduleId) {
    return true;
  }
  const { rows } = await pool.query(
    'SELECT course_id FROM modules WHERE id = $1 LIMIT 1',
    [moduleId],
  );
  if (!rows.length) {
    return false;
  }
  return rows[0].course_id === courseId;
};

const loadSeries = async (seriesId) => {
  const { rows } = await pool.query(
    `
      SELECT
        s.*,
        g.course_id,
        ct.label AS class_type_name,
        ct.code AS class_type_code,
        u.full_name AS host_teacher_name
      FROM live_session_series s
      JOIN groups g ON g.id = s.group_id
      JOIN class_types ct ON ct.id = s.class_type_id
      LEFT JOIN users u ON u.id = s.host_teacher_id
      WHERE s.id = $1
      LIMIT 1
    `,
    [seriesId],
  );
  return rows[0] || null;
};

const loadSessionById = async (sessionId) => {
  const { rows } = await pool.query(
    `
      SELECT
        ls.*,
        ct.label AS class_type_name,
        ct.code AS class_type_code,
        u.full_name AS host_teacher_name
      FROM live_sessions ls
      JOIN class_types ct ON ct.id = ls.class_type_id
      LEFT JOIN users u ON u.id = ls.host_teacher_id
      WHERE ls.id = $1
      LIMIT 1
    `,
    [sessionId],
  );
  return rows[0] || null;
};

const ensureSeriesAccess = async (req, res, seriesId) => {
  const series = await loadSeries(seriesId);
  if (!series) {
    res.status(404).json({ error: 'Series not found' });
    return null;
  }
  const auth = await ensureInstructorForGroup(req, res, { id: series.group_id, course_id: series.course_id });
  if (!auth) {
    return null;
  }
  return { series, auth };
};

const ensureSessionAccess = async (req, res, sessionId) => {
  const session = await loadSessionById(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return null;
  }
  const group = await loadGroup(session.group_id);
  const auth = await ensureInstructorForGroup(req, res, group);
  if (!auth) {
    return null;
  }
  return { session, group };
};

// Creates a live session series for a group
router.post('/groups/:groupId/live-series', async (req, res) => {
  try {
    const group = await loadGroup(req.params.groupId);
    const auth = await ensureInstructorForGroup(req, res, group);
    if (!auth) {
      return;
    }

    const parsed = liveSeriesCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }
    const payload = parsed.data;

    const moduleValid = await ensureModuleInCourse(payload.moduleId, group.course_id);
    if (!moduleValid) {
      return res.status(400).json({ error: 'Module does not belong to the course' });
    }

    const hostAllowed = await ensureHostBelongsToGroup(group.id, payload.hostTeacherId);
    if (!hostAllowed) {
      return res.status(400).json({ error: 'hostTeacherId must belong to the group' });
    }

    const { rows } = await pool.query(
      `
        INSERT INTO live_session_series (
          group_id,
          course_id,
          module_id,
          class_type_id,
          host_teacher_id,
          title,
          timezone,
          rrule,
          dtstart,
          duration_minutes,
          published,
          join_url,
          host_url,
          created_by,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, $11, $12, $13, now())
        RETURNING *
      `,
      [
        group.id,
        group.course_id,
        payload.moduleId || null,
        payload.classTypeId,
        payload.hostTeacherId,
        payload.title,
        payload.timezone,
        payload.rrule,
        new Date(payload.dtstart),
        payload.durationMinutes,
        payload.joinUrl || null,
        payload.hostUrl || null,
        req.user.id,
      ],
    );

    const result = await loadSeries(rows[0].id);
    return res.status(201).json(mapSeriesRow(result));
  } catch (err) {
    console.error('Failed to create live session series', err);
    return res.status(500).json({ error: 'Failed to create live session series' });
  }
});

// Lists live session series for a group
router.get('/groups/:groupId/live-series', async (req, res) => {
  try {
    const group = await loadGroup(req.params.groupId);
    const auth = await ensureInstructorForGroup(req, res, group);
    if (!auth) {
      return;
    }

    const { rows } = await pool.query(
      `
        SELECT
          s.*,
          ct.label AS class_type_name,
          ct.code AS class_type_code,
          u.full_name AS host_teacher_name
        FROM live_session_series s
        JOIN class_types ct ON ct.id = s.class_type_id
        LEFT JOIN users u ON u.id = s.host_teacher_id
        WHERE s.group_id = $1
        ORDER BY s.created_at DESC
      `,
      [group.id],
    );

    return res.json(rows.map(mapSeriesRow));
  } catch (err) {
    console.error('Failed to list live session series', err);
    return res.status(500).json({ error: 'Failed to list live session series' });
  }
});

// Updates an existing live session series
router.patch('/live-series/:id', async (req, res) => {
  try {
    const lookup = await ensureSeriesAccess(req, res, req.params.id);
    if (!lookup) {
      return;
    }
    const { series } = lookup;

    const parsed = liveSeriesUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }
    const updates = parsed.data;

    if (updates.moduleId !== undefined) {
      const valid = await ensureModuleInCourse(updates.moduleId, series.course_id);
      if (!valid) {
        return res.status(400).json({ error: 'Module does not belong to the course' });
      }
    }

    if (updates.hostTeacherId) {
      const valid = await ensureHostBelongsToGroup(series.group_id, updates.hostTeacherId);
      if (!valid) {
        return res.status(400).json({ error: 'hostTeacherId must belong to the group' });
      }
    }

    const fields = [];
    const values = [];
    const setField = (column, value) => {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    };

    if (updates.moduleId !== undefined) setField('module_id', updates.moduleId || null);
    if (updates.classTypeId !== undefined) setField('class_type_id', updates.classTypeId);
    if (updates.hostTeacherId !== undefined) setField('host_teacher_id', updates.hostTeacherId);
    if (updates.title !== undefined) setField('title', updates.title);
    if (updates.timezone !== undefined) setField('timezone', updates.timezone);
    if (updates.rrule !== undefined) setField('rrule', updates.rrule);
    if (updates.dtstart !== undefined) setField('dtstart', new Date(updates.dtstart));
    if (updates.durationMinutes !== undefined) setField('duration_minutes', updates.durationMinutes);
    if (updates.joinUrl !== undefined) setField('join_url', updates.joinUrl || null);
    if (updates.hostUrl !== undefined) setField('host_url', updates.hostUrl || null);

    if (!fields.length) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(series.id);

    await pool.query(
      `
        UPDATE live_session_series
        SET ${fields.join(', ')}, updated_at = now()
        WHERE id = $${values.length}
      `,
      values,
    );

    const fresh = await loadSeries(series.id);
    return res.json(mapSeriesRow(fresh));
  } catch (err) {
    console.error('Failed to update live session series', err);
    return res.status(500).json({ error: 'Failed to update live session series' });
  }
});

const setSeriesPublished = async (seriesId, published) => {
  await pool.query(
    'UPDATE live_session_series SET published = $2, updated_at = now() WHERE id = $1',
    [seriesId, published],
  );
  await pool.query('UPDATE live_sessions SET published = $2 WHERE series_id = $1', [
    seriesId,
    published,
  ]);
};

// Publishes a series and its sessions
router.post('/live-series/:id/publish', async (req, res) => {
  try {
    const lookup = await ensureSeriesAccess(req, res, req.params.id);
    if (!lookup) {
      return;
    }
    await setSeriesPublished(lookup.series.id, true);
    const fresh = await loadSeries(lookup.series.id);
    return res.json(mapSeriesRow(fresh));
  } catch (err) {
    console.error('Failed to publish live session series', err);
    return res.status(500).json({ error: 'Failed to publish live session series' });
  }
});

// Unpublishes a series and its sessions
router.post('/live-series/:id/unpublish', async (req, res) => {
  try {
    const lookup = await ensureSeriesAccess(req, res, req.params.id);
    if (!lookup) {
      return;
    }
    await setSeriesPublished(lookup.series.id, false);
    const fresh = await loadSeries(lookup.series.id);
    return res.json(mapSeriesRow(fresh));
  } catch (err) {
    console.error('Failed to unpublish live session series', err);
    return res.status(500).json({ error: 'Failed to unpublish live session series' });
  }
});

// Deletes a live session series and its generated sessions
router.delete('/live-series/:id', async (req, res) => {
  try {
    const lookup = await ensureSeriesAccess(req, res, req.params.id);
    if (!lookup) {
      return;
    }
    await pool.query('DELETE FROM live_session_series WHERE id = $1', [lookup.series.id]);
    return res.status(204).end();
  } catch (err) {
    console.error('Failed to delete live session series', err);
    return res.status(500).json({ error: 'Failed to delete live session series' });
  }
});

const parseWindow = (body = {}) => {
  const from = body.from ? new Date(body.from) : new Date();
  const weeksInput = Number(body.weeks);
  const weeks = Number.isFinite(weeksInput) && weeksInput > 0 ? weeksInput : 8;
  let to;
  if (body.to) {
    to = new Date(body.to);
  } else {
    to = new Date(from.getTime() + weeks * WEEK_MS);
  }
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('Invalid date range');
  }
  return { from, to };
};

const planSeriesOccurrences = (series, window) => {
  const options = RRule.parseString(series.rrule);
  options.dtstart = new Date(series.dtstart);
  const rule = new RRule(options);
  const rawOccurrences = rule.between(window.from, window.to, true);
  return rawOccurrences.map((start) => ({
    startsAt: start,
    endsAt: new Date(start.getTime() + (series.duration_minutes || 0) * 60000),
  }));
};

const insertSessionsForSeries = async (series, occurrences) => {
  if (!occurrences.length) {
    return [];
  }
  const values = [];
  const placeholders = [];
  let index = 1;
  for (const occ of occurrences) {
    placeholders.push(
      `($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4}, $${index + 5}, $${index + 6}, $${index + 7}, $${index + 8}, $${index + 9}, $${index + 10})`,
    );
    values.push(
      series.id,
      series.group_id,
      series.module_id,
      series.class_type_id,
      series.host_teacher_id,
      occ.startsAt,
      occ.endsAt,
      series.published,
      'scheduled',
      series.join_url || null,
      series.host_url || null,
    );
    index += 11;
  }
  const { rows } = await pool.query(
    `
      INSERT INTO live_sessions (
        series_id,
        group_id,
        module_id,
        class_type_id,
        host_teacher_id,
        starts_at,
        ends_at,
        published,
        status,
        join_url,
        host_url
      )
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `,
    values,
  );
  return rows;
};

const generateSessionsForSeries = async (series, window) => {
  const occurrences = planSeriesOccurrences(series, window);
  if (!occurrences.length) {
    return { created: 0, sessions: [] };
  }

  const existingRes = await pool.query(
    `
      SELECT starts_at
      FROM live_sessions
      WHERE series_id = $1
        AND starts_at BETWEEN $2 AND $3
    `,
    [series.id, window.from, window.to],
  );
  const existingStarts = new Set(
    existingRes.rows.map((row) => row.starts_at.toISOString()),
  );

  const pending = occurrences.filter(
    (occ) => !existingStarts.has(occ.startsAt.toISOString()),
  );
  if (!pending.length) {
    return { created: 0, sessions: [] };
  }

  const rows = await insertSessionsForSeries(series, pending);
  return {
    created: rows.length,
    sessions: rows.map(mapSessionRow),
  };
};

// Generates live session occurrences for a series
router.post('/live-series/:id/generate', async (req, res) => {
  try {
    const lookup = await ensureSeriesAccess(req, res, req.params.id);
    if (!lookup) {
      return;
    }
    const { series } = lookup;

    let window;
    try {
      window = parseWindow(req.body || {});
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Invalid window' });
    }

    const result = await generateSessionsForSeries(series, window);
    return res.json(result);
  } catch (err) {
    console.error('Failed to generate live sessions', err);
    return res.status(500).json({ error: 'Failed to generate live sessions' });
  }
});

router.post('/live-series/:id/regenerate', async (req, res) => {
  try {
    const lookup = await ensureSeriesAccess(req, res, req.params.id);
    if (!lookup) {
      return;
    }
    const { series } = lookup;

    let window;
    try {
      window = parseWindow(req.body || {});
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Invalid window' });
    }

    const deleted = await pool.query(
      `
        DELETE FROM live_sessions
        WHERE series_id = $1
          AND starts_at BETWEEN $2 AND $3
      `,
      [series.id, window.from, window.to],
    );

    const result = await generateSessionsForSeries(series, window);
    return res.json({ deleted: deleted.rowCount, ...result });
  } catch (err) {
    console.error('Failed to regenerate live sessions', err);
    return res.status(500).json({ error: 'Failed to regenerate live sessions' });
  }
});

router.patch('/live-sessions/:id', async (req, res) => {
  try {
    const parsed = liveSessionUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    const lookup = await ensureSessionAccess(req, res, req.params.id);
    if (!lookup) {
      return;
    }
    const { session, group } = lookup;
    const updates = parsed.data;

    if (updates.moduleId !== undefined && updates.moduleId) {
      const valid = await ensureModuleInCourse(updates.moduleId, group.course_id);
      if (!valid) {
        return res.status(400).json({ error: 'Module does not belong to the course' });
      }
    }

    if (updates.hostTeacherId !== undefined) {
      const allowed = await ensureHostBelongsToGroup(session.group_id, updates.hostTeacherId);
      if (!allowed) {
        return res.status(400).json({ error: 'hostTeacherId must belong to the group' });
      }
    }

    const assignments = [];
    const values = [];
    const assignField = (column, value) => {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    };

    if (updates.title !== undefined) {
      assignField('title', updates.title || null);
    }
    if (updates.moduleId !== undefined) {
      assignField('module_id', updates.moduleId || null);
    }
    if (updates.classTypeId !== undefined) {
      assignField('class_type_id', updates.classTypeId);
    }
    if (updates.hostTeacherId !== undefined) {
      assignField('host_teacher_id', updates.hostTeacherId);
    }
    if (updates.published !== undefined) {
      assignField('published', updates.published);
    }
    if (updates.status !== undefined) {
      assignField('status', updates.status);
    }
    if (updates.joinUrl !== undefined) {
      assignField('join_url', updates.joinUrl || null);
    }
    if (updates.hostUrl !== undefined) {
      assignField('host_url', updates.hostUrl || null);
    }

    const currentStart = new Date(session.starts_at);
    const currentEnd = new Date(session.ends_at);
    const existingDurationMs = currentEnd.getTime() - currentStart.getTime();

    let updatedStart = null;
    if (updates.startsAt !== undefined) {
      updatedStart = new Date(updates.startsAt);
      assignField('starts_at', updatedStart);
    }

    if (updates.durationMinutes !== undefined) {
      const baseStart = updatedStart || currentStart;
      const computedEnd = new Date(baseStart.getTime() + updates.durationMinutes * 60000);
      assignField('ends_at', computedEnd);
    } else if (updates.endsAt !== undefined) {
      assignField('ends_at', new Date(updates.endsAt));
    } else if (updates.startsAt !== undefined) {
      const baseStart = updatedStart || currentStart;
      const computedEnd = new Date(baseStart.getTime() + existingDurationMs);
      assignField('ends_at', computedEnd);
    }

    if (!assignments.length) {
      return res.status(400).json({ error: 'At least one field must be updated' });
    }

    assignments.push('updated_at = now()');
    values.push(session.id);

    await pool.query(
      `
        UPDATE live_sessions
        SET ${assignments.join(', ')}
        WHERE id = $${values.length}
      `,
      values,
    );

    const fresh = await loadSessionById(session.id);
    return res.json(fresh || {});
  } catch (err) {
    console.error('Failed to update live session', err);
    return res.status(500).json({ error: 'Failed to update live session' });
  }
});

const parseRangeQuery = (req) => {
  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - WEEK_MS);
  const to = req.query.to ? new Date(req.query.to) : new Date(Date.now() + 4 * WEEK_MS);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('Invalid date range');
  }
  return { from, to };
};

// Lists live sessions for a group (instructor view)
router.get('/groups/:groupId/live-sessions', async (req, res) => {
  try {
    const group = await loadGroup(req.params.groupId);
    const auth = await ensureInstructorForGroup(req, res, group);
    if (!auth) {
      return;
    }

    let range;
    try {
      range = parseRangeQuery(req);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const { rows } = await pool.query(
      `
        SELECT
          ls.*,
          ct.label AS class_type_name,
          ct.code AS class_type_code,
          u.full_name AS host_teacher_name
        FROM live_sessions ls
        JOIN class_types ct ON ct.id = ls.class_type_id
        LEFT JOIN users u ON u.id = ls.host_teacher_id
        WHERE ls.group_id = $1
          AND ls.starts_at BETWEEN $2 AND $3
        ORDER BY ls.starts_at ASC
      `,
      [group.id, range.from, range.to],
    );

    return res.json(rows.map(mapSessionRow));
  } catch (err) {
    console.error('Failed to list live sessions', err);
    return res.status(500).json({ error: 'Failed to list live sessions' });
  }
});

// Lists published live sessions for the authenticated student
router.get('/me/live-sessions', async (req, res) => {
  try {
    let range;
    try {
      range = parseRangeQuery(req);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    let courseIdFilter = null;
    if (req.query.courseId) {
      const parsedCourseId = uuidSchema.safeParse(req.query.courseId);
      if (!parsedCourseId.success) {
        return res.status(400).json({ error: 'courseId must be a valid UUID' });
      }
      courseIdFilter = parsedCourseId.data;
    }

    const { rows } = await pool.query(
      `
        SELECT
          ls.*,
          ct.label AS class_type_name,
          ct.code AS class_type_code,
          u.full_name AS host_teacher_name,
          g.name AS group_name,
          c.id AS course_id,
          c.title AS course_title
        FROM group_students gs
        JOIN live_sessions ls ON ls.group_id = gs.group_id
        JOIN groups g ON g.id = ls.group_id
        JOIN courses c ON c.id = g.course_id
        JOIN class_types ct ON ct.id = ls.class_type_id
        LEFT JOIN users u ON u.id = ls.host_teacher_id
        WHERE gs.user_id = $1
          AND ls.published = true
          AND ls.starts_at >= $2
          ${courseIdFilter ? `AND c.id = $3` : ''}
        ORDER BY ls.starts_at ASC
      `,
      courseIdFilter
        ? [req.user.id, range.from, courseIdFilter]
        : [req.user.id, range.from],
    );

    const sessions = rows.map((row) => ({
      ...mapSessionRow(row),
      groupName: row.group_name,
      courseTitle: row.course_title,
      courseId: row.course_id,
    }));

    return res.json(sessions);
  } catch (err) {
    console.error('Failed to list student live sessions', err);
    return res.status(500).json({ error: 'Failed to list live sessions' });
  }
});

module.exports = router;

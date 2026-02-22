const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { randomUUID } = require('crypto');
const pool = require('../db');
const auth = require('../middleware/auth');
const {
  requireGlobalRoleAny,
  requireCourseRoleAny,
  hasGlobalRole,
  hasCourseRole,
  resolveCourseId
} = require('../middleware/roles');
const {
  courseCreateSchema,
  courseUpdateSchema,
  instructorAssignSchema,
  moduleCreateSchema,
  moduleUpdateSchema,
  lessonCreateSchema,
  lessonUpdateSchema,
  quizQuestionCreateSchema,
  quizQuestionUpdateSchema,
  quizOptionCreateSchema,
  quizOptionUpdateSchema,
  enrollStudentSchema,
  assignGroupSchema,
  groupTeacherAssignSchema,
  groupCreateSchema,
  groupUpdateSchema,
  announcementCreateSchema,
  announcementUpdateSchema,
  coursePostCreateSchema,
  coursePostUpdateSchema,
  bulkEnrollSchema,
  formatZodError,
  uuidSchema,
} = require('../utils/validators');
const { canEditCourse } = require('../utils/cmsPermissions');
const { ensureCourseExists } = require('../utils/roleService');

const CMS_GLOBAL_ROLES = ['admin', 'instructor', 'content_editor', 'enrollment_manager'];
const CONTENT_ROLES = ['instructor', 'content_editor'];
const ENROLLMENT_ROLES = ['instructor', 'enrollment_manager'];
const COURSE_STAFF_ROLES = ['instructor', 'content_editor', 'enrollment_manager'];
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;
const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'];
const DOCUMENT_MIME_TYPES = ['application/pdf'];
const ALLOWED_MIME_TYPES = new Set([
  ...IMAGE_MIME_TYPES,
  ...AUDIO_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
]);
const ASSET_LIST_LIMIT = 50;
const ASSET_KIND_VALUES = new Set(['image', 'audio', 'file']);

const sanitizeAssetKind = (kind) =>
  ASSET_KIND_VALUES.has(kind) ? kind : 'file';


const router = express.Router();

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname) || '';
    cb(null, `${randomUUID()}${extension}`);
  },
});

const uploadAsset = multer({
  storage: uploadStorage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('Unsupported file type'), false);
  },
}).single('file');

const runUploadFile = (req, res) =>
  new Promise((resolve, reject) => {
    uploadAsset(req, res, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });

const getAssetKind = (mimeType) => {
  if (IMAGE_MIME_TYPES.includes(mimeType)) {
    return 'image';
  }
  if (AUDIO_MIME_TYPES.includes(mimeType)) {
    return 'audio';
  }
  if (DOCUMENT_MIME_TYPES.includes(mimeType)) {
    return 'file';
  }
  return null;
};

const isValidAssetKind = (kind) => ['image', 'audio', 'file'].includes(kind);

const COURSE_LEVEL_JOIN = 'LEFT JOIN course_levels cl ON cl.id = c.level_id';
const FALLBACK_LEVEL_CODE = 'A1';
const COURSE_SELECT = `
  c.id,
  c.title,
  c.description,
  COALESCE(cl.code, '${FALLBACK_LEVEL_CODE}') AS level,
  c.owner_user_id,
  c.is_published,
  c.published_at,
  c.created_at,
  c.updated_at
`;

const normalizeLevelCode = (value) => (value || '').trim().toUpperCase();

const resolveLevelId = async (code) => {
  const normalized = normalizeLevelCode(code);
  const { rows } = await pool.query(
    'SELECT id FROM course_levels WHERE code = $1 LIMIT 1',
    [normalized || FALLBACK_LEVEL_CODE],
  );
  if (rows.length) {
    return rows[0].id;
  }
  const fallbackRows = await pool.query(
    'SELECT id FROM course_levels ORDER BY created_at ASC LIMIT 1',
  );
  return fallbackRows.rows[0]?.id || null;
};

const fetchCourseById = async (courseId) => {
  const { rows } = await pool.query(
    `
      SELECT ${COURSE_SELECT}
      FROM courses c
      ${COURSE_LEVEL_JOIN}
      WHERE c.id = $1
      LIMIT 1
    `,
    [courseId],
  );
  return rows[0] || null;
};

router.use(auth);
router.use(requireGlobalRoleAny(CMS_GLOBAL_ROLES));

const fetchCourseIdByModule = async (moduleId) => {
  const { rows } = await pool.query('SELECT course_id FROM modules WHERE id = $1 LIMIT 1', [moduleId]);
  return rows[0]?.course_id;
};

const fetchCourseIdByLesson = async (lessonId) => {
  const { rows } = await pool.query(
    `
      SELECT m.course_id
      FROM lessons l
      JOIN modules m ON m.id = l.module_id
      WHERE l.id = $1
      LIMIT 1
    `,
    [lessonId],
  );
  return rows[0]?.course_id;
};

const resolveCourseIdFromParam = (param) => (req) => req.params[param];
const resolveCourseIdFromModuleParam = (param) => async (req) =>
  fetchCourseIdByModule(req.params[param]);
const resolveCourseIdFromLessonParam = (param) => async (req) =>
  fetchCourseIdByLesson(req.params[param]);
const resolveCourseIdFromGroupParam = (param) => async (req) => {
  const group = await fetchGroupById(req.params[param]);
  return group?.course_id || null;
};

const requireCourseContentRole = (resolver) => requireCourseRoleAny(resolver, CONTENT_ROLES);
const requireCourseRoleOrAdmin = (resolver, roles = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      console.log(resolver)
      const resolved = await resolveCourseId(resolver, req);
      const courseId = typeof resolved === 'string' ? resolved : resolved?.courseId;
      if (!courseId) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const course = await ensureCourseExists(courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      if (hasGlobalRole(req.user, 'admin')) {
        req.courseContext = { ...(req.courseContext || {}), courseId: course.id, course };
        return next();
      }

      return requireCourseRoleAny(resolver, roles)(req, res, next);
    } catch (err) {
      console.error('Course role verification failed', err);
      return res.status(500).json({ error: 'Failed to verify course permissions' });
    }
  };
};
const requireCourseEnrollmentRole = (resolver) =>
  requireCourseRoleAny(resolver, ENROLLMENT_ROLES);

const fetchGroupById = async (groupId) => {
  const { rows } = await pool.query(
    'SELECT id, course_id, name FROM groups WHERE id = $1 LIMIT 1',
    [groupId],
  );
  return rows[0];
};

const removeStudentFromCourseGroups = (client, courseId, studentId) =>
  client.query(
    `
      DELETE FROM group_students gs
      USING groups g
      WHERE gs.group_id = g.id
        AND g.course_id = $1
        AND gs.user_id = $2
    `,
    [courseId, studentId],
  );

const toDateString = (value) => (value ? value.toISOString().split('T')[0] : null);
const toTimestampString = (value) => (value ? value.toISOString() : null);

const mapGroupRow = (row) => ({
  id: row.id,
  courseId: row.course_id,
  name: row.name,
  code: row.code,
  timezone: row.timezone,
  startDate: toDateString(row.start_date),
  endDate: toDateString(row.end_date),
  capacity: row.capacity,
  status: row.status,
  isActive: row.is_active,
  scheduleText: row.schedule_text || null,
  createdAt: toTimestampString(row.created_at),
  updatedAt: toTimestampString(row.updated_at),
  teachersCount: Number(row.teachers_count || 0),
});

const mapCoursePostRow = (row) => ({
  id: row.id,
  courseId: row.course_id,
  groupId: row.group_id || null,
  createdByUserId: row.created_by_user_id || null,
  title: row.title,
  body: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at || null,
});

const hasPostsCmsAccess = (user) =>
  hasGlobalRole(user, 'admin') ||
  hasGlobalRole(user, 'instructor') ||
  hasGlobalRole(user, 'content_editor');


let quizQuestionsHasQuizIdColumn = null;

const getQuizQuestionsHasQuizIdColumn = async () => {
  if (quizQuestionsHasQuizIdColumn !== null) return quizQuestionsHasQuizIdColumn;
  const { rows } = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'quiz_questions'
          AND column_name = 'quiz_id'
      ) AS exists
    `,
  );
  quizQuestionsHasQuizIdColumn = Boolean(rows[0]?.exists);
  return quizQuestionsHasQuizIdColumn;
};

const getQuizWithOptionsSelect = async () => {
  const hasQuizId = await getQuizQuestionsHasQuizIdColumn();
  return `
    SELECT
      qq.id AS question_id,
      qq.lesson_id,
      qq.question_text,
      qq.question_type,
      qq.order_index,
      ${hasQuizId ? 'qq.quiz_id' : 'NULL::uuid'} AS question_quiz_id,
      qq.points AS question_points,
      qq.explanation AS question_explanation,
      qq.meta AS question_meta,
      qo.id AS option_id,
      qo.option_text,
      qo.is_correct,
      qo.order_index AS option_order,
      qo.points AS option_points,
      qo.feedback AS option_feedback,
      qo.meta AS option_meta
    FROM quiz_questions qq
    LEFT JOIN quiz_options qo ON qo.question_id = qq.id
  `;
};

const mapQuizRowsToQuestions = (rows) => {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.question_id)) {
      map.set(row.question_id, {
        id: row.question_id,
        lessonId: row.lesson_id,
        questionText: row.question_text,
        questionType: row.question_type,
        orderIndex: row.order_index,
        options: [],
        points: row.question_points !== null ? Number(row.question_points) : 1,
        explanation: row.question_explanation || null,
        meta: row.question_meta || null,
        quizId: row.question_quiz_id || null,
      });
    }
    if (row.option_id) {
      map.get(row.question_id).options.push({
        id: row.option_id,
        optionText: row.option_text,
        isCorrect: row.is_correct,
        orderIndex: row.option_order,
        points: row.option_points !== null ? Number(row.option_points) : 0,
        feedback: row.option_feedback || null,
        meta: row.option_meta || null,
      });
    }
  }
  return Array.from(map.values());
};

const getQuizIdByLesson = async (lessonId) => {
  const { rows } = await pool.query(
    'SELECT id FROM quizzes WHERE lesson_id = $1 LIMIT 1',
    [lessonId],
  );
  return rows[0]?.id || null;
};

router.get('/courses', async (req, res) => {
  try {
    const isAdmin = hasGlobalRole(req.user, 'admin');
    let rows;
    if (isAdmin) {
      ({ rows } = await pool.query(
        `
          SELECT ${COURSE_SELECT}
          FROM courses c
          ${COURSE_LEVEL_JOIN}
          ORDER BY c.created_at DESC
        `,
      ));
    } else {
      ({ rows } = await pool.query(
        `
          SELECT DISTINCT ${COURSE_SELECT}
          FROM courses c
          ${COURSE_LEVEL_JOIN}
          LEFT JOIN course_user_roles cur
            ON cur.course_id = c.id AND cur.user_id = $1
          LEFT JOIN roles r ON r.id = cur.role_id
          WHERE c.owner_user_id = $1 OR r.name = ANY($2)
          ORDER BY c.created_at DESC
        `,
        [req.user.id, COURSE_STAFF_ROLES],
      ));
    }

    return res.json(rows);
  } catch (err) {
    console.error('Failed to list CMS courses', err);
    return res.status(500).json({ error: 'Failed to list courses' });
  }
});

router.get('/course-levels', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT id, code, label, is_active
        FROM course_levels
        ORDER BY code ASC
      `,
    );
    return res.json(rows);
  } catch (err) {
    console.error('Failed to list CMS course levels', err);
    return res.status(500).json({ error: 'Failed to load course levels' });
  }
});

router.get('/announcements', async (req, res) => {
  const isAdmin = hasGlobalRole(req.user, 'admin');
  const status = req.query.status ? String(req.query.status).trim() : null;
  const scope = req.query.scope ? String(req.query.scope).trim() : null;
  const courseId = req.query.courseId ? String(req.query.courseId).trim() : null;
  const groupId = req.query.groupId ? String(req.query.groupId).trim() : null;
  const pageRaw = Number.parseInt(req.query.page, 10);
  const pageSizeRaw = Number.parseInt(req.query.pageSize, 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(Math.max(pageSizeRaw, 1), 100)
    : 20;
  const offset = (page - 1) * pageSize;

  try {
    let editableCourseIds = [];
    if (!isAdmin) {
      const editableCourses = await pool.query(
        `
          SELECT id AS course_id
          FROM courses
          WHERE owner_user_id = $1
          UNION
          SELECT DISTINCT cur.course_id
          FROM course_user_roles cur
          JOIN roles r ON r.id = cur.role_id
          WHERE cur.user_id = $1
            AND r.name IN ('instructor', 'content_editor')
        `,
        [req.user.id],
      );
      editableCourseIds = editableCourses.rows.map((row) => row.course_id);

      if (scope === 'academy' || !editableCourseIds.length) {
        return res.json({
          data: [],
          page,
          pageSize,
          total: 0,
        });
      }
    }

    const whereParts = [];
    const params = [];
    const pushParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (status) {
      whereParts.push(`a.status = ${pushParam(status)}`);
    }
    if (scope) {
      whereParts.push(`a.scope = ${pushParam(scope)}`);
    }
    if (courseId) {
      whereParts.push(`a.course_id = ${pushParam(courseId)}`);
    }
    if (groupId) {
      whereParts.push(`a.group_id = ${pushParam(groupId)}`);
    }

    if (!isAdmin) {
      const editableCourseIdsParam = pushParam(editableCourseIds);
      whereParts.push(`
        (
          (a.scope = 'course' AND a.course_id = ANY(${editableCourseIdsParam}::uuid[]))
          OR
          (
            a.scope = 'group'
            AND EXISTS (
              SELECT 1
              FROM groups g
              WHERE g.id = a.group_id
                AND g.course_id = ANY(${editableCourseIdsParam}::uuid[])
            )
          )
        )
      `);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM announcements a
        ${whereClause}
      `,
      params,
    );

    const dataParams = [...params, pageSize, offset];
    const limitParam = `$${params.length + 1}`;
    const offsetParam = `$${params.length + 2}`;
    const dataResult = await pool.query(
      `
        SELECT
          a.id,
          a.scope,
          a.course_id,
          a.group_id,
          a.created_by_user_id,
          a.title,
          a.body,
          a.status,
          a.priority,
          a.starts_at,
          a.expires_at,
          a.created_at
        FROM announcements a
        ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT ${limitParam} OFFSET ${offsetParam}
      `,
      dataParams,
    );

    return res.json({
      data: dataResult.rows.map((row) => ({
        id: row.id,
        scope: row.scope,
        courseId: row.course_id || null,
        groupId: row.group_id || null,
        createdByUserId: row.created_by_user_id || null,
        title: row.title,
        body: row.body,
        status: row.status,
        priority: Number(row.priority),
        startsAt: row.starts_at || null,
        expiresAt: row.expires_at || null,
        createdAt: row.created_at,
      })),
      page,
      pageSize,
      total: Number(countResult.rows[0]?.total || 0),
    });
  } catch (err) {
    console.error('Failed to list CMS announcements', err);
    return res.status(500).json({ error: 'Failed to list announcements' });
  }
});

router.post('/announcements', async (req, res) => {
  const parsed = announcementCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  const isAdmin = hasGlobalRole(req.user, 'admin');
  const { scope, title, body } = parsed.data;
  let courseId = parsed.data.courseId || null;
  let groupId = parsed.data.groupId || null;
  const status = parsed.data.status || 'published';
  const priority = parsed.data.priority ?? 2;
  const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;

  try {
    if (scope === 'academy') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only admins can create academy announcements' });
      }
      courseId = null;
      groupId = null;
    }

    if (scope === 'course') {
      const course = await ensureCourseExists(courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      if (!isAdmin) {
        const allowed = await canEditCourse(courseId, req.user);
        if (!allowed) {
          return res.status(403).json({ error: 'You cannot create announcements for this course' });
        }
      }
      groupId = null;
    }

    if (scope === 'group') {
      const group = await fetchGroupById(groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      courseId = group.course_id;
      if (!isAdmin) {
        const allowed = await canEditCourse(courseId, req.user);
        if (!allowed) {
          return res.status(403).json({ error: 'You cannot create announcements for this group' });
        }
      }
    }

    const { rows } = await pool.query(
      `
        INSERT INTO announcements (
          scope,
          course_id,
          group_id,
          created_by_user_id,
          title,
          body,
          status,
          priority,
          starts_at,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING
          id,
          scope,
          course_id,
          group_id,
          created_by_user_id,
          title,
          body,
          status,
          priority,
          starts_at,
          expires_at,
          created_at
      `,
      [scope, courseId, groupId, req.user.id, title, body, status, priority, startsAt, expiresAt],
    );

    const announcement = rows[0];
    return res.status(201).json({
      id: announcement.id,
      scope: announcement.scope,
      courseId: announcement.course_id || null,
      groupId: announcement.group_id || null,
      createdByUserId: announcement.created_by_user_id || null,
      title: announcement.title,
      body: announcement.body,
      status: announcement.status,
      priority: Number(announcement.priority),
      startsAt: announcement.starts_at || null,
      expiresAt: announcement.expires_at || null,
      createdAt: announcement.created_at,
    });
  } catch (err) {
    console.error('Failed to create announcement', err);
    return res.status(500).json({ error: 'Failed to create announcement' });
  }
});

router.patch('/announcements/:id', async (req, res) => {
  const parsedId = uuidSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ error: formatZodError(parsedId.error) });
  }

  const parsed = announcementUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }
  const announcementId = parsedId.data;
  const isAdmin = hasGlobalRole(req.user, 'admin');

  try {
    const updatedAtColumnCheck = await pool.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'announcements'
            AND column_name = 'updated_at'
        ) AS exists
      `,
    );
    const hasUpdatedAtColumn = Boolean(updatedAtColumnCheck.rows[0]?.exists);

    const existingResult = await pool.query(
      `
        SELECT
          id,
          scope,
          course_id,
          group_id,
          title,
          body,
          status,
          priority,
          starts_at,
          expires_at,
          created_by_user_id,
          created_at
        FROM announcements
        WHERE id = $1
        LIMIT 1
      `,
      [announcementId],
    );

    if (!existingResult.rows.length) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const existing = existingResult.rows[0];

    if (!isAdmin) {
      if (existing.scope === 'academy') {
        return res.status(403).json({ error: 'You cannot edit academy announcements' });
      }

      if (existing.scope === 'course') {
        const allowed = await canEditCourse(existing.course_id, req.user);
        if (!allowed) {
          return res.status(403).json({ error: 'You cannot edit this announcement' });
        }
      }

      if (existing.scope === 'group') {
        const groupResult = await pool.query(
          `
            SELECT course_id
            FROM groups
            WHERE id = $1
            LIMIT 1
          `,
          [existing.group_id],
        );
        if (!groupResult.rows.length) {
          return res.status(404).json({ error: 'Group not found' });
        }
        const allowed = await canEditCourse(groupResult.rows[0].course_id, req.user);
        if (!allowed) {
          return res.status(403).json({ error: 'You cannot edit this announcement' });
        }
      }
    }

    const hasScope = Object.prototype.hasOwnProperty.call(parsed.data, 'scope');
    const hasCourseId = Object.prototype.hasOwnProperty.call(parsed.data, 'courseId');
    const hasGroupId = Object.prototype.hasOwnProperty.call(parsed.data, 'groupId');
    const hasStartsAt = Object.prototype.hasOwnProperty.call(parsed.data, 'startsAt');
    const hasExpiresAt = Object.prototype.hasOwnProperty.call(parsed.data, 'expiresAt');

    const targetScope = hasScope ? parsed.data.scope : existing.scope;
    let targetCourseId = existing.course_id;
    let targetGroupId = existing.group_id;
    let resolvedGroup = null;

    if (targetScope === 'academy') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only admins can edit academy announcements' });
      }
      if (hasCourseId && parsed.data.courseId !== null) {
        return res.status(400).json({ error: 'courseId must be empty for academy scope' });
      }
      if (hasGroupId && parsed.data.groupId !== null) {
        return res.status(400).json({ error: 'groupId must be empty for academy scope' });
      }
      targetCourseId = null;
      targetGroupId = null;
    }

    if (targetScope === 'course') {
      if (hasGroupId && parsed.data.groupId !== null) {
        return res.status(400).json({ error: 'groupId must be empty for course scope' });
      }
      targetCourseId = hasCourseId ? parsed.data.courseId : existing.course_id;
      if (!targetCourseId) {
        return res.status(400).json({ error: 'courseId is required for course scope' });
      }
      targetGroupId = null;

      const course = await ensureCourseExists(targetCourseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }
      if (!isAdmin) {
        const allowed = await canEditCourse(targetCourseId, req.user);
        if (!allowed) {
          return res.status(403).json({ error: 'You cannot edit this announcement target' });
        }
      }
    }

    if (targetScope === 'group') {
      targetGroupId = hasGroupId ? parsed.data.groupId : existing.group_id;
      if (!targetGroupId) {
        return res.status(400).json({ error: 'groupId is required for group scope' });
      }

      resolvedGroup = await fetchGroupById(targetGroupId);
      if (!resolvedGroup) {
        return res.status(404).json({ error: 'Group not found' });
      }
      targetCourseId = resolvedGroup.course_id;

      if (!isAdmin) {
        const allowed = await canEditCourse(targetCourseId, req.user);
        if (!allowed) {
          return res.status(403).json({ error: 'You cannot edit this announcement target' });
        }
      }
    }

    const finalStartsAt = hasStartsAt
      ? (parsed.data.startsAt === null ? null : new Date(parsed.data.startsAt))
      : existing.starts_at;
    const finalExpiresAt = hasExpiresAt
      ? (parsed.data.expiresAt === null ? null : new Date(parsed.data.expiresAt))
      : existing.expires_at;

    if (finalStartsAt && finalExpiresAt && new Date(finalExpiresAt) <= new Date(finalStartsAt)) {
      return res.status(400).json({ error: 'expiresAt must be later than startsAt' });
    }

    const updates = [];
    const values = [];
    const addUpdate = (column, value) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if (Object.prototype.hasOwnProperty.call(parsed.data, 'title')) {
      addUpdate('title', parsed.data.title);
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, 'body')) {
      addUpdate('body', parsed.data.body);
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, 'status')) {
      addUpdate('status', parsed.data.status);
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, 'priority')) {
      addUpdate('priority', parsed.data.priority);
    }
    if (targetScope !== existing.scope) {
      addUpdate('scope', targetScope);
    }
    if (targetCourseId !== existing.course_id) {
      addUpdate('course_id', targetCourseId);
    }
    if (targetGroupId !== existing.group_id) {
      addUpdate('group_id', targetGroupId);
    }
    if (hasStartsAt) {
      addUpdate('starts_at', finalStartsAt);
    }
    if (hasExpiresAt) {
      addUpdate('expires_at', finalExpiresAt);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    if (hasUpdatedAtColumn) {
      updates.push('updated_at = now()');
    }

    values.push(announcementId);
    const { rows } = await pool.query(
      `
        UPDATE announcements
        SET ${updates.join(', ')}
        WHERE id = $${values.length}
        RETURNING
          id,
          scope,
          course_id,
          group_id,
          created_by_user_id,
          title,
          body,
          status,
          priority,
          starts_at,
          expires_at,
          created_at,
          ${hasUpdatedAtColumn ? 'updated_at' : 'NULL::timestamptz AS updated_at'}
      `,
      values,
    );

    const updated = rows[0];
    return res.json({
      id: updated.id,
      scope: updated.scope,
      courseId: updated.course_id || null,
      groupId: updated.group_id || null,
      createdByUserId: updated.created_by_user_id || null,
      title: updated.title,
      body: updated.body,
      status: updated.status,
      priority: Number(updated.priority),
      startsAt: updated.starts_at || null,
      expiresAt: updated.expires_at || null,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at || null,
    });
  } catch (err) {
    console.error('Failed to update announcement', err);
    return res.status(500).json({ error: 'Failed to update announcement' });
  }
});

router.delete('/announcements/:id', async (req, res) => {
  const parsedId = uuidSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ error: formatZodError(parsedId.error) });
  }

  const announcementId = parsedId.data;
  const isAdmin = hasGlobalRole(req.user, 'admin');

  try {
    const existingResult = await pool.query(
      `
        SELECT id, scope, course_id, group_id
        FROM announcements
        WHERE id = $1
        LIMIT 1
      `,
      [announcementId],
    );

    if (!existingResult.rows.length) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const existing = existingResult.rows[0];

    if (!isAdmin) {
      if (existing.scope === 'academy') {
        return res.status(403).json({ error: 'You cannot delete academy announcements' });
      }

      if (existing.scope === 'course') {
        const allowed = await canEditCourse(existing.course_id, req.user);
        if (!allowed) {
          return res.status(403).json({ error: 'You cannot delete this announcement' });
        }
      }

      if (existing.scope === 'group') {
        const group = await fetchGroupById(existing.group_id);
        if (!group) {
          return res.status(404).json({ error: 'Group not found' });
        }
        const allowed = await canEditCourse(group.course_id, req.user);
        if (!allowed) {
          return res.status(403).json({ error: 'You cannot delete this announcement' });
        }
      }
    }

    await pool.query(
      `
        DELETE FROM announcements
        WHERE id = $1
      `,
      [announcementId],
    );

    return res.status(204).send();
  } catch (err) {
    console.error('Failed to delete announcement', err);
    return res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

router.get('/courses/:courseId/posts', async (req, res) => {
  const parsedCourseId = uuidSchema.safeParse(req.params.courseId);
  if (!parsedCourseId.success) {
    return res.status(400).json({ error: formatZodError(parsedCourseId.error) });
  }

  if (!hasPostsCmsAccess(req.user)) {
    return res.status(403).json({ error: 'You cannot manage course posts' });
  }

  const courseId = parsedCourseId.data;
  const parsedGroupId = req.query.groupId ? uuidSchema.safeParse(String(req.query.groupId)) : null;
  if (parsedGroupId && !parsedGroupId.success) {
    return res.status(400).json({ error: formatZodError(parsedGroupId.error) });
  }
  const groupId = parsedGroupId?.data || null;

  const pageRaw = Number.parseInt(req.query.page, 10);
  const pageSizeRaw = Number.parseInt(req.query.pageSize, 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(pageSizeRaw, 1), 100) : 20;
  const offset = (page - 1) * pageSize;
  const isAdmin = hasGlobalRole(req.user, 'admin');

  try {
    const course = await ensureCourseExists(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (!isAdmin) {
      const allowed = await canEditCourse(courseId, req.user);
      if (!allowed) {
        return res.status(403).json({ error: 'You cannot view posts for this course' });
      }
    }

    const where = ['cp.course_id = $1'];
    const params = [courseId];
    if (groupId) {
      params.push(groupId);
      where.push(`cp.group_id = $${params.length}`);
    }
    const whereClause = `WHERE ${where.join(' AND ')}`;

    const totalResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM course_posts cp
        ${whereClause}
      `,
      params,
    );

    const listParams = [...params, pageSize, offset];
    const listResult = await pool.query(
      `
        SELECT
          cp.id,
          cp.course_id,
          cp.group_id,
          cp.created_by_user_id,
          cp.title,
          cp.body,
          cp.created_at,
          cp.updated_at
        FROM course_posts cp
        ${whereClause}
        ORDER BY cp.created_at DESC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `,
      listParams,
    );

    return res.json({
      data: listResult.rows.map(mapCoursePostRow),
      page,
      pageSize,
      total: Number(totalResult.rows[0]?.total || 0),
    });
  } catch (err) {
    console.error('Failed to list course posts', err);
    return res.status(500).json({ error: 'Failed to list course posts' });
  }
});

router.post('/courses/:courseId/posts', async (req, res) => {
  const parsedCourseId = uuidSchema.safeParse(req.params.courseId);
  if (!parsedCourseId.success) {
    return res.status(400).json({ error: formatZodError(parsedCourseId.error) });
  }
  if (!hasPostsCmsAccess(req.user)) {
    return res.status(403).json({ error: 'You cannot create course posts' });
  }

  const parsed = coursePostCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  const courseId = parsedCourseId.data;
  const isAdmin = hasGlobalRole(req.user, 'admin');
  let groupId = null;

  try {
    const course = await ensureCourseExists(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (!isAdmin) {
      const allowed = await canEditCourse(courseId, req.user);
      if (!allowed) {
        return res.status(403).json({ error: 'You cannot create posts for this course' });
      }
    }

    if (parsed.data.target === 'group') {
      const group = await fetchGroupById(parsed.data.groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      if (group.course_id !== courseId) {
        return res.status(400).json({ error: 'Group must belong to the course' });
      }
      groupId = group.id;
    }

    const { rows } = await pool.query(
      `
        INSERT INTO course_posts (
          course_id,
          group_id,
          created_by_user_id,
          title,
          body
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          course_id,
          group_id,
          created_by_user_id,
          title,
          body,
          created_at,
          updated_at
      `,
      [courseId, groupId, req.user.id, parsed.data.title, parsed.data.body],
    );

    return res.status(201).json(mapCoursePostRow(rows[0]));
  } catch (err) {
    console.error('Failed to create course post', err);
    return res.status(500).json({ error: 'Failed to create course post' });
  }
});

router.put('/posts/:id', async (req, res) => {
  const parsedId = uuidSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ error: formatZodError(parsedId.error) });
  }
  if (!hasPostsCmsAccess(req.user)) {
    return res.status(403).json({ error: 'You cannot edit course posts' });
  }

  const parsed = coursePostUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  const postId = parsedId.data;
  const isAdmin = hasGlobalRole(req.user, 'admin');

  try {
    const existingResult = await pool.query(
      `
        SELECT
          id,
          course_id,
          group_id,
          title,
          body,
          created_by_user_id,
          created_at,
          updated_at
        FROM course_posts
        WHERE id = $1
        LIMIT 1
      `,
      [postId],
    );

    if (!existingResult.rows.length) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const existing = existingResult.rows[0];
    if (!isAdmin) {
      const allowed = await canEditCourse(existing.course_id, req.user);
      if (!allowed) {
        return res.status(403).json({ error: 'You cannot edit this post' });
      }
    }

    const hasTarget = Object.prototype.hasOwnProperty.call(parsed.data, 'target');
    const hasGroupId = Object.prototype.hasOwnProperty.call(parsed.data, 'groupId');
    let nextGroupId = existing.group_id;
    const target = hasTarget ? parsed.data.target : existing.group_id ? 'group' : 'course';

    if (target === 'course') {
      if (hasGroupId && parsed.data.groupId) {
        return res.status(400).json({ error: 'groupId must be empty for course target' });
      }
      nextGroupId = null;
    } else {
      const candidateGroupId = hasGroupId ? parsed.data.groupId : existing.group_id;
      if (!candidateGroupId) {
        return res.status(400).json({ error: 'groupId is required for group target' });
      }
      const group = await fetchGroupById(candidateGroupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      if (group.course_id !== existing.course_id) {
        return res.status(400).json({ error: 'Group must belong to the post course' });
      }
      nextGroupId = group.id;
    }

    const updates = [];
    const values = [];
    const pushUpdate = (column, value) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if (Object.prototype.hasOwnProperty.call(parsed.data, 'title')) {
      pushUpdate('title', parsed.data.title);
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, 'body')) {
      pushUpdate('body', parsed.data.body);
    }
    if (nextGroupId !== existing.group_id) {
      pushUpdate('group_id', nextGroupId);
    }
    updates.push('updated_at = now()');

    values.push(postId);
    const { rows } = await pool.query(
      `
        UPDATE course_posts
        SET ${updates.join(', ')}
        WHERE id = $${values.length}
        RETURNING
          id,
          course_id,
          group_id,
          created_by_user_id,
          title,
          body,
          created_at,
          updated_at
      `,
      values,
    );

    return res.json(mapCoursePostRow(rows[0]));
  } catch (err) {
    console.error('Failed to update course post', err);
    return res.status(500).json({ error: 'Failed to update course post' });
  }
});

router.post('/courses', async (req, res) => {
  const parsed = courseCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  try {
    const isAdmin = hasGlobalRole(req.user, 'admin');
    const ownerUserId = isAdmin ? parsed.data.ownerUserId || null : req.user.id;
    const levelId = await resolveLevelId(parsed.data.level);

    const { rows } = await pool.query(
      `
        INSERT INTO courses (title, description, level_id, owner_user_id, is_published)
        VALUES ($1, $2, $3, $4, false)
        RETURNING id
      `,
      [parsed.data.title, parsed.data.description || null, levelId, ownerUserId],
    );
    if (!rows.length) {
      throw new Error('Failed to return created course');
    }
    const course = await fetchCourseById(rows[0].id);
    return res.status(201).json(course);
  } catch (err) {
    console.error('Failed to create course', err);
    return res.status(500).json({ error: 'Failed to create course' });
  }
});

router.patch(
  '/courses/:id',
  requireCourseContentRole(resolveCourseIdFromParam('id')),
  async (req, res) => {
  const courseId = req.params.id;
  const parsed = courseUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  try {
    const updates = [];
    const values = [];

    if (parsed.data.title !== undefined) {
      values.push(parsed.data.title);
      updates.push(`title = $${values.length}`);
    }
    if (parsed.data.description !== undefined) {
      values.push(parsed.data.description);
      updates.push(`description = $${values.length}`);
    }
    if (parsed.data.level !== undefined) {
      const levelId = await resolveLevelId(parsed.data.level);
      if (!levelId) {
        return res.status(400).json({ error: 'Invalid level code' });
      }
      values.push(levelId);
      updates.push(`level_id = $${values.length}`);
    }

    if (hasGlobalRole(req.user, 'admin') && parsed.data.ownerUserId !== undefined) {
      values.push(parsed.data.ownerUserId);
      updates.push(`owner_user_id = $${values.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const query = `
      UPDATE courses
      SET ${updates.join(', ')}, updated_at = now()
      WHERE id = $${values.length + 1}
      RETURNING id
    `;
    values.push(courseId);

    const { rows } = await pool.query(query, values);
    if (!rows.length) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const course = await fetchCourseById(courseId);
    return res.json(course);
  } catch (err) {
    console.error('Failed to update course', err);
    return res.status(500).json({ error: 'Failed to update course' });
  }
});

const toggleCoursePublish = async (req, res, isPublished) => {
  const courseId = req.params.id;
  try {
    const { rows } = await pool.query(
      `
        UPDATE courses
        SET
          is_published = $2,
          published_at = CASE WHEN $2 THEN now() ELSE NULL END,
          updated_at = now()
        WHERE id = $1
        RETURNING id, title, is_published, published_at, updated_at
      `,
      [courseId, isPublished],
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Course not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Failed to toggle course publish state', err);
    return res.status(500).json({ error: 'Failed to update course publish state' });
  }
};

router.post(
  '/courses/:id/publish',
  requireCourseContentRole(resolveCourseIdFromParam('id')),
  (req, res) => toggleCoursePublish(req, res, true),
);
router.post(
  '/courses/:id/unpublish',
  requireCourseContentRole(resolveCourseIdFromParam('id')),
  (req, res) => toggleCoursePublish(req, res, false),
);

router.delete(
  '/courses/:id',
  requireCourseContentRole(resolveCourseIdFromParam('id')),
  async (req, res) => {
    const courseId = req.params.id;
    try {
      const { rows } = await pool.query(
        `
          DELETE FROM courses
          WHERE id = $1
          RETURNING id
        `,
        [courseId],
      );
      if (!rows.length) {
        return res.status(404).json({ error: 'Course not found' });
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete course', err);
      return res.status(500).json({ error: 'Failed to delete course' });
    }
  },
);

router.post('/courses/:id/instructors', async (req, res) => {
  if (!hasGlobalRole(req.user, 'admin')) {
    return res.status(403).json({ error: 'Only admins can assign instructors' });
  }
  const courseId = req.params.id;
  const parsed = instructorAssignSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  const instructorIds = parsed.data.instructorIds || [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const roleRes = await client.query(
      `
        SELECT id
        FROM roles
        WHERE name = 'instructor'
        LIMIT 1
      `,
    );
    const instructorRoleId = roleRes.rows[0]?.id;
    if (!instructorRoleId) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Instructor role not configured' });
    }

    const courseCheck = await client.query('SELECT 1 FROM courses WHERE id = $1 LIMIT 1', [courseId]);
    if (!courseCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Course not found' });
    }

    if (instructorIds.length) {
      const { rows } = await client.query(
        `
          SELECT DISTINCT ur.user_id
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = ANY($1::uuid[])
            AND r.name = 'instructor'
        `,
        [instructorIds],
      );
      if (rows.length !== instructorIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'One or more users are not instructors' });
      }
    }

    await client.query(
      'DELETE FROM course_user_roles WHERE course_id = $1 AND role_id = $2',
      [courseId, instructorRoleId],
    );

    if (instructorIds.length) {
      const values = [];
      const placeholders = [];
      instructorIds.forEach((instructorId, index) => {
        const offset = index * 3;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
        values.push(courseId, instructorId, instructorRoleId);
      });
      await client.query(
        `
          INSERT INTO course_user_roles (course_id, user_id, role_id)
          VALUES ${placeholders.join(', ')}
          ON CONFLICT DO NOTHING
        `,
        values,
      );
    }

    await client.query('COMMIT');
    return res.json({ courseId, instructorIds });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to assign instructors', err);
    return res.status(500).json({ error: 'Failed to assign instructors' });
  } finally {
    client.release();
  }
});

router.get(
  '/courses/:courseId/modules',
  requireCourseContentRole(resolveCourseIdFromParam('courseId')),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
    try {
    const { rows } = await pool.query(
      `
        SELECT id, course_id, title, position, order_index, is_published, published_at, created_at, updated_at
        FROM modules
        WHERE course_id = $1
        ORDER BY order_index ASC
      `,
      [courseId],
    );
      return res.json(rows);
    } catch (err) {
      console.error('Failed to list modules', err);
      return res.status(500).json({ error: 'Failed to list modules' });
    }
  },
);

router.post(
  '/courses/:courseId/modules',
  requireCourseContentRole(resolveCourseIdFromParam('courseId')),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
  const parsed = moduleCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  try {
    let orderIndex = parsed.data.orderIndex;
    if (!orderIndex) {
      const { rows } = await pool.query(
        'SELECT COALESCE(MAX(order_index), 0) + 1 AS next FROM modules WHERE course_id = $1',
        [courseId],
      );
      orderIndex = rows[0].next;
    }

    const { rows } = await pool.query(
      `
        INSERT INTO modules (course_id, title, position, order_index, is_published)
        VALUES ($1, $2, $3, $4, false)
        RETURNING id, course_id, title, position, order_index, is_published, published_at, created_at, updated_at
      `,
      [courseId, parsed.data.title, orderIndex, orderIndex],
    );
      return res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Failed to create module', err);
      return res.status(500).json({ error: 'Failed to create module' });
    }
  },
);

router.patch(
  '/modules/:id',
  requireCourseContentRole(resolveCourseIdFromModuleParam('id')),
  async (req, res) => {
    const moduleId = req.params.id;
  const parsed = moduleUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }
  try {
    const updates = [];
    const values = [];
    if (parsed.data.title !== undefined) {
      values.push(parsed.data.title);
      updates.push(`title = $${values.length}`);
    }
    if (parsed.data.orderIndex !== undefined) {
      values.push(parsed.data.orderIndex);
      updates.push(`order_index = $${values.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const query = `
      UPDATE modules
      SET ${updates.join(', ')}, updated_at = now()
      WHERE id = $${values.length + 1}
      RETURNING id, course_id, title, order_index, is_published, published_at, created_at, updated_at
    `;
    values.push(moduleId);

    const { rows } = await pool.query(query, values);
    if (!rows.length) {
      return res.status(404).json({ error: 'Module not found' });
    }
      return res.json(rows[0]);
    } catch (err) {
      console.error('Failed to update module', err);
      return res.status(500).json({ error: 'Failed to update module' });
    }
  },
);

const toggleModulePublish = async (req, res, isPublished) => {
  const moduleId = req.params.id;
  try {
    const { rows } = await pool.query(
      `
        UPDATE modules
        SET
          is_published = $2,
          published_at = CASE WHEN $2 THEN now() ELSE NULL END,
          updated_at = now()
        WHERE id = $1
        RETURNING id, is_published, published_at, updated_at
      `,
      [moduleId, isPublished],
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Module not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Failed to toggle module publish state', err);
    return res.status(500).json({ error: 'Failed to update module publish state' });
  }
};

router.post(
  '/modules/:id/publish',
  requireCourseContentRole(resolveCourseIdFromModuleParam('id')),
  (req, res) => toggleModulePublish(req, res, true),
);
router.post(
  '/modules/:id/unpublish',
  requireCourseContentRole(resolveCourseIdFromModuleParam('id')),
  (req, res) => toggleModulePublish(req, res, false),
);

router.get(
  '/modules/:moduleId/lessons',
  requireCourseContentRole(resolveCourseIdFromModuleParam('moduleId')),
  async (req, res) => {
    const moduleId = req.params.moduleId;
    try {
    const { rows } = await pool.query(
      `
        SELECT id, module_id, title, content_text, content_markdown, content_html, video_url, estimated_minutes, order_index, is_published, published_at, created_at, updated_at
        FROM lessons
        WHERE module_id = $1
        ORDER BY order_index ASC
      `,
      [moduleId],
    );
      return res.json(rows);
    } catch (err) {
      console.error('Failed to list lessons', err);
      return res.status(500).json({ error: 'Failed to list lessons' });
    }
  },
);

router.post(
  '/modules/:moduleId/lessons',
  requireCourseContentRole(resolveCourseIdFromModuleParam('moduleId')),
  async (req, res) => {
    const moduleId = req.params.moduleId;
  const parsed = lessonCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }
  try {
    let orderIndex = parsed.data.orderIndex;
    if (!orderIndex) {
      const { rows } = await pool.query(
        'SELECT COALESCE(MAX(order_index), 0) + 1 AS next FROM lessons WHERE module_id = $1',
        [moduleId],
      );
      orderIndex = rows[0].next;
    }

    const htmlContent =
      parsed.data.contentHtml || parsed.data.contentMarkdown || parsed.data.contentText || null;
    const { rows } = await pool.query(
      `
        INSERT INTO lessons (module_id, title, content_text, content_markdown, content_html, video_url, estimated_minutes, position, order_index, is_published)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
        RETURNING id, module_id, title, content_text, content_markdown, content_html, video_url, estimated_minutes, order_index, is_published, published_at, created_at, updated_at
      `,
      [
        moduleId,
        parsed.data.title,
        parsed.data.contentText || null,
        parsed.data.contentMarkdown || parsed.data.contentText || null,
        htmlContent,
        parsed.data.videoUrl || null,
        parsed.data.estimatedMinutes || null,
        orderIndex,
        orderIndex,
      ],
    );
      return res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Failed to create lesson', err);
      return res.status(500).json({ error: 'Failed to create lesson' });
    }
  },
);

router.patch(
  '/lessons/:id',
  requireCourseContentRole(resolveCourseIdFromLessonParam('id')),
  async (req, res) => {
    const lessonId = req.params.id;
  const parsed = lessonUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }
  try {
    const updates = [];
    const values = [];
    if (parsed.data.title !== undefined) {
      values.push(parsed.data.title);
      updates.push(`title = $${values.length}`);
    }
    if (parsed.data.contentText !== undefined) {
      values.push(parsed.data.contentText);
      updates.push(`content_text = $${values.length}`);
    }
    if (parsed.data.contentMarkdown !== undefined) {
      values.push(parsed.data.contentMarkdown);
      updates.push(`content_markdown = $${values.length}`);
    }
    if (parsed.data.contentHtml !== undefined) {
      values.push(parsed.data.contentHtml);
      updates.push(`content_html = $${values.length}`);
    }
    if (parsed.data.videoUrl !== undefined) {
      values.push(parsed.data.videoUrl);
      updates.push(`video_url = $${values.length}`);
    }
    if (parsed.data.estimatedMinutes !== undefined) {
      values.push(parsed.data.estimatedMinutes);
      updates.push(`estimated_minutes = $${values.length}`);
    }
    if (parsed.data.orderIndex !== undefined) {
      values.push(parsed.data.orderIndex);
      updates.push(`order_index = $${values.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const query = `
      UPDATE lessons
      SET ${updates.join(', ')}, updated_at = now()
      WHERE id = $${values.length + 1}
      RETURNING id, module_id, title, content_text, content_markdown, content_html, video_url, estimated_minutes, order_index, is_published, published_at, created_at, updated_at
    `;
    values.push(lessonId);

    const { rows } = await pool.query(query, values);
    if (!rows.length) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
      return res.json(rows[0]);
    } catch (err) {
      console.error('Failed to update lesson', err);
      return res.status(500).json({ error: 'Failed to update lesson' });
    }
  },
);

const toggleLessonPublish = async (req, res, isPublished) => {
  const lessonId = req.params.id;
  try {
    const { rows } = await pool.query(
      `
        UPDATE lessons
        SET
          is_published = $2,
          published_at = CASE WHEN $2 THEN now() ELSE NULL END,
          updated_at = now()
        WHERE id = $1
        RETURNING id, is_published, published_at, updated_at
      `,
      [lessonId, isPublished],
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Failed to toggle lesson publish state', err);
    return res.status(500).json({ error: 'Failed to update lesson publish state' });
  }
};

router.post(
  '/lessons/:id/publish',
  requireCourseContentRole(resolveCourseIdFromLessonParam('id')),
  (req, res) => toggleLessonPublish(req, res, true),
);
router.post(
  '/lessons/:id/unpublish',
  requireCourseContentRole(resolveCourseIdFromLessonParam('id')),
  (req, res) => toggleLessonPublish(req, res, false),
);

router.delete(
  '/lessons/:id',
  requireCourseContentRole(resolveCourseIdFromLessonParam('id')),
  async (req, res) => {
    const lessonId = req.params.id;
    try {
      const { rows } = await pool.query(
        `
          DELETE FROM lessons
          WHERE id = $1
          RETURNING id
        `,
        [lessonId],
      );
      if (!rows.length) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete lesson', err);
      return res.status(500).json({ error: 'Failed to delete lesson' });
    }
  },
);

router.get(
  '/lessons/:lessonId/quiz',
  requireCourseContentRole(resolveCourseIdFromLessonParam('lessonId')),
  async (req, res) => {
    const lessonId = req.params.lessonId;
    try {
      const quizWithOptionsSelect = await getQuizWithOptionsSelect();
      const { rows } = await pool.query(
        `
          ${quizWithOptionsSelect}
          WHERE qq.lesson_id = $1
          ORDER BY qq.order_index ASC, qo.order_index ASC
        `,
        [lessonId],
      );

      return res.json({
        lessonId,
        questions: mapQuizRowsToQuestions(rows),
      });
    } catch (err) {
      console.error('Failed to load lesson quiz', err);
      return res.status(500).json({ error: 'Failed to load quiz' });
    }
  },
);

router.post('/lessons/:lessonId/quiz/questions', async (req, res) => {
  const lessonId = req.params.lessonId;
  const parsed = quizQuestionCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  try {
    const courseId = await fetchCourseIdByLesson(lessonId);
    if (!courseId) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    const allowed = await canEditCourse(courseId, req.user);
    if (!allowed) {
      return res.status(403).json({ error: 'You cannot edit this course' });
    }

    let orderIndex = parsed.data.orderIndex;
    if (!orderIndex) {
      const { rows } = await pool.query(
        'SELECT COALESCE(MAX(order_index), 0) + 1 AS next FROM quiz_questions WHERE lesson_id = $1',
        [lessonId],
      );
      orderIndex = rows[0].next;
    }

    const questionType = parsed.data.questionType || 'single_choice';
    const explicitQuizId = parsed.data.quizId;
    const lessonQuizId = explicitQuizId || (await getQuizIdByLesson(lessonId));
    const hasQuizIdColumn = await getQuizQuestionsHasQuizIdColumn();

    const columns = ['lesson_id', 'question_text', 'question_type', 'order_index'];
    const values = [lessonId, parsed.data.questionText, questionType, orderIndex];
    if (lessonQuizId && hasQuizIdColumn) {
      columns.push('quiz_id');
      values.push(lessonQuizId);
    }
    if (parsed.data.points !== undefined) {
      columns.push('points');
      values.push(parsed.data.points);
    }
    if (parsed.data.explanation !== undefined) {
      columns.push('explanation');
      values.push(parsed.data.explanation);
    }
    if (parsed.data.meta !== undefined) {
      columns.push('meta');
      values.push(parsed.data.meta);
    }

    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const insertRes = await pool.query(
      `
        INSERT INTO quiz_questions (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING id
      `,
      values,
    );
    const questionId = insertRes.rows[0].id;

    if (questionType === 'true_false') {
      await pool.query(
        `
          INSERT INTO quiz_options (question_id, option_text, is_correct, order_index)
            VALUES
            ($1, 'True', false, 1),
            ($1, 'False', false, 2)
        `,
        [questionId],
      );
    }

    const quizWithOptionsSelect = await getQuizWithOptionsSelect();
    const questionRows = await pool.query(
      `
        ${quizWithOptionsSelect}
        WHERE qq.id = $1
        ORDER BY qq.order_index ASC, qo.order_index ASC
      `,
      [questionId],
    );

    return res.status(201).json(mapQuizRowsToQuestions(questionRows.rows)[0]);
  } catch (err) {
    console.error('Failed to create quiz question', err);
    return res.status(500).json({ error: 'Failed to create quiz question' });
  }
});

router.patch('/quiz/questions/:id', async (req, res) => {
  const questionId = req.params.id;
  const parsed = quizQuestionUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  try {
    const questionRes = await pool.query(
      `
        SELECT qq.id, qq.lesson_id, qq.question_type, m.course_id
        FROM quiz_questions qq
        JOIN lessons l ON l.id = qq.lesson_id
        JOIN modules m ON m.id = l.module_id
        WHERE qq.id = $1
        LIMIT 1
      `,
      [questionId],
    );
    const question = questionRes.rows[0];
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const allowed = await canEditCourse(question.course_id, req.user);
    if (!allowed) {
      return res.status(403).json({ error: 'You cannot edit this course' });
    }

    const updates = [];
    const values = [];
    if (parsed.data.questionText !== undefined) {
      values.push(parsed.data.questionText);
      updates.push(`question_text = $${values.length}`);
    }
    if (parsed.data.questionType !== undefined) {
      values.push(parsed.data.questionType);
      updates.push(`question_type = $${values.length}`);
    }
    if (parsed.data.orderIndex !== undefined) {
      values.push(parsed.data.orderIndex);
      updates.push(`order_index = $${values.length}`);
    }
    if (parsed.data.points !== undefined) {
      values.push(parsed.data.points);
      updates.push(`points = $${values.length}`);
    }
    if (parsed.data.explanation !== undefined) {
      values.push(parsed.data.explanation);
      updates.push(`explanation = $${values.length}`);
    }
    if (parsed.data.meta !== undefined) {
      values.push(parsed.data.meta);
      updates.push(`meta = $${values.length}`);
    }
    if (parsed.data.quizId !== undefined && (await getQuizQuestionsHasQuizIdColumn())) {
      values.push(parsed.data.quizId);
      updates.push(`quiz_id = $${values.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const updateRes = await pool.query(
      `
        UPDATE quiz_questions
        SET ${updates.join(', ')}, updated_at = now()
        WHERE id = $${values.length + 1}
        RETURNING id
      `,
      [...values, questionId],
    );
    if (!updateRes.rows.length) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const finalType = parsed.data.questionType || question.question_type;
    if (finalType === 'true_false') {
      await pool.query('DELETE FROM quiz_options WHERE question_id = $1', [questionId]);
      await pool.query(
        `
          INSERT INTO quiz_options (question_id, option_text, is_correct, order_index)
            VALUES
            ($1, 'True', false, 1),
            ($1, 'False', false, 2)
        `,
        [questionId],
      );
    } else if (['short_text', 'long_text', 'numeric'].includes(finalType)) {
      // Text/numeric questions do not use options, so remove any stale ones after the type change.
      await pool.query('DELETE FROM quiz_options WHERE question_id = $1', [questionId]);
    }

    const quizWithOptionsSelect = await getQuizWithOptionsSelect();
    const questionRows = await pool.query(
      `
        ${quizWithOptionsSelect}
        WHERE qq.id = $1
        ORDER BY qq.order_index ASC, qo.order_index ASC
      `,
      [questionId],
    );

    return res.json(mapQuizRowsToQuestions(questionRows.rows)[0]);
  } catch (err) {
    console.error('Failed to update quiz question', err);
    return res.status(500).json({ error: 'Failed to update quiz question' });
  }
});

router.delete('/quiz/questions/:id', async (req, res) => {
  const questionId = req.params.id;
  try {
    const questionRes = await pool.query(
      `
        SELECT qq.lesson_id, m.course_id
        FROM quiz_questions qq
        JOIN lessons l ON l.id = qq.lesson_id
        JOIN modules m ON m.id = l.module_id
        WHERE qq.id = $1
        LIMIT 1
      `,
      [questionId],
    );
    const question = questionRes.rows[0];
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const allowed = await canEditCourse(question.course_id, req.user);
    if (!allowed) {
      return res.status(403).json({ error: 'You cannot edit this course' });
    }

    await pool.query('DELETE FROM quiz_questions WHERE id = $1', [questionId]);
    return res.json({ id: questionId });
  } catch (err) {
    console.error('Failed to delete quiz question', err);
    return res.status(500).json({ error: 'Failed to delete quiz question' });
  }
});

router.post('/quiz/questions/:id/options', async (req, res) => {
  const questionId = req.params.id;
  const parsed = quizOptionCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  try {
    const questionRes = await pool.query(
      `
        SELECT qq.id, qq.question_type, m.course_id
        FROM quiz_questions qq
        JOIN lessons l ON l.id = qq.lesson_id
        JOIN modules m ON m.id = l.module_id
        WHERE qq.id = $1
        LIMIT 1
      `,
      [questionId],
    );
    const question = questionRes.rows[0];
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const allowed = await canEditCourse(question.course_id, req.user);
    if (!allowed) {
      return res.status(403).json({ error: 'You cannot edit this course' });
    }

    if (question.question_type === 'true_false') {
      return res.status(400).json({ error: 'True/False questions already include default options' });
    }

    let orderIndex = parsed.data.orderIndex;
    if (!orderIndex) {
      const { rows } = await pool.query(
        'SELECT COALESCE(MAX(order_index), 0) + 1 AS next FROM quiz_options WHERE question_id = $1',
        [questionId],
      );
      orderIndex = rows[0].next;
    }

    const optionColumns = ['question_id', 'option_text', 'is_correct', 'order_index'];
    const optionValues = [questionId, parsed.data.optionText, parsed.data.isCorrect || false, orderIndex];
    if (parsed.data.points !== undefined) {
      optionColumns.push('points');
      optionValues.push(parsed.data.points);
    }
    if (parsed.data.feedback !== undefined) {
      optionColumns.push('feedback');
      optionValues.push(parsed.data.feedback);
    }
    if (parsed.data.meta !== undefined) {
      optionColumns.push('meta');
      optionValues.push(parsed.data.meta);
    }
    const optionPlaceholders = optionColumns.map((_, index) => `$${index + 1}`).join(', ');
    const optionRes = await pool.query(
      `
        INSERT INTO quiz_options (${optionColumns.join(', ')})
        VALUES (${optionPlaceholders})
        RETURNING id
      `,
      optionValues,
    );

    if (parsed.data.isCorrect) {
      await pool.query(
        `
          UPDATE quiz_options
          SET is_correct = false
          WHERE question_id = $1 AND id <> $2
        `,
        [questionId, optionRes.rows[0].id],
      );
    }

    const rows = await pool.query(
      `
        SELECT
          qo.id,
          qo.option_text,
          qo.is_correct,
          qo.order_index AS option_order,
          qo.points AS points,
          qo.feedback AS feedback,
          qo.meta AS meta
        FROM quiz_options qo
        WHERE qo.question_id = $1
        ORDER BY qo.order_index ASC
      `,
      [questionId],
    );

    return res.status(201).json(rows.rows);
  } catch (err) {
    console.error('Failed to create quiz option', err);
    return res.status(500).json({ error: 'Failed to create quiz option' });
  }
});

router.patch('/quiz/options/:id', async (req, res) => {
  const optionId = req.params.id;
  const parsed = quizOptionUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  try {
    const optionRes = await pool.query(
      `
        SELECT qo.id, qo.question_id, qq.question_type, m.course_id
        FROM quiz_options qo
        JOIN quiz_questions qq ON qq.id = qo.question_id
        JOIN lessons l ON l.id = qq.lesson_id
        JOIN modules m ON m.id = l.module_id
        WHERE qo.id = $1
        LIMIT 1
      `,
      [optionId],
    );
    const option = optionRes.rows[0];
    if (!option) {
      return res.status(404).json({ error: 'Option not found' });
    }

    const allowed = await canEditCourse(option.course_id, req.user);
    if (!allowed) {
      return res.status(403).json({ error: 'You cannot edit this course' });
    }

    const updates = [];
    const values = [];
    if (parsed.data.optionText !== undefined) {
      values.push(parsed.data.optionText);
      updates.push(`option_text = $${values.length}`);
    }
    if (parsed.data.isCorrect !== undefined) {
      values.push(parsed.data.isCorrect);
      updates.push(`is_correct = $${values.length}`);
    }
    if (parsed.data.orderIndex !== undefined) {
      values.push(parsed.data.orderIndex);
      updates.push(`order_index = $${values.length}`);
    }
    if (parsed.data.points !== undefined) {
      values.push(parsed.data.points);
      updates.push(`points = $${values.length}`);
    }
    if (parsed.data.feedback !== undefined) {
      values.push(parsed.data.feedback);
      updates.push(`feedback = $${values.length}`);
    }
    if (parsed.data.meta !== undefined) {
      values.push(parsed.data.meta);
      updates.push(`meta = $${values.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    await pool.query(
      `
        UPDATE quiz_options
        SET ${updates.join(', ')}, updated_at = now()
        WHERE id = $${values.length + 1}
      `,
      [...values, optionId],
    );

    if (parsed.data.isCorrect && option.question_type === 'single_choice') {
      await pool.query(
        `
          UPDATE quiz_options
          SET is_correct = false
          WHERE question_id = $1 AND id <> $2
        `,
        [option.question_id, optionId],
      );
    }

    const rows = await pool.query(
      `
        SELECT
          qo.id,
          qo.option_text,
          qo.is_correct,
          qo.order_index AS option_order,
          qo.points AS points,
          qo.feedback AS feedback,
          qo.meta AS meta
        FROM quiz_options qo
        WHERE qo.question_id = $1
        ORDER BY qo.order_index ASC
      `,
      [option.question_id],
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error('Failed to update quiz option', err);
    return res.status(500).json({ error: 'Failed to update quiz option' });
  }
});

router.delete('/quiz/options/:id', async (req, res) => {
  const optionId = req.params.id;
  try {
    const optionRes = await pool.query(
      `
        SELECT qo.id, qo.question_id, qq.question_type, m.course_id
        FROM quiz_options qo
        JOIN quiz_questions qq ON qq.id = qo.question_id
        JOIN lessons l ON l.id = qq.lesson_id
        JOIN modules m ON m.id = l.module_id
        WHERE qo.id = $1
        LIMIT 1
      `,
      [optionId],
    );
    const option = optionRes.rows[0];
    if (!option) {
      return res.status(404).json({ error: 'Option not found' });
    }

    if (option.question_type === 'true_false') {
      return res.status(400).json({ error: 'True/False questions require both options' });
    }

    const allowed = await canEditCourse(option.course_id, req.user);
    if (!allowed) {
      return res.status(403).json({ error: 'You cannot edit this course' });
    }

    await pool.query('DELETE FROM quiz_options WHERE id = $1', [optionId]);

    return res.json({ id: optionId });
  } catch (err) {
    console.error('Failed to delete quiz option', err);
    return res.status(500).json({ error: 'Failed to delete quiz option' });
  }
});

router.get(
  '/courses/:courseId/groups',
  requireCourseRoleOrAdmin(resolveCourseIdFromParam('courseId'), ['enrollment_manager', 'admin']),
  async (req, res) => {
    const courseId = req.courseContext.courseId;

    try {
      const { rows } = await pool.query(
        `
          SELECT
            g.*,
            (
              SELECT COUNT(*)
              FROM group_teachers gt
              WHERE gt.group_id = g.id
            ) AS teachers_count
          FROM groups g
          WHERE g.course_id = $1
          ORDER BY g.name ASC
        `,
        [courseId],
      );

      return res.json(rows.map(mapGroupRow));
    } catch (err) {
      console.error('Failed to list course groups', err);
      return res.status(500).json({ error: 'Failed to list groups' });
    }
  },
);

router.post(
  '/courses/:courseId/groups',
  requireCourseRoleOrAdmin(resolveCourseIdFromParam('courseId'), ['enrollment_manager', 'admin']),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
    const parsed = groupCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    try {
      const payload = parsed.data;
      const timezone = payload.timezone || 'America/Bogota';
      const { rows } = await pool.query(
        `
          INSERT INTO groups (
            course_id,
            name,
            code,
            timezone,
            start_date,
            end_date,
            capacity,
            status,
            is_active,
            schedule_text
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING groups.*, (
            SELECT COUNT(*) FROM group_teachers gt WHERE gt.group_id = groups.id
          ) AS teachers_count
        `,
        [
          courseId,
          payload.name,
          payload.code || null,
          timezone,
          payload.startDate || null,
          payload.endDate || null,
          payload.capacity || null,
          payload.status || 'active',
          payload.isActive ?? true,
          payload.scheduleText || null,
        ],
      );

      return res.status(201).json(mapGroupRow(rows[0]));
    } catch (err) {
      if (err.code === '23505' && err.constraint === 'idx_groups_course_code_unique') {
        return res
          .status(400)
          .json({ error: 'A group with that code already exists for this course' });
      }
      console.error('Failed to create course group', err);
      return res.status(500).json({ error: 'Failed to create group' });
    }
  },
);

router.patch(
  '/groups/:groupId',
  requireCourseContentRole(resolveCourseIdFromGroupParam('groupId')),
  async (req, res) => {
    const groupId = req.params.groupId;
    const parsed = groupUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    const assignments = [];
    const values = [];
    const assignField = (column, key, transform = (value) => value) => {
      if (Object.prototype.hasOwnProperty.call(parsed.data, key)) {
        values.push(transform(parsed.data[key]));
        assignments.push(`${column} = $${values.length}`);
      }
    };

    assignField('name', 'name');
    assignField('code', 'code', (value) => value || null);
    assignField('timezone', 'timezone');
    assignField('start_date', 'startDate', (value) => value || null);
    assignField('end_date', 'endDate', (value) => value || null);
    assignField('capacity', 'capacity', (value) => (value === null ? null : value));
    assignField('status', 'status');
    assignField('is_active', 'isActive');
    assignField('schedule_text', 'scheduleText', (value) => value || null);

    if (!assignments.length) {
      return res.status(400).json({ error: 'At least one field must be updated' });
    }

    assignments.push('updated_at = now()');
    values.push(groupId);

    try {
      const { rows } = await pool.query(
        `
          UPDATE groups
          SET ${assignments.join(', ')}
          WHERE id = $${values.length}
          RETURNING groups.*, (
            SELECT COUNT(*) FROM group_teachers gt WHERE gt.group_id = groups.id
          ) AS teachers_count
        `,
        values,
      );

      if (!rows.length) {
        return res.status(404).json({ error: 'Group not found' });
      }

      return res.json(mapGroupRow(rows[0]));
    } catch (err) {
      if (err.code === '23505' && err.constraint === 'idx_groups_course_code_unique') {
        return res
          .status(400)
          .json({ error: 'A group with that code already exists for this course' });
      }
      console.error('Failed to update group', err);
      return res.status(500).json({ error: 'Failed to update group' });
    }
  },
);

router.delete(
  '/groups/:groupId',
  requireCourseRoleOrAdmin(resolveCourseIdFromGroupParam('groupId'), ['enrollment_manager', 'admin']),
  async (req, res) => {
    const groupId = req.params.groupId;
    try {
      const { rows } = await pool.query(
        `
          DELETE FROM groups
          WHERE id = $1
          RETURNING id
        `,
        [groupId],
      );
      if (!rows.length) {
        return res.status(404).json({ error: 'Group not found' });
      }

      return res.json({ success: true });
    } catch (err) {
      console.error('Failed to delete group', err);
      return res.status(500).json({ error: 'Failed to delete group' });
    }
  },
);

router.get(
  '/groups/:groupId/teachers',
  requireCourseEnrollmentRole(resolveCourseIdFromGroupParam('groupId')),
  async (req, res) => {
    const groupId = req.params.groupId;
    try {
      const group = await fetchGroupById(groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      const { rows } = await pool.query(
        `
          SELECT u.id, u.full_name, u.email
          FROM group_teachers gt
          JOIN users u ON u.id = gt.user_id
          WHERE gt.group_id = $1
          ORDER BY u.full_name
        `,
        [groupId],
      );
      return res.json(rows);
    } catch (err) {
      console.error('Failed to load group teachers', err);
      return res.status(500).json({ error: 'Failed to load group teachers' });
    }
  },
);

router.post(
  '/groups/:groupId/teachers',
  requireCourseEnrollmentRole(resolveCourseIdFromGroupParam('groupId')),
  async (req, res) => {
    const groupId = req.params.groupId;
    const parsed = groupTeacherAssignSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    try {
      const group = await fetchGroupById(groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      const courseId = req.courseContext?.courseId;
      const isInstructor = await hasCourseRole(parsed.data.userId, courseId, ['instructor']);
      if (!isInstructor) {
        return res.status(400).json({ error: 'User must be an instructor for this course' });
      }

      await pool.query(
        `
          INSERT INTO group_teachers (group_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT (group_id, user_id) DO NOTHING
        `,
        [groupId, parsed.data.userId],
      );

      const { rows } = await pool.query(
        `
          SELECT u.id, u.full_name, u.email
          FROM users u
          WHERE u.id = $1
          LIMIT 1
        `,
        [parsed.data.userId],
      );

      return res.status(201).json(rows[0] || { id: parsed.data.userId });
    } catch (err) {
      console.error('Failed to assign group teacher', err);
      return res.status(500).json({ error: 'Failed to assign group teacher' });
    }
  },
);

router.delete(
  '/groups/:groupId/teachers/:userId',
  requireCourseEnrollmentRole(resolveCourseIdFromGroupParam('groupId')),
  async (req, res) => {
    const groupId = req.params.groupId;
    const { userId } = req.params;
    const parsed = uuidSchema.safeParse(userId);
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    try {
      const group = await fetchGroupById(groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      await pool.query(
        `
          DELETE FROM group_teachers
          WHERE group_id = $1 AND user_id = $2
        `,
        [groupId, parsed.data],
      );

      return res.status(204).send();
    } catch (err) {
      console.error('Failed to remove group teacher', err);
      return res.status(500).json({ error: 'Failed to remove group teacher' });
    }
  },
);

router.get(
  '/courses/:courseId/students/available',
  requireCourseRoleOrAdmin(resolveCourseIdFromParam('courseId'), ['enrollment_manager', 'admin']),
  async (req, res) => {
    const courseId = req.courseContext.courseId;

    try {
      const { rows } = await pool.query(
        `
          SELECT DISTINCT u.id, u.full_name, u.email
          FROM users u
          WHERE u.is_active = true
            AND u.status = 'active'
            AND EXISTS (
              SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id
                AND r.name = 'student'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM enrollments e
              WHERE e.course_id = $1
                AND e.user_id = u.id
            )
          ORDER BY u.full_name ASC
        `,
        [courseId],
      );

      return res.json(
        rows.map((row) => ({
          id: row.id,
          fullName: row.full_name,
          email: row.email,
        })),
      );
    } catch (err) {
      console.error('Failed to list available students', err);
      return res.status(500).json({ error: 'Failed to list students' });
    }
  },
);

router.get(
  '/courses/:courseId/enrollments',
  requireCourseEnrollmentRole(resolveCourseIdFromParam('courseId')),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 200);
    const offset = (page - 1) * pageSize;
    const searchTerm = (req.query.search || '').trim();
    const groupFilter = (req.query.groupId || '').trim();

    const whereClauses = [
      'e.course_id = $1',
      `EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id
          AND r.name = 'student'
      )`,
    ];
    const whereValues = [courseId];

    if (searchTerm) {
      whereValues.push(`%${searchTerm}%`);
      const placeholder = `$${whereValues.length}`;
      whereClauses.push(`(u.full_name ILIKE ${placeholder} OR u.email ILIKE ${placeholder})`);
    }

    if (groupFilter === 'no-group') {
      whereClauses.push(
        `NOT EXISTS (
          SELECT 1
          FROM group_students gs
          JOIN groups g ON g.id = gs.group_id
          WHERE gs.user_id = e.user_id
            AND g.course_id = e.course_id
        )`,
      );
    } else if (groupFilter) {
      whereValues.push(groupFilter);
      const placeholder = `$${whereValues.length}`;
      whereClauses.push(
        `EXISTS (
          SELECT 1
          FROM group_students gs
          WHERE gs.user_id = e.user_id
            AND gs.group_id = ${placeholder}
        )`,
      );
    }

    const whereSql = whereClauses.join('\n              AND ');

    try {
      const [dataRes, countRes] = await Promise.all([
        pool.query(
          `
            SELECT
              e.user_id AS student_id,
              u.full_name,
              u.email,
              assignment.group_id,
              assignment.group_name
            FROM enrollments e
            JOIN users u ON u.id = e.user_id
            LEFT JOIN LATERAL (
              SELECT gs.group_id, g.name AS group_name
              FROM group_students gs
              JOIN groups g ON g.id = gs.group_id
              WHERE gs.user_id = e.user_id
                AND g.course_id = e.course_id
              LIMIT 1
            ) assignment ON true
            WHERE ${whereSql}
            ORDER BY u.full_name ASC
            LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
          `,
          [...whereValues, pageSize, offset],
        ),
        pool.query(
          `
            SELECT COUNT(*)::int AS total
            FROM enrollments e
            JOIN users u ON u.id = e.user_id
            WHERE ${whereSql}
          `,
          whereValues,
        ),
      ]);

      const rows = dataRes.rows;
      const total = countRes.rows[0]?.total || 0;

      return res.json({
        data: rows.map((row) => ({
          studentId: row.student_id,
          fullName: row.full_name,
          email: row.email,
          groupId: row.group_id || null,
          groupName: row.group_name || null,
        })),
        page,
        pageSize,
        total,
      });
    } catch (err) {
      console.error('Failed to list enrollments', err);
      return res.status(500).json({ error: 'Failed to list enrollments' });
    }
  },
);

router.post(
  '/courses/:courseId/enroll',
  requireCourseEnrollmentRole(resolveCourseIdFromParam('courseId')),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
    const parsed = enrollStudentSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const studentRes = await client.query(
        `
          SELECT u.id
          FROM users u
          WHERE u.id = $1
            AND EXISTS (
              SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id
                AND r.name = 'student'
            )
          LIMIT 1
        `,
        [parsed.data.studentId],
      );
    if (!studentRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Student not found' });
    }

    const existing = await client.query(
      `
        SELECT 1
        FROM enrollments
        WHERE course_id = $1 AND user_id = $2
        LIMIT 1
      `,
      [courseId, parsed.data.studentId],
    );
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Student already enrolled in this course' });
    }

    await client.query(
      `
        INSERT INTO enrollments (course_id, user_id)
        VALUES ($1, $2)
      `,
      [courseId, parsed.data.studentId],
    );

    if (parsed.data.groupId) {
      const group = await fetchGroupById(parsed.data.groupId);
      if (!group || group.course_id !== courseId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Group must belong to this course' });
      }

      await removeStudentFromCourseGroups(client, courseId, parsed.data.studentId);
      await client.query(
        `
          INSERT INTO group_students (group_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT (group_id, user_id) DO NOTHING
        `,
        [parsed.data.groupId, parsed.data.studentId],
      );
    }

      await client.query('COMMIT');
      return res.status(201).json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Failed to enroll student', err);
      return res.status(500).json({ error: 'Failed to enroll student' });
    } finally {
      client.release();
    }
  },
);

router.delete(
  '/courses/:courseId/enroll/:studentId',
  requireCourseEnrollmentRole(resolveCourseIdFromParam('courseId')),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
    const studentId = req.params.studentId;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

    const deleted = await client.query(
      `
        DELETE FROM enrollments
        WHERE course_id = $1 AND user_id = $2
        RETURNING 1
      `,
      [courseId, studentId],
    );
    if (!deleted.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    await removeStudentFromCourseGroups(client, courseId, studentId);

      await client.query('COMMIT');
      return res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Failed to remove enrollment', err);
      return res.status(500).json({ error: 'Failed to remove enrollment' });
    } finally {
      client.release();
    }
  },
);

router.post(
  '/courses/:courseId/enroll/:studentId/group',
  requireCourseEnrollmentRole(resolveCourseIdFromParam('courseId')),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
    const studentId = req.params.studentId;

    const parsed = assignGroupSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const enrolled = await client.query(
      `
        SELECT 1
        FROM enrollments
        WHERE course_id = $1 AND user_id = $2
        LIMIT 1
      `,
      [courseId, studentId],
    );
    if (!enrolled.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Student is not enrolled in this course' });
    }

    if (parsed.data.groupId) {
      const group = await fetchGroupById(parsed.data.groupId);
      if (!group || group.course_id !== courseId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Group must belong to this course' });
      }
    }

    await removeStudentFromCourseGroups(client, courseId, studentId);

    if (parsed.data.groupId) {
      await client.query(
        `
          INSERT INTO group_students (group_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT (group_id, user_id) DO NOTHING
        `,
        [parsed.data.groupId, studentId],
      );
    }

      await client.query('COMMIT');
      return res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Failed to update group assignment', err);
      return res.status(500).json({ error: 'Failed to update group assignment' });
    } finally {
      client.release();
    }
  },
);

router.post(
  '/courses/:courseId/enroll/bulk',
  requireCourseEnrollmentRole(resolveCourseIdFromParam('courseId')),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
    const parsed = bulkEnrollSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    const studentIds = [...new Set(parsed.data.studentIds)];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (parsed.data.groupId) {
        const group = await fetchGroupById(parsed.data.groupId);
        if (!group || group.course_id !== courseId) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Group must belong to this course' });
        }
      }

      const { rows: studentRows } = await client.query(
        `
          SELECT DISTINCT u.id
          FROM users u
          WHERE u.id = ANY($1::uuid[])
            AND EXISTS (
              SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id
                AND r.name = 'student'
            )
        `,
        [studentIds],
      );
    const validStudents = new Set(studentRows.map((row) => row.id));

    const enrolled = [];
    const skipped = [];

    for (const studentId of studentIds) {
      if (!validStudents.has(studentId)) {
        skipped.push({ studentId, reason: 'not_student' });
        continue;
      }

      const insertRes = await client.query(
        `
          INSERT INTO enrollments (course_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT (course_id, user_id) DO NOTHING
          RETURNING user_id
        `,
        [courseId, studentId],
      );

      if (!insertRes.rows.length) {
        skipped.push({ studentId, reason: 'already_enrolled' });
        continue;
      }

      if (parsed.data.groupId) {
        await removeStudentFromCourseGroups(client, courseId, studentId);
        await client.query(
          `
            INSERT INTO group_students (group_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT (group_id, user_id) DO NOTHING
          `,
          [parsed.data.groupId, studentId],
        );
      }

      enrolled.push(studentId);
    }

      await client.query('COMMIT');
      const statusCode = enrolled.length ? 201 : 200;
      return res.status(statusCode).json({ enrolled, skipped });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Failed to bulk enroll students', err);
      return res.status(500).json({ error: 'Failed to enroll students' });
    } finally {
      client.release();
    }
  },
);

router.post('/assets/upload', async (req, res) => {
  try {
    await runUploadFile(req, res);
  } catch (err) {
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: err.message || 'File upload failed' });
    }
    return res.status(400).json({ error: err.message || 'File upload failed' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'File is required' });
  }

  const kind = getAssetKind(req.file.mimetype);
  if (!kind) {
    return res.status(400).json({ error: 'Unsupported file type' });
  }

  const filename = req.file.filename;
  const storagePath = path.posix.join('uploads', filename);
  const publicUrl = `/uploads/${filename}`;

  try {
    const insertRes = await pool.query(
      `
        INSERT INTO assets (
          uploaded_by_user_id,
          storage_provider,
          storage_path,
          public_url,
          kind,
          mime_type,
          original_name,
          size_bytes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
      [
        req.user.id,
        'local',
        storagePath,
        publicUrl,
        kind,
        req.file.mimetype,
        req.file.originalname,
        req.file.size,
      ],
    );
    const asset = insertRes.rows[0];
    return res.status(201).json({
      assetId: asset.id,
      kind,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      sizeBytes: req.file.size,
      url: publicUrl,
    });
  } catch (err) {
    console.error('Failed to save asset metadata', err);
    return res.status(500).json({ error: 'Failed to save asset metadata' });
  }
});

router.post('/assets/register', async (req, res) => {
  const {
    storagePath,
    publicUrl,
    kind,
    mimeType,
    originalName,
    sizeBytes,
    storageProvider = 'supabase',
  } = req.body || {};

  if (!storagePath || !publicUrl || !kind || !mimeType || !sizeBytes) {
    return res.status(400).json({ error: 'Missing asset metadata' });
  }

  const sanitizedKind = sanitizeAssetKind(kind);
  try {
    const { rows } = await pool.query(
      `
        INSERT INTO assets (
          uploaded_by_user_id,
          storage_provider,
          storage_path,
          public_url,
          kind,
          mime_type,
          original_name,
          size_bytes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id, storage_path, public_url, kind, mime_type, original_name, size_bytes, created_at
      `,
      [
        req.user.id,
        storageProvider,
        storagePath,
        publicUrl,
        sanitizedKind,
        mimeType,
        originalName || null,
        sizeBytes,
      ],
    );
    const asset = rows[0];
    return res.status(201).json({
      assetId: asset.id,
      storagePath: asset.storage_path,
      publicUrl: asset.public_url,
      kind: asset.kind,
      mimeType: asset.mime_type,
      originalName: asset.original_name,
      sizeBytes: asset.size_bytes,
      createdAt: asset.created_at,
      url: asset.public_url,
    });
  } catch (err) {
    console.error('Failed to register asset metadata', err);
    return res.status(500).json({ error: 'Failed to register asset metadata' });
  }
});

router.get('/assets', async (req, res) => {
  const queryKind = typeof req.query.kind === 'string' ? req.query.kind : null;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  if (queryKind && !isValidAssetKind(queryKind)) {
    return res.status(400).json({ error: 'Invalid asset kind filter' });
  }

  const filters = ['uploaded_by_user_id = $1'];
  const values = [req.user.id];

  if (queryKind) {
    values.push(queryKind);
    filters.push(`kind = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    filters.push(`original_name ILIKE $${values.length}`);
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          kind,
          mime_type,
          original_name,
          size_bytes,
          storage_path,
          public_url,
          created_at
        FROM assets
        WHERE ${filters.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT ${ASSET_LIST_LIMIT}
      `,
      values,
    );

    return res.json(
      rows.map((asset) => ({
        assetId: asset.id,
        kind: asset.kind,
        mimeType: asset.mime_type,
        originalName: asset.original_name,
        sizeBytes: asset.size_bytes,
        storagePath: asset.storage_path,
        url: asset.public_url,
        createdAt: asset.created_at,
      })),
    );
  } catch (err) {
    console.error('Failed to list assets', err);
    return res.status(500).json({ error: 'Failed to list assets' });
  }
});

module.exports = router;

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
      });
    }
    if (row.option_id) {
      map.get(row.question_id).options.push({
        id: row.option_id,
        optionText: row.option_text,
        isCorrect: row.is_correct,
        orderIndex: row.option_order,
      });
    }
  }
  return Array.from(map.values());
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
        SELECT id, module_id, title, content_text, content_markdown, video_url, estimated_minutes, order_index, is_published, published_at, created_at, updated_at
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

    const { rows } = await pool.query(
      `
        INSERT INTO lessons (module_id, title, content_text, content_markdown, video_url, estimated_minutes, position, order_index, is_published)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
        RETURNING id, module_id, title, content_text, content_markdown, video_url, estimated_minutes, order_index, is_published, published_at, created_at, updated_at
      `,
      [
        moduleId,
        parsed.data.title,
        parsed.data.contentText || null,
        parsed.data.contentMarkdown || parsed.data.contentText || null,
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
      RETURNING id, module_id, title, content_text, content_markdown, video_url, estimated_minutes, order_index, is_published, published_at, created_at, updated_at
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
      const { rows } = await pool.query(
        `
          SELECT
            qq.id AS question_id,
            qq.lesson_id,
            qq.question_text,
            qq.question_type,
            qq.order_index,
            qo.id AS option_id,
            qo.option_text,
            qo.is_correct,
            qo.order_index AS option_order
          FROM quiz_questions qq
          LEFT JOIN quiz_options qo ON qo.question_id = qq.id
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

    const insertRes = await pool.query(
      `
        INSERT INTO quiz_questions (lesson_id, question_text, question_type, order_index)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [lessonId, parsed.data.questionText, questionType, orderIndex],
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

    const questionRows = await pool.query(
      `
        SELECT
          qq.id AS question_id,
          qq.lesson_id,
          qq.question_text,
          qq.question_type,
          qq.order_index,
          qo.id AS option_id,
          qo.option_text,
          qo.is_correct,
          qo.order_index AS option_order
        FROM quiz_questions qq
        LEFT JOIN quiz_options qo ON qo.question_id = qq.id
        WHERE qq.id = $1
        ORDER BY qo.order_index ASC
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

    if (parsed.data.questionType === 'true_false') {
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
    }

    const questionRows = await pool.query(
      `
        SELECT
          qq.id AS question_id,
          qq.lesson_id,
          qq.question_text,
          qq.question_type,
          qq.order_index,
          qo.id AS option_id,
          qo.option_text,
          qo.is_correct,
          qo.order_index AS option_order
        FROM quiz_questions qq
        LEFT JOIN quiz_options qo ON qo.question_id = qq.id
        WHERE qq.id = $1
        ORDER BY qo.order_index ASC
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

    const optionRes = await pool.query(
      `
        INSERT INTO quiz_options (question_id, option_text, is_correct, order_index)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [questionId, parsed.data.optionText, parsed.data.isCorrect || false, orderIndex],
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
          qo.order_index
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
          qo.order_index
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

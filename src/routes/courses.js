const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { uuidSchema, formatZodError } = require('../utils/validators');
const { canEditCourse } = require('../utils/cmsPermissions');

const router = express.Router();

router.use(auth);

router.get('/:id', requireRole(['admin', 'instructor', 'student']), async (req, res) => {
  const courseId = req.params.id;
  const { role, id: userId } = req.user;
  const isPreview =
    req.query.preview === '1' || req.query.preview === 'true';

  try {
    const courseRes = await pool.query(
      `
        SELECT
          c.id,
          c.title,
          c.description,
          c.level,
          c.status,
          c.owner_user_id,
          c.created_at,
          c.published_at,
          c.is_published,
          c.updated_at
        FROM courses c
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
      if (!['admin', 'instructor'].includes(role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const allowed = await canEditCourse(courseId, req.user);
      if (!allowed) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else if (role === 'student') {
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
    } else if (role === 'instructor') {
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

    if (!isPreview && role === 'student') {
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

      if (!isPreview && role === 'student') {
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
            a.path,
            a.mime_type,
            a.size_bytes,
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
          path: row.path,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
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
router.get('/:id/progress', requireRole(['student', 'instructor', 'admin']), async (req, res) => {
  const courseId = req.params.id;
  const { role, id: userId } = req.user;
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

    if (role === 'student') {
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
    } else if (role === 'instructor') {
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
    } else if (role === 'admin') {
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

    const nextLesson = lessons.find((lesson) => !doneLessonIds.has(lesson.id)) || null;

    return res.json({
      courseId,
      totalLessons,
      completedLessons,
      percent,
      nextLessonId: nextLesson ? nextLesson.id : null,
      nextLessonTitle: nextLesson ? nextLesson.title : null,
    });
  } catch (err) {
    console.error('Failed to load course progress', err);
    return res.status(500).json({ error: 'Failed to load course progress' });
  }
});

module.exports = router;

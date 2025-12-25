const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { lessonProgressSchema, formatZodError } = require('../utils/validators');

const router = express.Router();

router.post('/lessons/:id/progress', auth, requireRole(['student']), async (req, res) => {
  const lessonId = req.params.id;
  const parsedBody = lessonProgressSchema.safeParse(req.body || {});
  if (!parsedBody.success) {
    return res.status(400).json({ error: formatZodError(parsedBody.error) });
  }
  const { status, progressPercent } = parsedBody.data;

  try {
    const lessonRes = await pool.query(
      `
        SELECT l.id, m.course_id
        FROM lessons l
        JOIN modules m ON m.id = l.module_id
        WHERE l.id = $1
        LIMIT 1
      `,
      [lessonId],
    );
    const lesson = lessonRes.rows[0];
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const enrollmentRes = await pool.query(
      `
        SELECT 1
        FROM enrollments
        WHERE course_id = $1 AND user_id = $2
        LIMIT 1
      `,
      [lesson.course_id, req.user.id],
    );
    if (!enrollmentRes.rows.length) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    const progressRes = await pool.query(
      `
        INSERT INTO lesson_progress (user_id, lesson_id, status, progress_percent, last_seen_at)
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (user_id, lesson_id) DO UPDATE
        SET
          progress_percent = GREATEST(
            lesson_progress.progress_percent,
            EXCLUDED.progress_percent
          ),
          status = CASE
            WHEN lesson_progress.status = 'done' THEN 'done'
            WHEN EXCLUDED.status = 'done' THEN 'done'
            WHEN lesson_progress.status = 'in_progress' THEN 'in_progress'
            WHEN EXCLUDED.status = 'in_progress' THEN 'in_progress'
            ELSE lesson_progress.status
          END,
          last_seen_at = now()
        RETURNING user_id, lesson_id, status, progress_percent, last_seen_at;
      `,
      [req.user.id, lesson.id, status, progressPercent ?? null],
    );

    const record = progressRes.rows[0];
    return res.json({
      userId: record.user_id,
      lessonId: record.lesson_id,
      status: record.status,
      progressPercent: record.progress_percent,
      lastSeenAt: record.last_seen_at,
    });
  } catch (err) {
    console.error('Failed to update lesson progress', err);
    return res.status(500).json({ error: 'Failed to update lesson progress' });
  }
});

module.exports = router;

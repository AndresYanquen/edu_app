const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.use(auth, requireRole(['instructor']));

router.get('/instructor/groups', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          g.id AS group_id,
          g.name AS group_name,
          g.schedule_text,
          c.id AS course_id,
          c.title AS course_title
        FROM group_teachers gt
        JOIN groups g ON g.id = gt.group_id
        JOIN courses c ON c.id = g.course_id
        WHERE gt.user_id = $1
        ORDER BY c.title, g.name
      `,
      [req.user.id],
    );

    return res.json(rows);
  } catch (err) {
    console.error('Failed to load instructor groups', err);
    return res.status(500).json({ error: 'Failed to load groups' });
  }
});

router.get('/groups/:id/students', async (req, res) => {
  const groupId = req.params.id;

  try {
    const assignment = await pool.query(
      `
        SELECT 1
        FROM group_teachers
        WHERE user_id = $1 AND group_id = $2
        LIMIT 1
      `,
      [req.user.id, groupId],
    );

    if (!assignment.rows.length) {
      return res.status(403).json({ error: 'You are not assigned to this group' });
    }

    const { rows } = await pool.query(
      `
        SELECT
          u.id,
          u.full_name,
          u.email
        FROM group_students gs
        JOIN users u ON u.id = gs.user_id
        JOIN academy_memberships m ON m.user_id = u.id
        WHERE gs.group_id = $1
          AND m.role = 'student'
        ORDER BY u.full_name
      `,
      [groupId],
    );

    return res.json(rows);
  } catch (err) {
    console.error('Failed to load group students', err);
    return res.status(500).json({ error: 'Failed to load group students' });
  }
});

router.get('/groups/:id/progress', async (req, res) => {
  const groupId = req.params.id;

  try {
    const groupRes = await pool.query(
      `
        SELECT g.id, g.course_id
        FROM group_teachers gt
        JOIN groups g ON g.id = gt.group_id
        WHERE gt.user_id = $1 AND g.id = $2
        LIMIT 1
      `,
      [req.user.id, groupId],
    );

    const group = groupRes.rows[0];
    if (!group) {
      return res.status(403).json({ error: 'You are not assigned to this group' });
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
      [group.course_id],
    );
    const lessons = lessonsRes.rows;
    const totalLessons = lessons.length;

    const studentsRes = await pool.query(
      `
        SELECT u.id, u.full_name
        FROM group_students gs
        JOIN users u ON u.id = gs.user_id
        JOIN academy_memberships m ON m.user_id = u.id
        WHERE gs.group_id = $1
          AND m.role = 'student'
        ORDER BY u.full_name
      `,
      [groupId],
    );
    const students = studentsRes.rows;
    if (!students.length) {
      return res.json([]);
    }

    const studentIds = students.map((student) => student.id);
    const progressRes = await pool.query(
      `
        SELECT
          lp.user_id,
          lp.lesson_id
        FROM lesson_progress lp
        JOIN lessons l ON l.id = lp.lesson_id
        JOIN modules m ON m.id = l.module_id
        WHERE lp.user_id = ANY($1::uuid[])
          AND lp.status = 'done'
          AND m.course_id = $2
      `,
      [studentIds, group.course_id],
    );

    const progressMap = {};
    for (const row of progressRes.rows) {
      if (!progressMap[row.user_id]) {
        progressMap[row.user_id] = new Set();
      }
      progressMap[row.user_id].add(row.lesson_id);
    }

    const response = students.map((student) => {
      const doneLessons = progressMap[student.id] || new Set();
      const completedLessons = doneLessons.size;
      const percent =
        totalLessons === 0 ? 0 : Math.floor((completedLessons * 100) / totalLessons);
      const nextLesson =
        lessons.find((lesson) => !doneLessons.has(lesson.id)) || null;

      return {
        studentId: student.id,
        studentName: student.full_name,
        totalLessons,
        completedLessons,
        percent,
        nextLessonTitle: nextLesson ? nextLesson.title : null,
      };
    });

    return res.json(response);
  } catch (err) {
    console.error('Failed to load group progress', err);
    return res.status(500).json({ error: 'Failed to load group progress' });
  }
});

module.exports = router;

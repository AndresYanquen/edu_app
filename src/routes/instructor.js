const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const {
  requireGlobalRoleAny,
  requireCourseRoleAny,
  hasGlobalRole,
  getCourseIdFromGroup,
} = require('../middleware/roles');

const router = express.Router();

router.use(auth, requireGlobalRoleAny(['instructor', 'admin']));

const resolveCourseIdFromParam = (param) => (req) => req.params[param];
const requireInstructorCourseRole = (resolver) =>
  requireCourseRoleAny(resolver, ['instructor']);

router.get('/instructor/groups', async (req, res) => {
  try {
    const isAdmin = hasGlobalRole(req.user, 'admin');
    let rows;
    if (isAdmin) {
      ({ rows } = await pool.query(
        `
          SELECT
            g.id AS group_id,
            g.name AS group_name,
            g.schedule_text,
            c.id AS course_id,
            c.title AS course_title
          FROM groups g
          JOIN courses c ON c.id = g.course_id
          ORDER BY c.title, g.name
        `,
      ));
    } else {
      ({ rows } = await pool.query(
        `
          SELECT
            g.id AS group_id,
            g.name AS group_name,
            g.schedule_text,
            c.id AS course_id,
            c.title AS course_title
          FROM groups g
          JOIN courses c ON c.id = g.course_id
          WHERE EXISTS (
            SELECT 1
            FROM course_user_roles cur
            JOIN roles r ON r.id = cur.role_id
            WHERE cur.course_id = c.id
              AND cur.user_id = $1
              AND r.name = 'instructor'
          )
          ORDER BY c.title, g.name
        `,
        [req.user.id],
      ));
    }

    return res.json(rows);
  } catch (err) {
    console.error('Failed to load instructor groups', err);
    return res.status(500).json({ error: 'Failed to load groups' });
  }
});

router.get(
  '/groups/:id/students',
  requireInstructorCourseRole((req) => getCourseIdFromGroup(req.params.id)),
  async (req, res) => {
    const groupId = req.params.id;

    try {
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
  },
);

router.get(
  '/groups/:id/progress',
  requireInstructorCourseRole((req) => getCourseIdFromGroup(req.params.id)),
  async (req, res) => {
    const groupId = req.params.id;

    try {
      const groupRes = await pool.query('SELECT id, course_id FROM groups WHERE id = $1 LIMIT 1', [
        groupId,
      ]);
      const group = groupRes.rows[0];
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
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
  },
);

router.get(
  '/instructor/courses/:courseId/analytics',
  requireInstructorCourseRole(resolveCourseIdFromParam('courseId')),
  async (req, res) => {
    const courseId = req.params.courseId;

    try {
      const totalLessonsRes = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM lessons l
        JOIN modules m ON m.id = l.module_id
        WHERE m.course_id = $1
      `,
      [courseId],
    );
    const totalLessons = totalLessonsRes.rows[0]?.total ?? 0;

      const analyticsRes = await pool.query(
      `
        WITH course_lessons AS (
          SELECT l.id
          FROM lessons l
          JOIN modules m ON m.id = l.module_id
          WHERE m.course_id = $1
        ),
        course_students AS (
          SELECT e.user_id, u.full_name, u.email
          FROM enrollments e
          JOIN users u ON u.id = e.user_id
          JOIN academy_memberships am ON am.user_id = u.id AND am.role = 'student'
          WHERE e.course_id = $1
        ),
        lesson_completion AS (
          SELECT
            lp.user_id,
            COUNT(DISTINCT lp.lesson_id)::int AS completed_lessons
          FROM lesson_progress lp
          WHERE lp.status = 'done'
            AND lp.lesson_id = ANY(SELECT id FROM course_lessons)
          GROUP BY lp.user_id
        )
        SELECT
          cs.user_id AS student_id,
          cs.full_name,
          cs.email,
          COALESCE(lc.completed_lessons, 0) AS completed_lessons
        FROM course_students cs
        LEFT JOIN lesson_completion lc ON lc.user_id = cs.user_id
        ORDER BY COALESCE(lc.completed_lessons, 0) DESC, cs.full_name ASC
      `,
      [courseId],
      );

      const response = analyticsRes.rows.map((row) => {
        const completedLessons = row.completed_lessons || 0;
        const percent =
          totalLessons === 0 ? 0 : Math.round((completedLessons * 100) / totalLessons);
        return {
          studentId: row.student_id,
          fullName: row.full_name,
          email: row.email,
          completedLessons,
          totalLessons,
          percent,
        };
      });

      return res.json(response);
    } catch (err) {
      console.error('Failed to load course analytics', err);
      return res.status(500).json({ error: 'Failed to load course analytics' });
    }
  },
);

router.get(
  '/groups/:id/analytics',
  requireInstructorCourseRole((req) => getCourseIdFromGroup(req.params.id)),
  async (req, res) => {
    const groupId = req.params.id;
    try {
      const groupRes = await pool.query('SELECT id, course_id FROM groups WHERE id = $1 LIMIT 1', [
        groupId,
      ]);
      const group = groupRes.rows[0];
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      const totalLessonsRes = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM lessons l
        JOIN modules m ON m.id = l.module_id
        WHERE m.course_id = $1
      `,
      [group.course_id],
    );
    const totalLessons = totalLessonsRes.rows[0]?.total ?? 0;

      const analyticsRes = await pool.query(
      `
        WITH group_students_cte AS (
          SELECT
            gs.user_id,
            u.full_name,
            u.email
          FROM group_students gs
          JOIN users u ON u.id = gs.user_id
          JOIN academy_memberships am ON am.user_id = u.id AND am.role = 'student'
          WHERE gs.group_id = $1
        ),
        progress AS (
          SELECT
            lp.user_id,
            COUNT(DISTINCT CASE WHEN lp.status = 'done' THEN lp.lesson_id END)::int AS completed_lessons,
            MAX(lp.last_seen_at) AS last_seen_at
          FROM lesson_progress lp
          JOIN lessons l ON l.id = lp.lesson_id
          JOIN modules m ON m.id = l.module_id
          WHERE m.course_id = $2
            AND lp.user_id IN (SELECT user_id FROM group_students_cte)
          GROUP BY lp.user_id
        ),
        quiz_attempts_scoped AS (
          SELECT
            qa.user_id,
            qa.score_percent::int AS score_percent,
            qa.created_at
          FROM quiz_attempts qa
          JOIN lessons l ON l.id = qa.lesson_id
          JOIN modules m ON m.id = l.module_id
          WHERE m.course_id = $2
            AND qa.user_id IN (SELECT user_id FROM group_students_cte)
        ),
        quiz_best AS (
          SELECT
            user_id,
            MAX(score_percent)::int AS best_score
          FROM quiz_attempts_scoped
          GROUP BY user_id
        ),
        quiz_last AS (
          SELECT DISTINCT ON (user_id)
            user_id,
            score_percent::int AS last_score
          FROM quiz_attempts_scoped
          ORDER BY user_id, created_at DESC
        )
        SELECT
          gs.user_id AS student_id,
          gs.full_name,
          gs.email,
          COALESCE(p.completed_lessons, 0) AS completed_lessons,
          p.last_seen_at,
          qb.best_score,
          ql.last_score
        FROM group_students_cte gs
        LEFT JOIN progress p ON p.user_id = gs.user_id
        LEFT JOIN quiz_best qb ON qb.user_id = gs.user_id
        LEFT JOIN quiz_last ql ON ql.user_id = gs.user_id
        ORDER BY COALESCE(p.completed_lessons, 0) DESC, gs.full_name ASC
      `,
        [groupId, group.course_id],
      );

      const response = analyticsRes.rows.map((row) => {
        const completedLessons = row.completed_lessons || 0;
        const percent =
          totalLessons === 0 ? 0 : Math.round((completedLessons * 100) / totalLessons);
        return {
          studentId: row.student_id,
          fullName: row.full_name,
          email: row.email,
          percent,
          completedLessons,
          totalLessons,
          lastSeenAt: row.last_seen_at,
          bestQuizScore: row.best_score ?? null,
          lastQuizScore: row.last_score ?? null,
        };
      });

      return res.json(response);
    } catch (err) {
      console.error('Failed to load group analytics', err);
      return res.status(500).json({ error: 'Failed to load group analytics' });
    }
  },
);

module.exports = router;

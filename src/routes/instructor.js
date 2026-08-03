const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const {
  requireGlobalRoleAny,
  requireCourseRoleAny,
  requireGroupTeacherOrAdmin,
  hasGlobalRole,
} = require('../middleware/roles');

const router = express.Router();
const PRESENCE_ONLINE_TTL_SECONDS = Number(process.env.PRESENCE_ONLINE_TTL_SECONDS || 120);

const instructorScopedPaths = ['/instructor', '/groups'];
router.use(instructorScopedPaths, auth, requireGlobalRoleAny(['instructor', 'admin']));

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
          JOIN group_teachers gt ON gt.group_id = g.id
          WHERE gt.user_id = $1
          ORDER BY g.created_at DESC
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
  requireGroupTeacherOrAdmin((req) => req.params.id),
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
          WHERE gs.group_id = $1
            AND EXISTS (
              SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id
                AND r.name = 'student'
            )
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

// Returns instructors/teachers assigned to a group
router.get(
  '/groups/:id/teachers',
  requireGroupTeacherOrAdmin((req) => req.params.id),
  async (req, res) => {
    const groupId = req.params.id;
    try {
      const { rows } = await pool.query(
        `
          SELECT
            u.id,
            u.full_name,
            u.email
          FROM group_teachers gt
          JOIN users u ON u.id = gt.user_id
          WHERE gt.group_id = $1
          ORDER BY u.full_name ASC
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

router.get(
  '/groups/:id/presence',
  requireGroupTeacherOrAdmin((req) => req.params.id),
  async (req, res) => {
    const groupId = req.params.id;
    const ttlSeconds = Number.isFinite(PRESENCE_ONLINE_TTL_SECONDS) && PRESENCE_ONLINE_TTL_SECONDS > 0
      ? PRESENCE_ONLINE_TTL_SECONDS
      : 120;

    try {
      const { rows } = await pool.query(
        `
          SELECT
            u.id AS student_id,
            u.full_name,
            u.email,
            u.last_seen_at,
            (
              u.last_seen_at IS NOT NULL
              AND u.last_seen_at >= (now() - make_interval(secs => $2::int))
            ) AS is_online
          FROM group_students gs
          JOIN users u ON u.id = gs.user_id
          WHERE gs.group_id = $1
            AND gs.status = 'active'
            AND EXISTS (
              SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id
                AND r.name = 'student'
            )
          ORDER BY u.full_name ASC
        `,
        [groupId, ttlSeconds],
      );

      return res.json({
        groupId,
        ttlSeconds: ttlSeconds,
        now: new Date().toISOString(),
        students: rows.map((row) => ({
          studentId: row.student_id,
          fullName: row.full_name,
          email: row.email,
          lastSeenAt: row.last_seen_at,
          isOnline: Boolean(row.is_online),
        })),
      });
    } catch (err) {
      console.error('Failed to load group presence', err);
      return res.status(500).json({ error: 'Failed to load group presence' });
    }
  },
);

router.get(
  '/groups/:id/progress',
  requireGroupTeacherOrAdmin((req) => req.params.id),
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
          WHERE gs.group_id = $1
            AND EXISTS (
              SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id
                AND r.name = 'student'
            )
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
  '/groups/:id/students/:studentId/progress',
  requireGroupTeacherOrAdmin((req) => req.params.id),
  async (req, res) => {
    const groupId = req.params.id;
    const studentId = req.params.studentId;

    try {
      const groupRes = await pool.query('SELECT id, course_id FROM groups WHERE id = $1 LIMIT 1', [
        groupId,
      ]);
      const group = groupRes.rows[0];
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      const studentRes = await pool.query(
        `
          SELECT
            u.id,
            u.full_name,
            u.email
          FROM group_students gs
          JOIN users u ON u.id = gs.user_id
          WHERE gs.group_id = $1
            AND gs.user_id = $2
            AND EXISTS (
              SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id
                AND r.name = 'student'
            )
          LIMIT 1
        `,
        [groupId, studentId],
      );
      const student = studentRes.rows[0];
      if (!student) {
        return res.status(404).json({ error: 'Student not found in group' });
      }

      const lessonsRes = await pool.query(
        `
          WITH latest_quiz AS (
            SELECT DISTINCT ON (qa.lesson_id)
              qa.lesson_id,
              qa.score_percent::int AS score_percent,
              qa.passed,
              qa.submitted_at,
              qa.created_at
            FROM quiz_attempts qa
            WHERE qa.user_id = $2
              AND qa.status = 'submitted'
            ORDER BY qa.lesson_id, COALESCE(qa.submitted_at, qa.created_at) DESC
          ),
          best_quiz AS (
            SELECT
              qa.lesson_id,
              MAX(qa.score_percent)::int AS score_percent
            FROM quiz_attempts qa
            WHERE qa.user_id = $2
              AND qa.status = 'submitted'
            GROUP BY qa.lesson_id
          )
          SELECT
            m.id AS module_id,
            m.title AS module_title,
            m.position AS module_position,
            l.id AS lesson_id,
            l.title AS lesson_title,
            l.position AS lesson_position,
            l.content_type,
            COALESCE(lp.status, 'not_started') AS progress_status,
            COALESCE(lp.progress_percent, 0)::int AS progress_percent,
            lp.last_seen_at,
            bq.score_percent AS best_quiz_score,
            lq.score_percent AS last_quiz_score,
            lq.passed AS last_quiz_passed,
            COALESCE(lq.submitted_at, lq.created_at) AS last_quiz_at
          FROM modules m
          JOIN lessons l ON l.module_id = m.id
          LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $2
          LEFT JOIN best_quiz bq ON bq.lesson_id = l.id
          LEFT JOIN latest_quiz lq ON lq.lesson_id = l.id
          WHERE m.course_id = $1
          ORDER BY m.position ASC, l.position ASC
        `,
        [group.course_id, studentId],
      );

      const modulesMap = new Map();
      let totalLessons = 0;
      let completedLessons = 0;

      for (const row of lessonsRes.rows) {
        if (!modulesMap.has(row.module_id)) {
          modulesMap.set(row.module_id, {
            id: row.module_id,
            title: row.module_title,
            position: row.module_position,
            lessons: [],
          });
        }

        totalLessons += 1;
        if (row.progress_status === 'done') {
          completedLessons += 1;
        }

        modulesMap.get(row.module_id).lessons.push({
          id: row.lesson_id,
          title: row.lesson_title,
          position: row.lesson_position,
          contentType: row.content_type,
          status: row.progress_status,
          progressPercent: row.progress_percent,
          lastSeenAt: row.last_seen_at,
          bestQuizScore: row.best_quiz_score ?? null,
          lastQuizScore: row.last_quiz_score ?? null,
          lastQuizPassed: row.last_quiz_passed ?? null,
          lastQuizAt: row.last_quiz_at,
        });
      }

      const percent = totalLessons === 0 ? 0 : Math.round((completedLessons * 100) / totalLessons);

      return res.json({
        groupId,
        courseId: group.course_id,
        student: {
          id: student.id,
          fullName: student.full_name,
          email: student.email,
        },
        totalLessons,
        completedLessons,
        percent,
        modules: Array.from(modulesMap.values()),
      });
    } catch (err) {
      console.error('Failed to load student group progress detail', err);
      return res.status(500).json({ error: 'Failed to load student progress detail' });
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
          WHERE e.course_id = $1
            AND EXISTS (
              SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id
                AND r.name = 'student'
            )
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
  requireGroupTeacherOrAdmin((req) => req.params.id),
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
          WHERE gs.group_id = $1
            AND EXISTS (
              SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id
                AND r.name = 'student'
            )
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

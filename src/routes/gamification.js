const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireGlobalRoleAny, hasGlobalRole } = require('../middleware/roles');
const { uuidSchema, formatZodError } = require('../utils/validators');
const { ensureCourseExists, hasCourseRole } = require('../utils/roleService');
const {
  getUserGamificationSummary,
  getCourseLeaderboard,
  getAdminGamificationOverview,
} = require('../services/gamification');

const router = express.Router();
router.use(auth);

const canViewCourseGamification = async (req, courseId) => {
  if (hasGlobalRole(req.user, 'admin')) return true;

  const course = await ensureCourseExists(courseId);
  if (!course) return false;

  if (course.owner_user_id === req.user.id) return true;

  const scoped = await hasCourseRole(req.user.id, courseId, ['instructor', 'enrollment_manager']);
  if (scoped) return true;

  const teacherRes = await pool.query(
    `
      SELECT 1
      FROM groups g
      JOIN group_teachers gt ON gt.group_id = g.id
      WHERE g.course_id = $1
        AND gt.user_id = $2
      LIMIT 1
    `,
    [courseId, req.user.id],
  );
  return teacherRes.rows.length > 0;
};

router.get('/gamification/me', requireGlobalRoleAny(['student', 'instructor', 'admin']), async (req, res) => {
  try {
    const summary = await getUserGamificationSummary(req.user.id, {
      weekStart: req.query.weekStart ? String(req.query.weekStart) : undefined,
    });
    return res.json(summary);
  } catch (err) {
    console.error('Failed to load my gamification summary', err);
    return res.status(500).json({ error: 'Failed to load gamification summary' });
  }
});

router.get('/courses/:courseId/gamification/leaderboard', requireGlobalRoleAny(['instructor', 'admin']), async (req, res) => {
  const parsed = uuidSchema.safeParse(req.params.courseId);
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  try {
    const allowed = await canViewCourseGamification(req, parsed.data);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const data = await getCourseLeaderboard(parsed.data, {
      weekStart: req.query.weekStart ? String(req.query.weekStart) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

    return res.json({ courseId: parsed.data, ...data });
  } catch (err) {
    console.error('Failed to load course leaderboard', err);
    return res.status(500).json({ error: 'Failed to load course leaderboard' });
  }
});

router.get('/admin/gamification/overview', requireGlobalRoleAny(['admin']), async (req, res) => {
  try {
    const data = await getAdminGamificationOverview({
      weekStart: req.query.weekStart ? String(req.query.weekStart) : undefined,
    });
    return res.json(data);
  } catch (err) {
    console.error('Failed to load gamification overview', err);
    return res.status(500).json({ error: 'Failed to load gamification overview' });
  }
});

module.exports = router;

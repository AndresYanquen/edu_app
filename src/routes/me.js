const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireGlobalRoleAny, hasGlobalRole } = require('../middleware/roles');
const { getGlobalRolesForUser } = require('../utils/roleService');

const FALLBACK_LEVEL_CODE = 'A1';
const COURSE_LEVEL_JOIN = 'LEFT JOIN course_levels cl ON cl.id = c.level_id';

const router = express.Router();

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          u.id,
          u.email,
          u.full_name,
          u.status,
          u.is_active
        FROM users u
        WHERE u.id = $1
        LIMIT 1
      `,
      [req.user.id],
    );

    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const globalRoles = await getGlobalRolesForUser(user.id);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        status: user.status,
        isActive: user.is_active,
      },
      globalRoles,
    });
  } catch (err) {
    console.error('Failed to fetch profile', err);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.get('/courses', requireGlobalRoleAny(['student', 'instructor', 'admin']), async (req, res) => {
  const { id: userId } = req.user;

  try {
    let rows = [];

    if (hasGlobalRole(req.user, 'student')) {
      ({ rows } = await pool.query(
        `
          SELECT DISTINCT
            c.id,
            c.title,
            c.description,
            COALESCE(cl.code, '${FALLBACK_LEVEL_CODE}') AS level,
            c.status,
            c.owner_user_id,
            c.is_published,
            c.published_at
          FROM enrollments e
          JOIN courses c ON c.id = e.course_id
          ${COURSE_LEVEL_JOIN}
          WHERE e.user_id = $1 AND c.is_published = true
          ORDER BY c.title
        `,
        [userId],
      ));
    } else if (hasGlobalRole(req.user, 'instructor')) {
      ({ rows } = await pool.query(
        `
          SELECT DISTINCT
            c.id,
            c.title,
            c.description,
            COALESCE(cl.code, '${FALLBACK_LEVEL_CODE}') AS level,
            c.status,
            c.owner_user_id
          FROM courses c
          LEFT JOIN groups g ON g.course_id = c.id
          LEFT JOIN group_teachers gt ON gt.group_id = g.id
          ${COURSE_LEVEL_JOIN}
          WHERE c.owner_user_id = $1 OR gt.user_id = $1
          ORDER BY c.title
        `,
        [userId],
      ));
    } else if (hasGlobalRole(req.user, 'admin')) {
      ({ rows } = await pool.query(
        `
          SELECT
            c.id,
            c.title,
            c.description,
            COALESCE(cl.code, '${FALLBACK_LEVEL_CODE}') AS level,
            c.status,
            c.owner_user_id
          FROM courses c
          ${COURSE_LEVEL_JOIN}
          ORDER BY c.created_at DESC
        `,
      ));
    } else {
      return res.status(403).json({ error: 'Unsupported role' });
    }

    return res.json(rows);
  } catch (err) {
    console.error('Failed to fetch user courses', err);
    return res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

module.exports = router;

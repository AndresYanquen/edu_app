const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

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
          m.role,
          m.status
        FROM users u
        JOIN academy_memberships m ON m.user_id = u.id
        WHERE u.id = $1
        LIMIT 1
      `,
      [req.user.id],
    );

    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      membershipStatus: user.status,
    });
  } catch (err) {
    console.error('Failed to fetch profile', err);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.get('/courses', requireRole(['student', 'instructor', 'admin']), async (req, res) => {
  const { id: userId, role } = req.user;

  try {
    let rows = [];

    if (role === 'student') {
      ({ rows } = await pool.query(
        `
          SELECT DISTINCT
            c.id,
            c.title,
            c.description,
            c.level,
            c.status,
            c.owner_user_id,
            c.is_published,
            c.published_at
          FROM enrollments e
          JOIN courses c ON c.id = e.course_id
          WHERE e.user_id = $1 AND c.is_published = true
          ORDER BY c.title
        `,
        [userId],
      ));
    } else if (role === 'instructor') {
      ({ rows } = await pool.query(
        `
          SELECT DISTINCT
            c.id,
            c.title,
            c.description,
            c.level,
            c.status,
            c.owner_user_id
          FROM courses c
          LEFT JOIN groups g ON g.course_id = c.id
          LEFT JOIN group_teachers gt ON gt.group_id = g.id
          WHERE c.owner_user_id = $1 OR gt.user_id = $1
          ORDER BY c.title
        `,
        [userId],
      ));
    } else if (role === 'admin') {
      ({ rows } = await pool.query(
        `
          SELECT
            c.id,
            c.title,
            c.description,
            c.level,
            c.status,
            c.owner_user_id
          FROM courses c
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

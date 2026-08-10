const jwt = require('jsonwebtoken');
const pool = require('../db');
const env = require('../config/env');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.replace('Bearer', '').trim();
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (!payload || !payload.id || !Number.isInteger(Number(payload.tokenVersion))) {
    return res.status(401).json({ error: 'Invalid token payload' });
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT
          u.id,
          u.is_active,
          u.must_set_password,
          COALESCE(u.token_version, 0)::int AS token_version,
          COALESCE(
            (
              SELECT array_agg(r.name ORDER BY r.name)
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id
            ),
            '{}'
          ) AS global_roles
        FROM users u
        WHERE u.id = $1
        LIMIT 1
      `,
      [payload.id],
    );

    const user = rows[0];
    if (!user || !user.is_active || user.must_set_password) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (Number(user.token_version || 0) !== Number(payload.tokenVersion)) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = {
      id: user.id,
      globalRoles: Array.isArray(user.global_roles) ? user.global_roles : [],
    };
    return next();
  } catch (err) {
    console.error('Failed to validate access token state', err);
    return res.status(500).json({ error: 'Failed to validate session' });
  }
};

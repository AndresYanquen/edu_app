const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireGlobalRoleAny } = require('../middleware/roles');

const router = express.Router();

router.use(auth);

const normalizeSource = (value) => {
  const source = String(value || '').trim().toLowerCase();
  if (!source) return 'web';
  if (source.length > 32) return source.slice(0, 32);
  return source;
};

const resolveClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const firstForwarded = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : String(forwardedFor || '').split(',')[0].trim();
  const ip = firstForwarded || req.ip || req.socket?.remoteAddress || null;
  return ip || null;
};

router.post('/presence/ping', requireGlobalRoleAny(['student']), async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const source = normalizeSource(req.body?.source);
  const ip = resolveClientIp(req);

  try {
    const { rows } = await pool.query(
      `
        UPDATE users
        SET
          last_seen_at = now(),
          last_seen_source = $2,
          last_seen_ip = NULLIF($3, '')::inet
        WHERE id = $1
        RETURNING id, last_seen_at
      `,
      [req.user.id, source, ip],
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(204).send();
  } catch (err) {
    console.error('Failed to update presence ping', err);
    return res.status(500).json({ error: 'Failed to update presence' });
  }
});

module.exports = router;

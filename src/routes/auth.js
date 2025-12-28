const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { loginSchema, activationSchema, formatZodError } = require('../utils/validators');
const {
  createAccessToken,
  generateRefreshToken,
  buildCookieOptions,
  hashRefreshToken,
} = require('../utils/authTokens');
const { hashInviteToken } = require('../utils/inviteTokens');

const router = express.Router();
const refreshCookieOptions = buildCookieOptions();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in a minute.' },
});

const setRefreshCookie = (res, token) => {
  res.cookie('refresh_token', token, refreshCookieOptions);
};

const clearRefreshCookie = (res) => {
  res.clearCookie('refresh_token', {
    path: refreshCookieOptions.path,
    sameSite: refreshCookieOptions.sameSite,
    secure: refreshCookieOptions.secure,
    httpOnly: refreshCookieOptions.httpOnly,
  });
};

const insertRefreshToken = async (userId, hash, expiresAt) => {
  await pool.query(
    `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `,
    [userId, hash, expiresAt.toISOString()],
  );
};

const revokeRefreshTokenByHash = async (hash) => {
  await pool.query(
    `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL
    `,
    [hash],
  );
};

const revokeRefreshTokenById = async (id) => {
  await pool.query(
    `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE id = $1 AND revoked_at IS NULL
    `,
    [id],
  );
};

router.post('/login', loginLimiter, async (req, res) => {
  const parsedBody = loginSchema.safeParse(req.body || {});
  if (!parsedBody.success) {
    return res.status(400).json({ error: formatZodError(parsedBody.error) });
  }
  const { email, password } = parsedBody.data;

  try {
    const { rows } = await pool.query(
      `
        SELECT
          u.id,
          u.email,
          u.password_hash,
          u.full_name,
          u.must_set_password,
          u.is_active,
          m.role,
          m.status AS membership_status
        FROM users u
        JOIN academy_memberships m ON m.user_id = u.id
        WHERE LOWER(u.email) = LOWER($1)
        LIMIT 1
      `,
      [email],
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.membership_status !== 'active') {
      return res.status(403).json({ error: 'User membership is not active' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'User is not active' });
    }

    if (user.must_set_password) {
      return res.status(403).json({ error: 'Account not activated' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash || '');
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const accessToken = createAccessToken({ id: user.id, role: user.role });
    const refreshToken = generateRefreshToken();
    await insertRefreshToken(user.id, refreshToken.hash, refreshToken.expiresAt);
    setRefreshCookie(res, refreshToken.token);

    return res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error', err);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

router.post('/refresh', async (req, res) => {
  const rawToken = req.cookies?.refresh_token;
  if (!rawToken) {
    return res.status(401).json({ error: 'Refresh token missing' });
  }

  const tokenHash = hashRefreshToken(rawToken);

  try {
    const { rows } = await pool.query(
      `
        SELECT id, user_id
        FROM refresh_tokens
        WHERE token_hash = $1
          AND revoked_at IS NULL
          AND expires_at > now()
        LIMIT 1
      `,
      [tokenHash],
    );

    const tokenRow = rows[0];
    if (!tokenRow) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const userRes = await pool.query(
      `
        SELECT u.id, u.email, u.full_name, m.role
        FROM users u
        JOIN academy_memberships m ON m.user_id = u.id
        WHERE u.id = $1
        LIMIT 1
      `,
      [tokenRow.user_id],
    );

    const user = userRes.rows[0];
    if (!user) {
      await revokeRefreshTokenById(tokenRow.id);
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    await revokeRefreshTokenById(tokenRow.id);

    const newRefresh = generateRefreshToken();
    await insertRefreshToken(user.id, newRefresh.hash, newRefresh.expiresAt);
    setRefreshCookie(res, newRefresh.token);

    const accessToken = createAccessToken({ id: user.id, role: user.role });

    return res.json({ accessToken });
  } catch (err) {
    console.error('Refresh token error', err);
    return res.status(500).json({ error: 'Failed to refresh token' });
  }
});

router.post('/logout', async (req, res) => {
  const rawToken = req.cookies?.refresh_token;
  if (rawToken) {
    try {
      const tokenHash = hashRefreshToken(rawToken);
      await revokeRefreshTokenByHash(tokenHash);
    } catch (err) {
      console.error('Failed to revoke refresh token during logout', err);
    }
  }

  clearRefreshCookie(res);

  return res.json({ ok: true });
});

router.post('/activate', async (req, res) => {
  const parsed = activationSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  const { token, password } = parsed.data;
  const tokenHash = hashInviteToken(token);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inviteRes = await client.query(
      `
        SELECT ui.id, ui.user_id, ui.expires_at, ui.used_at, u.must_set_password
        FROM user_invites ui
        JOIN users u ON u.id = ui.user_id
        WHERE ui.token_hash = $1
        LIMIT 1
      `,
      [tokenHash],
    );

    const invite = inviteRes.rows[0];
    if (!invite || invite.used_at || !invite.must_set_password || new Date(invite.expires_at) <= new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await client.query(
      `
        UPDATE users
        SET password_hash = $1, must_set_password = false, is_active = true
        WHERE id = $2
      `,
      [passwordHash, invite.user_id],
    );

    await client.query('UPDATE user_invites SET used_at = now() WHERE id = $1', [invite.id]);

    await client.query('COMMIT');

    return res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to activate account', err);
    return res.status(500).json({ error: 'Failed to activate account' });
  } finally {
    client.release();
  }
});

module.exports = router;

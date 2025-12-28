const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { userCreateSchema, formatZodError } = require('../utils/validators');
const { generateInviteToken } = require('../utils/inviteTokens');

const router = express.Router();

router.use(auth);
router.use(requireRole(['admin']));

const createInvite = async (client, userId) => {
  const invite = generateInviteToken();

  await client.query(
    `
      INSERT INTO user_invites (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `,
    [userId, invite.hash, invite.expiresAt.toISOString()],
  );

  return { rawToken: invite.token, expiresAt: invite.expiresAt };
};

const fetchManagedUser = async (client, userId) => {
  const { rows } = await client.query(
    `
      SELECT u.id, u.email, u.full_name, u.is_active, m.role, m.status
      FROM users u
      JOIN academy_memberships m ON m.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId],
  );
  const user = rows[0];
  if (!user) {
    return null;
  }
  if (user.role === 'admin') {
    throw new Error('Cannot manage admin user');
  }
  return user;
};

const updateUserActivation = async (client, userId, isActive) => {
  const membershipStatus = isActive ? 'active' : 'suspended';
  await client.query('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, userId]);
  await client.query('UPDATE academy_memberships SET status = $1 WHERE user_id = $2', [
    membershipStatus,
    userId,
  ]);
};

router.post('/users', async (req, res) => {
  const parsed = userCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  const { fullName, email, role } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already exists' });
    }

    const userInsert = await client.query(
      `
        INSERT INTO users (email, full_name, password_hash, must_set_password)
        VALUES ($1, $2, '', true)
        RETURNING id, email, full_name, created_at
      `,
      [email, fullName],
    );
    const user = userInsert.rows[0];

    await client.query(
      `
        INSERT INTO academy_memberships (user_id, role)
        VALUES ($1, $2)
      `,
      [user.id, role],
    );

    const invite = await createInvite(client, user.id);

    await client.query('COMMIT');

    const activationLink = `${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}/activate?token=${invite.rawToken}`;

    return res.status(201).json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role,
      activationLink,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to create user', err);
    return res.status(500).json({ error: 'Failed to create user' });
  } finally {
    client.release();
  }
});

router.get('/users', async (req, res) => {
  const roleFilter = req.query.role;
  try {
    const params = [];
    let filter = '';
    if (roleFilter && ['student', 'instructor'].includes(roleFilter)) {
      params.push(roleFilter);
      filter = 'WHERE m.role = $1';
    }

    const { rows } = await pool.query(
      `
        SELECT u.id, u.full_name, u.email, m.role, u.must_set_password, u.is_active, m.status, u.created_at
        FROM users u
        JOIN academy_memberships m ON m.user_id = u.id
        ${filter}
        ORDER BY u.created_at DESC
      `,
      params,
    );
    return res.json(rows);
  } catch (err) {
    console.error('Failed to list users', err);
    return res.status(500).json({ error: 'Failed to list users' });
  }
});

router.post('/users/:id/reset-password', async (req, res) => {
  const userId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      `
        SELECT u.id, u.email, u.full_name
        FROM users u
        JOIN academy_memberships m ON m.user_id = u.id
        WHERE u.id = $1 AND m.role IN ('student','instructor')
        LIMIT 1
      `,
      [userId],
    );
    const user = userRes.rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    await client.query('UPDATE users SET must_set_password = true WHERE id = $1', [userId]);
    await client.query('UPDATE user_invites SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId]);

    const invite = await createInvite(client, userId);

    await client.query('COMMIT');

    const activationLink = `${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}/activate?token=${invite.rawToken}`;
    return res.json({ id: userId, activationLink });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to reset password', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  } finally {
    client.release();
  }
});

const buildUserResponse = (user) => ({
  id: user.id,
  email: user.email,
  full_name: user.full_name,
  role: user.role,
  is_active: user.is_active,
  status: user.status,
});

router.post('/users/:id/deactivate', async (req, res) => {
  const userId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await fetchManagedUser(client, userId);
    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.is_active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'User already inactive' });
    }

    await updateUserActivation(client, userId, false);
    const updated = await fetchManagedUser(client, userId);
    await client.query('COMMIT');
    return res.json(buildUserResponse(updated));
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.message === 'Cannot manage admin user') {
      return res.status(403).json({ error: 'Cannot modify admin user' });
    }
    console.error('Failed to deactivate user', err);
    return res.status(500).json({ error: 'Failed to deactivate user' });
  } finally {
    client.release();
  }
});

router.post('/users/:id/activate', async (req, res) => {
  const userId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await fetchManagedUser(client, userId);
    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.is_active && user.status === 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'User already active' });
    }

    await updateUserActivation(client, userId, true);
    const updated = await fetchManagedUser(client, userId);
    await client.query('COMMIT');
    return res.json(buildUserResponse(updated));
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.message === 'Cannot manage admin user') {
      return res.status(403).json({ error: 'Cannot modify admin user' });
    }
    console.error('Failed to activate user', err);
    return res.status(500).json({ error: 'Failed to activate user' });
  } finally {
    client.release();
  }
});

module.exports = router;

const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireGlobalRoleAny, hasGlobalRole } = require('../middleware/roles');
const { getGlobalRolesForUser } = require('../utils/roleService');

const FALLBACK_LEVEL_CODE = 'A1';
const COURSE_LEVEL_JOIN = 'LEFT JOIN course_levels cl ON cl.id = c.level_id';

const router = express.Router();

router.use(auth);

const getQuentliConfig = () => ({
  apiUrl: (process.env.QUENTLI_API_URL || 'https://api.quentli.com').replace(/\/+$/, ''),
  apiToken: process.env.QUENTLI_API_TOKEN || '',
});

const fetchQuentliCustomerByEmail = async (email) => {
  const { apiUrl, apiToken } = getQuentliConfig();

  if (!apiToken) {
    const err = new Error('QUENTLI_API_TOKEN is not configured');
    err.statusCode = 503;
    throw err;
  }

  const url = new URL('/v1/customers', apiUrl);
  url.searchParams.set('take', '3');
  url.searchParams.set('filter[email][contains]', email);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (err) {
        payload = text;
      }
    }

    if (!response.ok) {
      const err = new Error('Quentli customer lookup failed');
      err.statusCode = response.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
};

const normalizeQuentliList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.customers)) return payload.customers;
  if (Array.isArray(payload?.payments)) return payload.payments;
  return [];
};

const getQuentliCustomerUsername = (customerPayload) => {
  const customer = normalizeQuentliList(customerPayload)[0] || customerPayload?.customer || null;
  return customer?.username || customer?.userName || customer?.customerUsername || '';
};

const fetchQuentliPendingPaymentsByUsername = async (username) => {
  if (!username) {
    return null;
  }

  const { apiUrl, apiToken } = getQuentliConfig();

  if (!apiToken) {
    const err = new Error('QUENTLI_API_TOKEN is not configured');
    err.statusCode = 503;
    throw err;
  }

  const url = new URL('/v1/payments', apiUrl);
  url.searchParams.set('filter[customer][username][equals]', username);
  url.searchParams.set('filter[status][equals]', 'INCOMPLETE');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (err) {
        payload = text;
      }
    }

    if (!response.ok) {
      const err = new Error('Quentli pending payments lookup failed');
      err.statusCode = response.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
};

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

router.get('/customer', requireGlobalRoleAny(['student']), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT email
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [req.user.id],
    );

    const email = rows[0]?.email;
    if (!email) {
      return res.status(404).json({ error: 'User email not found' });
    }

    const customerData = await fetchQuentliCustomerByEmail(email);
    const username = getQuentliCustomerUsername(customerData);
    const pendingPayments = await fetchQuentliPendingPaymentsByUsername(username);

    return res.json({
      email,
      username,
      customerData,
      pendingPayments,
    });
  } catch (err) {
    const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    console.error('Failed to fetch Quentli customer', err.payload || err);
    return res.status(statusCode).json({ error: 'Failed to fetch customer data' });
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

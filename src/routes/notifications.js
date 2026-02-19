const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const {
  buildVisibleAnnouncementsWhereClause,
  isAnnouncementVisibleToUser,
  isUuid,
} = require('../services/announcementNotifications');

const router = express.Router();

router.use(auth);

router.get('/notifications/announcements', async (req, res) => {
  const userId = req.user.id;
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const rawOffset = Number.parseInt(req.query.offset, 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const unreadOnly =
    req.query.unreadOnly === true ||
    req.query.unreadOnly === 'true' ||
    req.query.unreadOnly === '1';

  const visibilityClause = buildVisibleAnnouncementsWhereClause({
    announcementAlias: 'a',
    userIdParam: '$1',
  });

  try {
    const unreadOnlyClause = unreadOnly ? 'AND ar.announcement_id IS NULL' : '';
    const { rows } = await pool.query(
      `
        SELECT
          a.id,
          a.scope,
          a.course_id,
          a.group_id,
          a.created_by_user_id,
          a.title,
          a.body,
          a.status,
          a.priority,
          a.starts_at,
          a.expires_at,
          a.created_at,
          (ar.read_at IS NOT NULL) AS is_read,
          ar.read_at
        FROM announcements a
        LEFT JOIN announcement_reads ar
          ON ar.announcement_id = a.id
         AND ar.user_id = $1
        WHERE ${visibilityClause}
          ${unreadOnlyClause}
        ORDER BY a.priority ASC, a.created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset],
    );

    return res.json({
      items: rows.map((row) => ({
        id: row.id,
        scope: row.scope,
        courseId: row.course_id || null,
        groupId: row.group_id || null,
        createdByUserId: row.created_by_user_id || null,
        title: row.title,
        body: row.body,
        status: row.status,
        priority: Number(row.priority),
        startsAt: row.starts_at || null,
        expiresAt: row.expires_at || null,
        createdAt: row.created_at,
        isRead: Boolean(row.is_read),
        readAt: row.read_at || null,
      })),
      limit,
      offset,
    });
  } catch (err) {
    console.error('Failed to list announcements', err);
    return res.status(500).json({ error: 'Failed to list announcements' });
  }
});

router.get('/notifications/announcements/unread-count', async (req, res) => {
  const userId = req.user.id;
  const visibilityClause = buildVisibleAnnouncementsWhereClause({
    announcementAlias: 'a',
    userIdParam: '$1',
  });

  try {
    const { rows } = await pool.query(
      `
        SELECT COUNT(DISTINCT a.id)::int AS count
        FROM announcements a
        LEFT JOIN announcement_reads ar
          ON ar.announcement_id = a.id
         AND ar.user_id = $1
        WHERE ${visibilityClause}
          AND ar.announcement_id IS NULL
      `,
      [userId],
    );

    return res.json({ count: Number(rows[0]?.count || 0) });
  } catch (err) {
    console.error('Failed to fetch unread announcement count', err);
    return res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

router.post('/notifications/announcements/:id/read', async (req, res) => {
  const userId = req.user.id;
  const announcementId = req.params.id;

  if (!isUuid(announcementId)) {
    return res.status(400).json({ error: 'Invalid announcement id' });
  }

  try {
    const isVisible = await isAnnouncementVisibleToUser(pool, {
      userId,
      announcementId,
    });
    if (!isVisible) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    await pool.query(
      `
        INSERT INTO announcement_reads (announcement_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (announcement_id, user_id) DO NOTHING
      `,
      [announcementId, userId],
    );

    return res.status(204).send();
  } catch (err) {
    console.error('Failed to mark announcement as read', err);
    return res.status(500).json({ error: 'Failed to mark announcement as read' });
  }
});

router.post('/notifications/announcements/read-all', async (req, res) => {
  const userId = req.user.id;
  const visibilityClause = buildVisibleAnnouncementsWhereClause({
    announcementAlias: 'a',
    userIdParam: '$1',
  });

  try {
    const { rows } = await pool.query(
      `
        INSERT INTO announcement_reads (announcement_id, user_id)
        SELECT a.id, $1
        FROM announcements a
        WHERE ${visibilityClause}
        ON CONFLICT (announcement_id, user_id) DO NOTHING
        RETURNING announcement_id
      `,
      [userId],
    );

    return res.json({ inserted: rows.length });
  } catch (err) {
    console.error('Failed to mark all announcements as read', err);
    return res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

module.exports = router;

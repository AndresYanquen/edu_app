const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireGlobalRoleAny, hasGlobalRole } = require('../middleware/roles');
const { uuidSchema, formatZodError } = require('../utils/validators');

const router = express.Router();

router.get(
  '/lessons/:lessonId/live',
  auth,
  requireGlobalRoleAny(['student', 'admin']),
  async (req, res) => {
    const { lessonId } = req.params;

    try {
      const lessonRes = await pool.query(
        `
          SELECT l.id, m.course_id, l.meeting_url
          FROM lessons l
          JOIN modules m ON m.id = l.module_id
          WHERE l.id = $1
          LIMIT 1
        `,
        [lessonId],
      );
      const lesson = lessonRes.rows[0];

      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }

      const isAdmin = hasGlobalRole(req.user, 'admin');
      let groupId = null;

      if (isAdmin && req.query.groupId) {
        const parsedGroup = uuidSchema.safeParse(req.query.groupId);
        if (!parsedGroup.success) {
          return res.status(400).json({ error: formatZodError(parsedGroup.error) });
        }

        const groupRes = await pool.query(
          'SELECT id, course_id FROM groups WHERE id = $1 LIMIT 1',
          [parsedGroup.data],
        );
        const group = groupRes.rows[0];
        if (!group) {
          return res.status(404).json({ error: 'Group not found' });
        }
        if (group.course_id !== lesson.course_id) {
          return res.status(400).json({ error: 'Group does not belong to this course' });
        }
        groupId = group.id;
      } else {
        const enrollmentRes = await pool.query(
          `
            SELECT group_id
            FROM enrollments
            WHERE course_id = $1 AND user_id = $2
            LIMIT 1
          `,
          [lesson.course_id, req.user.id],
        );
        const enrollment = enrollmentRes.rows[0];
        if (!enrollment) {
          return res.status(403).json({ error: 'You are not enrolled in this course' });
        }
        if (!enrollment.group_id) {
          return res.status(409).json({ error: 'No group assigned for this enrollment' });
        }
        groupId = enrollment.group_id;
      }

      if (!groupId) {
        return res.status(400).json({ error: 'Group assignment is required' });
      }

      const sessionRes = await pool.query(
        `
          SELECT
            id,
            starts_at,
            ends_at,
            meeting_url,
            unlock_offset_minutes
          FROM group_lesson_sessions
          WHERE group_id = $1 AND lesson_id = $2
          LIMIT 1
        `,
        [groupId, lessonId],
      );
      const session = sessionRes.rows[0];
      if (!session) {
        return res.status(404).json({ error: 'Live session not scheduled' });
      }

      const startsAt = session.starts_at;
      const unlockOffsetMinutes = session.unlock_offset_minutes ?? 0;
      const unlockAt = new Date(startsAt.getTime() - unlockOffsetMinutes * 60 * 1000);
      const meetingUnlockAt = new Date(startsAt.getTime() - 5 * 60 * 1000);
      const now = new Date();
      const isUnlocked = now >= unlockAt;
      const meetingUnlocked = now >= meetingUnlockAt;
      const sourceMeetingUrl = session.meeting_url || lesson.meeting_url || null;
      const hasMeetingUrl = Boolean(sourceMeetingUrl);

      return res.json({
        lessonId,
        groupId,
        startsAt: startsAt.toISOString(),
        endsAt: session.ends_at ? session.ends_at.toISOString() : null,
        unlockAt: unlockAt.toISOString(),
        isUnlocked,
        meetingUnlocked,
        meetingUnlockAt: meetingUnlockAt.toISOString(),
        hasMeetingUrl,
        meetingUrl: sourceMeetingUrl,
      });
    } catch (err) {
      console.error('Failed to load live session info', err);
      return res.status(500).json({ error: 'Failed to load live session info' });
    }
  },
);

module.exports = router;

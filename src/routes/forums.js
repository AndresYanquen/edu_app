const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { hasGlobalRole } = require('../middleware/roles');
const { hasCourseRole, isGroupTeacher } = require('../utils/roleService');

const router = express.Router();
router.use(auth);

const FORUM_SCOPES = new Set(['global', 'course', 'group']);
const REACTION_TYPES = new Set(['like', 'love', 'insightful', 'celebrate', 'support']);

const isValidUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ''),
  );

const normalizeForum = (row) => ({
  id: row.id,
  scope: row.scope,
  courseId: row.course_id || null,
  groupId: row.group_id || null,
  title: row.title,
  description: row.description || null,
  isActive: Boolean(row.is_active),
  createdBy: row.created_by || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeThread = (row) => ({
  id: row.id,
  forumId: row.forum_id,
  authorUserId: row.author_user_id || null,
  authorName: row.author_name || null,
  title: row.title,
  body: row.body,
  isPinned: Boolean(row.is_pinned),
  isLocked: Boolean(row.is_locked),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  repliesCount: Number(row.replies_count || 0),
  unread: Boolean(row.unread),
  myReaction: row.my_reaction || null,
  reactionsSummary: Array.isArray(row.reactions_summary) ? row.reactions_summary : [],
});

const normalizePost = (row) => ({
  id: row.id,
  threadId: row.thread_id,
  authorUserId: row.author_user_id || null,
  authorName: row.author_name || null,
  parentPostId: row.parent_post_id || null,
  body: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getGroupCourseId = async (groupId) => {
  const { rows } = await pool.query('SELECT course_id FROM groups WHERE id = $1 LIMIT 1', [groupId]);
  return rows[0]?.course_id || null;
};

const isEnrolledInCourse = async (userId, courseId) => {
  const { rows } = await pool.query(
    `
      SELECT 1
      FROM enrollments
      WHERE user_id = $1
        AND course_id = $2
        AND status = 'active'
      LIMIT 1
    `,
    [userId, courseId],
  );
  return rows.length > 0;
};

const isStudentInGroup = async (userId, groupId) => {
  const { rows } = await pool.query(
    `
      SELECT 1
      FROM group_students
      WHERE user_id = $1
        AND group_id = $2
        AND status = 'active'
      LIMIT 1
    `,
    [userId, groupId],
  );
  return rows.length > 0;
};

const canViewForum = async (user, forum) => {
  if (hasGlobalRole(user, 'admin')) return true;
  if (forum.scope === 'global') return true;

  if (forum.scope === 'course') {
    if (!forum.course_id) return false;
    const staff = await hasCourseRole(user.id, forum.course_id, [
      'instructor',
      'content_editor',
      'enrollment_manager',
    ]);
    if (staff) return true;
    return isEnrolledInCourse(user.id, forum.course_id);
  }

  if (forum.scope === 'group') {
    if (!forum.group_id) return false;
    const teacher = await isGroupTeacher(user.id, forum.group_id);
    if (teacher) return true;
    return isStudentInGroup(user.id, forum.group_id);
  }

  return false;
};

const canManageForum = async (user, forum) => {
  if (hasGlobalRole(user, 'admin')) return true;
  if (forum.scope === 'global') return false;

  if (forum.scope === 'course') {
    if (!forum.course_id) return false;
    return hasCourseRole(user.id, forum.course_id, ['instructor', 'content_editor']);
  }

  if (forum.scope === 'group') {
    if (!forum.group_id) return false;
    return isGroupTeacher(user.id, forum.group_id);
  }

  return false;
};

const fetchForumById = async (forumId) => {
  const { rows } = await pool.query(
    `
      SELECT id, scope, course_id, group_id, title, description, is_active, created_by, created_at, updated_at
      FROM forums
      WHERE id = $1
      LIMIT 1
    `,
    [forumId],
  );
  return rows[0] || null;
};

const fetchThreadById = async (threadId) => {
  const { rows } = await pool.query(
    `
      SELECT id, forum_id, author_user_id, title, body, is_pinned, is_locked, created_at, updated_at
      FROM forum_threads
      WHERE id = $1
      LIMIT 1
    `,
    [threadId],
  );
  return rows[0] || null;
};

const fetchPostById = async (postId) => {
  const { rows } = await pool.query(
    `
      SELECT id, thread_id, author_user_id, parent_post_id, body, created_at, updated_at
      FROM forum_posts
      WHERE id = $1
      LIMIT 1
    `,
    [postId],
  );
  return rows[0] || null;
};

const ensureGroupForumsForUser = async (userId) => {
  await pool.query(
    `
      INSERT INTO forums (
        scope,
        course_id,
        group_id,
        title,
        description,
        is_active,
        created_by,
        created_at,
        updated_at
      )
      SELECT
        'group' AS scope,
        g.course_id,
        g.id AS group_id,
        g.name AS title,
        'Foro del grupo' AS description,
        true AS is_active,
        NULL::uuid AS created_by,
        now(),
        now()
      FROM groups g
      JOIN group_students gs ON gs.group_id = g.id
      LEFT JOIN forums f
        ON f.scope = 'group'
       AND f.group_id = g.id
      WHERE gs.user_id = $1
        AND gs.status = 'active'
        AND f.id IS NULL
    `,
    [userId],
  );
};

const withThreadReactions = async (rows, userId) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const threadIds = rows.map((row) => row.id).filter(Boolean);
  if (!threadIds.length) return rows;

  const [summaryResult, myResult] = await Promise.all([
    pool.query(
      `
        SELECT
          thread_id,
          reaction_type,
          COUNT(*)::int AS count
        FROM forum_reactions
        WHERE thread_id = ANY($1::uuid[])
        GROUP BY thread_id, reaction_type
      `,
      [threadIds],
    ),
    pool.query(
      `
        SELECT thread_id, reaction_type
        FROM forum_reactions
        WHERE user_id = $1
          AND thread_id = ANY($2::uuid[])
      `,
      [userId, threadIds],
    ),
  ]);

  const summaryByThread = new Map();
  for (const row of summaryResult.rows) {
    const bucket = summaryByThread.get(row.thread_id) || [];
    bucket.push({
      type: row.reaction_type,
      count: Number(row.count || 0),
    });
    summaryByThread.set(row.thread_id, bucket);
  }

  const myByThread = new Map();
  for (const row of myResult.rows) {
    myByThread.set(row.thread_id, row.reaction_type);
  }

  return rows.map((row) => ({
    ...row,
    reactions_summary: summaryByThread.get(row.id) || [],
    my_reaction: myByThread.get(row.id) || null,
  }));
};

router.get('/forums', async (req, res) => {
  const scope = String(req.query.scope || '').trim();
  const courseId = String(req.query.courseId || '').trim();
  const groupId = String(req.query.groupId || '').trim();

  if (scope && !FORUM_SCOPES.has(scope)) {
    return res.status(400).json({ error: 'Invalid scope' });
  }
  if (courseId && !isValidUuid(courseId)) {
    return res.status(400).json({ error: 'courseId must be a valid UUID' });
  }
  if (groupId && !isValidUuid(groupId)) {
    return res.status(400).json({ error: 'groupId must be a valid UUID' });
  }

  try {
    if (!groupId && (!scope || scope === 'group')) {
      await ensureGroupForumsForUser(req.user.id);
    }

    const where = [];
    const values = [];
    let idx = 1;

    if (scope) {
      where.push(`f.scope = $${idx++}`);
      values.push(scope);
    }
    if (courseId) {
      where.push(`f.course_id = $${idx++}`);
      values.push(courseId);
    }
    if (groupId) {
      where.push(`f.group_id = $${idx++}`);
      values.push(groupId);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `
        SELECT
          f.id,
          f.scope,
          f.course_id,
          f.group_id,
          f.title,
          f.description,
          f.is_active,
          f.created_by,
          f.created_at,
          f.updated_at
        FROM forums f
        ${whereClause}
        ORDER BY
          CASE f.scope WHEN 'global' THEN 0 WHEN 'course' THEN 1 ELSE 2 END,
          f.created_at DESC
      `,
      values,
    );

    const visible = [];
    for (const forum of rows) {
      const canView = await canViewForum(req.user, forum);
      if (!canView) continue;
      const canManage = await canManageForum(req.user, forum);
      visible.push({ ...normalizeForum(forum), canManage });
    }

    return res.json({ items: visible });
  } catch (err) {
    console.error('Failed to list forums', err);
    return res.status(500).json({ error: 'Failed to list forums' });
  }
});

router.post('/forums', async (req, res) => {
  const scope = String(req.body?.scope || '').trim();
  const title = String(req.body?.title || '').trim();
  const descriptionRaw = req.body?.description;
  const description =
    descriptionRaw === null || descriptionRaw === undefined
      ? null
      : String(descriptionRaw).trim();
  const courseId = req.body?.courseId ? String(req.body.courseId).trim() : null;
  const groupId = req.body?.groupId ? String(req.body.groupId).trim() : null;

  if (!FORUM_SCOPES.has(scope)) {
    return res.status(400).json({ error: 'scope is required and must be global|course|group' });
  }
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (scope === 'course' && (!courseId || !isValidUuid(courseId))) {
    return res.status(400).json({ error: 'courseId is required for course forums' });
  }
  if (scope === 'group' && (!groupId || !isValidUuid(groupId))) {
    return res.status(400).json({ error: 'groupId is required for group forums' });
  }
  if (scope === 'global' && !hasGlobalRole(req.user, 'admin')) {
    return res.status(403).json({ error: 'Only admin can create global forums' });
  }

  try {
    let resolvedCourseId = courseId || null;
    let resolvedGroupId = groupId || null;

    if (scope === 'group') {
      resolvedCourseId = await getGroupCourseId(groupId);
      if (!resolvedCourseId) {
        return res.status(404).json({ error: 'Group not found' });
      }
      const canManage = await canManageForum(req.user, {
        scope: 'group',
        group_id: resolvedGroupId,
        course_id: resolvedCourseId,
      });
      if (!canManage) {
        return res.status(403).json({ error: 'You cannot create forum for this group' });
      }
    } else if (scope === 'course') {
      const canManage = await canManageForum(req.user, {
        scope: 'course',
        course_id: resolvedCourseId,
      });
      if (!canManage) {
        return res.status(403).json({ error: 'You cannot create forum for this course' });
      }
    }

    const { rows } = await pool.query(
      `
        INSERT INTO forums (
          scope,
          course_id,
          group_id,
          title,
          description,
          is_active,
          created_by,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, true, $6, now(), now())
        RETURNING id, scope, course_id, group_id, title, description, is_active, created_by, created_at, updated_at
      `,
      [scope, resolvedCourseId, resolvedGroupId, title, description, req.user.id],
    );

    return res.status(201).json(normalizeForum(rows[0]));
  } catch (err) {
    console.error('Failed to create forum', err);
    return res.status(500).json({ error: 'Failed to create forum' });
  }
});

router.patch('/forums/:forumId', async (req, res) => {
  const forumId = req.params.forumId;
  if (!isValidUuid(forumId)) {
    return res.status(400).json({ error: 'Invalid forum id' });
  }

  const forum = await fetchForumById(forumId);
  if (!forum) return res.status(404).json({ error: 'Forum not found' });

  const canManage = await canManageForum(req.user, forum);
  if (!canManage) {
    return res.status(403).json({ error: 'You cannot manage this forum' });
  }

  const updates = [];
  const values = [];
  let idx = 1;

  if (req.body?.title !== undefined) {
    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'title cannot be empty' });
    updates.push(`title = $${idx++}`);
    values.push(title);
  }
  if (req.body?.description !== undefined) {
    const description = req.body.description == null ? null : String(req.body.description).trim();
    updates.push(`description = $${idx++}`);
    values.push(description);
  }
  if (req.body?.isActive !== undefined) {
    updates.push(`is_active = $${idx++}`);
    values.push(Boolean(req.body.isActive));
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No changes provided' });
  }

  values.push(forumId);

  try {
    const { rows } = await pool.query(
      `
        UPDATE forums
        SET ${updates.join(', ')}, updated_at = now()
        WHERE id = $${idx}
        RETURNING id, scope, course_id, group_id, title, description, is_active, created_by, created_at, updated_at
      `,
      values,
    );
    return res.json(normalizeForum(rows[0]));
  } catch (err) {
    console.error('Failed to update forum', err);
    return res.status(500).json({ error: 'Failed to update forum' });
  }
});

router.get('/forums/:forumId/threads', async (req, res) => {
  const forumId = req.params.forumId;
  if (!isValidUuid(forumId)) {
    return res.status(400).json({ error: 'Invalid forum id' });
  }

  try {
    const forum = await fetchForumById(forumId);
    if (!forum) return res.status(404).json({ error: 'Forum not found' });
    const canView = await canViewForum(req.user, forum);
    if (!canView) return res.status(403).json({ error: 'You cannot view this forum' });

    const { rows } = await pool.query(
      `
        SELECT
          ft.id,
          ft.forum_id,
          ft.author_user_id,
          u.full_name AS author_name,
          ft.title,
          ft.body,
          ft.is_pinned,
          ft.is_locked,
          ft.created_at,
          ft.updated_at,
          COUNT(fp.id)::int AS replies_count,
          (fr.last_read_at IS NULL OR fr.last_read_at < ft.updated_at) AS unread
        FROM forum_threads ft
        LEFT JOIN users u ON u.id = ft.author_user_id
        LEFT JOIN forum_posts fp ON fp.thread_id = ft.id
        LEFT JOIN forum_reads fr ON fr.thread_id = ft.id AND fr.user_id = $2
        WHERE ft.forum_id = $1
        GROUP BY ft.id, u.full_name, fr.last_read_at
        ORDER BY ft.is_pinned DESC, ft.updated_at DESC
      `,
      [forumId, req.user.id],
    );

    const rowsWithReactions = await withThreadReactions(rows, req.user.id);
    const canManage = await canManageForum(req.user, forum);
    return res.json({
      forum: { ...normalizeForum(forum), canManage },
      items: rowsWithReactions.map(normalizeThread),
    });
  } catch (err) {
    console.error('Failed to list forum threads', err);
    return res.status(500).json({ error: 'Failed to list threads' });
  }
});

router.post('/forums/:forumId/threads', async (req, res) => {
  const forumId = req.params.forumId;
  const title = String(req.body?.title || '').trim();
  const body = String(req.body?.body || '').trim();

  if (!isValidUuid(forumId)) return res.status(400).json({ error: 'Invalid forum id' });
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!body) return res.status(400).json({ error: 'body is required' });

  try {
    const forum = await fetchForumById(forumId);
    if (!forum) return res.status(404).json({ error: 'Forum not found' });
    if (!forum.is_active) return res.status(400).json({ error: 'Forum is inactive' });
    const canView = await canViewForum(req.user, forum);
    if (!canView) return res.status(403).json({ error: 'You cannot post in this forum' });

    const { rows } = await pool.query(
      `
        INSERT INTO forum_threads (forum_id, author_user_id, title, body, is_pinned, is_locked, created_at, updated_at)
        VALUES ($1, $2, $3, $4, false, false, now(), now())
        RETURNING id, forum_id, author_user_id, title, body, is_pinned, is_locked, created_at, updated_at
      `,
      [forumId, req.user.id, title, body],
    );

    const row = rows[0];
    return res.status(201).json({
      ...normalizeThread({
        ...row,
        author_name: req.user.fullName || null,
        replies_count: 0,
        unread: false,
        my_reaction: null,
        reactions_summary: [],
      }),
    });
  } catch (err) {
    console.error('Failed to create forum thread', err);
    return res.status(500).json({ error: 'Failed to create thread' });
  }
});

router.patch('/threads/:threadId', async (req, res) => {
  const threadId = req.params.threadId;
  if (!isValidUuid(threadId)) return res.status(400).json({ error: 'Invalid thread id' });

  try {
    const thread = await fetchThreadById(threadId);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    const forum = await fetchForumById(thread.forum_id);
    if (!forum) return res.status(404).json({ error: 'Forum not found' });
    const canManage = await canManageForum(req.user, forum);
    const isAuthor = thread.author_user_id === req.user.id;
    const wantsContentEdit = req.body?.title !== undefined || req.body?.body !== undefined;
    const wantsModerationEdit = req.body?.isPinned !== undefined || req.body?.isLocked !== undefined;

    if (wantsContentEdit && !isAuthor) {
      return res.status(403).json({ error: 'Only the author can edit this thread content' });
    }
    if (wantsModerationEdit && !canManage) {
      return res.status(403).json({ error: 'You cannot manage this thread' });
    }
    if (!wantsContentEdit && !wantsModerationEdit) {
      return res.status(400).json({ error: 'No changes provided' });
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (req.body?.isPinned !== undefined) {
      updates.push(`is_pinned = $${idx++}`);
      values.push(Boolean(req.body.isPinned));
    }
    if (req.body?.isLocked !== undefined) {
      updates.push(`is_locked = $${idx++}`);
      values.push(Boolean(req.body.isLocked));
    }
    if (req.body?.title !== undefined) {
      const title = String(req.body.title || '').trim();
      if (!title) return res.status(400).json({ error: 'title cannot be empty' });
      updates.push(`title = $${idx++}`);
      values.push(title);
    }
    if (req.body?.body !== undefined) {
      const body = String(req.body.body || '').trim();
      if (!body) return res.status(400).json({ error: 'body cannot be empty' });
      updates.push(`body = $${idx++}`);
      values.push(body);
    }
    if (!updates.length) return res.status(400).json({ error: 'No changes provided' });

    values.push(threadId);
    const { rows } = await pool.query(
      `
        UPDATE forum_threads
        SET ${updates.join(', ')}, updated_at = now()
        WHERE id = $${idx}
        RETURNING id, forum_id, author_user_id, title, body, is_pinned, is_locked, created_at, updated_at
      `,
      values,
    );
    return res.json(
      normalizeThread({
        ...rows[0],
        replies_count: 0,
        unread: false,
        my_reaction: null,
        reactions_summary: [],
      }),
    );
  } catch (err) {
    console.error('Failed to update thread', err);
    return res.status(500).json({ error: 'Failed to update thread' });
  }
});

router.patch('/posts/:postId', async (req, res) => {
  const postId = req.params.postId;
  const body = String(req.body?.body || '').trim();

  if (!isValidUuid(postId)) return res.status(400).json({ error: 'Invalid post id' });
  if (!body) return res.status(400).json({ error: 'body cannot be empty' });

  try {
    const post = await fetchPostById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.author_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the author can edit this comment' });
    }

    const thread = await fetchThreadById(post.thread_id);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    const forum = await fetchForumById(thread.forum_id);
    if (!forum) return res.status(404).json({ error: 'Forum not found' });
    const canView = await canViewForum(req.user, forum);
    if (!canView) return res.status(403).json({ error: 'You cannot edit this comment' });

    const { rows } = await pool.query(
      `
        UPDATE forum_posts
        SET body = $2, updated_at = now()
        WHERE id = $1
        RETURNING id, thread_id, author_user_id, parent_post_id, body, created_at, updated_at
      `,
      [postId, body],
    );

    await pool.query('UPDATE forum_threads SET updated_at = now() WHERE id = $1', [thread.id]);

    return res.json(normalizePost({ ...rows[0], author_name: req.user.fullName || null }));
  } catch (err) {
    console.error('Failed to edit post', err);
    return res.status(500).json({ error: 'Failed to edit post' });
  }
});

router.delete('/threads/:threadId', async (req, res) => {
  const threadId = req.params.threadId;
  if (!isValidUuid(threadId)) return res.status(400).json({ error: 'Invalid thread id' });

  try {
    const thread = await fetchThreadById(threadId);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    const forum = await fetchForumById(thread.forum_id);
    if (!forum) return res.status(404).json({ error: 'Forum not found' });
    const canManage = await canManageForum(req.user, forum);
    const isAuthor = thread.author_user_id === req.user.id;
    if (!canManage && !isAuthor) {
      return res.status(403).json({ error: 'You cannot delete this thread' });
    }
    await pool.query('DELETE FROM forum_threads WHERE id = $1', [threadId]);
    return res.status(204).send();
  } catch (err) {
    console.error('Failed to delete thread', err);
    return res.status(500).json({ error: 'Failed to delete thread' });
  }
});

router.get('/threads/:threadId/posts', async (req, res) => {
  const threadId = req.params.threadId;
  if (!isValidUuid(threadId)) return res.status(400).json({ error: 'Invalid thread id' });

  try {
    const thread = await fetchThreadById(threadId);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    const forum = await fetchForumById(thread.forum_id);
    if (!forum) return res.status(404).json({ error: 'Forum not found' });
    const canView = await canViewForum(req.user, forum);
    if (!canView) return res.status(403).json({ error: 'You cannot view this thread' });

    const { rows } = await pool.query(
      `
        SELECT
          fp.id,
          fp.thread_id,
          fp.author_user_id,
          u.full_name AS author_name,
          fp.parent_post_id,
          fp.body,
          fp.created_at,
          fp.updated_at
        FROM forum_posts fp
        LEFT JOIN users u ON u.id = fp.author_user_id
        WHERE fp.thread_id = $1
        ORDER BY fp.created_at ASC
      `,
      [threadId],
    );

    return res.json({
      thread: normalizeThread({ ...thread, author_name: null, replies_count: rows.length, unread: false }),
      items: rows.map(normalizePost),
    });
  } catch (err) {
    console.error('Failed to list thread posts', err);
    return res.status(500).json({ error: 'Failed to list posts' });
  }
});

router.post('/threads/:threadId/posts', async (req, res) => {
  const threadId = req.params.threadId;
  const body = String(req.body?.body || '').trim();
  const parentPostId = req.body?.parentPostId ? String(req.body.parentPostId).trim() : null;
  if (!isValidUuid(threadId)) return res.status(400).json({ error: 'Invalid thread id' });
  if (!body) return res.status(400).json({ error: 'body is required' });
  if (parentPostId && !isValidUuid(parentPostId)) {
    return res.status(400).json({ error: 'parentPostId must be a valid UUID' });
  }

  try {
    const thread = await fetchThreadById(threadId);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    const forum = await fetchForumById(thread.forum_id);
    if (!forum) return res.status(404).json({ error: 'Forum not found' });
    const canView = await canViewForum(req.user, forum);
    if (!canView) return res.status(403).json({ error: 'You cannot reply in this thread' });
    if (thread.is_locked) return res.status(400).json({ error: 'Thread is locked' });

    const { rows } = await pool.query(
      `
        INSERT INTO forum_posts (thread_id, author_user_id, parent_post_id, body, created_at, updated_at)
        VALUES ($1, $2, $3, $4, now(), now())
        RETURNING id, thread_id, author_user_id, parent_post_id, body, created_at, updated_at
      `,
      [threadId, req.user.id, parentPostId, body],
    );

    await pool.query('UPDATE forum_threads SET updated_at = now() WHERE id = $1', [threadId]);

    return res.status(201).json(
      normalizePost({ ...rows[0], author_name: req.user.fullName || null }),
    );
  } catch (err) {
    console.error('Failed to create post', err);
    return res.status(500).json({ error: 'Failed to create post' });
  }
});

router.delete('/posts/:postId', async (req, res) => {
  const postId = req.params.postId;
  if (!isValidUuid(postId)) return res.status(400).json({ error: 'Invalid post id' });

  try {
    const post = await fetchPostById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const thread = await fetchThreadById(post.thread_id);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    const forum = await fetchForumById(thread.forum_id);
    if (!forum) return res.status(404).json({ error: 'Forum not found' });

    const canManage = await canManageForum(req.user, forum);
    const isAuthor = post.author_user_id === req.user.id;
    if (!canManage && !isAuthor) {
      return res.status(403).json({ error: 'You cannot delete this post' });
    }

    await pool.query('DELETE FROM forum_posts WHERE id = $1', [postId]);
    await pool.query('UPDATE forum_threads SET updated_at = now() WHERE id = $1', [thread.id]);
    return res.status(204).send();
  } catch (err) {
    console.error('Failed to delete post', err);
    return res.status(500).json({ error: 'Failed to delete post' });
  }
});

router.post('/threads/:threadId/read', async (req, res) => {
  const threadId = req.params.threadId;
  if (!isValidUuid(threadId)) return res.status(400).json({ error: 'Invalid thread id' });

  try {
    const thread = await fetchThreadById(threadId);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    const forum = await fetchForumById(thread.forum_id);
    if (!forum) return res.status(404).json({ error: 'Forum not found' });
    const canView = await canViewForum(req.user, forum);
    if (!canView) return res.status(403).json({ error: 'You cannot mark this thread as read' });

    await pool.query(
      `
        INSERT INTO forum_reads (user_id, thread_id, last_read_at)
        VALUES ($1, $2, now())
        ON CONFLICT (user_id, thread_id)
        DO UPDATE SET last_read_at = now()
      `,
      [req.user.id, threadId],
    );

    return res.status(204).send();
  } catch (err) {
    console.error('Failed to mark thread as read', err);
    return res.status(500).json({ error: 'Failed to mark thread as read' });
  }
});

router.put('/threads/:threadId/reaction', async (req, res) => {
  const threadId = req.params.threadId;
  const reactionType = String(req.body?.type || '').trim();

  if (!isValidUuid(threadId)) return res.status(400).json({ error: 'Invalid thread id' });
  if (!REACTION_TYPES.has(reactionType)) {
    return res.status(400).json({ error: 'Invalid reaction type' });
  }

  try {
    const thread = await fetchThreadById(threadId);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    const forum = await fetchForumById(thread.forum_id);
    if (!forum) return res.status(404).json({ error: 'Forum not found' });
    const canView = await canViewForum(req.user, forum);
    if (!canView) return res.status(403).json({ error: 'You cannot react to this thread' });

    await pool.query(
      `
        INSERT INTO forum_reactions (thread_id, user_id, reaction_type, created_at, updated_at)
        VALUES ($1, $2, $3, now(), now())
        ON CONFLICT (thread_id, user_id)
        DO UPDATE SET reaction_type = EXCLUDED.reaction_type, updated_at = now()
      `,
      [threadId, req.user.id, reactionType],
    );

    return res.status(200).json({ ok: true, type: reactionType });
  } catch (err) {
    console.error('Failed to set thread reaction', err);
    return res.status(500).json({ error: 'Failed to set reaction' });
  }
});

router.delete('/threads/:threadId/reaction', async (req, res) => {
  const threadId = req.params.threadId;
  if (!isValidUuid(threadId)) return res.status(400).json({ error: 'Invalid thread id' });

  try {
    const thread = await fetchThreadById(threadId);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    const forum = await fetchForumById(thread.forum_id);
    if (!forum) return res.status(404).json({ error: 'Forum not found' });
    const canView = await canViewForum(req.user, forum);
    if (!canView) return res.status(403).json({ error: 'You cannot react to this thread' });

    await pool.query(
      `
        DELETE FROM forum_reactions
        WHERE thread_id = $1
          AND user_id = $2
      `,
      [threadId, req.user.id],
    );

    return res.status(204).send();
  } catch (err) {
    console.error('Failed to remove thread reaction', err);
    return res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

module.exports = router;

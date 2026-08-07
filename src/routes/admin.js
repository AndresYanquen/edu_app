const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { randomUUID } = require('crypto');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireGlobalRoleAny, hasGlobalRole } = require('../middleware/roles');
const {
  userCreateSchema,
  courseStaffAssignSchema,
  themeSettingsSchema,
  formatZodError,
} = require('../utils/validators');
const { generateInviteToken, DEFAULT_INVITE_TTL_DAYS } = require('../utils/inviteTokens');
const {
  lockStudentCourseMembership,
  assignStudentToCourseGroup,
} = require('../utils/groupMembership');
const {
  STAFF_ROLES,
  listCourseStaff,
  setCourseStaffRoles,
  removeCourseStaffRole,
  ensureCourseExists,
  hasCourseRole,
  grantGlobalRoles,
  getGlobalRolesForUser,
} = require('../utils/roleService');
const { THEME_SETTING_KEY, normalizeTheme } = require('../utils/themeSettings');

const router = express.Router();

router.use(auth);

const requireAdmin = requireGlobalRoleAny(['admin']);
const requireBulkInviteAccess = requireGlobalRoleAny(['admin', 'enrollment_manager']);

const MAX_BULK_UPLOAD_SIZE = 1024 * 1024;
const MAX_IMAGE_UPLOAD_SIZE = 25 * 1024 * 1024;
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const ALLOWED_ROLES = ['student', 'instructor', 'content_editor', 'enrollment_manager'];
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const imageUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname) || '';
    cb(null, `${randomUUID()}${extension}`);
  },
});

const uploadImage = multer({
  storage: imageUploadStorage,
  limits: { fileSize: MAX_IMAGE_UPLOAD_SIZE },
  fileFilter: (req, file, cb) => {
    if (IMAGE_MIME_TYPES.has(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('Unsupported image type'), false);
  },
}).single('file');

const runImageUpload = (req, res) =>
  new Promise((resolve, reject) => {
    uploadImage(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

const parseMultipartForm = (req, maxSize = MAX_BULK_UPLOAD_SIZE) =>
  new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
    if (!boundaryMatch) {
      return reject(new Error('Invalid multipart request'));
    }
    const boundary = `--${boundaryMatch[1]}`;

    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        reject(new Error('Upload exceeds 1MB limit'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const raw = buffer.toString('utf8');
      const segments = raw.split(boundary);
      const fields = {};
      const files = {};

      for (let part of segments) {
        if (!part || part === '--' || part === '--\r\n') {
          continue;
        }
        if (part.startsWith('\r\n')) {
          part = part.slice(2);
        }
        const [rawHeaders, ...bodyParts] = part.split('\r\n\r\n');
        if (!rawHeaders || !bodyParts.length) {
          continue;
        }
        let body = bodyParts.join('\r\n\r\n');
        if (body.endsWith('\r\n')) {
          body = body.slice(0, -2);
        }
        if (body.endsWith('--')) {
          body = body.slice(0, -2);
        }

        const headers = rawHeaders.split('\r\n').filter(Boolean);
        const disposition = headers.find((h) =>
          h.toLowerCase().startsWith('content-disposition'),
        );
        if (!disposition) continue;
        const nameMatch = disposition.match(/name="([^"]+)"/i);
        if (!nameMatch) continue;
        const fieldName = nameMatch[1];
        const filenameMatch = disposition.match(/filename="([^"]*)"/i);

        if (filenameMatch && filenameMatch[1]) {
          files[fieldName] = {
            filename: filenameMatch[1],
            content: body,
          };
        } else {
          fields[fieldName] = body.trim();
        }
      }

      resolve({ fields, files });
    });
  });

const parseCsv = (text) => {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(current);
      current = '';
    } else if (char === '\n') {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
    } else if (char === '\r') {
      continue;
    } else {
      current += char;
    }
  }

  if (current.length > 0 || row.length) {
    row.push(current);
    rows.push(row);
  }

  return rows;
};

const isUuid = (value) => UUID_REGEX.test(value);
const isValidEmail = (email) => EMAIL_REGEX.test(email);
const pickValue = (row, keys) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return '';
};

const createInvite = async (client, userId, ttlDays) => {
  const invite = generateInviteToken(ttlDays);

  await client.query(
    `
      INSERT INTO user_invites (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `,
    [userId, invite.hash, invite.expiresAt.toISOString()],
  );

  return { rawToken: invite.token, expiresAt: invite.expiresAt };
};

const fetchThemeSettings = async (client = pool) => {
  const { rows } = await client.query(
    'SELECT value FROM app_settings WHERE key = $1 LIMIT 1',
    [THEME_SETTING_KEY],
  );

  return normalizeTheme(rows[0]?.value);
};

router.get('/theme', requireAdmin, async (req, res) => {
  try {
    const theme = await fetchThemeSettings();
    return res.json(theme);
  } catch (err) {
    console.error('Failed to fetch theme settings', err);
    return res.status(500).json({ error: 'Failed to fetch theme settings' });
  }
});

router.patch('/theme', requireAdmin, async (req, res) => {
  const parsed = themeSettingsSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentTheme = await fetchThemeSettings(client);
    const nextTheme = normalizeTheme({
      colors: {
        ...currentTheme.colors,
        ...parsed.data.colors,
      },
    });

    await client.query(
      `
        INSERT INTO app_settings (key, value, updated_by, updated_at)
        VALUES ($1, $2::jsonb, $3, now())
        ON CONFLICT (key)
        DO UPDATE SET
          value = EXCLUDED.value,
          updated_by = EXCLUDED.updated_by,
          updated_at = now()
      `,
      [THEME_SETTING_KEY, JSON.stringify(nextTheme), req.user?.id || null],
    );

    await client.query('COMMIT');
    return res.json(nextTheme);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to update theme settings', err);
    return res.status(500).json({ error: 'Failed to update theme settings' });
  } finally {
    client.release();
  }
});

router.get('/images', requireAdmin, async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const courseId = typeof req.query.courseId === 'string' ? req.query.courseId.trim() : '';

  if (courseId && !isUuid(courseId)) {
    return res.status(400).json({ error: 'courseId must be a valid UUID' });
  }

  const values = [];
  const filters = ["(a.kind = 'image' OR a.mime_type LIKE 'image/%')"];

  if (search) {
    values.push(`%${search}%`);
    filters.push(`(a.original_name ILIKE $${values.length} OR a.public_url ILIKE $${values.length})`);
  }

  if (courseId) {
    values.push(courseId);
    filters.push(`
      EXISTS (
        SELECT 1
        FROM lesson_assets la
        JOIN lessons l ON l.id = la.lesson_id
        JOIN modules m ON m.id = l.module_id
        WHERE la.asset_id = a.id
          AND m.course_id = $${values.length}
      )
    `);
  }

  try {
    const { rows } = await pool.query(
      `
        WITH asset_images AS (
          SELECT
            a.id::text AS id,
            a.id AS asset_id,
            NULL::uuid AS lesson_id,
            'asset' AS source_type,
            a.kind,
            a.mime_type,
            a.original_name,
            a.size_bytes,
            a.storage_provider,
            a.storage_path,
            a.public_url,
            a.created_at,
            uploader.email AS uploaded_by_email,
            COALESCE(
              jsonb_agg(
                DISTINCT jsonb_build_object(
                  'courseId', c.id,
                  'courseTitle', c.title,
                  'lessonId', l.id,
                  'lessonTitle', l.title,
                  'moduleId', m.id,
                  'moduleTitle', m.title
                )
              ) FILTER (WHERE c.id IS NOT NULL),
              '[]'::jsonb
            ) AS usages
          FROM assets a
          LEFT JOIN users uploader ON uploader.id = a.uploaded_by_user_id
          LEFT JOIN lesson_assets la ON la.asset_id = a.id
          LEFT JOIN lessons l ON l.id = la.lesson_id
          LEFT JOIN modules m ON m.id = l.module_id
          LEFT JOIN courses c ON c.id = m.course_id
          WHERE ${filters.join(' AND ')}
          GROUP BY a.id, uploader.email
        ),
        cover_images AS (
          SELECT
            ('lesson-cover:' || l.id::text) AS id,
            NULL::uuid AS asset_id,
            l.id AS lesson_id,
            'lesson_cover' AS source_type,
            'image' AS kind,
            NULL::text AS mime_type,
            COALESCE(NULLIF(split_part(reverse(l.cover_image_url), '/', 1), ''), 'Portada de lección') AS original_name,
            NULL::bigint AS size_bytes,
            'external' AS storage_provider,
            NULL::text AS storage_path,
            l.cover_image_url AS public_url,
            l.created_at,
            NULL::text AS uploaded_by_email,
            jsonb_build_array(
              jsonb_build_object(
                'courseId', c.id,
                'courseTitle', c.title,
                'lessonId', l.id,
                'lessonTitle', l.title,
                'moduleId', m.id,
                'moduleTitle', m.title
              )
            ) AS usages
          FROM lessons l
          JOIN modules m ON m.id = l.module_id
          JOIN courses c ON c.id = m.course_id
          WHERE l.cover_image_url IS NOT NULL
            AND l.cover_image_url <> ''
            AND NOT EXISTS (
              SELECT 1 FROM assets a WHERE a.public_url = l.cover_image_url
            )
            ${search ? `AND l.cover_image_url ILIKE $1` : ''}
            ${courseId ? `AND c.id = $${values.length}` : ''}
        )
        SELECT
          a.id,
          a.asset_id,
          a.lesson_id,
          a.source_type,
          a.kind,
          a.mime_type,
          a.original_name,
          a.size_bytes,
          a.storage_provider,
          a.storage_path,
          a.public_url,
          a.created_at,
          uploader.email AS uploaded_by_email,
          COALESCE(
            jsonb_agg(
              DISTINCT jsonb_build_object(
                'courseId', c.id,
                'courseTitle', c.title,
                'lessonId', l.id,
                'lessonTitle', l.title,
                'moduleId', m.id,
                'moduleTitle', m.title
              )
            ) FILTER (WHERE c.id IS NOT NULL),
            '[]'::jsonb
          ) AS usages
        FROM (
          SELECT * FROM asset_images
          UNION ALL
          SELECT * FROM cover_images
        ) a
        ORDER BY a.created_at DESC
        LIMIT 200
      `,
      values,
    );

    return res.json(
      rows.map((asset) => ({
        id: asset.id,
        assetId: asset.asset_id,
        lessonId: asset.lesson_id,
        sourceType: asset.source_type,
        kind: asset.kind,
        mimeType: asset.mime_type,
        originalName: asset.original_name,
        sizeBytes: asset.size_bytes === null ? null : Number(asset.size_bytes || 0),
        storageProvider: asset.storage_provider,
        storagePath: asset.storage_path,
        url: asset.public_url,
        createdAt: asset.created_at,
        uploadedByEmail: asset.uploaded_by_email,
        usages: asset.usages || [],
      })),
    );
  } catch (err) {
    console.error('Failed to list admin images', err);
    return res.status(500).json({ error: 'Failed to list images' });
  }
});

router.post('/images/lesson-cover/:lessonId/replace', requireAdmin, async (req, res) => {
  const { lessonId } = req.params;
  if (!isUuid(lessonId)) {
    return res.status(400).json({ error: 'lessonId must be a valid UUID' });
  }

  try {
    await runImageUpload(req, res);
  } catch (err) {
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: err.message || 'Image upload failed' });
    }
    return res.status(400).json({ error: err.message || 'Image upload failed' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'File is required' });
  }

  const filename = req.file.filename;
  const publicUrl = `/uploads/${filename}`;

  try {
    const { rows } = await pool.query(
      `
        UPDATE lessons
        SET cover_image_url = $2,
            updated_at = now()
        WHERE id = $1
        RETURNING id, title, cover_image_url
      `,
      [lessonId, publicUrl],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    return res.json({
      id: `lesson-cover:${lessonId}`,
      lessonId,
      sourceType: 'lesson_cover',
      kind: 'image',
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      sizeBytes: req.file.size,
      storageProvider: 'local',
      storagePath: path.posix.join('uploads', filename),
      url: publicUrl,
    });
  } catch (err) {
    console.error('Failed to replace lesson cover image', err);
    return res.status(500).json({ error: 'Failed to replace lesson cover image' });
  }
});

router.post('/images/:assetId/replace', requireAdmin, async (req, res) => {
  const { assetId } = req.params;
  if (!isUuid(assetId)) {
    return res.status(400).json({ error: 'assetId must be a valid UUID' });
  }

  try {
    await runImageUpload(req, res);
  } catch (err) {
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: err.message || 'Image upload failed' });
    }
    return res.status(400).json({ error: err.message || 'Image upload failed' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'File is required' });
  }

  const filename = req.file.filename;
  const storagePath = path.posix.join('uploads', filename);
  const publicUrl = `/uploads/${filename}`;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentRes = await client.query(
      `
        SELECT id, public_url
        FROM assets
        WHERE id = $1
          AND (kind = 'image' OR mime_type LIKE 'image/%')
        FOR UPDATE
      `,
      [assetId],
    );
    const current = currentRes.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Image not found' });
    }

    await client.query(
      `
        UPDATE assets
        SET
          uploaded_by_user_id = $2,
          storage_provider = 'local',
          storage_path = $3,
          public_url = $4,
          kind = 'image',
          mime_type = $5,
          original_name = $6,
          size_bytes = $7
        WHERE id = $1
      `,
      [
        assetId,
        req.user.id,
        storagePath,
        publicUrl,
        req.file.mimetype,
        req.file.originalname,
        req.file.size,
      ],
    );

    if (current.public_url && current.public_url !== publicUrl) {
      await client.query(
        `
          UPDATE lessons
          SET
            cover_image_url = CASE WHEN cover_image_url = $1 THEN $2 ELSE cover_image_url END,
            content_text = replace(content_text, $1, $2),
            content_markdown = replace(content_markdown, $1, $2),
            content_html = replace(content_html, $1, $2),
            content_json = CASE
              WHEN content_json IS NULL THEN NULL
              ELSE replace(content_json::text, $1, $2)::jsonb
            END
          WHERE
            cover_image_url = $1
            OR content_text LIKE '%' || $1 || '%'
            OR content_markdown LIKE '%' || $1 || '%'
            OR content_html LIKE '%' || $1 || '%'
            OR content_json::text LIKE '%' || $1 || '%'
        `,
        [current.public_url, publicUrl],
      );
    }

    await client.query('COMMIT');
    return res.json({
      id: assetId,
      assetId,
      kind: 'image',
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      sizeBytes: req.file.size,
      storageProvider: 'local',
      storagePath,
      url: publicUrl,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to replace image', err);
    return res.status(500).json({ error: 'Failed to replace image' });
  } finally {
    client.release();
  }
});

const fetchManagedUser = async (client, userId) => {
  const { rows } = await client.query(
    `
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.is_active,
        u.status,
        u.must_set_password,
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
    [userId],
  );
  const user = rows[0];
  if (!user) {
    return null;
  }
  if ((user.global_roles || []).includes('admin')) {
    throw new Error('Cannot manage admin user');
  }
  return user;
};

const updateUserActivation = async (client, userId, isActive) => {
  await client.query(
    `
      UPDATE users
      SET is_active = $1,
          status = $2
      WHERE id = $3
    `,
    [isActive, isActive ? 'active' : 'suspended', userId],
  );
};

router.post('/users', requireAdmin, async (req, res) => {
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

    await grantGlobalRoles(client, user.id, [role]);

    const globalRoles = await getGlobalRolesForUser(user.id, client);
    const invite = await createInvite(client, user.id);

    await client.query('COMMIT');

    const activationLink = `${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}/activate?token=${invite.rawToken}`;

    return res.status(201).json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      globalRoles,
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

router.get('/users', requireAdmin, async (req, res) => {
  const roleFilter = (req.query.role || '').trim();
  const search = (req.query.search || '').trim().toLowerCase();
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
  const offset = (page - 1) * pageSize;

  try {
    const params = [];
    const whereParts = [];

    if (roleFilter) {
      params.push(roleFilter);
      whereParts.push(`
        EXISTS (
          SELECT 1
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = u.id
            AND r.name = $${params.length}
        )
      `);
    }

    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      const firstIndex = params.length - 1;
      const secondIndex = params.length;
      whereParts.push(
        `(LOWER(u.full_name) LIKE $${firstIndex} OR LOWER(u.email) LIKE $${secondIndex})`,
      );
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM users u
      ${whereClause}
    `;
    const countRes = await pool.query(countQuery, params);
    const total = countRes.rows[0]?.total ?? 0;

    const dataQuery = `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.must_set_password,
        u.is_active,
        u.status,
        u.created_at,
        COALESCE(
          (
            SELECT array_agg(r2.name ORDER BY r2.name)
            FROM user_roles ur2
            JOIN roles r2 ON r2.id = ur2.role_id
            WHERE ur2.user_id = u.id
          ),
          '{}'
        ) AS global_roles
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;
    const { rows } = await pool.query(dataQuery, params);

    return res.json({
      users: rows,
      page,
      pageSize,
      total,
    });
  } catch (err) {
    console.error('Failed to list users', err);
    return res.status(500).json({ error: 'Failed to list users' });
  }
});

router.post('/users/:id/reset-password', requireAdmin, async (req, res) => {
  const userId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      `
        SELECT u.id, u.email, u.full_name
        FROM users u
        WHERE u.id = $1
          AND EXISTS (
            SELECT 1
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = u.id
              AND r.name = ANY('{student,instructor}')
          )
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
  is_active: user.is_active,
  status: user.status,
  must_set_password: user.must_set_password ?? false,
  global_roles: user.global_roles || [],
});

const COURSE_LEVEL_SELECT =
  'id, code, label, is_active, created_at';
const normalizeLevelCode = (value) => (value || '').trim().toUpperCase();

const fetchCourseLevel = async (levelId) => {
  const { rows } = await pool.query(
    `SELECT ${COURSE_LEVEL_SELECT} FROM course_levels WHERE id = $1 LIMIT 1`,
    [levelId],
  );
  return rows[0] || null;
};

router.post('/users/:id/deactivate', requireAdmin, async (req, res) => {
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

router.post('/users/:id/activate', requireAdmin, async (req, res) => {
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

router.post('/users/bulk-invite', requireBulkInviteAccess, async (req, res) => {
  let formData;
  try {
    formData = await parseMultipartForm(req);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to parse upload' });
  }

  const file = formData.files?.file;
  if (!file || !file.content) {
    return res.status(400).json({ error: 'CSV file is required (field name "file")' });
  }

  const csvText = file.content.replace(/^\uFEFF/, '');
  const rawRows = parseCsv(csvText);
  if (!rawRows.length) {
    return res.status(400).json({ error: 'CSV is empty' });
  }

  const headerRow = rawRows.shift().map((cell) => cell.trim().toLowerCase());
  if (!headerRow.includes('email')) {
    return res.status(400).json({ error: 'CSV must include an email column' });
  }

  const rows = [];
  rawRows.forEach((cols, index) => {
    const isBlank = cols.every((value) => !value || !value.trim());
    if (isBlank) {
      return;
    }
    const rowObj = {};
    headerRow.forEach((header, colIndex) => {
      rowObj[header] = (cols[colIndex] || '').trim();
    });
    rows.push({
      rowNumber: index + 2,
      values: rowObj,
    });
  });

  if (!rows.length) {
    return res.status(400).json({ error: 'CSV has no data rows' });
  }

  const defaultRoleRaw = (formData.fields.defaultRole || '').trim().toLowerCase();
  const defaultRole = defaultRoleRaw || 'student';
  const isAdmin = hasGlobalRole(req.user, 'admin');
  if (!isAdmin) {
    const containsNonStudentRole =
      defaultRole !== 'student' ||
      rows.some((row) => {
        const requestedRole = (row.values.role || defaultRole).trim().toLowerCase();
        return requestedRole !== 'student';
      });
    if (containsNonStudentRole) {
      return res.status(403).json({
        error: 'Enrollment managers can only invite users as students',
      });
    }
  }
  if (!ALLOWED_ROLES.includes(defaultRole)) {
    return res.status(400).json({ error: 'defaultRole must be a valid role' });
  }

  const defaultCourseIdRaw = (formData.fields.defaultCourseId || '').trim();
  const defaultGroupIdRaw = (formData.fields.defaultGroupId || '').trim();
  if (defaultGroupIdRaw && !defaultCourseIdRaw) {
    return res.status(400).json({ error: 'defaultGroupId requires defaultCourseId' });
  }
  if (defaultCourseIdRaw && !isUuid(defaultCourseIdRaw)) {
    return res.status(400).json({ error: 'defaultCourseId must be a valid UUID' });
  }
  if (defaultGroupIdRaw && !isUuid(defaultGroupIdRaw)) {
    return res.status(400).json({ error: 'defaultGroupId must be a valid UUID' });
  }

  const expiresDaysInput = Number.parseInt(formData.fields.expiresDays, 10);
  const expiresDays = Number.isFinite(expiresDaysInput)
    ? Math.min(Math.max(expiresDaysInput, 1), 30)
    : undefined;

  const courseCache = new Map();
  const groupCache = new Map();
  const getCourse = async (courseId) => {
    if (!courseCache.has(courseId)) {
      const { rows: courseRows } = await pool.query('SELECT id FROM courses WHERE id = $1 LIMIT 1', [
        courseId,
      ]);
      courseCache.set(courseId, courseRows[0] || null);
    }
    return courseCache.get(courseId);
  };

  const getGroup = async (groupId) => {
    if (!groupCache.has(groupId)) {
      const { rows: groupRows } = await pool.query(
        'SELECT id, course_id FROM groups WHERE id = $1 LIMIT 1',
        [groupId],
      );
      groupCache.set(groupId, groupRows[0] || null);
    }
    return groupCache.get(groupId);
  };

  const results = [];
  const summary = {
    total: 0,
    created: 0,
    alreadyExists: 0,
    invalid: 0,
    failed: 0,
    enrolled: 0,
    enrollmentFailed: 0,
  };
  const enrollmentRoleCache = new Map();
  const canManageEnrollment = async (courseId) => {
    if (!courseId || isAdmin) {
      return true;
    }
    if (enrollmentRoleCache.has(courseId)) {
      return enrollmentRoleCache.get(courseId);
    }
    const allowed = await hasCourseRole(req.user.id, courseId, ['enrollment_manager']);
    enrollmentRoleCache.set(courseId, allowed);
    return allowed;
  };

  if (!isAdmin) {
    const requestedCourseIds = new Set();
    if (defaultCourseIdRaw) requestedCourseIds.add(defaultCourseIdRaw);
    rows.forEach((row) => {
      const courseId = pickValue(row.values, ['courseid', 'course_id']);
      if (courseId && isUuid(courseId)) requestedCourseIds.add(courseId);
    });
    for (const courseId of requestedCourseIds) {
      if (!(await canManageEnrollment(courseId))) {
        return res.status(403).json({ error: 'Forbidden for course' });
      }
    }
  }

  for (const row of rows) {
    const values = row.values;
    const rawEmail = (values.email || '').trim().toLowerCase();
    const fullNameInput =
      pickValue(values, ['fullname', 'full_name', 'name']) ||
      rawEmail.split('@')[0] ||
      '';
    const roleInput = (values.role || '').trim().toLowerCase();
    const rowRole = roleInput || defaultRole;
    const rowCourseId = pickValue(values, ['courseid', 'course_id']) || '';
    const rowGroupId = pickValue(values, ['groupid', 'group_id']) || '';
    const courseId = (rowCourseId || defaultCourseIdRaw || '').trim();
    const groupId = (rowGroupId || defaultGroupIdRaw || '').trim();

    const result = {
      rowNumber: row.rowNumber,
      fullName: fullNameInput,
      email: rawEmail,
      role: rowRole,
      status: '',
      error: null,
      activationLink: null,
      enrollment: {
        requested: Boolean(courseId),
        courseId: courseId || null,
        groupId: groupId || null,
        status: null,
        error: null,
      },
    };

    const pushResult = (statusKey) => {
      result.status = statusKey;
      if (statusKey === 'created') summary.created += 1;
      else if (statusKey === 'already_exists') summary.alreadyExists += 1;
      else if (statusKey === 'invalid_row') summary.invalid += 1;
      else if (statusKey === 'failed') summary.failed += 1;
      results.push(result);
    };

    if (!rawEmail) {
      result.error = 'Email is required';
      pushResult('invalid_row');
      continue;
    }
    if (!isValidEmail(rawEmail)) {
      result.error = 'Invalid email format';
      pushResult('invalid_row');
      continue;
    }
    if (!ALLOWED_ROLES.includes(rowRole)) {
      result.error = 'Invalid role value';
      pushResult('invalid_row');
      continue;
    }
    if (courseId && !isUuid(courseId)) {
      result.error = 'courseId must be a valid UUID';
      pushResult('invalid_row');
      continue;
    }
    if (groupId && !isUuid(groupId)) {
      result.error = 'groupId must be a valid UUID';
      pushResult('invalid_row');
      continue;
    }
    if (groupId && !courseId) {
      result.error = 'groupId requires a courseId in the same row or default';
      pushResult('invalid_row');
      continue;
    }

    if (courseId && !isAdmin) {
      const allowed = await canManageEnrollment(courseId);
      if (!allowed) {
        result.error = 'forbidden for course';
        result.enrollment.status = 'forbidden';
        result.enrollment.error = 'forbidden for course';
        summary.enrollmentFailed += 1;
        pushResult('failed');
        continue;
      }
    }

    let userId = null;
    let userHasStudentRole = rowRole === 'student';

    try {
      const existingUserRes = await pool.query(
        `
          SELECT
            u.id,
            u.full_name,
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
          WHERE LOWER(u.email) = LOWER($1)
          LIMIT 1
        `,
        [rawEmail],
      );
      const existingUser = existingUserRes.rows[0];

      if (existingUser) {
        userId = existingUser.id;
        const existingGlobalRoles = existingUser.global_roles || [];
        userHasStudentRole =
          existingGlobalRoles.includes('student') || rowRole === 'student';
        const summarizedRoles = new Set(existingGlobalRoles);
        if (isAdmin && rowRole) {
          summarizedRoles.add(rowRole);
        }
        result.role = Array.from(summarizedRoles).join(', ');
        if (isAdmin) {
          await grantGlobalRoles(pool, userId, [rowRole]);
        } else {
          userHasStudentRole = existingGlobalRoles.includes('student');
        }
        pushResult('already_exists');
      } else {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const insertUser = await client.query(
            `
              INSERT INTO users (email, full_name, password_hash, must_set_password)
              VALUES ($1, $2, '', true)
              RETURNING id
              `,
            [rawEmail, fullNameInput || rawEmail.split('@')[0] || rawEmail],
          );
          userId = insertUser.rows[0].id;

          await grantGlobalRoles(client, userId, [rowRole]);
          userHasStudentRole = rowRole === 'student' || userHasStudentRole;

          const invite = await createInvite(client, userId, expiresDays);
          await client.query('COMMIT');

          result.activationLink = `${
            process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
          }/activate?token=${invite.rawToken}`;
          pushResult('created');
        } catch (err) {
          await client.query('ROLLBACK');
          console.error('Bulk invite user creation failed', err);
          result.error = 'Failed to create user';
          pushResult('failed');
          client.release();
          continue;
        }
        client.release();
      }
    } catch (err) {
      console.error('Bulk invite lookup failed', err);
      result.error = 'Failed to process user';
      pushResult('failed');
      continue;
    }

    if (!courseId) {
      continue;
    }

    if (!userHasStudentRole) {
      result.enrollment.status = 'skipped_not_student';
      result.enrollment.error = 'Role is not student';
      continue;
    }

    try {
      const course = await getCourse(courseId);
        if (!course) {
          result.enrollment.status = 'failed';
          result.enrollment.error = 'Course not found';
          summary.enrollmentFailed += 1;
          continue;
        }

      if (groupId) {
        const group = await getGroup(groupId);
        if (!group) {
          result.enrollment.status = 'failed';
          result.enrollment.error = 'Group not found';
          summary.enrollmentFailed += 1;
          continue;
        }
        if (group.course_id !== courseId) {
          result.enrollment.status = 'failed';
          result.enrollment.error = 'Group does not belong to course';
          summary.enrollmentFailed += 1;
          continue;
        }
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await lockStudentCourseMembership(client, courseId, userId);

        const enrollmentInsert = await client.query(
          `
            INSERT INTO enrollments (course_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `,
          [courseId, userId],
        );

        if (enrollmentInsert.rowCount > 0) {
          result.enrollment.status = 'enrolled';
          summary.enrolled += 1;
        } else {
          result.enrollment.status = 'already_enrolled';
        }

        if (groupId) {
          await assignStudentToCourseGroup(client, {
            courseId,
            studentId: userId,
            groupId,
          });
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Bulk enrollment failed', err);
      result.enrollment.status = 'failed';
      result.enrollment.error = 'Failed to enroll student';
      summary.enrollmentFailed += 1;
    }

    results[results.length - 1] = result;
  }

  summary.total = results.length;
  return res.json({ totals: summary, results });
});

router.get('/courses/:courseId/staff', requireAdmin, async (req, res) => {
  const { courseId } = req.params;
  try {
    const course = await ensureCourseExists(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const staff = await listCourseStaff(course.id);
    return res.json(staff);
  } catch (err) {
    console.error('Failed to list course staff', err);
    return res.status(500).json({ error: 'Failed to list course staff' });
  }
});

router.post('/courses/:courseId/staff', requireAdmin, async (req, res) => {
  const { courseId } = req.params;
  const parsed = courseStaffAssignSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  const { userId, roles } = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingCourse = await ensureCourseExists(courseId, client);
    if (!existingCourse) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Course not found' });
    }

    const userRes = await client.query('SELECT id, full_name FROM users WHERE id = $1 LIMIT 1', [userId]);
    if (!userRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    await setCourseStaffRoles(client, existingCourse.id, userId, roles);
    await client.query('COMMIT');

    const staff = await listCourseStaff(existingCourse.id);
    const entry = staff.find((member) => member.userId === userId) || {
      userId,
      roles,
      fullName: userRes.rows[0].full_name || null,
    };

    return res.status(201).json(entry);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to assign course staff roles', err);
    return res.status(500).json({ error: 'Failed to assign staff roles' });
  } finally {
    client.release();
  }
});

router.delete('/courses/:courseId/staff/:userId/role/:roleName', requireAdmin, async (req, res) => {
  const { courseId, userId, roleName } = req.params;
  if (!STAFF_ROLES.includes(roleName)) {
    return res.status(400).json({ error: 'Invalid role name' });
  }

  try {
    const course = await ensureCourseExists(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (roleName === 'instructor') {
      const [groupTeacherResult, seriesHostResult, sessionsHostResult] = await Promise.all([
        pool.query(
          `
            SELECT COUNT(*)::int AS total
            FROM group_teachers gt
            JOIN groups g ON g.id = gt.group_id
            WHERE gt.user_id = $1
              AND g.course_id = $2
          `,
          [userId, course.id],
        ),
        pool.query(
          `
            SELECT COUNT(*)::int AS total
            FROM live_session_series lss
            JOIN groups g ON g.id = lss.group_id
            WHERE g.course_id = $1
              AND lss.host_teacher_id = $2
          `,
          [course.id, userId],
        ),
        pool.query(
          `
            SELECT COUNT(*)::int AS total
            FROM live_sessions ls
            JOIN groups g ON g.id = ls.group_id
            WHERE g.course_id = $1
              AND ls.host_teacher_id = $2
          `,
          [course.id, userId],
        ),
      ]);

      const groupAssignments = Number(groupTeacherResult.rows[0]?.total || 0);
      const hostedSeries = Number(seriesHostResult.rows[0]?.total || 0);
      const hostedSessions = Number(sessionsHostResult.rows[0]?.total || 0);

      if (groupAssignments > 0 || hostedSeries > 0 || hostedSessions > 0) {
        return res.status(409).json({
          error:
            'Cannot remove instructor role while assigned to groups or live sessions. Reassign/remove those dependencies first.',
          details: {
            groupAssignments,
            hostedSeries,
            hostedSessions,
          },
        });
      }
    }

    const removed = await removeCourseStaffRole(pool, course.id, userId, roleName);
    if (!removed) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to remove course staff role', err);
    return res.status(500).json({ error: 'Failed to remove staff role' });
  }
});

router.get('/course-levels', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT ${COURSE_LEVEL_SELECT}
        FROM course_levels
        ORDER BY code ASC
      `,
    );
    return res.json(rows);
  } catch (err) {
    console.error('Failed to list course levels', err);
    return res.status(500).json({ error: 'Failed to load course levels' });
  }
});

router.post('/course-levels', requireAdmin, async (req, res) => {
  const payload = req.body || {};
  const codeRaw = payload.code || '';
  const labelRaw = payload.label || '';
  const code = normalizeLevelCode(codeRaw);
  const label = (labelRaw || '').trim();
  const isActive =
    payload.is_active === undefined || payload.is_active === null
      ? true
      : Boolean(payload.is_active);

  if (!code) {
    return res.status(400).json({ error: 'Level code is required' });
  }
  if (!label) {
    return res.status(400).json({ error: 'Level label is required' });
  }

  try {
    const { rows } = await pool.query(
      `
        INSERT INTO course_levels (code, label, is_active)
        VALUES ($1, $2, $3)
        RETURNING ${COURSE_LEVEL_SELECT}
      `,
      [code, label, isActive],
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Level code already exists' });
    }
    console.error('Failed to create course level', err);
    return res.status(500).json({ error: 'Failed to create course level' });
  }
});

router.patch('/course-levels/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  const updates = [];
  const values = [];

  if (payload.label !== undefined) {
    const label = (payload.label || '').trim();
    if (!label) {
      return res.status(400).json({ error: 'Label cannot be empty' });
    }
    values.push(label);
    updates.push(`label = $${values.length}`);
  }

  if (payload.is_active !== undefined) {
    values.push(Boolean(payload.is_active));
    updates.push(`is_active = $${values.length}`);
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  try {
    values.push(id);
    const { rows } = await pool.query(
      `
        UPDATE course_levels
        SET ${updates.join(', ')}, updated_at = now()
        WHERE id = $${values.length}
        RETURNING ${COURSE_LEVEL_SELECT}
      `,
      values,
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Course level not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Failed to update course level', err);
    return res.status(500).json({ error: 'Failed to update course level' });
  }
});

router.delete('/course-levels/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: usageRows } = await pool.query(
      `
        SELECT 1
        FROM courses
        WHERE level_id = $1
        LIMIT 1
      `,
      [id],
    );
    if (usageRows.length) {
      return res.status(409).json({ error: 'Level is in use by courses' });
    }

    const deleteRes = await pool.query('DELETE FROM course_levels WHERE id = $1', [id]);
    if (!deleteRes.rowCount) {
      return res.status(404).json({ error: 'Course level not found' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete course level', err);
    return res.status(500).json({ error: 'Failed to delete course level' });
  }
});

module.exports = router;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_SCOPES = new Set(['academy', 'course', 'group']);

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function parseScope(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (!ALLOWED_SCOPES.has(value)) {
    return null;
  }
  return value;
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  return defaultValue;
}

function parseInteger(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (parsed < min) {
    return min;
  }
  if (parsed > max) {
    return max;
  }

  return parsed;
}

function buildVisibleAnnouncementsWhereClause({
  announcementAlias = 'a',
  userIdParam = '$1',
} = {}) {
  // Compose lifecycle + visibility branches separately to avoid parenthesis drift.
  const lifecycleRules = [
    `${announcementAlias}.status = 'published'`,
    `(${announcementAlias}.starts_at IS NULL OR ${announcementAlias}.starts_at <= now())`,
    `(${announcementAlias}.expires_at IS NULL OR ${announcementAlias}.expires_at > now())`,
  ];

  const scopeRules = [
    `(
      ${announcementAlias}.scope = 'academy'
    )`,
    `(
      ${announcementAlias}.scope = 'course'
      AND EXISTS (
        SELECT 1
        FROM enrollments e
        WHERE e.course_id = ${announcementAlias}.course_id
          AND e.user_id = ${userIdParam}
          AND e.status = 'active'
      )
    )`,
    `(
      ${announcementAlias}.scope = 'group'
      AND (
        EXISTS (
          SELECT 1
          FROM group_students gs
          WHERE gs.group_id = ${announcementAlias}.group_id
            AND gs.user_id = ${userIdParam}
            AND gs.status = 'active'
        )
        OR EXISTS (
          SELECT 1
          FROM group_teachers gt
          WHERE gt.group_id = ${announcementAlias}.group_id
            AND gt.user_id = ${userIdParam}
        )
      )
    )`,
  ];

  return `(
    ${lifecycleRules.join('\n    AND ')}
    AND
    (
      ${scopeRules.join('\n      OR ')}
    )
  )`;
}

function buildVisibleAnnouncementsBaseQuery(knexOrUserId, maybeUserId) {
  const userId = maybeUserId || knexOrUserId;
  const visibilityClause = buildVisibleAnnouncementsWhereClause({
    announcementAlias: 'a',
    userIdParam: '$1',
  });

  return {
    params: [userId],
    sql: `
      SELECT
        a.id,
        a.scope,
        a.course_id,
        a.group_id,
        a.created_by_user_id,
        a.title,
        a.body,
        a.created_at,
        (ar.announcement_id IS NOT NULL) AS is_read,
        ar.read_at
      FROM announcements a
      LEFT JOIN announcement_reads ar
        ON ar.announcement_id = a.id
       AND ar.user_id = $1
      WHERE ${visibilityClause}
    `,
  };
}

async function isAnnouncementVisibleToUser(knex, { userId, announcementId }) {
  const visibilityClause = buildVisibleAnnouncementsWhereClause({
    announcementAlias: 'a',
    userIdParam: '$1',
  });

  const { rowCount } = await knex.query(
    `
      SELECT 1
      FROM announcements a
      WHERE a.id = $2
        AND ${visibilityClause}
      LIMIT 1
    `,
    [userId, announcementId],
  );

  return rowCount > 0;
}

module.exports = {
  buildVisibleAnnouncementsBaseQuery,
  buildVisibleAnnouncementsWhereClause,
  isAnnouncementVisibleToUser,
  isUuid,
  parseBoolean,
  parseInteger,
  parseScope,
};

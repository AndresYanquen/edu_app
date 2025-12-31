const pool = require('../db');

const STAFF_ROLES = ['instructor', 'content_editor', 'enrollment_manager'];

const getRoleIdMap = async (roleNames = [], client = pool) => {
  if (!roleNames.length) {
    return new Map();
  }
  const { rows } = await client.query(
    `
      SELECT id, name
      FROM roles
      WHERE name = ANY($1)
    `,
    [roleNames],
  );
  return rows.reduce((map, row) => {
    map.set(row.name, row.id);
    return map;
  }, new Map());
};

const getGlobalRolesForUser = async (userId, client = pool) => {
  if (!userId) {
    return [];
  }
  const { rows } = await client.query(
    `
      SELECT r.name
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
      ORDER BY r.name
    `,
    [userId],
  );
  return rows.map((row) => row.name);
};

const grantGlobalRoles = async (client, userId, roleNames = []) => {
  if (!userId || !roleNames.length) {
    return;
  }

  const roleMap = await getRoleIdMap(roleNames, client);
  if (!roleMap.size) {
    return;
  }

  const values = [];
  const placeholders = [];
  let index = 1;
  for (const [, roleId] of roleMap.entries()) {
    placeholders.push(`($${index}, $${index + 1})`);
    values.push(userId, roleId);
    index += 2;
  }

  await client.query(
    `
      INSERT INTO user_roles (user_id, role_id)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT DO NOTHING
    `,
    values,
  );
};

const hasCourseRole = async (userId, courseId, allowedRoles = [], client = pool) => {
  if (!userId || !courseId || !allowedRoles.length) {
    return false;
  }
  const { rows } = await client.query(
    `
      SELECT 1
      FROM course_user_roles cur
      JOIN roles r ON r.id = cur.role_id
      WHERE cur.user_id = $1
        AND cur.course_id = $2
        AND r.name = ANY($3)
      LIMIT 1
    `,
    [userId, courseId, allowedRoles],
  );
  return rows.length > 0;
};

const getCourseIdFromLesson = async (lessonId, client = pool) => {
  if (!lessonId) {
    return null;
  }
  const { rows } = await client.query(
    `
      SELECT m.course_id AS course_id
      FROM lessons l
      JOIN modules m ON m.id = l.module_id
      WHERE l.id = $1
      LIMIT 1
    `,
    [lessonId],
  );
  return rows[0]?.course_id || null;
};

const getCourseIdFromGroup = async (groupId, client = pool) => {
  if (!groupId) {
    return null;
  }
  const { rows } = await client.query(
    `
      SELECT course_id
      FROM groups
      WHERE id = $1
      LIMIT 1
    `,
    [groupId],
  );
  return rows[0]?.course_id || null;
};

const getCourseIdFromModule = async (moduleId, client = pool) => {
  if (!moduleId) {
    return null;
  }
  const { rows } = await client.query(
    `
      SELECT course_id
      FROM modules
      WHERE id = $1
      LIMIT 1
    `,
    [moduleId],
  );
  return rows[0]?.course_id || null;
};

const ensureCourseExists = async (courseId, client = pool) => {
  if (!courseId) {
    return null;
  }
  const { rows } = await client.query(
    `
      SELECT id, owner_user_id
      FROM courses
      WHERE id = $1
      LIMIT 1
    `,
    [courseId],
  );
  if (!rows.length) {
    return null;
  }
  return rows[0];
};

const listCourseStaff = async (courseId, client = pool) => {
  if (!courseId) {
    return [];
  }
  const { rows } = await client.query(
    `
      SELECT
        u.id AS user_id,
        u.full_name,
        u.email,
        r.name AS role_name
      FROM course_user_roles cur
      JOIN users u ON u.id = cur.user_id
      JOIN roles r ON r.id = cur.role_id
      WHERE cur.course_id = $1
        AND r.name = ANY($2)
      ORDER BY u.full_name
    `,
    [courseId, STAFF_ROLES],
  );

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.user_id)) {
      map.set(row.user_id, {
        userId: row.user_id,
        fullName: row.full_name,
        email: row.email,
        roles: [],
      });
    }
    map.get(row.user_id).roles.push(row.role_name);
  }
  return Array.from(map.values());
};

const setCourseStaffRoles = async (client, courseId, userId, roles = []) => {
  if (!courseId || !userId || !roles.length) {
    return [];
  }
  const roleMap = await getRoleIdMap(roles, client);
  if (!roleMap.size) {
    return [];
  }

  const values = [];
  const placeholders = [];
  let index = 1;
  for (const roleName of roles) {
    const roleId = roleMap.get(roleName);
    if (!roleId) {
      continue;
    }
    placeholders.push(`($${index}, $${index + 1}, $${index + 2})`);
    values.push(courseId, userId, roleId);
    index += 3;
  }

  if (!placeholders.length) {
    return [];
  }

  await client.query(
    `
      INSERT INTO course_user_roles (course_id, user_id, role_id)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT DO NOTHING
    `,
    values,
  );

  return roles;
};

const removeCourseStaffRole = async (client, courseId, userId, roleName) => {
  if (!courseId || !userId || !roleName) {
    return 0;
  }
  const result = await client.query(
    `
      DELETE FROM course_user_roles cur
      USING roles r
      WHERE cur.course_id = $1
        AND cur.user_id = $2
        AND cur.role_id = r.id
        AND r.name = $3
    `,
    [courseId, userId, roleName],
  );
  return result.rowCount || 0;
};

const isGroupTeacher = async (userId, groupId, client = pool) => {
  if (!userId || !groupId) {
    return false;
  }
  const { rows } = await client.query(
    `
      SELECT 1
      FROM group_teachers
      WHERE group_id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [groupId, userId],
  );
  return rows.length > 0;
};

module.exports = {
  STAFF_ROLES,
  getGlobalRolesForUser,
  grantGlobalRoles,
  hasCourseRole,
  getCourseIdFromLesson,
  getCourseIdFromGroup,
  getCourseIdFromModule,
  ensureCourseExists,
  listCourseStaff,
  setCourseStaffRoles,
  removeCourseStaffRole,
  isGroupTeacher,
};

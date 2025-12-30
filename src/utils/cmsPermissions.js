const pool = require('../db');
const { hasCourseRole } = require('./roleService');

const CONTENT_ROLES = ['instructor', 'content_editor'];

const extractRoles = (user) =>
  Array.isArray(user?.globalRoles) ? user.globalRoles : [];

const canEditCourse = async (courseId, user) => {
  if (!courseId || !user) {
    return false;
  }

  const roles = extractRoles(user);
  if (roles.includes('admin')) {
    return true;
  }

  if (!roles.some((role) => CONTENT_ROLES.includes(role))) {
    return false;
  }

  const { rows } = await pool.query(
    `
      SELECT owner_user_id
      FROM courses
      WHERE id = $1
      LIMIT 1
    `,
    [courseId],
  );
  const course = rows[0];
  if (!course) {
    return false;
  }

  if (course.owner_user_id === user.id) {
    return true;
  }

  return hasCourseRole(user.id, courseId, CONTENT_ROLES);
};

module.exports = {
  canEditCourse,
};

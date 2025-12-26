const pool = require('../db');

const canEditCourse = async (courseId, user) => {
  if (!courseId || !user) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  if (user.role !== 'instructor') {
    return false;
  }

  const { rows } = await pool.query(
    `
      SELECT 1
      FROM courses c
      WHERE c.id = $1
        AND (
          c.owner_user_id = $2
          OR EXISTS (
            SELECT 1
            FROM course_instructors ci
            WHERE ci.course_id = c.id AND ci.user_id = $2
          )
        )
      LIMIT 1
    `,
    [courseId, user.id],
  );

  return rows.length > 0;
};

module.exports = {
  canEditCourse,
};

const lockStudentCourseMembership = (client, courseId, studentId) =>
  client.query(
    `
      SELECT pg_advisory_xact_lock(
        hashtextextended($1, 0)
      )
    `,
    [`${courseId}:${studentId}`],
  );

const removeStudentFromCourseGroups = (client, courseId, studentId) =>
  client.query(
    `
      DELETE FROM group_students gs
      USING groups g
      WHERE gs.group_id = g.id
        AND g.course_id = $1
        AND gs.user_id = $2
    `,
    [courseId, studentId],
  );

const assignStudentToCourseGroup = async (
  client,
  { courseId, studentId, groupId },
) => {
  await lockStudentCourseMembership(client, courseId, studentId);

  if (groupId) {
    const { rows: groupRows } = await client.query(
      `
        SELECT id, capacity
        FROM groups
        WHERE id = $1
          AND course_id = $2
        FOR UPDATE
      `,
      [groupId, courseId],
    );
    if (!groupRows.length) {
      const error = new Error("Group must belong to this course");
      error.code = "GROUP_NOT_IN_COURSE";
      throw error;
    }

    const { rows: capacityRows } = await client.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE gs.status = 'active')::int AS students_count,
          BOOL_OR(gs.user_id = $2 AND gs.status = 'active') AS already_assigned
        FROM group_students gs
        WHERE gs.group_id = $1
      `,
      [groupId, studentId],
    );
    const currentCount = Number(capacityRows[0]?.students_count || 0);
    const alreadyAssigned = Boolean(capacityRows[0]?.already_assigned);
    const capacity = groupRows[0].capacity;
    if (
      capacity != null &&
      currentCount + (alreadyAssigned ? 0 : 1) > Number(capacity)
    ) {
      const error = new Error("Group capacity has been reached");
      error.code = "GROUP_CAPACITY_REACHED";
      throw error;
    }
  }

  await removeStudentFromCourseGroups(client, courseId, studentId);

  if (!groupId) return;

  await client.query(
    `
      INSERT INTO group_students (group_id, user_id, status, joined_at)
      VALUES ($1, $2, 'active', now())
      ON CONFLICT (group_id, user_id)
      DO UPDATE SET status = 'active', joined_at = now()
    `,
    [groupId, studentId],
  );
};

module.exports = {
  lockStudentCourseMembership,
  removeStudentFromCourseGroups,
  assignStudentToCourseGroup,
};

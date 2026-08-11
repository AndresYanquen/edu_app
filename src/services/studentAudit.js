const STUDENT_AUDIT_EVENT_TYPES = new Set([
  "student_enrolled",
  "student_unenrolled",
  "student_group_assigned",
  "student_group_moved",
  "student_group_removed",
  "student_enrolled_imported",
]);

const normalizeMetadata = (metadata) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata;
};

const recordStudentAuditEvent = (client, event) => {
  if (!STUDENT_AUDIT_EVENT_TYPES.has(event.eventType)) {
    const error = new Error("Invalid student audit event type");
    error.code = "INVALID_STUDENT_AUDIT_EVENT_TYPE";
    throw error;
  }

  return client.query(
    `
      INSERT INTO student_audit_events (
        course_id,
        student_id,
        actor_user_id,
        event_type,
        source_group_id,
        target_group_id,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      event.courseId,
      event.studentId,
      event.actorUserId || null,
      event.eventType,
      event.sourceGroupId || null,
      event.targetGroupId || null,
      JSON.stringify(normalizeMetadata(event.metadata)),
    ],
  );
};

const eventTypeForGroupChange = (sourceGroupId, targetGroupId) => {
  if (sourceGroupId && targetGroupId && sourceGroupId !== targetGroupId) {
    return "student_group_moved";
  }
  if (!sourceGroupId && targetGroupId) {
    return "student_group_assigned";
  }
  if (sourceGroupId && !targetGroupId) {
    return "student_group_removed";
  }
  return null;
};

const recordStudentGroupChange = (client, {
  courseId,
  studentId,
  actorUserId,
  sourceGroupId,
  targetGroupId,
  metadata,
}) => {
  const eventType = eventTypeForGroupChange(sourceGroupId, targetGroupId);
  if (!eventType) return Promise.resolve();

  return recordStudentAuditEvent(client, {
    courseId,
    studentId,
    actorUserId,
    eventType,
    sourceGroupId,
    targetGroupId,
    metadata,
  });
};

module.exports = {
  STUDENT_AUDIT_EVENT_TYPES,
  eventTypeForGroupChange,
  recordStudentAuditEvent,
  recordStudentGroupChange,
};

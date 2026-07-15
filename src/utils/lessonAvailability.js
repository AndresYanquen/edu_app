const { normalizeLessonType } = require("./lessonTypes");

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const calculateLessonAvailability = (lesson, referenceDate = new Date()) => {
  const now =
    referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const availableFrom = lesson?.available_from || lesson?.availableFrom || null;
  const dueAt = lesson?.due_at || lesson?.dueAt || null;
  const allowLateSubmission = Boolean(
    lesson?.allow_late_submission ?? lesson?.allowLateSubmission ?? false,
  );
  const lateUntil = allowLateSubmission
    ? lesson?.late_until || lesson?.lateUntil || null
    : null;

  const availableFromDate = availableFrom ? new Date(availableFrom) : null;
  const dueAtDate = dueAt ? new Date(dueAt) : null;
  const lateUntilDate = lateUntil ? new Date(lateUntil) : null;
  const normalizedType = normalizeLessonType(
    lesson?.content_type || lesson?.contentType,
  );

  if (normalizedType === "notice") {
    const isBeforeDisplay = Boolean(availableFromDate && now < availableFromDate);
    const isAfterDisplay = Boolean(dueAtDate && now > dueAtDate);
    const isVisible = !isBeforeDisplay && !isAfterDisplay;

    return {
      availabilityStatus: isVisible ? "display_active" : "display_hidden",
      isAvailable: isVisible,
      isOverdue: false,
      isClosed: false,
      acceptsLateSubmission: false,
      isDisplayActive: isVisible,
    };
  }

  let availabilityStatus = "always_available";

  if (availableFromDate && now < availableFromDate) {
    availabilityStatus = "upcoming";
  } else if (dueAtDate && now > dueAtDate) {
    if (allowLateSubmission && lateUntilDate && now <= lateUntilDate) {
      availabilityStatus = "late_available";
    } else if (allowLateSubmission && !lateUntilDate) {
      availabilityStatus = "late_available";
    } else {
      availabilityStatus = "closed";
    }
  } else if (availableFromDate || dueAtDate) {
    availabilityStatus = "available";
  }

  if (
    availabilityStatus === "late_available" &&
    lateUntilDate &&
    now > lateUntilDate
  ) {
    availabilityStatus = "closed";
  }

  return {
    availabilityStatus,
    isAvailable: ["always_available", "available", "late_available"].includes(
      availabilityStatus,
    ),
    isOverdue: Boolean(dueAtDate && now > dueAtDate),
    isClosed: availabilityStatus === "closed",
    acceptsLateSubmission:
      allowLateSubmission && availabilityStatus === "late_available",
    isDisplayActive: true,
  };
};

const decorateLessonAvailability = (lesson, referenceDate = new Date()) => ({
  ...lesson,
  availableFrom: toIsoOrNull(lesson?.available_from || lesson?.availableFrom),
  dueAt: toIsoOrNull(lesson?.due_at || lesson?.dueAt),
  allowLateSubmission: Boolean(
    lesson?.allow_late_submission ?? lesson?.allowLateSubmission ?? false,
  ),
  lateUntil: toIsoOrNull(lesson?.late_until || lesson?.lateUntil),
  requiresSubmission: Boolean(
    lesson?.requires_submission ?? lesson?.requiresSubmission ?? false,
  ),
  normalizedType: normalizeLessonType(
    lesson?.content_type || lesson?.contentType,
  ),
  ...calculateLessonAvailability(lesson, referenceDate),
});

module.exports = {
  calculateLessonAvailability,
  decorateLessonAvailability,
};

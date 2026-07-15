const LEGACY_CONTENT_TYPES = new Set(["text", "link", "file", "embed"]);
const LESSON_CONTENT_TYPES = new Set([
  "banner",
  "content",
  "video",
  "activity",
  "assessment",
  ...LEGACY_CONTENT_TYPES,
]);

const normalizeLessonType = (value) => {
  const type = String(value || "activity").trim().toLowerCase();
  if (type === "banner" || type === "notice" || type === "aviso") {
    return "notice";
  }
  if (type === "assessment" || type === "evaluation" || type === "evaluacion") {
    return "assessment";
  }
  return "activity";
};

const isLegacyLessonType = (value) =>
  LEGACY_CONTENT_TYPES.has(String(value || "").trim().toLowerCase());

const toStoredLessonType = (value) => {
  const normalizedType = normalizeLessonType(value);
  if (normalizedType === "notice") return "banner";
  if (normalizedType === "assessment") return "assessment";
  return "activity";
};

const shouldTrackLessonProgress = (value) =>
  normalizeLessonType(value) !== "notice";

const canHaveManualSubmission = (value) =>
  normalizeLessonType(value) === "activity";

const canHaveQuiz = (value) => normalizeLessonType(value) === "assessment";

module.exports = {
  LESSON_CONTENT_TYPES,
  normalizeLessonType,
  isLegacyLessonType,
  toStoredLessonType,
  shouldTrackLessonProgress,
  canHaveManualSubmission,
  canHaveQuiz,
};

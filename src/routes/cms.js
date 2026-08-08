const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { randomUUID } = require("crypto");
const pool = require("../db");
const auth = require("../middleware/auth");
const {
  requireGlobalRoleAny,
  requireCourseRoleAny,
  hasGlobalRole,
  hasCourseRole,
  resolveCourseId,
} = require("../middleware/roles");
const {
  courseCreateSchema,
  courseUpdateSchema,
  instructorAssignSchema,
  moduleCreateSchema,
  moduleUpdateSchema,
  lessonCreateSchema,
  lessonUpdateSchema,
  quizQuestionCreateSchema,
  quizQuestionUpdateSchema,
  quizOptionCreateSchema,
  quizOptionUpdateSchema,
  enrollStudentSchema,
  assignGroupSchema,
  groupTeacherAssignSchema,
  groupCreateSchema,
  groupUpdateSchema,
  announcementCreateSchema,
  announcementUpdateSchema,
  coursePostCreateSchema,
  coursePostUpdateSchema,
  bulkEnrollSchema,
  bulkGroupStudentsSchema,
  bulkMoveGroupStudentsSchema,
  formatZodError,
  uuidSchema,
} = require("../utils/validators");
const { canEditCourse } = require("../utils/cmsPermissions");
const { ensureCourseExists } = require("../utils/roleService");
const { decorateLessonAvailability } = require("../utils/lessonAvailability");
const { normalizeLessonType, toStoredLessonType } = require("../utils/lessonTypes");
const { getStorageProvider } = require("../services/storage");
const { canConvertToWebp, convertImageToWebp } = require("../services/imageProcessing");
const {
  lockStudentCourseMembership,
  removeStudentFromCourseGroups,
  assignStudentToCourseGroup,
} = require("../utils/groupMembership");

const CMS_GLOBAL_ROLES = [
  "admin",
  "instructor",
  "content_editor",
  "enrollment_manager",
];
const CONTENT_ROLES = ["instructor", "content_editor"];
const ENROLLMENT_ROLES = ["instructor", "enrollment_manager"];
const COURSE_STAFF_ROLES = [
  "instructor",
  "content_editor",
  "enrollment_manager",
];
const PAST_LESSON_DATE_ROLES = ["admin", "instructor", "content_editor", "teacher"];
const requireCmsContentAccess = requireGlobalRoleAny([
  "admin",
  "instructor",
  "content_editor",
]);
const isEnrollmentManagerOnly = (user) =>
  hasGlobalRole(user, "enrollment_manager") &&
  !hasGlobalRole(user, "admin") &&
  !hasGlobalRole(user, "instructor") &&
  !hasGlobalRole(user, "content_editor");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
];
const DOCUMENT_MIME_TYPES = ["application/pdf"];
const ALLOWED_MIME_TYPES = new Set([
  ...IMAGE_MIME_TYPES,
  ...AUDIO_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
]);
const mbToBytes = (value, fallback) => {
  const parsed = Number(value);
  const mb = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return mb * 1024 * 1024;
};
const bytesToMb = (value) => Math.round(value / 1024 / 1024);
const MAX_IMAGE_UPLOAD_SIZE = mbToBytes(process.env.MAX_IMAGE_UPLOAD_MB, 10);
const MAX_DOCUMENT_UPLOAD_SIZE = mbToBytes(process.env.MAX_DOCUMENT_UPLOAD_MB, 25);
const MAX_AUDIO_UPLOAD_SIZE = mbToBytes(process.env.MAX_AUDIO_UPLOAD_MB, 50);
const MAX_UPLOAD_SIZE = Math.max(
  MAX_IMAGE_UPLOAD_SIZE,
  MAX_DOCUMENT_UPLOAD_SIZE,
  MAX_AUDIO_UPLOAD_SIZE,
);
const getMaxUploadSizeForMime = (mimeType) => {
  if (IMAGE_MIME_TYPES.includes(mimeType)) return MAX_IMAGE_UPLOAD_SIZE;
  if (DOCUMENT_MIME_TYPES.includes(mimeType)) return MAX_DOCUMENT_UPLOAD_SIZE;
  if (AUDIO_MIME_TYPES.includes(mimeType)) return MAX_AUDIO_UPLOAD_SIZE;
  return 0;
};
const getUploadSizeError = (mimeType) => {
  const maxSize = getMaxUploadSizeForMime(mimeType);
  return maxSize ? `File must be ${bytesToMb(maxSize)} MB or smaller` : "Unsupported file type";
};
const ASSET_LIST_LIMIT = 50;
const R2_ASSET_UPLOAD_TTL_SECONDS = Number(process.env.R2_PRESIGNED_TTL_SECONDS || 5 * 60);
const R2_HOST_SUFFIX = ".r2.cloudflarestorage.com";

const getR2StorageKeyFromReference = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^courses\/[^/]+\/lessons\/[^/]+\//.test(raw)) {
    return raw;
  }

  try {
    const url = new URL(raw);
    if (!url.hostname.endsWith(R2_HOST_SUFFIX) && !url.hostname.includes(".r2.")) {
      return null;
    }

    const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const bucket = process.env.R2_BUCKET;
    if (bucket && pathname.startsWith(`${bucket}/`)) {
      return pathname.slice(bucket.length + 1);
    }
    return pathname || null;
  } catch {
    return null;
  }
};

const toStoredR2Reference = (value) => getR2StorageKeyFromReference(value) || value;

const resolveR2ReferenceUrl = async (value) => {
  const storageKey = getR2StorageKeyFromReference(value);
  if (!storageKey) return value;

  try {
    return await getStorageProvider("r2").createDownloadUrl({ key: storageKey });
  } catch (err) {
    console.error("Failed to sign R2 reference URL", err);
    return value;
  }
};

const resolveContentJsonR2References = async (contentJson) => {
  if (!contentJson || typeof contentJson !== "object") return contentJson;
  const next = JSON.parse(JSON.stringify(contentJson));
  const pages = Array.isArray(next.pages) ? next.pages : [];

  for (const page of pages) {
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    for (const block of blocks) {
      if (block?.src) {
        block.src = await resolveR2ReferenceUrl(block.src);
      }
    }
  }

  return next;
};

const resolveHtmlR2References = async (html = "") => {
  const value = String(html || "");
  if (!value) return html;

  const matches = [
    ...new Set(value.match(/https?:\/\/[^"' <>()]+r2[^"' <>()]+|courses\/[^"' <>()]+\/lessons\/[^"' <>()]+/g) || []),
  ];
  let next = value;

  for (const match of matches) {
    const resolved = await resolveR2ReferenceUrl(match);
    if (resolved && resolved !== match) {
      next = next.split(match).join(resolved);
    }
  }

  return next;
};

const toStoredContentJsonR2References = (contentJson) => {
  if (!contentJson || typeof contentJson !== "object") return contentJson;
  const next = JSON.parse(JSON.stringify(contentJson));
  const pages = Array.isArray(next.pages) ? next.pages : [];

  for (const page of pages) {
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    for (const block of blocks) {
      if (block?.src) {
        block.src = toStoredR2Reference(block.src);
      }
    }
  }

  return next;
};

const toStoredHtmlR2References = (html = "") => {
  const value = String(html || "");
  if (!value) return html;

  const matches = [
    ...new Set(value.match(/https?:\/\/[^"' <>()]+r2[^"' <>()]+|courses\/[^"' <>()]+\/lessons\/[^"' <>()]+/g) || []),
  ];
  let next = value;

  for (const match of matches) {
    const stored = toStoredR2Reference(match);
    if (stored && stored !== match) {
      next = next.split(match).join(stored);
    }
  }

  return next;
};

const sanitizeObjectFileName = (value = "") =>
  String(value)
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "")
    .slice(0, 120) || "asset";

const getExtensionForMime = (mimeType, originalName = "") => {
  const existing = path.extname(originalName).toLowerCase();
  if (existing && existing.length <= 10) return existing;
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "audio/mpeg") return ".mp3";
  if (mimeType === "audio/wav") return ".wav";
  if (mimeType === "audio/ogg") return ".ogg";
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "video/mp4") return ".mp4";
  if (mimeType === "video/webm") return ".webm";
  return "";
};

const buildLessonAssetStorageKey = ({ courseId, lessonId, kind, mimeType, originalName }) => {
  const folderByKind = {
    image: "images",
    audio: "audio",
    video: "videos",
    file: "files",
  };
  const safeName = sanitizeObjectFileName(originalName);
  const extension = getExtensionForMime(mimeType, safeName);
  const baseName = extension && safeName.endsWith(extension) ? safeName.slice(0, -extension.length) : safeName;
  return `courses/${courseId}/lessons/${lessonId}/${folderByKind[kind] || "files"}/${randomUUID()}-${baseName}${extension}`;
};
const ASSET_KIND_VALUES = new Set(["image", "audio", "file"]);

const sanitizeAssetKind = (kind) =>
  ASSET_KIND_VALUES.has(kind) ? kind : "file";

const router = express.Router();

const tableExists = async (client, tableName) => {
  const { rows } = await client.query("SELECT to_regclass($1) AS table_name", [
    tableName,
  ]);
  return Boolean(rows[0]?.table_name);
};

const deleteLessonCascade = async (client, lessonId) => {
  if (await tableExists(client, "quiz_attempt_answers")) {
    await client.query(
      `
        DELETE FROM quiz_attempt_answers
        WHERE attempt_id IN (
          SELECT id FROM quiz_attempts WHERE lesson_id = $1
        )
        OR question_id IN (
          SELECT id FROM quiz_questions WHERE lesson_id = $1
        )
      `,
      [lessonId],
    );
  }

  if (await tableExists(client, "quiz_attempts")) {
    await client.query("DELETE FROM quiz_attempts WHERE lesson_id = $1", [
      lessonId,
    ]);
  }

  if (await tableExists(client, "quiz_options")) {
    await client.query(
      `
        DELETE FROM quiz_options
        WHERE question_id IN (
          SELECT id FROM quiz_questions WHERE lesson_id = $1
        )
      `,
      [lessonId],
    );
  }

  if (await tableExists(client, "quiz_questions")) {
    await client.query("DELETE FROM quiz_questions WHERE lesson_id = $1", [
      lessonId,
    ]);
  }

  if (await tableExists(client, "quizzes")) {
    await client.query("DELETE FROM quizzes WHERE lesson_id = $1", [lessonId]);
  }

  if (await tableExists(client, "lesson_submission_files")) {
    await client.query(
      `
        DELETE FROM lesson_submission_files
        WHERE submission_id IN (
          SELECT id FROM lesson_submissions WHERE lesson_id = $1
        )
      `,
      [lessonId],
    );
  }

  if (await tableExists(client, "lesson_submissions")) {
    await client.query("DELETE FROM lesson_submissions WHERE lesson_id = $1", [
      lessonId,
    ]);
  }

  if (await tableExists(client, "lesson_assets")) {
    await client.query("DELETE FROM lesson_assets WHERE lesson_id = $1", [
      lessonId,
    ]);
  }

  if (await tableExists(client, "lesson_progress")) {
    await client.query("DELETE FROM lesson_progress WHERE lesson_id = $1", [
      lessonId,
    ]);
  }

  const { rows } = await client.query(
    `
      DELETE FROM lessons
      WHERE id = $1
      RETURNING id
    `,
    [lessonId],
  );
  return rows[0] || null;
};

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname) || "";
    cb(null, `${randomUUID()}${extension}`);
  },
});

const uploadAsset = multer({
  storage: uploadStorage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error("Unsupported file type"), false);
  },
}).single("file");

const uploadImageToProcess = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_UPLOAD_SIZE },
  fileFilter: (req, file, cb) => {
    if (IMAGE_MIME_TYPES.includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error("Unsupported image type"), false);
  },
}).single("file");

const runUploadFile = (req, res) =>
  new Promise((resolve, reject) => {
    uploadAsset(req, res, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });

const runImageProcessingUpload = (req, res) =>
  new Promise((resolve, reject) => {
    uploadImageToProcess(req, res, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });

const getAssetKind = (mimeType) => {
  if (IMAGE_MIME_TYPES.includes(mimeType)) {
    return "image";
  }
  if (AUDIO_MIME_TYPES.includes(mimeType)) {
    return "audio";
  }
  if (DOCUMENT_MIME_TYPES.includes(mimeType)) {
    return "file";
  }
  return null;
};

const isValidAssetKind = (kind) => ["image", "audio", "file"].includes(kind);

const COURSE_LEVEL_JOIN = "LEFT JOIN course_levels cl ON cl.id = c.level_id";
const FALLBACK_LEVEL_CODE = "A1";
const COURSE_SELECT = `
  c.id,
  c.title,
  c.description,
  COALESCE(cl.code, '${FALLBACK_LEVEL_CODE}') AS level,
  c.owner_user_id,
  c.is_published,
  c.published_at,
  c.created_at,
  c.updated_at
`;

const normalizeLevelCode = (value) => (value || "").trim().toUpperCase();

const resolveLevelId = async (code) => {
  const normalized = normalizeLevelCode(code);
  const { rows } = await pool.query(
    "SELECT id FROM course_levels WHERE code = $1 LIMIT 1",
    [normalized || FALLBACK_LEVEL_CODE],
  );
  if (rows.length) {
    return rows[0].id;
  }
  const fallbackRows = await pool.query(
    "SELECT id FROM course_levels ORDER BY created_at ASC LIMIT 1",
  );
  return fallbackRows.rows[0]?.id || null;
};

const fetchCourseById = async (courseId) => {
  const { rows } = await pool.query(
    `
      SELECT ${COURSE_SELECT}
      FROM courses c
      ${COURSE_LEVEL_JOIN}
      WHERE c.id = $1
      LIMIT 1
    `,
    [courseId],
  );
  return rows[0] || null;
};

router.use(auth);
router.use(requireGlobalRoleAny(CMS_GLOBAL_ROLES));

const fetchCourseIdByModule = async (moduleId) => {
  const { rows } = await pool.query(
    "SELECT course_id FROM modules WHERE id = $1 LIMIT 1",
    [moduleId],
  );
  return rows[0]?.course_id;
};

const fetchCourseIdByLesson = async (lessonId) => {
  const { rows } = await pool.query(
    `
      SELECT m.course_id
      FROM lessons l
      JOIN modules m ON m.id = l.module_id
      WHERE l.id = $1
      LIMIT 1
    `,
    [lessonId],
  );
  return rows[0]?.course_id;
};

const resolveCourseIdFromParam = (param) => (req) => req.params[param];
const resolveCourseIdFromModuleParam = (param) => async (req) =>
  fetchCourseIdByModule(req.params[param]);
const resolveCourseIdFromLessonParam = (param) => async (req) =>
  fetchCourseIdByLesson(req.params[param]);
const resolveCourseIdFromGroupParam = (param) => async (req) => {
  const group = await fetchGroupById(req.params[param]);
  return group?.course_id || null;
};

const requireCourseContentRole = (resolver) =>
  requireCourseRoleAny(resolver, CONTENT_ROLES);
const requireCourseRoleOrAdmin = (resolver, roles = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const resolved = await resolveCourseId(resolver, req);
      const courseId =
        typeof resolved === "string" ? resolved : resolved?.courseId;
      if (!courseId) {
        return res.status(404).json({ error: "Course not found" });
      }

      const course = await ensureCourseExists(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      if (hasGlobalRole(req.user, "admin")) {
        req.courseContext = {
          ...(req.courseContext || {}),
          courseId: course.id,
          course,
        };
        return next();
      }

      return requireCourseRoleAny(resolver, roles)(req, res, next);
    } catch (err) {
      console.error("Course role verification failed", err);
      return res
        .status(500)
        .json({ error: "Failed to verify course permissions" });
    }
  };
};
const requireCourseEnrollmentRole = (resolver) =>
  requireCourseRoleAny(resolver, ENROLLMENT_ROLES);

const fetchGroupById = async (groupId) => {
  const { rows } = await pool.query(
    "SELECT id, course_id, name FROM groups WHERE id = $1 LIMIT 1",
    [groupId],
  );
  return rows[0];
};

const toDateString = (value) =>
  value ? value.toISOString().split("T")[0] : null;
const toTimestampString = (value) => (value ? value.toISOString() : null);

const sendGroupMembershipError = (res, err, fallbackMessage) => {
  if (err.code === "GROUP_CAPACITY_REACHED") {
    return res.status(409).json({ error: err.message });
  }
  if (err.code === "GROUP_NOT_IN_COURSE") {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: fallbackMessage });
};

const mapGroupRow = (row) => ({
  id: row.id,
  courseId: row.course_id,
  name: row.name,
  code: row.code,
  timezone: row.timezone,
  startDate: toDateString(row.start_date),
  endDate: toDateString(row.end_date),
  capacity: row.capacity,
  status: row.status,
  isActive: row.is_active,
  scheduleText: row.schedule_text || null,
  createdAt: toTimestampString(row.created_at),
  updatedAt: toTimestampString(row.updated_at),
  teachersCount: Number(row.teachers_count || 0),
  teachers: Array.isArray(row.teachers) ? row.teachers : [],
  studentsCount: Number(row.students_count || 0),
  nextClass: row.next_session_id
    ? {
        id: row.next_session_id,
        title: row.next_session_title || null,
        startsAt: toTimestampString(row.next_session_starts_at),
        joinUrl: row.next_session_join_url || null,
      }
    : null,
});

const mapCoursePostRow = (row) => ({
  id: row.id,
  courseId: row.course_id,
  groupId: row.group_id || null,
  createdByUserId: row.created_by_user_id || null,
  title: row.title,
  body: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at || null,
});

const hasPostsCmsAccess = (user) =>
  hasGlobalRole(user, "admin") ||
  hasGlobalRole(user, "instructor") ||
  hasGlobalRole(user, "content_editor");

const canSavePastLessonDates = (user) =>
  PAST_LESSON_DATE_ROLES.some((role) => hasGlobalRole(user, role));

let quizQuestionsHasQuizIdColumn = null;
let quizzesTableExists = null;

const getQuizQuestionsHasQuizIdColumn = async () => {
  if (quizQuestionsHasQuizIdColumn !== null)
    return quizQuestionsHasQuizIdColumn;
  const { rows } = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'quiz_questions'
          AND column_name = 'quiz_id'
      ) AS exists
    `,
  );
  quizQuestionsHasQuizIdColumn = Boolean(rows[0]?.exists);
  return quizQuestionsHasQuizIdColumn;
};

const getQuizzesTableExists = async () => {
  if (quizzesTableExists !== null) return quizzesTableExists;
  const { rows } = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'quizzes'
      ) AS exists
    `,
  );
  quizzesTableExists = Boolean(rows[0]?.exists);
  return quizzesTableExists;
};

const getQuizWithOptionsSelect = async () => {
  const hasQuizId = await getQuizQuestionsHasQuizIdColumn();
  return `
    SELECT
      qq.id AS question_id,
      qq.lesson_id,
      qq.question_text,
      qq.question_type,
      qq.order_index,
      ${hasQuizId ? "qq.quiz_id" : "NULL::uuid"} AS question_quiz_id,
      qq.points AS question_points,
      qq.explanation AS question_explanation,
      qq.meta AS question_meta,
      qo.id AS option_id,
      qo.option_text,
      qo.is_correct,
      qo.order_index AS option_order,
      qo.points AS option_points,
      qo.feedback AS option_feedback,
      qo.meta AS option_meta
    FROM quiz_questions qq
    LEFT JOIN quiz_options qo ON qo.question_id = qq.id
  `;
};

const mapQuizRowsToQuestions = (rows) => {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.question_id)) {
      map.set(row.question_id, {
        id: row.question_id,
        lessonId: row.lesson_id,
        questionText: row.question_text,
        questionType: row.question_type,
        orderIndex: row.order_index,
        options: [],
        points: row.question_points !== null ? Number(row.question_points) : 1,
        explanation: row.question_explanation || null,
        meta: row.question_meta || null,
        quizId: row.question_quiz_id || null,
      });
    }
    if (row.option_id) {
      map.get(row.question_id).options.push({
        id: row.option_id,
        optionText: row.option_text,
        isCorrect: row.is_correct,
        orderIndex: row.option_order,
        points: row.option_points !== null ? Number(row.option_points) : 0,
        feedback: row.option_feedback || null,
        meta: row.option_meta || null,
      });
    }
  }
  return Array.from(map.values());
};

const getQuizIdByLesson = async (lessonId) => {
  const hasQuizzesTable = await getQuizzesTableExists();
  if (!hasQuizzesTable) {
    return null;
  }
  const { rows } = await pool.query(
    "SELECT id FROM quizzes WHERE lesson_id = $1 LIMIT 1",
    [lessonId],
  );
  return rows[0]?.id || null;
};

router.get("/courses", async (req, res) => {
  try {
    const isAdmin = hasGlobalRole(req.user, "admin");
    let rows;
    if (isAdmin) {
      ({ rows } = await pool.query(
        `
          SELECT ${COURSE_SELECT}
          FROM courses c
          ${COURSE_LEVEL_JOIN}
          ORDER BY c.created_at DESC
        `,
      ));
    } else if (isEnrollmentManagerOnly(req.user)) {
      ({ rows } = await pool.query(
        `
          SELECT DISTINCT ${COURSE_SELECT}
          FROM courses c
          ${COURSE_LEVEL_JOIN}
          JOIN course_user_roles cur
            ON cur.course_id = c.id AND cur.user_id = $1
          JOIN roles r
            ON r.id = cur.role_id AND r.name = 'enrollment_manager'
          ORDER BY c.created_at DESC
        `,
        [req.user.id],
      ));
    } else {
      ({ rows } = await pool.query(
        `
          SELECT DISTINCT ${COURSE_SELECT}
          FROM courses c
          ${COURSE_LEVEL_JOIN}
          LEFT JOIN course_user_roles cur
            ON cur.course_id = c.id AND cur.user_id = $1
          LEFT JOIN roles r ON r.id = cur.role_id
          WHERE c.owner_user_id = $1
             OR r.name = ANY($2)
             OR EXISTS (
               SELECT 1
               FROM groups g
               JOIN group_teachers gt ON gt.group_id = g.id
               WHERE g.course_id = c.id
                 AND gt.user_id = $1
             )
          ORDER BY c.created_at DESC
        `,
        [req.user.id, COURSE_STAFF_ROLES],
      ));
    }

    return res.json(rows);
  } catch (err) {
    console.error("Failed to list CMS courses", err);
    return res.status(500).json({ error: "Failed to list courses" });
  }
});

router.get("/course-levels", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT id, code, label, is_active
        FROM course_levels
        ORDER BY code ASC
      `,
    );
    return res.json(rows);
  } catch (err) {
    console.error("Failed to list CMS course levels", err);
    return res.status(500).json({ error: "Failed to load course levels" });
  }
});

router.get("/announcements", async (req, res) => {
  const isAdmin = hasGlobalRole(req.user, "admin");
  const status = req.query.status ? String(req.query.status).trim() : null;
  const scope = req.query.scope ? String(req.query.scope).trim() : null;
  const courseId = req.query.courseId
    ? String(req.query.courseId).trim()
    : null;
  const groupId = req.query.groupId ? String(req.query.groupId).trim() : null;
  const pageRaw = Number.parseInt(req.query.page, 10);
  const pageSizeRaw = Number.parseInt(req.query.pageSize, 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(Math.max(pageSizeRaw, 1), 100)
    : 20;
  const offset = (page - 1) * pageSize;

  try {
    let editableCourseIds = [];
    if (!isAdmin) {
      const editableCourses = await pool.query(
        `
          SELECT id AS course_id
          FROM courses
          WHERE owner_user_id = $1
          UNION
          SELECT DISTINCT cur.course_id
          FROM course_user_roles cur
          JOIN roles r ON r.id = cur.role_id
          WHERE cur.user_id = $1
            AND r.name IN ('instructor', 'content_editor')
        `,
        [req.user.id],
      );
      editableCourseIds = editableCourses.rows.map((row) => row.course_id);

      if (scope === "academy" || !editableCourseIds.length) {
        return res.json({
          data: [],
          page,
          pageSize,
          total: 0,
        });
      }
    }

    const whereParts = [];
    const params = [];
    const pushParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (status) {
      whereParts.push(`a.status = ${pushParam(status)}`);
    }
    if (scope) {
      whereParts.push(`a.scope = ${pushParam(scope)}`);
    }
    if (courseId) {
      whereParts.push(`a.course_id = ${pushParam(courseId)}`);
    }
    if (groupId) {
      whereParts.push(`a.group_id = ${pushParam(groupId)}`);
    }

    if (!isAdmin) {
      const editableCourseIdsParam = pushParam(editableCourseIds);
      whereParts.push(`
        (
          (a.scope = 'course' AND a.course_id = ANY(${editableCourseIdsParam}::uuid[]))
          OR
          (
            a.scope = 'group'
            AND EXISTS (
              SELECT 1
              FROM groups g
              WHERE g.id = a.group_id
                AND g.course_id = ANY(${editableCourseIdsParam}::uuid[])
            )
          )
        )
      `);
    }

    const whereClause = whereParts.length
      ? `WHERE ${whereParts.join(" AND ")}`
      : "";

    const countResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM announcements a
        ${whereClause}
      `,
      params,
    );

    const dataParams = [...params, pageSize, offset];
    const limitParam = `$${params.length + 1}`;
    const offsetParam = `$${params.length + 2}`;
    const dataResult = await pool.query(
      `
        SELECT
          a.id,
          a.scope,
          a.course_id,
          a.group_id,
          a.created_by_user_id,
          a.title,
          a.body,
          a.status,
          a.priority,
          a.starts_at,
          a.expires_at,
          a.created_at
        FROM announcements a
        ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT ${limitParam} OFFSET ${offsetParam}
      `,
      dataParams,
    );

    return res.json({
      data: dataResult.rows.map((row) => ({
        id: row.id,
        scope: row.scope,
        courseId: row.course_id || null,
        groupId: row.group_id || null,
        createdByUserId: row.created_by_user_id || null,
        title: row.title,
        body: row.body,
        status: row.status,
        priority: Number(row.priority),
        startsAt: row.starts_at || null,
        expiresAt: row.expires_at || null,
        createdAt: row.created_at,
      })),
      page,
      pageSize,
      total: Number(countResult.rows[0]?.total || 0),
    });
  } catch (err) {
    console.error("Failed to list CMS announcements", err);
    return res.status(500).json({ error: "Failed to list announcements" });
  }
});

router.post("/announcements", async (req, res) => {
  const parsed = announcementCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  const isAdmin = hasGlobalRole(req.user, "admin");
  const { scope, title, body } = parsed.data;
  let courseId = parsed.data.courseId || null;
  let groupId = parsed.data.groupId || null;
  const status = parsed.data.status || "published";
  const priority = parsed.data.priority ?? 2;
  const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
  const expiresAt = parsed.data.expiresAt
    ? new Date(parsed.data.expiresAt)
    : null;

  try {
    if (scope === "academy") {
      if (!isAdmin) {
        return res
          .status(403)
          .json({ error: "Only admins can create academy announcements" });
      }
      courseId = null;
      groupId = null;
    }

    if (scope === "course") {
      const course = await ensureCourseExists(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      if (!isAdmin) {
        const allowed = await canEditCourse(courseId, req.user);
        if (!allowed) {
          return res
            .status(403)
            .json({ error: "You cannot create announcements for this course" });
        }
      }
      groupId = null;
    }

    if (scope === "group") {
      const group = await fetchGroupById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      courseId = group.course_id;
      if (!isAdmin) {
        const allowed = await canEditCourse(courseId, req.user);
        if (!allowed) {
          return res
            .status(403)
            .json({ error: "You cannot create announcements for this group" });
        }
      }
    }

    const { rows } = await pool.query(
      `
        INSERT INTO announcements (
          scope,
          course_id,
          group_id,
          created_by_user_id,
          title,
          body,
          status,
          priority,
          starts_at,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING
          id,
          scope,
          course_id,
          group_id,
          created_by_user_id,
          title,
          body,
          status,
          priority,
          starts_at,
          expires_at,
          created_at
      `,
      [
        scope,
        courseId,
        groupId,
        req.user.id,
        title,
        body,
        status,
        priority,
        startsAt,
        expiresAt,
      ],
    );

    const announcement = rows[0];
    return res.status(201).json({
      id: announcement.id,
      scope: announcement.scope,
      courseId: announcement.course_id || null,
      groupId: announcement.group_id || null,
      createdByUserId: announcement.created_by_user_id || null,
      title: announcement.title,
      body: announcement.body,
      status: announcement.status,
      priority: Number(announcement.priority),
      startsAt: announcement.starts_at || null,
      expiresAt: announcement.expires_at || null,
      createdAt: announcement.created_at,
    });
  } catch (err) {
    console.error("Failed to create announcement", err);
    return res.status(500).json({ error: "Failed to create announcement" });
  }
});

router.patch("/announcements/:id", async (req, res) => {
  const parsedId = uuidSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ error: formatZodError(parsedId.error) });
  }

  const parsed = announcementUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }
  const announcementId = parsedId.data;
  const isAdmin = hasGlobalRole(req.user, "admin");

  try {
    const updatedAtColumnCheck = await pool.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'announcements'
            AND column_name = 'updated_at'
        ) AS exists
      `,
    );
    const hasUpdatedAtColumn = Boolean(updatedAtColumnCheck.rows[0]?.exists);

    const existingResult = await pool.query(
      `
        SELECT
          id,
          scope,
          course_id,
          group_id,
          title,
          body,
          status,
          priority,
          starts_at,
          expires_at,
          created_by_user_id,
          created_at
        FROM announcements
        WHERE id = $1
        LIMIT 1
      `,
      [announcementId],
    );

    if (!existingResult.rows.length) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    const existing = existingResult.rows[0];

    if (!isAdmin) {
      if (existing.scope === "academy") {
        return res
          .status(403)
          .json({ error: "You cannot edit academy announcements" });
      }

      if (existing.scope === "course") {
        const allowed = await canEditCourse(existing.course_id, req.user);
        if (!allowed) {
          return res
            .status(403)
            .json({ error: "You cannot edit this announcement" });
        }
      }

      if (existing.scope === "group") {
        const groupResult = await pool.query(
          `
            SELECT course_id
            FROM groups
            WHERE id = $1
            LIMIT 1
          `,
          [existing.group_id],
        );
        if (!groupResult.rows.length) {
          return res.status(404).json({ error: "Group not found" });
        }
        const allowed = await canEditCourse(
          groupResult.rows[0].course_id,
          req.user,
        );
        if (!allowed) {
          return res
            .status(403)
            .json({ error: "You cannot edit this announcement" });
        }
      }
    }

    const hasScope = Object.prototype.hasOwnProperty.call(parsed.data, "scope");
    const hasCourseId = Object.prototype.hasOwnProperty.call(
      parsed.data,
      "courseId",
    );
    const hasGroupId = Object.prototype.hasOwnProperty.call(
      parsed.data,
      "groupId",
    );
    const hasStartsAt = Object.prototype.hasOwnProperty.call(
      parsed.data,
      "startsAt",
    );
    const hasExpiresAt = Object.prototype.hasOwnProperty.call(
      parsed.data,
      "expiresAt",
    );

    const targetScope = hasScope ? parsed.data.scope : existing.scope;
    let targetCourseId = existing.course_id;
    let targetGroupId = existing.group_id;
    let resolvedGroup = null;

    if (targetScope === "academy") {
      if (!isAdmin) {
        return res
          .status(403)
          .json({ error: "Only admins can edit academy announcements" });
      }
      if (hasCourseId && parsed.data.courseId !== null) {
        return res
          .status(400)
          .json({ error: "courseId must be empty for academy scope" });
      }
      if (hasGroupId && parsed.data.groupId !== null) {
        return res
          .status(400)
          .json({ error: "groupId must be empty for academy scope" });
      }
      targetCourseId = null;
      targetGroupId = null;
    }

    if (targetScope === "course") {
      if (hasGroupId && parsed.data.groupId !== null) {
        return res
          .status(400)
          .json({ error: "groupId must be empty for course scope" });
      }
      targetCourseId = hasCourseId ? parsed.data.courseId : existing.course_id;
      if (!targetCourseId) {
        return res
          .status(400)
          .json({ error: "courseId is required for course scope" });
      }
      targetGroupId = null;

      const course = await ensureCourseExists(targetCourseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      if (!isAdmin) {
        const allowed = await canEditCourse(targetCourseId, req.user);
        if (!allowed) {
          return res
            .status(403)
            .json({ error: "You cannot edit this announcement target" });
        }
      }
    }

    if (targetScope === "group") {
      targetGroupId = hasGroupId ? parsed.data.groupId : existing.group_id;
      if (!targetGroupId) {
        return res
          .status(400)
          .json({ error: "groupId is required for group scope" });
      }

      resolvedGroup = await fetchGroupById(targetGroupId);
      if (!resolvedGroup) {
        return res.status(404).json({ error: "Group not found" });
      }
      targetCourseId = resolvedGroup.course_id;

      if (!isAdmin) {
        const allowed = await canEditCourse(targetCourseId, req.user);
        if (!allowed) {
          return res
            .status(403)
            .json({ error: "You cannot edit this announcement target" });
        }
      }
    }

    const finalStartsAt = hasStartsAt
      ? parsed.data.startsAt === null
        ? null
        : new Date(parsed.data.startsAt)
      : existing.starts_at;
    const finalExpiresAt = hasExpiresAt
      ? parsed.data.expiresAt === null
        ? null
        : new Date(parsed.data.expiresAt)
      : existing.expires_at;

    if (
      finalStartsAt &&
      finalExpiresAt &&
      new Date(finalExpiresAt) <= new Date(finalStartsAt)
    ) {
      return res
        .status(400)
        .json({ error: "expiresAt must be later than startsAt" });
    }

    const updates = [];
    const values = [];
    const addUpdate = (column, value) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if (Object.prototype.hasOwnProperty.call(parsed.data, "title")) {
      addUpdate("title", parsed.data.title);
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "body")) {
      addUpdate("body", parsed.data.body);
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "status")) {
      addUpdate("status", parsed.data.status);
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "priority")) {
      addUpdate("priority", parsed.data.priority);
    }
    if (targetScope !== existing.scope) {
      addUpdate("scope", targetScope);
    }
    if (targetCourseId !== existing.course_id) {
      addUpdate("course_id", targetCourseId);
    }
    if (targetGroupId !== existing.group_id) {
      addUpdate("group_id", targetGroupId);
    }
    if (hasStartsAt) {
      addUpdate("starts_at", finalStartsAt);
    }
    if (hasExpiresAt) {
      addUpdate("expires_at", finalExpiresAt);
    }

    if (!updates.length) {
      console.log("PATCH sin campos válidos:", req.body);
      return res.status(400).json({
        error: "No updates provided",
        receivedBody: req.body,
      });
    }
    if (hasUpdatedAtColumn) {
      updates.push("updated_at = now()");
    }

    values.push(announcementId);
    const { rows } = await pool.query(
      `
        UPDATE announcements
        SET ${updates.join(", ")}
        WHERE id = $${values.length}
        RETURNING
          id,
          scope,
          course_id,
          group_id,
          created_by_user_id,
          title,
          body,
          status,
          priority,
          starts_at,
          expires_at,
          created_at,
          ${hasUpdatedAtColumn ? "updated_at" : "NULL::timestamptz AS updated_at"}
      `,
      values,
    );

    const updated = rows[0];
    return res.json({
      id: updated.id,
      scope: updated.scope,
      courseId: updated.course_id || null,
      groupId: updated.group_id || null,
      createdByUserId: updated.created_by_user_id || null,
      title: updated.title,
      body: updated.body,
      status: updated.status,
      priority: Number(updated.priority),
      startsAt: updated.starts_at || null,
      expiresAt: updated.expires_at || null,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at || null,
    });
  } catch (err) {
    console.error("Failed to update announcement", err);
    return res.status(500).json({ error: "Failed to update announcement" });
  }
});

router.delete("/announcements/:id", async (req, res) => {
  const parsedId = uuidSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ error: formatZodError(parsedId.error) });
  }

  const announcementId = parsedId.data;
  const isAdmin = hasGlobalRole(req.user, "admin");

  try {
    const existingResult = await pool.query(
      `
        SELECT id, scope, course_id, group_id
        FROM announcements
        WHERE id = $1
        LIMIT 1
      `,
      [announcementId],
    );

    if (!existingResult.rows.length) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    const existing = existingResult.rows[0];

    if (!isAdmin) {
      if (existing.scope === "academy") {
        return res
          .status(403)
          .json({ error: "You cannot delete academy announcements" });
      }

      if (existing.scope === "course") {
        const allowed = await canEditCourse(existing.course_id, req.user);
        if (!allowed) {
          return res
            .status(403)
            .json({ error: "You cannot delete this announcement" });
        }
      }

      if (existing.scope === "group") {
        const group = await fetchGroupById(existing.group_id);
        if (!group) {
          return res.status(404).json({ error: "Group not found" });
        }
        const allowed = await canEditCourse(group.course_id, req.user);
        if (!allowed) {
          return res
            .status(403)
            .json({ error: "You cannot delete this announcement" });
        }
      }
    }

    await pool.query(
      `
        DELETE FROM announcements
        WHERE id = $1
      `,
      [announcementId],
    );

    return res.status(204).send();
  } catch (err) {
    console.error("Failed to delete announcement", err);
    return res.status(500).json({ error: "Failed to delete announcement" });
  }
});

router.get("/courses/:courseId/posts", async (req, res) => {
  const parsedCourseId = uuidSchema.safeParse(req.params.courseId);
  if (!parsedCourseId.success) {
    return res
      .status(400)
      .json({ error: formatZodError(parsedCourseId.error) });
  }

  if (!hasPostsCmsAccess(req.user)) {
    return res.status(403).json({ error: "You cannot manage course posts" });
  }

  const courseId = parsedCourseId.data;
  const parsedGroupId = req.query.groupId
    ? uuidSchema.safeParse(String(req.query.groupId))
    : null;
  if (parsedGroupId && !parsedGroupId.success) {
    return res.status(400).json({ error: formatZodError(parsedGroupId.error) });
  }
  const groupId = parsedGroupId?.data || null;

  const pageRaw = Number.parseInt(req.query.page, 10);
  const pageSizeRaw = Number.parseInt(req.query.pageSize, 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(Math.max(pageSizeRaw, 1), 100)
    : 20;
  const offset = (page - 1) * pageSize;
  const isAdmin = hasGlobalRole(req.user, "admin");

  try {
    const course = await ensureCourseExists(courseId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    if (!isAdmin) {
      const allowed = await canEditCourse(courseId, req.user);
      if (!allowed) {
        return res
          .status(403)
          .json({ error: "You cannot view posts for this course" });
      }
    }

    const where = ["cp.course_id = $1"];
    const params = [courseId];
    if (groupId) {
      params.push(groupId);
      where.push(`cp.group_id = $${params.length}`);
    }
    const whereClause = `WHERE ${where.join(" AND ")}`;

    const totalResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM course_posts cp
        ${whereClause}
      `,
      params,
    );

    const listParams = [...params, pageSize, offset];
    const listResult = await pool.query(
      `
        SELECT
          cp.id,
          cp.course_id,
          cp.group_id,
          cp.created_by_user_id,
          cp.title,
          cp.body,
          cp.created_at,
          cp.updated_at
        FROM course_posts cp
        ${whereClause}
        ORDER BY cp.created_at DESC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `,
      listParams,
    );

    return res.json({
      data: listResult.rows.map(mapCoursePostRow),
      page,
      pageSize,
      total: Number(totalResult.rows[0]?.total || 0),
    });
  } catch (err) {
    console.error("Failed to list course posts", err);
    return res.status(500).json({ error: "Failed to list course posts" });
  }
});

router.post("/courses/:courseId/posts", async (req, res) => {
  const parsedCourseId = uuidSchema.safeParse(req.params.courseId);
  if (!parsedCourseId.success) {
    return res
      .status(400)
      .json({ error: formatZodError(parsedCourseId.error) });
  }
  if (!hasPostsCmsAccess(req.user)) {
    return res.status(403).json({ error: "You cannot create course posts" });
  }

  const parsed = coursePostCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  const courseId = parsedCourseId.data;
  const isAdmin = hasGlobalRole(req.user, "admin");
  let groupId = null;

  try {
    const course = await ensureCourseExists(courseId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    if (!isAdmin) {
      const allowed = await canEditCourse(courseId, req.user);
      if (!allowed) {
        return res
          .status(403)
          .json({ error: "You cannot create posts for this course" });
      }
    }

    if (parsed.data.target === "group") {
      const group = await fetchGroupById(parsed.data.groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      if (group.course_id !== courseId) {
        return res
          .status(400)
          .json({ error: "Group must belong to the course" });
      }
      groupId = group.id;
    }

    const { rows } = await pool.query(
      `
        INSERT INTO course_posts (
          course_id,
          group_id,
          created_by_user_id,
          title,
          body
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          course_id,
          group_id,
          created_by_user_id,
          title,
          body,
          created_at,
          updated_at
      `,
      [courseId, groupId, req.user.id, parsed.data.title, parsed.data.body],
    );

    return res.status(201).json(mapCoursePostRow(rows[0]));
  } catch (err) {
    console.error("Failed to create course post", err);
    return res.status(500).json({ error: "Failed to create course post" });
  }
});

router.put("/posts/:id", async (req, res) => {
  const parsedId = uuidSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ error: formatZodError(parsedId.error) });
  }
  if (!hasPostsCmsAccess(req.user)) {
    return res.status(403).json({ error: "You cannot edit course posts" });
  }

  const parsed = coursePostUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  const postId = parsedId.data;
  const isAdmin = hasGlobalRole(req.user, "admin");

  try {
    const existingResult = await pool.query(
      `
        SELECT
          id,
          course_id,
          group_id,
          title,
          body,
          created_by_user_id,
          created_at,
          updated_at
        FROM course_posts
        WHERE id = $1
        LIMIT 1
      `,
      [postId],
    );

    if (!existingResult.rows.length) {
      return res.status(404).json({ error: "Post not found" });
    }

    const existing = existingResult.rows[0];
    if (!isAdmin) {
      const allowed = await canEditCourse(existing.course_id, req.user);
      if (!allowed) {
        return res.status(403).json({ error: "You cannot edit this post" });
      }
    }

    const hasTarget = Object.prototype.hasOwnProperty.call(
      parsed.data,
      "target",
    );
    const hasGroupId = Object.prototype.hasOwnProperty.call(
      parsed.data,
      "groupId",
    );
    let nextGroupId = existing.group_id;
    const target = hasTarget
      ? parsed.data.target
      : existing.group_id
        ? "group"
        : "course";

    if (target === "course") {
      if (hasGroupId && parsed.data.groupId) {
        return res
          .status(400)
          .json({ error: "groupId must be empty for course target" });
      }
      nextGroupId = null;
    } else {
      const candidateGroupId = hasGroupId
        ? parsed.data.groupId
        : existing.group_id;
      if (!candidateGroupId) {
        return res
          .status(400)
          .json({ error: "groupId is required for group target" });
      }
      const group = await fetchGroupById(candidateGroupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      if (group.course_id !== existing.course_id) {
        return res
          .status(400)
          .json({ error: "Group must belong to the post course" });
      }
      nextGroupId = group.id;
    }

    const updates = [];
    const values = [];
    const pushUpdate = (column, value) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if (Object.prototype.hasOwnProperty.call(parsed.data, "title")) {
      pushUpdate("title", parsed.data.title);
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "body")) {
      pushUpdate("body", parsed.data.body);
    }
    if (nextGroupId !== existing.group_id) {
      pushUpdate("group_id", nextGroupId);
    }
    updates.push("updated_at = now()");

    values.push(postId);
    const { rows } = await pool.query(
      `
        UPDATE course_posts
        SET ${updates.join(", ")}
        WHERE id = $${values.length}
        RETURNING
          id,
          course_id,
          group_id,
          created_by_user_id,
          title,
          body,
          created_at,
          updated_at
      `,
      values,
    );

    return res.json(mapCoursePostRow(rows[0]));
  } catch (err) {
    console.error("Failed to update course post", err);
    return res.status(500).json({ error: "Failed to update course post" });
  }
});

router.post("/courses", requireCmsContentAccess, async (req, res) => {
  const parsed = courseCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  try {
    const isAdmin = hasGlobalRole(req.user, "admin");
    const ownerUserId = isAdmin ? parsed.data.ownerUserId || null : req.user.id;
    const levelId = await resolveLevelId(parsed.data.level);

    const { rows } = await pool.query(
      `
        INSERT INTO courses (title, description, level_id, owner_user_id, is_published)
        VALUES ($1, $2, $3, $4, false)
        RETURNING id
      `,
      [
        parsed.data.title,
        parsed.data.description || null,
        levelId,
        ownerUserId,
      ],
    );
    if (!rows.length) {
      throw new Error("Failed to return created course");
    }
    const course = await fetchCourseById(rows[0].id);
    return res.status(201).json(course);
  } catch (err) {
    console.error("Failed to create course", err);
    return res.status(500).json({ error: "Failed to create course" });
  }
});

router.patch(
  "/courses/:id",
  requireCourseContentRole(resolveCourseIdFromParam("id")),
  async (req, res) => {
    const courseId = req.params.id;
    const parsed = courseUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    try {
      const updates = [];
      const values = [];

      if (parsed.data.title !== undefined) {
        values.push(parsed.data.title);
        updates.push(`title = $${values.length}`);
      }
      if (parsed.data.description !== undefined) {
        values.push(parsed.data.description);
        updates.push(`description = $${values.length}`);
      }
      if (parsed.data.level !== undefined) {
        const levelId = await resolveLevelId(parsed.data.level);
        if (!levelId) {
          return res.status(400).json({ error: "Invalid level code" });
        }
        values.push(levelId);
        updates.push(`level_id = $${values.length}`);
      }

      if (
        hasGlobalRole(req.user, "admin") &&
        parsed.data.ownerUserId !== undefined
      ) {
        values.push(parsed.data.ownerUserId);
        updates.push(`owner_user_id = $${values.length}`);
      }

      if (!updates.length) {
        return res.status(400).json({ error: "No updates provided" });
      }

      const query = `
      UPDATE courses
      SET ${updates.join(", ")}, updated_at = now()
      WHERE id = $${values.length + 1}
      RETURNING id
    `;
      values.push(courseId);

      const { rows } = await pool.query(query, values);
      if (!rows.length) {
        return res.status(404).json({ error: "Course not found" });
      }
      const course = await fetchCourseById(courseId);
      return res.json(course);
    } catch (err) {
      console.error("Failed to update course", err);
      return res.status(500).json({ error: "Failed to update course" });
    }
  },
);

const toggleCoursePublish = async (req, res, isPublished) => {
  const courseId = req.params.id;
  try {
    const { rows } = await pool.query(
      `
        UPDATE courses
        SET
          is_published = $2,
          published_at = CASE WHEN $2 THEN now() ELSE NULL END,
          updated_at = now()
        WHERE id = $1
        RETURNING id, title, is_published, published_at, updated_at
      `,
      [courseId, isPublished],
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Course not found" });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error("Failed to toggle course publish state", err);
    return res
      .status(500)
      .json({ error: "Failed to update course publish state" });
  }
};

router.post(
  "/courses/:id/publish",
  requireCourseContentRole(resolveCourseIdFromParam("id")),
  (req, res) => toggleCoursePublish(req, res, true),
);
router.post(
  "/courses/:id/unpublish",
  requireCourseContentRole(resolveCourseIdFromParam("id")),
  (req, res) => toggleCoursePublish(req, res, false),
);

router.delete(
  "/courses/:id",
  requireCourseContentRole(resolveCourseIdFromParam("id")),
  async (req, res) => {
    const courseId = req.params.id;
    try {
      const { rows } = await pool.query(
        `
          DELETE FROM courses
          WHERE id = $1
          RETURNING id
        `,
        [courseId],
      );
      if (!rows.length) {
        return res.status(404).json({ error: "Course not found" });
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error("Failed to delete course", err);
      return res.status(500).json({ error: "Failed to delete course" });
    }
  },
);

router.post("/courses/:id/instructors", async (req, res) => {
  if (!hasGlobalRole(req.user, "admin")) {
    return res
      .status(403)
      .json({ error: "Only admins can assign instructors" });
  }
  const courseId = req.params.id;
  const parsed = instructorAssignSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  const instructorIds = parsed.data.instructorIds || [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const roleRes = await client.query(
      `
        SELECT id
        FROM roles
        WHERE name = 'instructor'
        LIMIT 1
      `,
    );
    const instructorRoleId = roleRes.rows[0]?.id;
    if (!instructorRoleId) {
      await client.query("ROLLBACK");
      return res.status(500).json({ error: "Instructor role not configured" });
    }

    const courseCheck = await client.query(
      "SELECT 1 FROM courses WHERE id = $1 LIMIT 1",
      [courseId],
    );
    if (!courseCheck.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Course not found" });
    }

    if (instructorIds.length) {
      const { rows } = await client.query(
        `
          SELECT DISTINCT ur.user_id
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = ANY($1::uuid[])
            AND r.name = 'instructor'
        `,
        [instructorIds],
      );
      if (rows.length !== instructorIds.length) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "One or more users are not instructors" });
      }
    }

    await client.query(
      "DELETE FROM course_user_roles WHERE course_id = $1 AND role_id = $2",
      [courseId, instructorRoleId],
    );

    if (instructorIds.length) {
      const values = [];
      const placeholders = [];
      instructorIds.forEach((instructorId, index) => {
        const offset = index * 3;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
        values.push(courseId, instructorId, instructorRoleId);
      });
      await client.query(
        `
          INSERT INTO course_user_roles (course_id, user_id, role_id)
          VALUES ${placeholders.join(", ")}
          ON CONFLICT DO NOTHING
        `,
        values,
      );
    }

    await client.query("COMMIT");
    return res.json({ courseId, instructorIds });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to assign instructors", err);
    return res.status(500).json({ error: "Failed to assign instructors" });
  } finally {
    client.release();
  }
});

router.get(
  "/courses/:courseId/modules",
  requireCourseContentRole(resolveCourseIdFromParam("courseId")),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
    try {
      const { rows } = await pool.query(
        `
        SELECT id, course_id, title, position, order_index, is_published, published_at, created_at, updated_at
        FROM modules
        WHERE course_id = $1
        ORDER BY order_index ASC
      `,
        [courseId],
      );
      return res.json(rows);
    } catch (err) {
      console.error("Failed to list modules", err);
      return res.status(500).json({ error: "Failed to list modules" });
    }
  },
);

router.post(
  "/courses/:courseId/modules",
  requireCourseContentRole(resolveCourseIdFromParam("courseId")),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
    const parsed = moduleCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    try {
      let orderIndex = parsed.data.orderIndex;
      if (!orderIndex) {
        const { rows } = await pool.query(
          "SELECT COALESCE(MAX(order_index), 0) + 1 AS next FROM modules WHERE course_id = $1",
          [courseId],
        );
        orderIndex = rows[0].next;
      }

      const { rows } = await pool.query(
        `
        INSERT INTO modules (course_id, title, position, order_index, is_published)
        VALUES ($1, $2, $3, $4, false)
        RETURNING id, course_id, title, position, order_index, is_published, published_at, created_at, updated_at
      `,
        [courseId, parsed.data.title, orderIndex, orderIndex],
      );
      return res.status(201).json(rows[0]);
    } catch (err) {
      console.error("Failed to create module", err);
      return res.status(500).json({ error: "Failed to create module" });
    }
  },
);

router.patch(
  "/modules/:id",
  requireCourseContentRole(resolveCourseIdFromModuleParam("id")),
  async (req, res) => {
    const moduleId = req.params.id;
    const parsed = moduleUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }
    try {
      const updates = [];
      const values = [];
      if (parsed.data.title !== undefined) {
        values.push(parsed.data.title);
        updates.push(`title = $${values.length}`);
      }
      if (parsed.data.orderIndex !== undefined) {
        values.push(parsed.data.orderIndex);
        updates.push(`order_index = $${values.length}`);
      }

      if (!updates.length) {
        return res.status(400).json({ error: "No updates provided" });
      }

      const query = `
      UPDATE modules
      SET ${updates.join(", ")}, updated_at = now()
      WHERE id = $${values.length + 1}
      RETURNING id, course_id, title, order_index, is_published, published_at, created_at, updated_at
    `;
      values.push(moduleId);

      const { rows } = await pool.query(query, values);
      if (!rows.length) {
        return res.status(404).json({ error: "Module not found" });
      }
      return res.json(rows[0]);
    } catch (err) {
      console.error("Failed to update module", err);
      return res.status(500).json({ error: "Failed to update module" });
    }
  },
);

const toggleModulePublish = async (req, res, isPublished) => {
  const moduleId = req.params.id;
  try {
    const { rows } = await pool.query(
      `
        UPDATE modules
        SET
          is_published = $2,
          published_at = CASE WHEN $2 THEN now() ELSE NULL END,
          updated_at = now()
        WHERE id = $1
        RETURNING id, is_published, published_at, updated_at
      `,
      [moduleId, isPublished],
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Module not found" });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error("Failed to toggle module publish state", err);
    return res
      .status(500)
      .json({ error: "Failed to update module publish state" });
  }
};

router.post(
  "/modules/:id/publish",
  requireCourseContentRole(resolveCourseIdFromModuleParam("id")),
  (req, res) => toggleModulePublish(req, res, true),
);
router.post(
  "/modules/:id/unpublish",
  requireCourseContentRole(resolveCourseIdFromModuleParam("id")),
  (req, res) => toggleModulePublish(req, res, false),
);

router.delete(
  "/modules/:id",
  requireCourseContentRole(resolveCourseIdFromModuleParam("id")),
  async (req, res) => {
    const moduleId = req.params.id;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const moduleRes = await client.query(
        "SELECT id FROM modules WHERE id = $1 LIMIT 1",
        [moduleId],
      );
      if (!moduleRes.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Module not found" });
      }

      const lessonRes = await client.query(
        "SELECT id FROM lessons WHERE module_id = $1",
        [moduleId],
      );
      for (const lesson of lessonRes.rows) {
        await deleteLessonCascade(client, lesson.id);
      }

      await client.query("DELETE FROM modules WHERE id = $1", [moduleId]);
      await client.query("COMMIT");

      return res.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Failed to delete module", err);
      return res.status(500).json({
        error: "Failed to delete module",
        detail: err.message,
      });
    } finally {
      client.release();
    }
  },
);

router.get(
  "/modules/:moduleId/lessons",
  requireCourseContentRole(resolveCourseIdFromModuleParam("moduleId")),
  async (req, res) => {
    const moduleId = req.params.moduleId;
    try {
      const { rows } = await pool.query(
        `
        SELECT
          id,
          module_id,
          title,
          content_type,
          content_text,
          content_markdown,
          content_html,
          video_url,
          cover_image_url,
          estimated_minutes,
          order_index,
          is_published,
          published_at,
          available_from,
          due_at,
          allow_late_submission,
          late_until,
          requires_submission,
          created_at,
          updated_at
        FROM lessons
        WHERE module_id = $1
        ORDER BY order_index ASC
      `,
        [moduleId],
      );
      return res.json(
        await Promise.all(
          rows.map(async (lesson) => ({
            ...decorateLessonAvailability(lesson),
            cover_image_url: await resolveR2ReferenceUrl(lesson.cover_image_url),
          })),
        ),
      );
    } catch (err) {
      console.error("Failed to list lessons", err);
      return res.status(500).json({ error: "Failed to list lessons" });
    }
  },
);

router.post(
  "/modules/:moduleId/lessons",
  requireCourseContentRole(resolveCourseIdFromModuleParam("moduleId")),
  async (req, res) => {
    const moduleId = req.params.moduleId;
    const parsed = lessonCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      console.log("BODY RECIBIDO:", req.body);
      console.log("ERROR ZOD:", parsed.error.flatten());
      return res.status(400).json({
        error: formatZodError(parsed.error),
        details: parsed.error.flatten(),
        receivedBody: req.body,
      });
    }

    const scheduledDates = [
      parsed.data.availableFrom,
      parsed.data.dueAt,
      parsed.data.lateUntil,
    ].filter(Boolean);
    const now = Date.now();
    if (
      !canSavePastLessonDates(req.user) &&
      scheduledDates.some((value) => new Date(value).getTime() < now)
    ) {
      return res.status(400).json({
        error: "Scheduled lesson dates cannot be in the past",
      });
    }

    try {
      let orderIndex = parsed.data.orderIndex;
      if (!orderIndex) {
        const { rows } = await pool.query(
          "SELECT COALESCE(MAX(order_index), 0) + 1 AS next FROM lessons WHERE module_id = $1",
          [moduleId],
        );
        orderIndex = rows[0].next;
      }

      const htmlContent =
        toStoredHtmlR2References(
          parsed.data.contentHtml ||
            parsed.data.contentMarkdown ||
            parsed.data.contentText ||
            null,
        );

      const contentJsonValue =
        parsed.data.contentJson !== undefined
          ? JSON.stringify(toStoredContentJsonR2References(parsed.data.contentJson))
          : null;
      const coverImage =
        toStoredR2Reference(
          parsed.data.coverImage ??
            parsed.data.cover_image_url ??
            parsed.data.image_url ??
            null,
        );
      const contentUrl =
        parsed.data.contentUrl ??
        parsed.data.content_url ??
        parsed.data.externalUrl ??
        null;

      const { rows } = await pool.query(
        `
          INSERT INTO lessons (
            module_id,
            title,
            content_type,
            content_text,
            content_markdown,
            content_html,
            content_json,
            video_url,
            cover_image_url,
            content_url,
            estimated_minutes,
            available_from,
            due_at,
            allow_late_submission,
            late_until,
            requires_submission,
            position,
            order_index,
            is_published
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, false)
          RETURNING
            id,
            module_id,
            title,
            content_type,
            content_text,
            content_markdown,
            content_html,
            content_json,
            video_url,
            cover_image_url,
            content_url,
            estimated_minutes,
            order_index,
            is_published,
            published_at,
            available_from,
            due_at,
            allow_late_submission,
            late_until,
            requires_submission,
            created_at,
            updated_at
        `,
        [
          moduleId,
          parsed.data.title,
          toStoredLessonType(parsed.data.contentType),
          parsed.data.contentText || null,
          parsed.data.contentMarkdown || parsed.data.contentText || null,
          htmlContent,
          contentJsonValue,
          parsed.data.videoUrl || null,
          coverImage,
          contentUrl,
          parsed.data.estimatedMinutes || null,
          parsed.data.availableFrom ? new Date(parsed.data.availableFrom) : null,
          parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
          Boolean(parsed.data.allowLateSubmission),
          parsed.data.allowLateSubmission && parsed.data.lateUntil
            ? new Date(parsed.data.lateUntil)
            : null,
          Boolean(parsed.data.requiresSubmission),
          orderIndex,
          orderIndex,
        ],
      );

      const lesson = rows[0];

      return res.status(201).json({
        ...decorateLessonAvailability(lesson),
        cover_image_url: await resolveR2ReferenceUrl(lesson.cover_image_url),
        content_html: await resolveHtmlR2References(lesson.content_html),
        content_json: await resolveContentJsonR2References(
          lesson.content_json
            ? typeof lesson.content_json === "string"
              ? JSON.parse(lesson.content_json)
              : lesson.content_json
            : null,
        ),
      });
    } catch (err) {
      console.error("Failed to create lesson", err);
      return res.status(500).json({ error: "Failed to create lesson" });
    }
  },
);

router.patch(
  "/lessons/:id",
  requireCourseContentRole(resolveCourseIdFromLessonParam("id")),
  async (req, res) => {
    const lessonId = req.params.id;

    console.log("PATCH /cms/lessons/:id BODY RECIBIDO:");
    console.dir(req.body, { depth: null });

    const parsed = lessonUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      console.log("PATCH LESSON ZOD ERROR:");
      console.dir(parsed.error.flatten(), { depth: null });

      return res.status(400).json({
        error: formatZodError(parsed.error),
        details: parsed.error.flatten(),
        receivedBody: req.body,
      });
    }

    const submittedDates = [
      parsed.data.availableFrom,
      parsed.data.dueAt,
      parsed.data.lateUntil,
    ].filter(Boolean);
    const now = Date.now();
    if (
      !canSavePastLessonDates(req.user) &&
      submittedDates.some((value) => new Date(value).getTime() < now)
    ) {
      return res.status(400).json({
        error: "Scheduled lesson dates cannot be in the past",
      });
    }

    try {
      const updates = [];
      const values = [];

      if (parsed.data.title !== undefined) {
        values.push(parsed.data.title);
        updates.push(`title = $${values.length}`);
      }

      if (parsed.data.contentType !== undefined) {
        values.push(toStoredLessonType(parsed.data.contentType));
        updates.push(`content_type = $${values.length}`);
      }

      if (parsed.data.contentText !== undefined) {
        values.push(parsed.data.contentText ?? null);
        updates.push(`content_text = $${values.length}`);
      }

      if (parsed.data.contentMarkdown !== undefined) {
        values.push(parsed.data.contentMarkdown ?? null);
        updates.push(`content_markdown = $${values.length}`);
      }

      if (parsed.data.contentHtml !== undefined) {
        values.push(toStoredHtmlR2References(parsed.data.contentHtml ?? null));
        updates.push(`content_html = $${values.length}`);
      }

      if (parsed.data.contentJson !== undefined) {
        values.push(
          parsed.data.contentJson === null
            ? null
            : JSON.stringify(toStoredContentJsonR2References(parsed.data.contentJson)),
        );
        updates.push(`content_json = $${values.length}`);
      }

      if (parsed.data.videoUrl !== undefined) {
        values.push(parsed.data.videoUrl ?? null);
        updates.push(`video_url = $${values.length}`);
      }

      if (
        parsed.data.coverImage !== undefined ||
        parsed.data.cover_image_url !== undefined ||
        parsed.data.image_url !== undefined
      ) {
        const coverImage =
          toStoredR2Reference(
            parsed.data.coverImage ??
              parsed.data.cover_image_url ??
              parsed.data.image_url ??
              null,
          );

        values.push(coverImage);
        updates.push(`cover_image_url = $${values.length}`);
      }

      if (
        parsed.data.contentUrl !== undefined ||
        parsed.data.content_url !== undefined ||
        parsed.data.externalUrl !== undefined
      ) {
        const contentUrl =
          parsed.data.contentUrl ??
          parsed.data.content_url ??
          parsed.data.externalUrl ??
          null;

        values.push(contentUrl);
        updates.push(`content_url = $${values.length}`);
      }

      if (parsed.data.estimatedMinutes !== undefined) {
        values.push(parsed.data.estimatedMinutes ?? null);
        updates.push(`estimated_minutes = $${values.length}`);
      }

      if (parsed.data.orderIndex !== undefined) {
        values.push(parsed.data.orderIndex ?? null);
        updates.push(`order_index = $${values.length}`);
      }

      if (parsed.data.availableFrom !== undefined) {
        values.push(
          parsed.data.availableFrom ? new Date(parsed.data.availableFrom) : null,
        );
        updates.push(`available_from = $${values.length}`);
      }

      if (parsed.data.dueAt !== undefined) {
        values.push(parsed.data.dueAt ? new Date(parsed.data.dueAt) : null);
        updates.push(`due_at = $${values.length}`);
      }

      if (parsed.data.allowLateSubmission !== undefined) {
        values.push(Boolean(parsed.data.allowLateSubmission));
        updates.push(`allow_late_submission = $${values.length}`);

        if (!parsed.data.allowLateSubmission) {
          updates.push("late_until = NULL");
        }
      }

      if (
        parsed.data.lateUntil !== undefined &&
        parsed.data.allowLateSubmission !== false
      ) {
        values.push(
          parsed.data.lateUntil ? new Date(parsed.data.lateUntil) : null,
        );
        updates.push(`late_until = $${values.length}`);
      }

      if (parsed.data.requiresSubmission !== undefined) {
        values.push(Boolean(parsed.data.requiresSubmission));
        updates.push(`requires_submission = $${values.length}`);
      }

      if (!updates.length) {
        return res.status(400).json({
          error: "No updates provided",
          receivedBody: req.body,
          parsedData: parsed.data,
        });
      }

      const currentLessonRes = await pool.query(
        `
          SELECT available_from, due_at, allow_late_submission, late_until
          FROM lessons
          WHERE id = $1
          LIMIT 1
        `,
        [lessonId],
      );

      if (!currentLessonRes.rows.length) {
        return res.status(404).json({ error: "Lesson not found" });
      }

      const currentLesson = currentLessonRes.rows[0];
      const nextAvailableFrom =
        parsed.data.availableFrom !== undefined
          ? parsed.data.availableFrom
          : currentLesson.available_from;
      const nextDueAt =
        parsed.data.dueAt !== undefined
          ? parsed.data.dueAt
          : currentLesson.due_at;
      const nextAllowLateSubmission =
        parsed.data.allowLateSubmission !== undefined
          ? Boolean(parsed.data.allowLateSubmission)
          : Boolean(currentLesson.allow_late_submission);
      const nextLateUntil = nextAllowLateSubmission
        ? parsed.data.lateUntil !== undefined
          ? parsed.data.lateUntil
          : currentLesson.late_until
        : null;
      const nextAvailableFromDate = nextAvailableFrom
        ? new Date(nextAvailableFrom)
        : null;
      const nextDueAtDate = nextDueAt ? new Date(nextDueAt) : null;
      const nextLateUntilDate = nextLateUntil
        ? new Date(nextLateUntil)
        : null;

      if (
        nextAvailableFromDate &&
        nextDueAtDate &&
        nextDueAtDate < nextAvailableFromDate
      ) {
        return res.status(400).json({
          error: "dueAt cannot be earlier than availableFrom",
        });
      }

      if (
        nextAllowLateSubmission &&
        nextDueAtDate &&
        nextLateUntilDate &&
        nextLateUntilDate < nextDueAtDate
      ) {
        return res.status(400).json({
          error: "lateUntil cannot be earlier than dueAt",
        });
      }

      const query = `
        UPDATE lessons
        SET ${updates.join(", ")}, updated_at = now()
        WHERE id = $${values.length + 1}
        RETURNING
          id,
          module_id,
          title,
          content_type,
          content_text,
          content_markdown,
          content_html,
          content_json,
          video_url,
          cover_image_url,
          content_url,
          estimated_minutes,
          order_index,
          is_published,
          published_at,
          available_from,
          due_at,
          allow_late_submission,
          late_until,
          requires_submission,
          created_at,
          updated_at
      `;

      values.push(lessonId);

      console.log("PATCH LESSON QUERY VALUES:");
      console.dir(values, { depth: null });

      const { rows } = await pool.query(query, values);

      if (!rows.length) {
        return res.status(404).json({ error: "Lesson not found" });
      }

      const lesson = rows[0];

      return res.json({
        ...decorateLessonAvailability(lesson),
        cover_image_url: await resolveR2ReferenceUrl(lesson.cover_image_url),
        content_html: await resolveHtmlR2References(lesson.content_html),
        content_json: await resolveContentJsonR2References(
          lesson.content_json
            ? typeof lesson.content_json === "string"
              ? JSON.parse(lesson.content_json)
              : lesson.content_json
            : null,
        ),
      });
    } catch (err) {
      console.error("Failed to update lesson", err);
      return res.status(500).json({
        error: "Failed to update lesson",
        detail: err.message,
      });
    }
  },
);

router.get(
  "/lessons/:id",
  requireCourseContentRole(resolveCourseIdFromLessonParam("id")),
  async (req, res) => {
    try {
      const { id } = req.params;

      const { rows } = await pool.query(
        `
          SELECT
            id,
            module_id,
            title,
            content_type,
            content_text,
            content_markdown,
            content_html,
            content_json,
            video_url,
            cover_image_url,
            content_url,
            estimated_minutes,
            order_index,
            is_published,
            published_at,
            available_from,
            due_at,
            allow_late_submission,
            late_until,
            requires_submission,
            created_at,
            updated_at
          FROM lessons
          WHERE id = $1
          LIMIT 1
        `,
        [id],
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Lesson not found" });
      }

      const lesson = rows[0];

      let parsedContentJson = null;

      if (lesson.content_json) {
        try {
          parsedContentJson =
            typeof lesson.content_json === "string"
              ? JSON.parse(lesson.content_json)
              : lesson.content_json;
        } catch (e) {
          parsedContentJson = null;
        }
      }

      if (!parsedContentJson) {
        parsedContentJson = {
          pages: [
            {
              title: "Page 1",
              layout: "single-column",
              blocks: lesson.content_html
                ? [
                    {
                      type: "html",
                      title: "Contenido",
                      content: lesson.content_html,
                    },
                  ]
                : lesson.content_text
                  ? [
                      {
                        type: "text",
                        title: "Contenido",
                        content: lesson.content_text,
                      },
                    ]
                  : [],
            },
          ],
        };
      }

      return res.json({
        ...decorateLessonAvailability(lesson),
        cover_image_url: await resolveR2ReferenceUrl(lesson.cover_image_url),
        content_html: await resolveHtmlR2References(lesson.content_html),
        content_json: await resolveContentJsonR2References(parsedContentJson),
      });
    } catch (err) {
      console.error("Error loading lesson:", err);
      return res.status(500).json({ error: "Error loading lesson" });
    }
  },
);

const toggleLessonPublish = async (req, res, isPublished) => {
  const lessonId = req.params.id;
  try {
    const { rows } = await pool.query(
      `
        UPDATE lessons
        SET
          is_published = $2,
          published_at = CASE WHEN $2 THEN now() ELSE NULL END,
          updated_at = now()
        WHERE id = $1
        RETURNING id, is_published, published_at, updated_at
      `,
      [lessonId, isPublished],
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error("Failed to toggle lesson publish state", err);
    return res
      .status(500)
      .json({ error: "Failed to update lesson publish state" });
  }
};

router.post(
  "/lessons/:id/publish",
  requireCourseContentRole(resolveCourseIdFromLessonParam("id")),
  (req, res) => toggleLessonPublish(req, res, true),
);
router.post(
  "/lessons/:id/unpublish",
  requireCourseContentRole(resolveCourseIdFromLessonParam("id")),
  (req, res) => toggleLessonPublish(req, res, false),
);

router.delete(
  "/lessons/:id",
  requireCourseContentRole(resolveCourseIdFromLessonParam("id")),
  async (req, res) => {
    const lessonId = req.params.id;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const deletedLesson = await deleteLessonCascade(client, lessonId);
      if (!deletedLesson) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Lesson not found" });
      }

      await client.query("COMMIT");
      return res.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Failed to delete lesson", err);
      return res.status(500).json({
        error: "Failed to delete lesson",
        detail: err.message,
      });
    } finally {
      client.release();
    }
  },
);

router.get(
  "/lessons/:lessonId/quiz",
  requireCourseContentRole(resolveCourseIdFromLessonParam("lessonId")),
  async (req, res) => {
    const lessonId = req.params.lessonId;
    try {
      const lessonTypeRes = await pool.query(
        "SELECT content_type FROM lessons WHERE id = $1 LIMIT 1",
        [lessonId],
      );
      if (!lessonTypeRes.rows.length) {
        return res.status(404).json({ error: "Lesson not found" });
      }
      if (normalizeLessonType(lessonTypeRes.rows[0].content_type) === "notice") {
        return res.json({ lessonId, questions: [] });
      }

      const quizWithOptionsSelect = await getQuizWithOptionsSelect();
      const { rows } = await pool.query(
        `
          ${quizWithOptionsSelect}
          WHERE qq.lesson_id = $1
          ORDER BY qq.order_index ASC, qo.order_index ASC
        `,
        [lessonId],
      );

      return res.json({
        lessonId,
        questions: mapQuizRowsToQuestions(rows),
      });
    } catch (err) {
      console.error("Failed to load lesson quiz", err);
      return res.status(500).json({ error: "Failed to load quiz" });
    }
  },
);

router.post("/lessons/:lessonId/quiz/questions", async (req, res) => {
  const lessonId = req.params.lessonId;
  const parsed = quizQuestionCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  try {
    const courseId = await fetchCourseIdByLesson(lessonId);
    if (!courseId) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    const allowed = await canEditCourse(courseId, req.user);
    if (!allowed) {
      return res.status(403).json({ error: "You cannot edit this course" });
    }

    const lessonTypeRes = await pool.query(
      "SELECT content_type FROM lessons WHERE id = $1 LIMIT 1",
      [lessonId],
    );
    if (normalizeLessonType(lessonTypeRes.rows[0]?.content_type) === "notice") {
      return res.status(400).json({ error: "Avisos cannot have quizzes" });
    }

    let orderIndex = parsed.data.orderIndex;
    if (!orderIndex) {
      const { rows } = await pool.query(
        "SELECT COALESCE(MAX(order_index), 0) + 1 AS next FROM quiz_questions WHERE lesson_id = $1",
        [lessonId],
      );
      orderIndex = rows[0].next;
    }

    const questionType = parsed.data.questionType || "single_choice";
    const explicitQuizId = parsed.data.quizId;
    const lessonQuizId = explicitQuizId || (await getQuizIdByLesson(lessonId));
    const hasQuizIdColumn = await getQuizQuestionsHasQuizIdColumn();

    const columns = [
      "lesson_id",
      "question_text",
      "question_type",
      "order_index",
    ];
    const values = [
      lessonId,
      parsed.data.questionText,
      questionType,
      orderIndex,
    ];
    if (lessonQuizId && hasQuizIdColumn) {
      columns.push("quiz_id");
      values.push(lessonQuizId);
    }
    if (parsed.data.points !== undefined) {
      columns.push("points");
      values.push(parsed.data.points);
    }
    if (parsed.data.explanation !== undefined) {
      columns.push("explanation");
      values.push(parsed.data.explanation);
    }
    if (parsed.data.meta !== undefined) {
      columns.push("meta");
      values.push(parsed.data.meta);
    }

    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const insertRes = await pool.query(
      `
        INSERT INTO quiz_questions (${columns.join(", ")})
        VALUES (${placeholders})
        RETURNING id
      `,
      values,
    );
    const questionId = insertRes.rows[0].id;

    if (questionType === "true_false") {
      await pool.query(
        `
          INSERT INTO quiz_options (question_id, option_text, is_correct, order_index)
            VALUES
            ($1, 'True', false, 1),
            ($1, 'False', false, 2)
        `,
        [questionId],
      );
    }

    const quizWithOptionsSelect = await getQuizWithOptionsSelect();
    const questionRows = await pool.query(
      `
        ${quizWithOptionsSelect}
        WHERE qq.id = $1
        ORDER BY qq.order_index ASC, qo.order_index ASC
      `,
      [questionId],
    );

    return res.status(201).json(mapQuizRowsToQuestions(questionRows.rows)[0]);
  } catch (err) {
    console.error("Failed to create quiz question", err);
    return res.status(500).json({ error: "Failed to create quiz question" });
  }
});

router.patch("/quiz/questions/:id", async (req, res) => {
  const questionId = req.params.id;
  const parsed = quizQuestionUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  try {
    const questionRes = await pool.query(
      `
        SELECT qq.id, qq.lesson_id, qq.question_type, m.course_id
        FROM quiz_questions qq
        JOIN lessons l ON l.id = qq.lesson_id
        JOIN modules m ON m.id = l.module_id
        WHERE qq.id = $1
        LIMIT 1
      `,
      [questionId],
    );
    const question = questionRes.rows[0];
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    const allowed = await canEditCourse(question.course_id, req.user);
    if (!allowed) {
      return res.status(403).json({ error: "You cannot edit this course" });
    }

    const updates = [];
    const values = [];
    if (parsed.data.questionText !== undefined) {
      values.push(parsed.data.questionText);
      updates.push(`question_text = $${values.length}`);
    }
    if (parsed.data.questionType !== undefined) {
      values.push(parsed.data.questionType);
      updates.push(`question_type = $${values.length}`);
    }
    if (parsed.data.orderIndex !== undefined) {
      values.push(parsed.data.orderIndex);
      updates.push(`order_index = $${values.length}`);
    }
    if (parsed.data.points !== undefined) {
      values.push(parsed.data.points);
      updates.push(`points = $${values.length}`);
    }
    if (parsed.data.explanation !== undefined) {
      values.push(parsed.data.explanation);
      updates.push(`explanation = $${values.length}`);
    }
    if (parsed.data.meta !== undefined) {
      values.push(parsed.data.meta);
      updates.push(`meta = $${values.length}`);
    }
    if (
      parsed.data.quizId !== undefined &&
      (await getQuizQuestionsHasQuizIdColumn())
    ) {
      values.push(parsed.data.quizId);
      updates.push(`quiz_id = $${values.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ error: "No updates provided" });
    }

    const updateRes = await pool.query(
      `
        UPDATE quiz_questions
        SET ${updates.join(", ")}, updated_at = now()
        WHERE id = $${values.length + 1}
        RETURNING id
      `,
      [...values, questionId],
    );
    if (!updateRes.rows.length) {
      return res.status(404).json({ error: "Question not found" });
    }

    const finalType = parsed.data.questionType || question.question_type;
    if (finalType === "true_false") {
      await pool.query("DELETE FROM quiz_options WHERE question_id = $1", [
        questionId,
      ]);
      await pool.query(
        `
          INSERT INTO quiz_options (question_id, option_text, is_correct, order_index)
            VALUES
            ($1, 'True', false, 1),
            ($1, 'False', false, 2)
        `,
        [questionId],
      );
    } else if (["short_text", "long_text", "numeric"].includes(finalType)) {
      // Text/numeric questions do not use options, so remove any stale ones after the type change.
      await pool.query("DELETE FROM quiz_options WHERE question_id = $1", [
        questionId,
      ]);
    }

    const quizWithOptionsSelect = await getQuizWithOptionsSelect();
    const questionRows = await pool.query(
      `
        ${quizWithOptionsSelect}
        WHERE qq.id = $1
        ORDER BY qq.order_index ASC, qo.order_index ASC
      `,
      [questionId],
    );

    return res.json(mapQuizRowsToQuestions(questionRows.rows)[0]);
  } catch (err) {
    console.error("Failed to update quiz question", err);
    return res.status(500).json({ error: "Failed to update quiz question" });
  }
});

router.delete("/quiz/questions/:id", async (req, res) => {
  const questionId = req.params.id;
  try {
    const questionRes = await pool.query(
      `
        SELECT qq.lesson_id, m.course_id
        FROM quiz_questions qq
        JOIN lessons l ON l.id = qq.lesson_id
        JOIN modules m ON m.id = l.module_id
        WHERE qq.id = $1
        LIMIT 1
      `,
      [questionId],
    );
    const question = questionRes.rows[0];
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    const allowed = await canEditCourse(question.course_id, req.user);
    if (!allowed) {
      return res.status(403).json({ error: "You cannot edit this course" });
    }

    await pool.query("DELETE FROM quiz_questions WHERE id = $1", [questionId]);
    return res.json({ id: questionId });
  } catch (err) {
    console.error("Failed to delete quiz question", err);
    return res.status(500).json({ error: "Failed to delete quiz question" });
  }
});

router.post("/quiz/questions/:id/options", async (req, res) => {
  const questionId = req.params.id;
  const parsed = quizOptionCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  try {
    const questionRes = await pool.query(
      `
        SELECT qq.id, qq.question_type, m.course_id
        FROM quiz_questions qq
        JOIN lessons l ON l.id = qq.lesson_id
        JOIN modules m ON m.id = l.module_id
        WHERE qq.id = $1
        LIMIT 1
      `,
      [questionId],
    );
    const question = questionRes.rows[0];
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    const allowed = await canEditCourse(question.course_id, req.user);
    if (!allowed) {
      return res.status(403).json({ error: "You cannot edit this course" });
    }

    if (question.question_type === "true_false") {
      return res.status(400).json({
        error: "True/False questions already include default options",
      });
    }

    let orderIndex = parsed.data.orderIndex;
    if (!orderIndex) {
      const { rows } = await pool.query(
        "SELECT COALESCE(MAX(order_index), 0) + 1 AS next FROM quiz_options WHERE question_id = $1",
        [questionId],
      );
      orderIndex = rows[0].next;
    }

    const optionColumns = [
      "question_id",
      "option_text",
      "is_correct",
      "order_index",
    ];
    const optionValues = [
      questionId,
      parsed.data.optionText,
      parsed.data.isCorrect || false,
      orderIndex,
    ];
    if (parsed.data.points !== undefined) {
      optionColumns.push("points");
      optionValues.push(parsed.data.points);
    }
    if (parsed.data.feedback !== undefined) {
      optionColumns.push("feedback");
      optionValues.push(parsed.data.feedback);
    }
    if (parsed.data.meta !== undefined) {
      optionColumns.push("meta");
      optionValues.push(parsed.data.meta);
    }
    const optionPlaceholders = optionColumns
      .map((_, index) => `$${index + 1}`)
      .join(", ");
    const optionRes = await pool.query(
      `
        INSERT INTO quiz_options (${optionColumns.join(", ")})
        VALUES (${optionPlaceholders})
        RETURNING id
      `,
      optionValues,
    );

    if (parsed.data.isCorrect) {
      await pool.query(
        `
          UPDATE quiz_options
          SET is_correct = false
          WHERE question_id = $1 AND id <> $2
        `,
        [questionId, optionRes.rows[0].id],
      );
    }

    const rows = await pool.query(
      `
        SELECT
          qo.id,
          qo.option_text,
          qo.is_correct,
          qo.order_index AS option_order,
          qo.points AS points,
          qo.feedback AS feedback,
          qo.meta AS meta
        FROM quiz_options qo
        WHERE qo.question_id = $1
        ORDER BY qo.order_index ASC
      `,
      [questionId],
    );

    return res.status(201).json(rows.rows);
  } catch (err) {
    console.error("Failed to create quiz option", err);
    return res.status(500).json({ error: "Failed to create quiz option" });
  }
});

router.patch("/quiz/options/:id", async (req, res) => {
  const optionId = req.params.id;
  const parsed = quizOptionUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  try {
    const optionRes = await pool.query(
      `
        SELECT qo.id, qo.question_id, qq.question_type, m.course_id
        FROM quiz_options qo
        JOIN quiz_questions qq ON qq.id = qo.question_id
        JOIN lessons l ON l.id = qq.lesson_id
        JOIN modules m ON m.id = l.module_id
        WHERE qo.id = $1
        LIMIT 1
      `,
      [optionId],
    );
    const option = optionRes.rows[0];
    if (!option) {
      return res.status(404).json({ error: "Option not found" });
    }

    const allowed = await canEditCourse(option.course_id, req.user);
    if (!allowed) {
      return res.status(403).json({ error: "You cannot edit this course" });
    }

    const updates = [];
    const values = [];
    if (parsed.data.optionText !== undefined) {
      values.push(parsed.data.optionText);
      updates.push(`option_text = $${values.length}`);
    }
    if (parsed.data.isCorrect !== undefined) {
      values.push(parsed.data.isCorrect);
      updates.push(`is_correct = $${values.length}`);
    }
    if (parsed.data.orderIndex !== undefined) {
      values.push(parsed.data.orderIndex);
      updates.push(`order_index = $${values.length}`);
    }
    if (parsed.data.points !== undefined) {
      values.push(parsed.data.points);
      updates.push(`points = $${values.length}`);
    }
    if (parsed.data.feedback !== undefined) {
      values.push(parsed.data.feedback);
      updates.push(`feedback = $${values.length}`);
    }
    if (parsed.data.meta !== undefined) {
      values.push(parsed.data.meta);
      updates.push(`meta = $${values.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ error: "No updates provided" });
    }

    await pool.query(
      `
        UPDATE quiz_options
        SET ${updates.join(", ")}, updated_at = now()
        WHERE id = $${values.length + 1}
      `,
      [...values, optionId],
    );

    if (parsed.data.isCorrect && option.question_type === "single_choice") {
      await pool.query(
        `
          UPDATE quiz_options
          SET is_correct = false
          WHERE question_id = $1 AND id <> $2
        `,
        [option.question_id, optionId],
      );
    }

    const rows = await pool.query(
      `
        SELECT
          qo.id,
          qo.option_text,
          qo.is_correct,
          qo.order_index AS option_order,
          qo.points AS points,
          qo.feedback AS feedback,
          qo.meta AS meta
        FROM quiz_options qo
        WHERE qo.question_id = $1
        ORDER BY qo.order_index ASC
      `,
      [option.question_id],
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error("Failed to update quiz option", err);
    return res.status(500).json({ error: "Failed to update quiz option" });
  }
});

router.delete("/quiz/options/:id", async (req, res) => {
  const optionId = req.params.id;
  try {
    const optionRes = await pool.query(
      `
        SELECT qo.id, qo.question_id, qq.question_type, m.course_id
        FROM quiz_options qo
        JOIN quiz_questions qq ON qq.id = qo.question_id
        JOIN lessons l ON l.id = qq.lesson_id
        JOIN modules m ON m.id = l.module_id
        WHERE qo.id = $1
        LIMIT 1
      `,
      [optionId],
    );
    const option = optionRes.rows[0];
    if (!option) {
      return res.status(404).json({ error: "Option not found" });
    }

    if (option.question_type === "true_false") {
      return res
        .status(400)
        .json({ error: "True/False questions require both options" });
    }

    const allowed = await canEditCourse(option.course_id, req.user);
    if (!allowed) {
      return res.status(403).json({ error: "You cannot edit this course" });
    }

    await pool.query("DELETE FROM quiz_options WHERE id = $1", [optionId]);

    return res.json({ id: optionId });
  } catch (err) {
    console.error("Failed to delete quiz option", err);
    return res.status(500).json({ error: "Failed to delete quiz option" });
  }
});

router.get(
  "/courses/:courseId/groups",
  requireCourseRoleOrAdmin(resolveCourseIdFromParam("courseId"), [
    "instructor",
    "enrollment_manager",
    "admin",
  ]),
  async (req, res) => {
    const courseId = req.courseContext.courseId;

    try {
      const { rows } = await pool.query(
        `
          SELECT
            g.*,
            COALESCE(teacher_data.teachers, '[]'::json) AS teachers,
            COALESCE(teacher_data.teachers_count, 0) AS teachers_count,
            COALESCE(student_data.students_count, 0) AS students_count,
            next_session.id AS next_session_id,
            next_session.title AS next_session_title,
            next_session.starts_at AS next_session_starts_at,
            next_session.join_url AS next_session_join_url
          FROM groups g
          LEFT JOIN LATERAL (
            SELECT
              COUNT(*)::int AS teachers_count,
              json_agg(
                json_build_object(
                  'id', u.id,
                  'fullName', u.full_name,
                  'email', u.email,
                  'role', gt.role
                )
                ORDER BY CASE WHEN gt.role = 'lead' THEN 0 ELSE 1 END, u.full_name
              ) AS teachers
            FROM group_teachers gt
            JOIN users u ON u.id = gt.user_id
            WHERE gt.group_id = g.id
          ) teacher_data ON true
          LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS students_count
            FROM group_students gs
            WHERE gs.group_id = g.id
              AND gs.status = 'active'
          ) student_data ON true
          LEFT JOIN LATERAL (
            SELECT
              ls.id,
              s.title,
              ls.starts_at,
              ls.join_url
            FROM live_sessions ls
            LEFT JOIN live_session_series s ON s.id = ls.series_id
            WHERE ls.group_id = g.id
              AND ls.starts_at >= now()
              AND ls.status = 'scheduled'
            ORDER BY ls.starts_at ASC
            LIMIT 1
          ) next_session ON true
          WHERE g.course_id = $1
          ORDER BY g.name ASC
        `,
        [courseId],
      );

      const groups = rows.map(mapGroupRow);
      if (isEnrollmentManagerOnly(req.user)) {
        groups.forEach((group) => {
          group.teachers = group.teachers.map((teacher) => ({
            fullName: teacher.fullName,
          }));
        });
      }
      return res.json(groups);
    } catch (err) {
      console.error("Failed to list course groups", err);
      return res.status(500).json({ error: "Failed to list groups" });
    }
  },
);

router.post(
  "/courses/:courseId/groups",
  requireCourseRoleOrAdmin(resolveCourseIdFromParam("courseId"), [
    "instructor",
    "admin",
  ]),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
    const parsed = groupCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    try {
      const payload = parsed.data;
      const timezone = payload.timezone || "America/Bogota";
      const { rows } = await pool.query(
        `
          INSERT INTO groups (
            course_id,
            name,
            code,
            timezone,
            start_date,
            end_date,
            capacity,
            status,
            is_active,
            schedule_text
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING groups.*, (
            SELECT COUNT(*) FROM group_teachers gt WHERE gt.group_id = groups.id
          ) AS teachers_count
        `,
        [
          courseId,
          payload.name,
          payload.code || null,
          timezone,
          payload.startDate || null,
          payload.endDate || null,
          payload.capacity || null,
          payload.status || "active",
          payload.isActive ?? true,
          payload.scheduleText || null,
        ],
      );

      return res.status(201).json(mapGroupRow(rows[0]));
    } catch (err) {
      if (
        err.code === "23505" &&
        err.constraint === "idx_groups_course_code_unique"
      ) {
        return res.status(400).json({
          error: "A group with that code already exists for this course",
        });
      }
      console.error("Failed to create course group", err);
      return res.status(500).json({ error: "Failed to create group" });
    }
  },
);

router.patch(
  "/groups/:groupId",
  requireCourseContentRole(resolveCourseIdFromGroupParam("groupId")),
  async (req, res) => {
    const groupId = req.params.groupId;
    const parsed = groupUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    const assignments = [];
    const values = [];
    const assignField = (column, key, transform = (value) => value) => {
      if (Object.prototype.hasOwnProperty.call(parsed.data, key)) {
        values.push(transform(parsed.data[key]));
        assignments.push(`${column} = $${values.length}`);
      }
    };

    assignField("name", "name");
    assignField("code", "code", (value) => value || null);
    assignField("timezone", "timezone");
    assignField("start_date", "startDate", (value) => value || null);
    assignField("end_date", "endDate", (value) => value || null);
    assignField("capacity", "capacity", (value) =>
      value === null ? null : value,
    );
    assignField("status", "status");
    assignField("is_active", "isActive");
    assignField("schedule_text", "scheduleText", (value) => value || null);

    if (!assignments.length) {
      return res
        .status(400)
        .json({ error: "At least one field must be updated" });
    }

    assignments.push("updated_at = now()");
    values.push(groupId);

    try {
      const { rows } = await pool.query(
        `
          UPDATE groups
          SET ${assignments.join(", ")}
          WHERE id = $${values.length}
          RETURNING groups.*, (
            SELECT COUNT(*) FROM group_teachers gt WHERE gt.group_id = groups.id
          ) AS teachers_count
        `,
        values,
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Group not found" });
      }

      return res.json(mapGroupRow(rows[0]));
    } catch (err) {
      if (
        err.code === "23505" &&
        err.constraint === "idx_groups_course_code_unique"
      ) {
        return res.status(400).json({
          error: "A group with that code already exists for this course",
        });
      }
      console.error("Failed to update group", err);
      return res.status(500).json({ error: "Failed to update group" });
    }
  },
);

router.delete(
  "/groups/:groupId",
  requireCourseRoleOrAdmin(resolveCourseIdFromGroupParam("groupId"), [
    "instructor",
    "admin",
  ]),
  async (req, res) => {
    const groupId = req.params.groupId;
    try {
      const { rows } = await pool.query(
        `
          DELETE FROM groups
          WHERE id = $1
          RETURNING id
        `,
        [groupId],
      );
      if (!rows.length) {
        return res.status(404).json({ error: "Group not found" });
      }

      return res.json({ success: true });
    } catch (err) {
      console.error("Failed to delete group", err);
      return res.status(500).json({ error: "Failed to delete group" });
    }
  },
);

router.get(
  "/groups/:groupId/teachers",
  requireCourseEnrollmentRole(resolveCourseIdFromGroupParam("groupId")),
  async (req, res) => {
    const groupId = req.params.groupId;
    try {
      const group = await fetchGroupById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      const { rows } = await pool.query(
        `
          SELECT u.id, u.full_name, u.email
          FROM group_teachers gt
          JOIN users u ON u.id = gt.user_id
          WHERE gt.group_id = $1
          ORDER BY u.full_name
        `,
        [groupId],
      );
      if (isEnrollmentManagerOnly(req.user)) {
        return res.json(rows.map((row) => ({ fullName: row.full_name })));
      }
      return res.json(rows);
    } catch (err) {
      console.error("Failed to load group teachers", err);
      return res.status(500).json({ error: "Failed to load group teachers" });
    }
  },
);

router.get(
  "/groups/:groupId/students",
  requireCourseEnrollmentRole(resolveCourseIdFromGroupParam("groupId")),
  async (req, res) => {
    const groupId = req.params.groupId;
    const courseId = req.courseContext.courseId;
    const search = String(req.query.search || "").trim();
    const values = [groupId, courseId];
    let searchSql = "";
    if (search) {
      values.push(`%${search}%`);
      searchSql = `AND (
        u.full_name ILIKE $${values.length}
        OR u.email ILIKE $${values.length}
        OR u.id::text ILIKE $${values.length}
      )`;
    }

    try {
      const [groupResult, studentResult, candidateResult] = await Promise.all([
        pool.query(
          `
            SELECT
              g.*,
              COALESCE(teacher_data.teachers, '[]'::json) AS teachers,
              COALESCE(teacher_data.teachers_count, 0) AS teachers_count,
              COALESCE(student_data.students_count, 0) AS students_count,
              next_session.id AS next_session_id,
              next_session.title AS next_session_title,
              next_session.starts_at AS next_session_starts_at,
              next_session.join_url AS next_session_join_url
            FROM groups g
            LEFT JOIN LATERAL (
              SELECT
                COUNT(*)::int AS teachers_count,
                json_agg(
                  json_build_object(
                    'id', u.id,
                    'fullName', u.full_name,
                    'email', u.email,
                    'role', gt.role
                  )
                  ORDER BY CASE WHEN gt.role = 'lead' THEN 0 ELSE 1 END, u.full_name
                ) AS teachers
              FROM group_teachers gt
              JOIN users u ON u.id = gt.user_id
              WHERE gt.group_id = g.id
            ) teacher_data ON true
            LEFT JOIN LATERAL (
              SELECT COUNT(*)::int AS students_count
              FROM group_students gs
              WHERE gs.group_id = g.id
                AND gs.status = 'active'
            ) student_data ON true
            LEFT JOIN LATERAL (
              SELECT ls.id, s.title, ls.starts_at, ls.join_url
              FROM live_sessions ls
              LEFT JOIN live_session_series s ON s.id = ls.series_id
              WHERE ls.group_id = g.id
                AND ls.starts_at >= now()
                AND ls.status = 'scheduled'
              ORDER BY ls.starts_at ASC
              LIMIT 1
            ) next_session ON true
            WHERE g.id = $1
              AND g.course_id = $2
            LIMIT 1
          `,
          [groupId, courseId],
        ),
        pool.query(
        `
          SELECT
            u.id AS student_id,
            u.full_name,
            u.email,
            e.status AS enrollment_status,
            gs.status AS group_status,
            gs.joined_at,
            attendance.taken_sessions,
            attendance.attended_sessions
          FROM group_students gs
          JOIN groups g ON g.id = gs.group_id
          JOIN enrollments e
            ON e.course_id = g.course_id
           AND e.user_id = gs.user_id
          JOIN users u ON u.id = gs.user_id
          LEFT JOIN LATERAL (
            SELECT
              COUNT(*) FILTER (WHERE ar.status = 'finalized')::int AS taken_sessions,
              COUNT(*) FILTER (
                WHERE ar.status = 'finalized'
                  AND COALESCE(lsa.status, 'present') IN ('present', 'late', 'excused')
              )::int AS attended_sessions
            FROM live_sessions ls
            LEFT JOIN live_session_attendance_runs ar
              ON ar.live_session_id = ls.id
            LEFT JOIN live_session_attendance lsa
              ON lsa.live_session_id = ls.id
             AND lsa.user_id = gs.user_id
            WHERE ls.group_id = gs.group_id
              AND ls.starts_at >= gs.joined_at
          ) attendance ON true
          WHERE gs.group_id = $1
            AND g.course_id = $2
            AND gs.status = 'active'
            ${searchSql}
          ORDER BY u.full_name ASC
        `,
        values,
        ),
        pool.query(
          `
            SELECT
              e.user_id AS student_id,
              u.full_name,
              u.email,
              e.status AS enrollment_status,
              c.id AS course_id,
              c.title AS course_title,
              assignment.group_id,
              assignment.group_name,
              assignment.schedule_text,
              assignment.teacher_names
            FROM enrollments e
            JOIN users u ON u.id = e.user_id
            JOIN courses c ON c.id = e.course_id
            LEFT JOIN LATERAL (
              SELECT
                gs.group_id,
                g.name AS group_name,
                g.schedule_text,
                (
                  SELECT string_agg(u_teacher.full_name, ', ' ORDER BY u_teacher.full_name)
                  FROM group_teachers gt
                  JOIN users u_teacher ON u_teacher.id = gt.user_id
                  WHERE gt.group_id = g.id
                ) AS teacher_names
              FROM group_students gs
              JOIN groups g ON g.id = gs.group_id
              WHERE gs.user_id = e.user_id
                AND g.course_id = e.course_id
                AND gs.status = 'active'
              ORDER BY gs.joined_at DESC
              LIMIT 1
            ) assignment ON true
            WHERE e.course_id = $1
              AND e.status = 'active'
              AND (assignment.group_id IS NULL OR assignment.group_id <> $2)
            ORDER BY u.full_name ASC
            LIMIT 500
          `,
          [courseId, groupId],
        ),
      ]);

      if (!groupResult.rows.length) {
        return res.status(404).json({ error: "Group not found" });
      }

      const group = mapGroupRow(groupResult.rows[0]);
      if (isEnrollmentManagerOnly(req.user)) {
        group.teachers = group.teachers.map((teacher) => ({
          fullName: teacher.fullName,
        }));
      }

      const students = studentResult.rows.map((row) => {
          const takenSessions = Number(row.taken_sessions || 0);
          const attendedSessions = Number(row.attended_sessions || 0);
          return {
            studentId: row.student_id,
            platformId: row.student_id,
            studentCode: null,
            fullName: row.full_name,
            email: row.email,
            enrollmentStatus: row.enrollment_status,
            groupStatus: row.group_status,
            joinedAt: toTimestampString(row.joined_at),
            attendancePercentage:
              takenSessions > 0
                ? Math.round((attendedSessions / takenSessions) * 10000) / 100
                : null,
          };
        });
      const availableStudents = candidateResult.rows.map((row) => ({
        studentId: row.student_id,
        platformId: row.student_id,
        studentCode: null,
        fullName: row.full_name,
        email: row.email,
        enrollmentStatus: row.enrollment_status,
        courseId: row.course_id,
        courseTitle: row.course_title,
        groupId: row.group_id || null,
        groupName: row.group_name || null,
        currentGroupTeacher: row.teacher_names || null,
        currentGroupSchedule: row.schedule_text || null,
        assignmentStatus: row.group_id ? "with_group" : "without_group",
      }));

      return res.json({
        group,
        teacher: group.teachers[0] || null,
        schedule: group.scheduleText,
        studentCount: group.studentsCount,
        students,
        availableStudents,
      });
    } catch (err) {
      console.error("Failed to list group students", err);
      return res.status(500).json({ error: "Failed to list group students" });
    }
  },
);

router.get(
  "/groups/:groupId/student-candidates",
  requireCourseEnrollmentRole(resolveCourseIdFromGroupParam("groupId")),
  async (req, res) => {
    const groupId = req.params.groupId;
    const courseId = req.courseContext.courseId;
    const search = String(req.query.search || "").trim();
    const values = [courseId, groupId];
    let searchSql = "";
    if (search) {
      values.push(`%${search}%`);
      searchSql = `AND (
        u.full_name ILIKE $${values.length}
        OR u.email ILIKE $${values.length}
        OR u.id::text ILIKE $${values.length}
      )`;
    }

    try {
      const { rows } = await pool.query(
        `
          SELECT
            e.user_id AS student_id,
            u.full_name,
            u.email,
            e.status AS enrollment_status,
            c.id AS course_id,
            c.title AS course_title,
            assignment.group_id,
            assignment.group_name,
            assignment.schedule_text,
            assignment.teacher_names
          FROM enrollments e
          JOIN users u ON u.id = e.user_id
          JOIN courses c ON c.id = e.course_id
          LEFT JOIN LATERAL (
            SELECT
              gs.group_id,
              g.name AS group_name,
              g.schedule_text,
              (
                SELECT string_agg(u_teacher.full_name, ', ' ORDER BY u_teacher.full_name)
                FROM group_teachers gt
                JOIN users u_teacher ON u_teacher.id = gt.user_id
                WHERE gt.group_id = g.id
              ) AS teacher_names
            FROM group_students gs
            JOIN groups g ON g.id = gs.group_id
            WHERE gs.user_id = e.user_id
              AND g.course_id = e.course_id
              AND gs.status = 'active'
            ORDER BY gs.joined_at DESC
            LIMIT 1
          ) assignment ON true
          WHERE e.course_id = $1
            AND e.status = 'active'
            AND (assignment.group_id IS NULL OR assignment.group_id <> $2)
            ${searchSql}
          ORDER BY u.full_name ASC
          LIMIT 500
        `,
        values,
      );

      return res.json(
        rows.map((row) => ({
          studentId: row.student_id,
          platformId: row.student_id,
          studentCode: null,
          fullName: row.full_name,
          email: row.email,
          enrollmentStatus: row.enrollment_status,
          courseId: row.course_id,
          courseTitle: row.course_title,
          groupId: row.group_id || null,
          groupName: row.group_name || null,
          currentGroupTeacher: row.teacher_names || null,
          currentGroupSchedule: row.schedule_text || null,
          assignmentStatus: row.group_id ? "with_group" : "without_group",
        })),
      );
    } catch (err) {
      console.error("Failed to list group student candidates", err);
      return res.status(500).json({ error: "Failed to list student candidates" });
    }
  },
);

const runBulkGroupStudentOperation = async (req, res, operation) => {
  const courseId = req.courseContext.courseId;
  const sourceGroupId = req.params.groupId;
  const schema = operation === "move"
    ? bulkMoveGroupStudentsSchema
    : bulkGroupStudentsSchema;
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  const studentIds = [...new Set(parsed.data.studentIds)].sort();
  const targetGroupId = operation === "assign"
    ? sourceGroupId
    : parsed.data.targetGroupId || null;

  if (operation === "move" && targetGroupId === sourceGroupId) {
    return res.status(400).json({ error: "Target group must be different" });
  }

  const summary = {
    operation,
    requested: studentIds.length,
    processed: [],
    skipped: [],
    failed: [],
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const studentId of studentIds) {
      await lockStudentCourseMembership(client, courseId, studentId);
    }

    const groupIds = [...new Set([sourceGroupId, targetGroupId].filter(Boolean))].sort();
    const { rows: groupRows } = await client.query(
      `
        SELECT id, name, capacity
        FROM groups
        WHERE course_id = $1
          AND id = ANY($2::uuid[])
        ORDER BY id
        FOR UPDATE
      `,
      [courseId, groupIds],
    );
    const groupsById = new Map(groupRows.map((group) => [group.id, group]));
    if (!groupsById.has(sourceGroupId) || (targetGroupId && !groupsById.has(targetGroupId))) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "All groups must belong to this course" });
    }

    const [{ rows: enrollmentRows }, { rows: membershipRows }] = await Promise.all([
      client.query(
        `
          SELECT user_id, status
          FROM enrollments
          WHERE course_id = $1
            AND user_id = ANY($2::uuid[])
        `,
        [courseId, studentIds],
      ),
      client.query(
        `
          SELECT gs.user_id, gs.group_id
          FROM group_students gs
          JOIN groups g ON g.id = gs.group_id
          WHERE g.course_id = $1
            AND gs.user_id = ANY($2::uuid[])
            AND gs.status = 'active'
        `,
        [courseId, studentIds],
      ),
    ]);
    const enrollments = new Map(enrollmentRows.map((row) => [row.user_id, row.status]));
    const memberships = new Map(membershipRows.map((row) => [row.user_id, row.group_id]));

    const processable = [];
    for (const studentId of studentIds) {
      if (!enrollments.has(studentId) || enrollments.get(studentId) !== "active") {
        summary.failed.push({ studentId, reason: "not_enrolled" });
        continue;
      }
      const currentGroupId = memberships.get(studentId) || null;
      if ((operation === "move" || operation === "remove") && currentGroupId !== sourceGroupId) {
        summary.skipped.push({ studentId, reason: "not_in_source_group" });
        continue;
      }
      if ((operation === "assign" || operation === "move") && currentGroupId === targetGroupId) {
        summary.skipped.push({ studentId, reason: "already_in_target_group" });
        continue;
      }
      processable.push(studentId);
    }

    if (targetGroupId && processable.length) {
      const targetGroup = groupsById.get(targetGroupId);
      if (targetGroup.capacity != null) {
        const { rows: countRows } = await client.query(
          `
            SELECT COUNT(*)::int AS students_count
            FROM group_students
            WHERE group_id = $1
              AND status = 'active'
          `,
          [targetGroupId],
        );
        const currentCount = Number(countRows[0]?.students_count || 0);
        const available = Math.max(0, Number(targetGroup.capacity) - currentCount);
        if (processable.length > available) {
          summary.failed.push(...processable.map((studentId) => ({
            studentId,
            reason: "capacity_exceeded",
          })));
          await client.query("ROLLBACK");
          return res.status(409).json({
            ...summary,
            capacity: Number(targetGroup.capacity),
            availableSlots: available,
          });
        }
      }
    }

    if (processable.length) {
      if (operation === "remove") {
        await client.query(
          `
            DELETE FROM group_students
            WHERE group_id = $1
              AND user_id = ANY($2::uuid[])
          `,
          [sourceGroupId, processable],
        );
      } else {
        await client.query(
          `
            DELETE FROM group_students gs
            USING groups g
            WHERE gs.group_id = g.id
              AND g.course_id = $1
              AND gs.user_id = ANY($2::uuid[])
          `,
          [courseId, processable],
        );
        await client.query(
          `
            INSERT INTO group_students (group_id, user_id, status, joined_at)
            SELECT $1, student_id, 'active', now()
            FROM unnest($2::uuid[]) AS student_id
            ON CONFLICT (group_id, user_id)
            DO UPDATE SET status = 'active', joined_at = now()
          `,
          [targetGroupId, processable],
        );
      }
      summary.processed = processable;
    }

    await client.query("COMMIT");
    return res.json(summary);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`Failed to ${operation} group students in bulk`, err);
    return res.status(500).json({ error: "Failed to update group students" });
  } finally {
    client.release();
  }
};

router.post(
  "/courses/:courseId/groups/:groupId/students/bulk-assign",
  requireCourseEnrollmentRole(resolveCourseIdFromParam("courseId")),
  (req, res) => runBulkGroupStudentOperation(req, res, "assign"),
);

router.post(
  "/courses/:courseId/groups/:groupId/students/bulk-move",
  requireCourseEnrollmentRole(resolveCourseIdFromParam("courseId")),
  (req, res) => runBulkGroupStudentOperation(req, res, "move"),
);

router.post(
  "/courses/:courseId/groups/:groupId/students/bulk-remove",
  requireCourseEnrollmentRole(resolveCourseIdFromParam("courseId")),
  (req, res) => runBulkGroupStudentOperation(req, res, "remove"),
);

router.post(
  "/groups/:groupId/teachers",
  requireCourseRoleAny(resolveCourseIdFromGroupParam("groupId"), ["instructor"]),
  async (req, res) => {
    const groupId = req.params.groupId;
    const parsed = groupTeacherAssignSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    try {
      const group = await fetchGroupById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      const courseId = req.courseContext?.courseId;
      const isInstructor = await hasCourseRole(parsed.data.userId, courseId, [
        "instructor",
      ]);
      if (!isInstructor) {
        return res
          .status(400)
          .json({ error: "User must be an instructor for this course" });
      }

      await pool.query(
        `
          INSERT INTO group_teachers (group_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT (group_id, user_id) DO NOTHING
        `,
        [groupId, parsed.data.userId],
      );

      const { rows } = await pool.query(
        `
          SELECT u.id, u.full_name, u.email
          FROM users u
          WHERE u.id = $1
          LIMIT 1
        `,
        [parsed.data.userId],
      );

      return res.status(201).json(rows[0] || { id: parsed.data.userId });
    } catch (err) {
      console.error("Failed to assign group teacher", err);
      return res.status(500).json({ error: "Failed to assign group teacher" });
    }
  },
);

router.delete(
  "/groups/:groupId/teachers/:userId",
  requireCourseRoleAny(resolveCourseIdFromGroupParam("groupId"), ["instructor"]),
  async (req, res) => {
    const groupId = req.params.groupId;
    const { userId } = req.params;
    const parsed = uuidSchema.safeParse(userId);
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    try {
      const group = await fetchGroupById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      await pool.query(
        `
          DELETE FROM group_teachers
          WHERE group_id = $1 AND user_id = $2
        `,
        [groupId, parsed.data],
      );

      return res.status(204).send();
    } catch (err) {
      console.error("Failed to remove group teacher", err);
      return res.status(500).json({ error: "Failed to remove group teacher" });
    }
  },
);

router.get(
  "/courses/:courseId/students/available",
  requireCourseRoleOrAdmin(resolveCourseIdFromParam("courseId"), [
    "enrollment_manager",
    "admin",
  ]),
  async (req, res) => {
    const courseId = req.courseContext.courseId;

    try {
      const { rows } = await pool.query(
        `
          SELECT DISTINCT u.id, u.full_name, u.email
          FROM users u
          WHERE u.is_active = true
            AND u.status = 'active'
            AND EXISTS (
              SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id
                AND r.name = 'student'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM enrollments e
              WHERE e.course_id = $1
                AND e.user_id = u.id
            )
          ORDER BY u.full_name ASC
        `,
        [courseId],
      );

      return res.json(
        rows.map((row) => ({
          id: row.id,
          fullName: row.full_name,
          email: row.email,
        })),
      );
    } catch (err) {
      console.error("Failed to list available students", err);
      return res.status(500).json({ error: "Failed to list students" });
    }
  },
);

router.get(
  "/courses/:courseId/enrollments",
  requireCourseEnrollmentRole(resolveCourseIdFromParam("courseId")),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(
      Math.max(parseInt(req.query.pageSize, 10) || 25, 1),
      200,
    );
    const offset = (page - 1) * pageSize;
    const searchTerm = (req.query.search || "").trim();
    const groupFilter = (req.query.groupId || "").trim();

    const whereClauses = [
      "e.course_id = $1",
      `EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id
          AND r.name = 'student'
      )`,
    ];
    const whereValues = [courseId];

    if (searchTerm) {
      whereValues.push(`%${searchTerm}%`);
      const placeholder = `$${whereValues.length}`;
      whereClauses.push(
        `(u.full_name ILIKE ${placeholder} OR u.email ILIKE ${placeholder})`,
      );
    }

    if (groupFilter === "no-group") {
      whereClauses.push(
        `NOT EXISTS (
          SELECT 1
          FROM group_students gs
          JOIN groups g ON g.id = gs.group_id
          WHERE gs.user_id = e.user_id
            AND g.course_id = e.course_id
        )`,
      );
    } else if (groupFilter) {
      whereValues.push(groupFilter);
      const placeholder = `$${whereValues.length}`;
      whereClauses.push(
        `EXISTS (
          SELECT 1
          FROM group_students gs
          WHERE gs.user_id = e.user_id
            AND gs.group_id = ${placeholder}
        )`,
      );
    }

    const whereSql = whereClauses.join("\n              AND ");

    try {
      const [dataRes, countRes] = await Promise.all([
        pool.query(
          `
            SELECT
              e.user_id AS student_id,
              u.full_name,
              u.email,
              assignment.group_id,
              assignment.group_name
            FROM enrollments e
            JOIN users u ON u.id = e.user_id
            LEFT JOIN LATERAL (
              SELECT gs.group_id, g.name AS group_name
              FROM group_students gs
              JOIN groups g ON g.id = gs.group_id
              WHERE gs.user_id = e.user_id
                AND g.course_id = e.course_id
              LIMIT 1
            ) assignment ON true
            WHERE ${whereSql}
            ORDER BY u.full_name ASC
            LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
          `,
          [...whereValues, pageSize, offset],
        ),
        pool.query(
          `
            SELECT COUNT(*)::int AS total
            FROM enrollments e
            JOIN users u ON u.id = e.user_id
            WHERE ${whereSql}
          `,
          whereValues,
        ),
      ]);

      const rows = dataRes.rows;
      const total = countRes.rows[0]?.total || 0;

      return res.json({
        data: rows.map((row) => ({
          studentId: row.student_id,
          fullName: row.full_name,
          email: row.email,
          groupId: row.group_id || null,
          groupName: row.group_name || null,
        })),
        page,
        pageSize,
        total,
      });
    } catch (err) {
      console.error("Failed to list enrollments", err);
      return res.status(500).json({ error: "Failed to list enrollments" });
    }
  },
);

router.post(
  "/courses/:courseId/enroll",
  requireCourseEnrollmentRole(resolveCourseIdFromParam("courseId")),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
    const parsed = enrollStudentSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await lockStudentCourseMembership(
        client,
        courseId,
        parsed.data.studentId,
      );

      const studentRes = await client.query(
        `
          SELECT u.id
          FROM users u
          WHERE u.id = $1
            AND EXISTS (
              SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id
                AND r.name = 'student'
            )
          LIMIT 1
        `,
        [parsed.data.studentId],
      );
      if (!studentRes.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Student not found" });
      }

      const existing = await client.query(
        `
        SELECT 1
        FROM enrollments
        WHERE course_id = $1 AND user_id = $2
        LIMIT 1
      `,
        [courseId, parsed.data.studentId],
      );
      if (existing.rows.length) {
        await client.query("ROLLBACK");
        return res
          .status(409)
          .json({ error: "Student already enrolled in this course" });
      }

      await client.query(
        `
        INSERT INTO enrollments (course_id, user_id)
        VALUES ($1, $2)
      `,
        [courseId, parsed.data.studentId],
      );

      if (parsed.data.groupId) {
        const group = await fetchGroupById(parsed.data.groupId);
        if (!group || group.course_id !== courseId) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Group must belong to this course" });
        }

        await assignStudentToCourseGroup(client, {
          courseId,
          studentId: parsed.data.studentId,
          groupId: parsed.data.groupId,
        });
      }

      await client.query("COMMIT");
      return res.status(201).json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Failed to enroll student", err);
      return sendGroupMembershipError(res, err, "Failed to enroll student");
    } finally {
      client.release();
    }
  },
);

router.delete(
  "/courses/:courseId/enroll/:studentId",
  requireCourseEnrollmentRole(resolveCourseIdFromParam("courseId")),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
    const studentId = req.params.studentId;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await lockStudentCourseMembership(client, courseId, studentId);

      const deleted = await client.query(
        `
        DELETE FROM enrollments
        WHERE course_id = $1 AND user_id = $2
        RETURNING 1
      `,
        [courseId, studentId],
      );
      if (!deleted.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Enrollment not found" });
      }

      await removeStudentFromCourseGroups(client, courseId, studentId);

      await client.query("COMMIT");
      return res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Failed to remove enrollment", err);
      return res.status(500).json({ error: "Failed to remove enrollment" });
    } finally {
      client.release();
    }
  },
);

router.post(
  "/courses/:courseId/enroll/:studentId/group",
  requireCourseEnrollmentRole(resolveCourseIdFromParam("courseId")),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
    const studentId = req.params.studentId;

    const parsed = assignGroupSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await lockStudentCourseMembership(client, courseId, studentId);

      const enrolled = await client.query(
        `
        SELECT 1
        FROM enrollments
        WHERE course_id = $1 AND user_id = $2
        LIMIT 1
      `,
        [courseId, studentId],
      );
      if (!enrolled.rows.length) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ error: "Student is not enrolled in this course" });
      }

      if (parsed.data.groupId) {
        const group = await fetchGroupById(parsed.data.groupId);
        if (!group || group.course_id !== courseId) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Group must belong to this course" });
        }
      }

      await assignStudentToCourseGroup(client, {
        courseId,
        studentId,
        groupId: parsed.data.groupId || null,
      });

      await client.query("COMMIT");
      return res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Failed to update group assignment", err);
      return sendGroupMembershipError(
        res,
        err,
        "Failed to update group assignment",
      );
    } finally {
      client.release();
    }
  },
);

router.post(
  "/courses/:courseId/enroll/bulk",
  requireCourseEnrollmentRole(resolveCourseIdFromParam("courseId")),
  async (req, res) => {
    const courseId = req.courseContext.courseId;
    const parsed = bulkEnrollSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    const studentIds = [...new Set(parsed.data.studentIds)];
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (parsed.data.groupId) {
        const group = await fetchGroupById(parsed.data.groupId);
        if (!group || group.course_id !== courseId) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Group must belong to this course" });
        }
      }

      const { rows: studentRows } = await client.query(
        `
          SELECT DISTINCT u.id
          FROM users u
          WHERE u.id = ANY($1::uuid[])
            AND EXISTS (
              SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id
                AND r.name = 'student'
            )
        `,
        [studentIds],
      );
      const validStudents = new Set(studentRows.map((row) => row.id));

      const enrolled = [];
      const skipped = [];

      for (const studentId of studentIds) {
        if (!validStudents.has(studentId)) {
          skipped.push({ studentId, reason: "not_student" });
          continue;
        }

        await lockStudentCourseMembership(client, courseId, studentId);

        const insertRes = await client.query(
          `
          INSERT INTO enrollments (course_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT (course_id, user_id) DO NOTHING
          RETURNING user_id
        `,
          [courseId, studentId],
        );

        if (!insertRes.rows.length) {
          skipped.push({ studentId, reason: "already_enrolled" });
          continue;
        }

        if (parsed.data.groupId) {
          await assignStudentToCourseGroup(client, {
            courseId,
            studentId,
            groupId: parsed.data.groupId,
          });
        }

        enrolled.push(studentId);
      }

      await client.query("COMMIT");
      const statusCode = enrolled.length ? 201 : 200;
      return res.status(statusCode).json({ enrolled, skipped });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Failed to bulk enroll students", err);
      return sendGroupMembershipError(res, err, "Failed to enroll students");
    } finally {
      client.release();
    }
  },
);

router.post("/assets/upload", requireCmsContentAccess, async (req, res) => {
  try {
    await runUploadFile(req, res);
  } catch (err) {
    console.log("[TEMP CMS ASSET UPLOAD] multer error", {
      code: err?.code,
      message: err?.message,
      body: req.body,
    });

    if (err instanceof multer.MulterError) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res
        .status(status)
        .json({ error: err.message || "File upload failed" });
    }
    return res.status(400).json({ error: err.message || "File upload failed" });
  }

  if (!req.file) {
    console.log("[TEMP CMS ASSET UPLOAD] missing file", {
      body: req.body,
    });
    return res.status(400).json({ error: "File is required" });
  }

  console.log("[TEMP CMS ASSET UPLOAD] received", {
    body: req.body,
    file: {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      filename: req.file.filename,
      path: req.file.path,
    },
  });

  const kind = getAssetKind(req.file.mimetype);
  if (!kind) {
    console.log("[TEMP CMS ASSET UPLOAD] unsupported mime type", {
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });
    return res.status(400).json({ error: "Unsupported file type" });
  }
  if (req.file.size > getMaxUploadSizeForMime(req.file.mimetype)) {
    return res.status(413).json({ error: getUploadSizeError(req.file.mimetype) });
  }

  const filename = req.file.filename;
  const storagePath = path.posix.join("uploads", filename);
  const publicUrl = `/uploads/${filename}`;

  console.log("[TEMP CMS ASSET UPLOAD] generated url", {
    storagePath,
    publicUrl,
    kind,
  });

  try {
    const insertRes = await pool.query(
      `
        INSERT INTO assets (
          uploaded_by_user_id,
          storage_provider,
          storage_path,
          public_url,
          kind,
          mime_type,
          original_name,
          size_bytes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
      [
        req.user.id,
        "local",
        storagePath,
        publicUrl,
        kind,
        req.file.mimetype,
        req.file.originalname,
        req.file.size,
      ],
    );
    const asset = insertRes.rows[0];
    const responsePayload = {
      assetId: asset.id,
      storagePath,
      kind,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      sizeBytes: req.file.size,
      url: publicUrl,
      createdAt: new Date().toISOString(),
    };

    console.log("[TEMP CMS ASSET UPLOAD] response", responsePayload);

    return res.status(201).json(responsePayload);
  } catch (err) {
    console.error("Failed to save asset metadata", err);
    return res.status(500).json({ error: "Failed to save asset metadata" });
  }
});

router.post(
  "/courses/:courseId/lessons/:lessonId/assets/upload-image",
  requireCourseContentRole(resolveCourseIdFromParam("courseId")),
  async (req, res) => {
    const parsedLessonId = uuidSchema.safeParse(req.params.lessonId);
    if (!parsedLessonId.success) {
      return res.status(400).json({ error: "lessonId must be a valid UUID" });
    }

    try {
      await runImageProcessingUpload(req, res);
    } catch (err) {
      if (err instanceof multer.MulterError) {
        const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({ error: err.message || "Image upload failed" });
      }
      return res.status(400).json({ error: err.message || "Image upload failed" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }
    if (!canConvertToWebp(req.file.mimetype)) {
      return res.status(400).json({ error: "Unsupported image type" });
    }
    if (req.file.size > getMaxUploadSizeForMime(req.file.mimetype)) {
      return res.status(413).json({ error: getUploadSizeError(req.file.mimetype) });
    }

    const client = await pool.connect();
    try {
      const lessonRes = await client.query(
        `
          SELECT l.id
          FROM lessons l
          JOIN modules m ON m.id = l.module_id
          WHERE l.id = $1
            AND m.course_id = $2
          LIMIT 1
        `,
        [parsedLessonId.data, req.courseContext.courseId],
      );
      if (!lessonRes.rows[0]) {
        return res.status(404).json({ error: "Lesson not found for this course" });
      }

      const processed = await convertImageToWebp({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
      });
      if (!processed) {
        return res.status(400).json({ error: "Unsupported image type" });
      }

      const storageKey = buildLessonAssetStorageKey({
        courseId: req.courseContext.courseId,
        lessonId: parsedLessonId.data,
        kind: "image",
        mimeType: processed.mimeType,
        originalName: processed.fileName,
      });
      const storage = getStorageProvider("r2");

      await storage.putObject({
        key: storageKey,
        body: processed.buffer,
        mimeType: processed.mimeType,
        metadata: {
          originalName: req.file.originalname,
          sourceMimeType: req.file.mimetype,
        },
      });

      const exists = await storage.objectExists({ key: storageKey });
      if (!exists) {
        return res.status(500).json({ error: "Uploaded object was not found" });
      }

      await client.query("BEGIN");
      const { rows } = await client.query(
        `
          INSERT INTO assets (
            uploaded_by_user_id,
            storage_provider,
            storage_path,
            public_url,
            kind,
            mime_type,
            original_name,
            size_bytes
          )
          VALUES ($1,$2,$3,NULL,$4,$5,$6,$7)
          RETURNING id, storage_path, public_url, kind, mime_type, original_name, size_bytes, created_at, storage_provider
        `,
        [
          req.user.id,
          "r2",
          storageKey,
          "image",
          processed.mimeType,
          req.file.originalname,
          processed.sizeBytes,
        ],
      );
      const asset = rows[0];

      await client.query(
        `
          INSERT INTO lesson_assets (lesson_id, asset_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `,
        [parsedLessonId.data, asset.id],
      );

      const downloadUrl = await storage.createDownloadUrl({ key: storageKey });
      await client.query("COMMIT");

      return res.status(201).json({
        assetId: asset.id,
        storagePath: asset.storage_path,
        publicUrl: asset.public_url,
        kind: asset.kind,
        mimeType: asset.mime_type,
        originalName: asset.original_name,
        sizeBytes: Number(asset.size_bytes || 0),
        storageProvider: asset.storage_provider,
        createdAt: asset.created_at,
        url: downloadUrl,
        processed: {
          convertedTo: "image/webp",
          originalMimeType: req.file.mimetype,
          originalSizeBytes: req.file.size,
          sizeBytes: processed.sizeBytes,
        },
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Failed to process R2 image upload", err);
      return res.status(500).json({ error: "Failed to process image upload" });
    } finally {
      client.release();
    }
  },
);

router.post(
  "/courses/:courseId/lessons/:lessonId/assets/upload-url",
  requireCourseContentRole(resolveCourseIdFromParam("courseId")),
  async (req, res) => {
    const parsedLessonId = uuidSchema.safeParse(req.params.lessonId);
    if (!parsedLessonId.success) {
      return res.status(400).json({ error: "lessonId must be a valid UUID" });
    }

    const { fileName, mimeType, sizeBytes, kind } = req.body || {};
    const numericSize = Number(sizeBytes);
    const sanitizedKind = sanitizeAssetKind(kind || getAssetKind(mimeType));

    if (!fileName || !mimeType || !Number.isFinite(numericSize) || numericSize <= 0) {
      return res.status(400).json({ error: "fileName, mimeType and sizeBytes are required" });
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType) || !isValidAssetKind(sanitizedKind)) {
      return res.status(400).json({ error: "Unsupported file type" });
    }
    if (numericSize > getMaxUploadSizeForMime(mimeType)) {
      return res.status(413).json({ error: getUploadSizeError(mimeType) });
    }

    try {
      const lessonRes = await pool.query(
        `
          SELECT l.id
          FROM lessons l
          JOIN modules m ON m.id = l.module_id
          WHERE l.id = $1
            AND m.course_id = $2
          LIMIT 1
        `,
        [parsedLessonId.data, req.courseContext.courseId],
      );
      if (!lessonRes.rows[0]) {
        return res.status(404).json({ error: "Lesson not found for this course" });
      }

      const storageKey = buildLessonAssetStorageKey({
        courseId: req.courseContext.courseId,
        lessonId: parsedLessonId.data,
        kind: sanitizedKind,
        mimeType,
        originalName: fileName,
      });
      const storage = getStorageProvider("r2");
      const uploadUrl = await storage.createUploadUrl({
        key: storageKey,
        mimeType,
        sizeBytes: numericSize,
        expiresIn: R2_ASSET_UPLOAD_TTL_SECONDS,
      });

      return res.json({
        provider: "r2",
        uploadUrl,
        storageKey,
        storagePath: storageKey,
        expiresIn: R2_ASSET_UPLOAD_TTL_SECONDS,
      });
    } catch (err) {
      console.error("Failed to create R2 upload URL", err);
      return res.status(500).json({ error: "Failed to create upload URL" });
    }
  },
);

router.post("/assets/confirm-upload", requireCmsContentAccess, async (req, res) => {
  const {
    courseId,
    lessonId,
    storageKey,
    kind,
    mimeType,
    originalName,
    sizeBytes,
    storageProvider = "r2",
  } = req.body || {};

  const parsedCourseId = uuidSchema.safeParse(courseId);
  const parsedLessonId = uuidSchema.safeParse(lessonId);
  const numericSize = Number(sizeBytes);
  const sanitizedKind = sanitizeAssetKind(kind || getAssetKind(mimeType));

  if (!parsedCourseId.success || !parsedLessonId.success) {
    return res.status(400).json({ error: "courseId and lessonId must be valid UUIDs" });
  }
  if (!storageKey || typeof storageKey !== "string" || storageKey.includes("..")) {
    return res.status(400).json({ error: "storageKey is required" });
  }
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType) || !isValidAssetKind(sanitizedKind)) {
    return res.status(400).json({ error: "Unsupported file type" });
  }
  if (!Number.isFinite(numericSize) || numericSize <= 0) {
    return res.status(400).json({ error: "Invalid file size" });
  }
  if (numericSize > getMaxUploadSizeForMime(mimeType)) {
    return res.status(413).json({ error: getUploadSizeError(mimeType) });
  }
  if (storageProvider !== "r2") {
    return res.status(400).json({ error: "Unsupported storage provider" });
  }

  const expectedPrefix = `courses/${parsedCourseId.data}/lessons/${parsedLessonId.data}/`;
  if (!storageKey.startsWith(expectedPrefix)) {
    return res.status(400).json({ error: "Invalid storage key for lesson" });
  }

  const client = await pool.connect();
  try {
    const allowed = await canEditCourse(parsedCourseId.data, req.user);
    if (!allowed) {
      return res.status(403).json({ error: "You cannot upload assets for this course" });
    }

    const lessonRes = await client.query(
      `
        SELECT l.id
        FROM lessons l
        JOIN modules m ON m.id = l.module_id
        WHERE l.id = $1
          AND m.course_id = $2
        LIMIT 1
      `,
      [parsedLessonId.data, parsedCourseId.data],
    );
    if (!lessonRes.rows[0]) {
      return res.status(404).json({ error: "Lesson not found for this course" });
    }

    const storage = getStorageProvider("r2");
    const exists = await storage.objectExists({ key: storageKey });
    if (!exists) {
      return res.status(400).json({ error: "Uploaded object was not found" });
    }

    await client.query("BEGIN");
    const { rows } = await client.query(
      `
        INSERT INTO assets (
          uploaded_by_user_id,
          storage_provider,
          storage_path,
          public_url,
          kind,
          mime_type,
          original_name,
          size_bytes
        )
        VALUES ($1,$2,$3,NULL,$4,$5,$6,$7)
        RETURNING id, storage_path, public_url, kind, mime_type, original_name, size_bytes, created_at, storage_provider
      `,
      [
        req.user.id,
        "r2",
        storageKey,
        sanitizedKind,
        mimeType,
        originalName || null,
        numericSize,
      ],
    );
    const asset = rows[0];

    await client.query(
      `
        INSERT INTO lesson_assets (lesson_id, asset_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [parsedLessonId.data, asset.id],
    );

    const downloadUrl = await storage.createDownloadUrl({ key: storageKey });
    await client.query("COMMIT");

    return res.status(201).json({
      assetId: asset.id,
      storagePath: asset.storage_path,
      publicUrl: asset.public_url,
      kind: asset.kind,
      mimeType: asset.mime_type,
      originalName: asset.original_name,
      sizeBytes: Number(asset.size_bytes || 0),
      storageProvider: asset.storage_provider,
      createdAt: asset.created_at,
      url: downloadUrl,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to confirm R2 asset upload", err);
    return res.status(500).json({ error: "Failed to confirm asset upload" });
  } finally {
    client.release();
  }
});

router.get("/assets/:assetId/download-url", requireCmsContentAccess, async (req, res) => {
  const parsedAssetId = uuidSchema.safeParse(req.params.assetId);
  if (!parsedAssetId.success) {
    return res.status(400).json({ error: "assetId must be a valid UUID" });
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT id, storage_provider, storage_path, public_url
        FROM assets
        WHERE id = $1
        LIMIT 1
      `,
      [parsedAssetId.data],
    );
    const asset = rows[0];
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    if (asset.storage_provider !== "r2") {
      return res.json({ url: asset.public_url });
    }

    const storage = getStorageProvider("r2");
    const url = await storage.createDownloadUrl({ key: asset.storage_path });
    return res.json({ url });
  } catch (err) {
    console.error("Failed to create asset download URL", err);
    return res.status(500).json({ error: "Failed to create download URL" });
  }
});

router.post("/assets/register", requireCmsContentAccess, async (req, res) => {
  const {
    storagePath,
    publicUrl,
    kind,
    mimeType,
    originalName,
    sizeBytes,
    storageProvider = "supabase",
  } = req.body || {};

  if (!storagePath || !publicUrl || !kind || !mimeType || !sizeBytes) {
    return res.status(400).json({ error: "Missing asset metadata" });
  }

  const sanitizedKind = sanitizeAssetKind(kind);
  try {
    const { rows } = await pool.query(
      `
        INSERT INTO assets (
          uploaded_by_user_id,
          storage_provider,
          storage_path,
          public_url,
          kind,
          mime_type,
          original_name,
          size_bytes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id, storage_path, public_url, kind, mime_type, original_name, size_bytes, created_at
      `,
      [
        req.user.id,
        storageProvider,
        storagePath,
        publicUrl,
        sanitizedKind,
        mimeType,
        originalName || null,
        sizeBytes,
      ],
    );
    const asset = rows[0];
    return res.status(201).json({
      assetId: asset.id,
      storagePath: asset.storage_path,
      publicUrl: asset.public_url,
      kind: asset.kind,
      mimeType: asset.mime_type,
      originalName: asset.original_name,
      sizeBytes: asset.size_bytes,
      createdAt: asset.created_at,
      url: asset.public_url,
    });
  } catch (err) {
    console.error("Failed to register asset metadata", err);
    return res.status(500).json({ error: "Failed to register asset metadata" });
  }
});

router.get("/assets", requireCmsContentAccess, async (req, res) => {
  const queryKind = typeof req.query.kind === "string" ? req.query.kind : null;
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";

  if (queryKind && !isValidAssetKind(queryKind)) {
    return res.status(400).json({ error: "Invalid asset kind filter" });
  }

  const filters = ["uploaded_by_user_id = $1"];
  const values = [req.user.id];

  if (queryKind) {
    values.push(queryKind);
    filters.push(`kind = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    filters.push(`original_name ILIKE $${values.length}`);
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          kind,
          mime_type,
          original_name,
          size_bytes,
          storage_path,
          storage_provider,
          public_url,
          created_at
        FROM assets
        WHERE ${filters.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT ${ASSET_LIST_LIMIT}
      `,
      values,
    );

    const items = await Promise.all(
      rows.map(async (asset) => {
        let url = asset.public_url;
        if (asset.storage_provider === "r2") {
          try {
            url = await getStorageProvider("r2").createDownloadUrl({ key: asset.storage_path });
          } catch (err) {
            console.error("Failed to sign R2 asset URL", err);
            url = null;
          }
        }

        return {
        assetId: asset.id,
        kind: asset.kind,
        mimeType: asset.mime_type,
        originalName: asset.original_name,
        sizeBytes: asset.size_bytes,
        storagePath: asset.storage_path,
        storageProvider: asset.storage_provider,
        url,
        createdAt: asset.created_at,
        };
      }),
    );
    return res.json(items);
  } catch (err) {
    console.error("Failed to list assets", err);
    return res.status(500).json({ error: "Failed to list assets" });
  }
});

module.exports = router;

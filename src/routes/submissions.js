const express = require("express");
const { z } = require("zod");
const pool = require("../db");
const auth = require("../middleware/auth");
const { requireGlobalRoleAny } = require("../middleware/roles");
const { decorateLessonAvailability } = require("../utils/lessonAvailability");
const { normalizeLessonType } = require("../utils/lessonTypes");

const router = express.Router();

const submissionSchema = z.object({
  contentText: z.string().trim().max(20000).optional().nullable(),
  assetIds: z.array(z.string().uuid()).optional().default([]),
});

const mapSubmissionFiles = (rows) =>
  rows.map((row) => ({
    id: row.asset_id,
    assetId: row.asset_id,
    kind: row.kind,
    mimeType: row.mime_type,
    originalName: row.original_name,
    sizeBytes: row.size_bytes,
    storagePath: row.storage_path,
    url: row.public_url,
  }));

const loadSubmission = async (lessonId, userId) => {
  const submissionRes = await pool.query(
    `
      SELECT
        id,
        lesson_id,
        user_id,
        status,
        content_text,
        submitted_at,
        reviewed_at,
        reviewed_by,
        grade,
        feedback,
        created_at,
        updated_at
      FROM lesson_submissions
      WHERE lesson_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [lessonId, userId],
  );

  const submission = submissionRes.rows[0] || null;
  if (!submission) return null;

  const filesRes = await pool.query(
    `
      SELECT
        lsf.asset_id,
        a.kind,
        a.mime_type,
        a.original_name,
        a.size_bytes,
        a.storage_path,
        a.public_url
      FROM lesson_submission_files lsf
      JOIN assets a ON a.id = lsf.asset_id
      WHERE lsf.submission_id = $1
      ORDER BY lsf.created_at ASC
    `,
    [submission.id],
  );

  return {
    id: submission.id,
    lessonId: submission.lesson_id,
    userId: submission.user_id,
    status: submission.status,
    contentText: submission.content_text || "",
    submittedAt: submission.submitted_at,
    reviewedAt: submission.reviewed_at,
    reviewedBy: submission.reviewed_by,
    grade: submission.grade === null ? null : Number(submission.grade),
    feedback: submission.feedback || "",
    createdAt: submission.created_at,
    updatedAt: submission.updated_at,
    files: mapSubmissionFiles(filesRes.rows),
  };
};

const loadActivityContext = async (lessonId, userId) => {
  const lessonRes = await pool.query(
    `
      SELECT
        l.id,
        l.title,
        l.content_type,
        l.requires_submission,
        l.available_from,
        l.due_at,
        l.allow_late_submission,
        l.late_until,
        m.course_id
      FROM lessons l
      JOIN modules m ON m.id = l.module_id
      WHERE l.id = $1
      LIMIT 1
    `,
    [lessonId],
  );
  const lesson = lessonRes.rows[0];
  if (!lesson) return { status: 404, error: "Lesson not found" };

  if (normalizeLessonType(lesson.content_type) !== "activity") {
    return { status: 400, error: "Only activities can receive submissions" };
  }

  if (!lesson.requires_submission) {
    return { status: 400, error: "This activity does not require a submission" };
  }

  const enrollmentRes = await pool.query(
    `
      SELECT 1
      FROM enrollments
      WHERE course_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [lesson.course_id, userId],
  );
  if (!enrollmentRes.rows.length) {
    return { status: 403, error: "You are not enrolled in this course" };
  }

  const availability = decorateLessonAvailability(lesson);
  const submission = await loadSubmission(lesson.id, userId);

  return {
    lesson,
    availability,
    submission,
  };
};

const buildSubmissionResponse = (context) => {
  const submission = context.submission;
  const status = submission?.status || "pending";

  return {
    lessonId: context.lesson.id,
    status,
    contentText: submission?.contentText || "",
    files: submission?.files || [],
    submittedAt: submission?.submittedAt || null,
    reviewedAt: submission?.reviewedAt || null,
    grade: submission?.grade ?? null,
    feedback: submission?.feedback || "",
    canSubmit:
      context.availability.isAvailable &&
      !context.availability.isClosed &&
      !["submitted", "submitted_late", "reviewed"].includes(status),
    isLate: context.availability.availabilityStatus === "late_available",
    availabilityStatus: context.availability.availabilityStatus,
  };
};

router.get(
  "/lessons/:id/submission/me",
  auth,
  requireGlobalRoleAny(["student"]),
  async (req, res) => {
    try {
      const context = await loadActivityContext(req.params.id, req.user.id);
      if (context.error) {
        return res.status(context.status || 400).json({ error: context.error });
      }

      return res.json(buildSubmissionResponse(context));
    } catch (err) {
      console.error("Failed to load lesson submission", err);
      return res.status(500).json({ error: "Failed to load submission" });
    }
  },
);

router.post(
  "/lessons/:id/submission",
  auth,
  requireGlobalRoleAny(["student"]),
  async (req, res) => {
    const parsed = submissionSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid submission payload" });
    }

    const contentText = String(parsed.data.contentText || "").trim();
    const assetIds = [...new Set(parsed.data.assetIds || [])];
    if (!contentText && !assetIds.length) {
      return res.status(400).json({ error: "Submission content or assetIds are required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const context = await loadActivityContext(req.params.id, req.user.id);
      if (context.error) {
        await client.query("ROLLBACK");
        return res.status(context.status || 400).json({ error: context.error });
      }

      if (!context.availability.isAvailable || context.availability.isClosed) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "This activity is not open for submissions" });
      }

      if (context.submission && ["submitted", "submitted_late", "reviewed"].includes(context.submission.status)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "This activity was already submitted" });
      }

      if (assetIds.length) {
        const assetsRes = await client.query(
          "SELECT id FROM assets WHERE id = ANY($1::uuid[])",
          [assetIds],
        );
        if (assetsRes.rows.length !== assetIds.length) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "One or more assetIds do not exist" });
        }
      }

      const status =
        context.availability.availabilityStatus === "late_available"
          ? "submitted_late"
          : "submitted";

      const submissionRes = await client.query(
        `
          INSERT INTO lesson_submissions (
            lesson_id,
            user_id,
            status,
            content_text,
            submitted_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, now(), now())
          ON CONFLICT (lesson_id, user_id)
          DO UPDATE SET
            status = EXCLUDED.status,
            content_text = EXCLUDED.content_text,
            submitted_at = now(),
            updated_at = now()
          WHERE lesson_submissions.status = 'returned'
          RETURNING id
        `,
        [context.lesson.id, req.user.id, status, contentText || null],
      );

      const submissionId = submissionRes.rows[0]?.id;
      if (!submissionId) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "This activity was already submitted" });
      }

      await client.query("DELETE FROM lesson_submission_files WHERE submission_id = $1", [
        submissionId,
      ]);

      if (assetIds.length) {
        const placeholders = assetIds
          .map((_, index) => `($1, $${index + 2})`)
          .join(", ");
        await client.query(
          `
            INSERT INTO lesson_submission_files (submission_id, asset_id)
            VALUES ${placeholders}
            ON CONFLICT (submission_id, asset_id) DO NOTHING
          `,
          [submissionId, ...assetIds],
        );
      }

      await client.query("COMMIT");

      const submission = await loadSubmission(context.lesson.id, req.user.id);
      return res.status(201).json({
        ...buildSubmissionResponse({
          ...context,
          submission,
        }),
        status: submission.status,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Failed to submit lesson activity", err);
      return res.status(500).json({ error: "Failed to submit activity" });
    } finally {
      client.release();
    }
  },
);

module.exports = router;

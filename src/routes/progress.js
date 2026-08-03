const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireGlobalRoleAny } = require('../middleware/roles');
const { lessonProgressSchema, formatZodError } = require('../utils/validators');
const { recordGamificationEvent } = require('../services/gamification');
const { shouldTrackLessonProgress } = require('../utils/lessonTypes');
const { decorateLessonAvailability } = require('../utils/lessonAvailability');

const router = express.Router();

const getVisibleQuizRequirement = (contentJson) => {
  let source = {};
  try {
    source =
      typeof contentJson === 'string'
        ? JSON.parse(contentJson || '{}')
        : contentJson || {};
  } catch {
    source = {};
  }
  const pages = Array.isArray(source.pages) ? source.pages : [];
  const questionIds = new Set();
  let requiresLessonQuiz = false;

  for (const page of pages) {
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    for (const block of blocks) {
      if (block?.type !== 'quiz') continue;
      if (block.quizMode === 'lesson_quiz') {
        requiresLessonQuiz = true;
        continue;
      }
      if (block.quizMode === 'single_question' && block.questionId) {
        questionIds.add(String(block.questionId));
      }
    }
  }

  return {
    requiresQuiz: requiresLessonQuiz || questionIds.size > 0,
    requiresLessonQuiz,
    questionIds,
  };
};

const getVisibleQuizScore = async ({ lessonId, userId, requirement }) => {
  if (!requirement.requiresQuiz) return { passed: true, scorePercent: null };

  let questionFilter = '';
  if (!requirement.requiresLessonQuiz) {
    questionFilter = 'AND qq.id = ANY($3::uuid[])';
  }

  const questionsRes = await pool.query(
    `
      SELECT
        qq.id AS question_id,
        qq.question_type,
        COALESCE(qq.points, 1) AS points,
        qo.id AS option_id,
        qo.is_correct
      FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
      WHERE qq.lesson_id = $1
        AND qq.question_type = ANY($2::text[])
        ${questionFilter}
      ORDER BY qq.order_index ASC, qo.order_index ASC
    `,
    requirement.requiresLessonQuiz
      ? [lessonId, ['single_choice', 'true_false', 'multiple_choice']]
      : [lessonId, ['single_choice', 'true_false', 'multiple_choice'], Array.from(requirement.questionIds)],
  );

  const questionsMap = new Map();
  for (const row of questionsRes.rows) {
    if (!questionsMap.has(row.question_id)) {
      questionsMap.set(row.question_id, {
        questionId: row.question_id,
        questionType: row.question_type,
        points: Number(row.points ?? 1),
        correctOptionIds: new Set(),
      });
    }
    if (row.option_id && row.is_correct) {
      questionsMap.get(row.question_id).correctOptionIds.add(row.option_id);
    }
  }

  const questions = Array.from(questionsMap.values());
  if (!questions.length) return { passed: true, scorePercent: null };

  const latestAttemptByQuestionRes = await pool.query(
    `
      SELECT DISTINCT ON (qaa.question_id)
        qaa.question_id,
        qa.id AS attempt_id
      FROM quiz_attempt_answers qaa
      JOIN quiz_attempts qa ON qa.id = qaa.attempt_id
      JOIN quiz_questions qq ON qq.id = qaa.question_id
      WHERE qa.user_id = $1
        AND qa.lesson_id = $2
        AND qa.status = 'submitted'
        AND qaa.question_id = ANY($3::uuid[])
      ORDER BY qaa.question_id, COALESCE(qa.submitted_at, qa.created_at) DESC, qa.id DESC
    `,
    [userId, lessonId, questions.map((question) => question.questionId)],
  );

  const latestAttemptIdByQuestionId = new Map();
  const latestAttemptIds = [];
  const latestQuestionIds = [];
  for (const row of latestAttemptByQuestionRes.rows) {
    latestAttemptIdByQuestionId.set(row.question_id, row.attempt_id);
    latestAttemptIds.push(row.attempt_id);
    latestQuestionIds.push(row.question_id);
  }

  if (!latestAttemptIds.length) return { passed: false, scorePercent: 0 };

  const answersRes = await pool.query(
    `
      SELECT qaa.question_id, qaa.selected_option_id, qa.id AS attempt_id
      FROM quiz_attempt_answers qaa
      JOIN quiz_attempts qa ON qa.id = qaa.attempt_id
      WHERE qa.id = ANY($1::uuid[])
        AND qaa.question_id = ANY($2::uuid[])
    `,
    [latestAttemptIds, latestQuestionIds],
  );

  const selectedOptionIdsByQuestionId = new Map();
  for (const row of answersRes.rows) {
    const latestAttemptId = latestAttemptIdByQuestionId.get(row.question_id);
    if (String(latestAttemptId) !== String(row.attempt_id)) continue;
    if (!selectedOptionIdsByQuestionId.has(row.question_id)) {
      selectedOptionIdsByQuestionId.set(row.question_id, []);
    }
    selectedOptionIdsByQuestionId.get(row.question_id).push(row.selected_option_id);
  }

  let totalPoints = 0;
  let earnedPoints = 0;
  for (const question of questions) {
    totalPoints += question.points;
    const selected = Array.from(
      new Set((selectedOptionIdsByQuestionId.get(question.questionId) || []).filter(Boolean)),
    );
    const correctSet = question.correctOptionIds;
    const isCorrect =
      question.questionType === 'multiple_choice'
        ? selected.length === correctSet.size && selected.every((optionId) => correctSet.has(optionId))
        : selected.length === 1 && correctSet.has(selected[0]);
    if (isCorrect) earnedPoints += question.points;
  }

  const scorePercent = totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  return { passed: scorePercent >= 70, scorePercent };
};

router.post('/lessons/:id/progress', auth, requireGlobalRoleAny(['student']), async (req, res) => {
  const lessonId = req.params.id;
  const parsedBody = lessonProgressSchema.safeParse(req.body || {});
  if (!parsedBody.success) {
    return res.status(400).json({ error: formatZodError(parsedBody.error) });
  }
  const { status, progressPercent } = parsedBody.data;

  try {
    const lessonRes = await pool.query(
      `
        SELECT
          l.id,
          l.content_type,
          l.content_json,
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
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    if (!shouldTrackLessonProgress(lesson.content_type)) {
      return res.status(400).json({ error: 'This lesson type does not track progress' });
    }

    const availability = decorateLessonAvailability(lesson);
    if (!availability.isAvailable || availability.isClosed) {
      return res.status(403).json({
        error: 'This lesson is not available for progress updates',
        availabilityStatus: availability.availabilityStatus,
      });
    }

    const enrollmentRes = await pool.query(
      `
        SELECT 1
        FROM enrollments
        WHERE course_id = $1 AND user_id = $2
        LIMIT 1
      `,
      [lesson.course_id, req.user.id],
    );
    if (!enrollmentRes.rows.length) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    if (status === 'done') {
      const requirement = getVisibleQuizRequirement(lesson.content_json);
      const quizCompletion = await getVisibleQuizScore({
        lessonId: lesson.id,
        userId: req.user.id,
        requirement,
      });
      if (!quizCompletion.passed) {
        return res.status(400).json({
          error: 'You must pass the visible quiz before marking this lesson as done',
        });
      }
    }

    const progressRes = await pool.query(
      `
        INSERT INTO lesson_progress (user_id, lesson_id, status, progress_percent, last_seen_at)
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (user_id, lesson_id) DO UPDATE
        SET
          progress_percent = GREATEST(
            lesson_progress.progress_percent,
            EXCLUDED.progress_percent
          ),
          status = CASE
            WHEN lesson_progress.status = 'done' THEN 'done'
            WHEN EXCLUDED.status = 'done' THEN 'done'
            WHEN lesson_progress.status = 'in_progress' THEN 'in_progress'
            WHEN EXCLUDED.status = 'in_progress' THEN 'in_progress'
            ELSE lesson_progress.status
          END,
          last_seen_at = now()
        RETURNING user_id, lesson_id, status, progress_percent, last_seen_at;
      `,
      [req.user.id, lesson.id, status, progressPercent ?? null],
    );

    const record = progressRes.rows[0];

    if (record?.status === 'done') {
      try {
        await recordGamificationEvent({
          userId: req.user.id,
          courseId: lesson.course_id,
          groupId: null,
          actorUserId: req.user.id,
          eventType: 'lesson_completed_student',
          eventKey: `lesson_done:${req.user.id}:${lesson.id}`,
          occurredAt: record.last_seen_at || new Date(),
          meta: { lessonId: lesson.id, source: 'lesson_progress' },
        });
      } catch (gamificationErr) {
        console.warn('Failed to record lesson completion gamification event', gamificationErr);
      }
    }

    return res.json({
      userId: record.user_id,
      lessonId: record.lesson_id,
      status: record.status,
      progressPercent: record.progress_percent,
      lastSeenAt: record.last_seen_at,
    });
  } catch (err) {
    console.error('Failed to update lesson progress', err);
    return res.status(500).json({ error: 'Failed to update lesson progress' });
  }
});

module.exports = router;

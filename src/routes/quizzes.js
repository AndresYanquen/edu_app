const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireGlobalRoleAny } = require('../middleware/roles');
const { quizAttemptSchema, inlineQuizAttemptSchema, formatZodError } = require('../utils/validators');
const { computeQuizScore } = require('../utils/quizScoring');

const router = express.Router();

router.use(auth);

const getLessonCourse = async (lessonId) => {
  const result = await pool.query(
    `
      SELECT
        l.id,
        l.is_published AS lesson_published,
        m.course_id,
        m.is_published AS module_published,
        c.is_published AS course_published
      FROM lessons l
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE l.id = $1
      LIMIT 1
    `,
    [lessonId],
  );
  return result.rows[0];
};

const ensureEnrollment = async (courseId, userId) => {
  const result = await pool.query(
    `
      SELECT 1
      FROM enrollments
      WHERE course_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [courseId, userId],
  );
  return result.rows.length > 0;
};

router.get('/lessons/:id/quiz', requireGlobalRoleAny(['student', 'admin']), async (req, res) => {
  const lessonId = req.params.id;
  try {
    const lesson = await getLessonCourse(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    if (!lesson.course_published || !lesson.module_published || !lesson.lesson_published) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const enrolled = await ensureEnrollment(lesson.course_id, req.user.id);
    if (!enrolled) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    const quizRes = await pool.query(
      `
        SELECT
          qq.id AS question_id,
          qq.question_text,
          qq.question_type,
          qq.order_index,
          qq.points,
          qq.explanation,
          qo.id AS option_id,
          qo.option_text,
          qo.order_index AS option_order,
          qo.is_correct
        FROM quiz_questions qq
        LEFT JOIN quiz_options qo ON qo.question_id = qq.id
        WHERE qq.lesson_id = $1
        ORDER BY qq.order_index ASC, qo.order_index ASC
      `,
      [lessonId],
    );

    if (!quizRes.rows.length) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questionsMap = new Map();
    for (const row of quizRes.rows) {
      if (!questionsMap.has(row.question_id)) {
        questionsMap.set(row.question_id, {
          questionId: row.question_id,
          questionText: row.question_text,
          questionType: row.question_type,
          orderIndex: row.order_index,
          points: row.points !== null ? Number(row.points) : 1,
          explanation: row.explanation || null,
          options: [],
          correctCount: 0,
          optionSet: new Set(),
        });
      }
      if (row.option_id) {
        const question = questionsMap.get(row.question_id);
        if (!question.optionSet.has(row.option_id)) {
          question.optionSet.add(row.option_id);
          question.options.push({
            id: row.option_id,
            optionText: row.option_text,
            orderIndex: row.option_order,
            isCorrect: Boolean(row.is_correct)            
          });
        }
        if (row.is_correct) {
          const question = questionsMap.get(row.question_id);
          question.correctCount += 1;
        }
      }
    }

    let quizReady = true;
    for (const question of questionsMap.values()) {
      if (['single_choice', 'true_false', 'multiple_choice'].includes(question.questionType)) {
        if (question.options.length < 2) {
          quizReady = false;
          break;
        }
        if (question.questionType === 'single_choice' && question.correctCount !== 1) {
          quizReady = false;
          break;
        }
        if (question.questionType === 'true_false' && question.correctCount === 0) {
          quizReady = false;
          break;
        }
        if (question.questionType === 'multiple_choice' && question.correctCount === 0) {
          quizReady = false;
          break;
        }
      }
    }

    if (!quizReady) {
      return res.status(404).json({ error: 'Quiz not ready' });
    }

    const questions = Array.from(questionsMap.values()).map((question) => ({
      id: question.questionId,
      questionText: question.questionText,
      questionType: question.questionType,
      orderIndex: question.orderIndex,
      points: question.points,
      explanation: question.explanation,
      options: question.options.map((option) => ({
        id: option.id,
        optionText: option.optionText,
        isCorrect: option.isCorrect,
      })),
    }));

    const latestByQuestionRes = await pool.query(
      `
        SELECT DISTINCT ON (qaa.question_id)
          qaa.question_id,
          qa.id AS attempt_id,
          qa.created_at,
          qa.submitted_at,
          qq.question_type
        FROM quiz_attempts qa
        JOIN quiz_attempt_answers qaa ON qaa.attempt_id = qa.id
        JOIN quiz_questions qq ON qq.id = qaa.question_id
        WHERE qa.user_id = $1
          AND qa.lesson_id = $2
          AND qa.status = 'submitted'
        ORDER BY qaa.question_id, qa.created_at DESC, qa.id DESC
      `,
      [req.user.id, lessonId],
    );

    const myAnswersByQuestionId = {};
    if (latestByQuestionRes.rows.length) {
      const latestAttemptByQuestionId = new Map();
      const attemptIds = new Set();
      const questionIds = new Set();

      for (const row of latestByQuestionRes.rows) {
        latestAttemptByQuestionId.set(row.question_id, row);
        attemptIds.add(row.attempt_id);
        questionIds.add(row.question_id);
      }

      const answersRes = await pool.query(
        `
          SELECT
            qaa.question_id,
            qaa.selected_option_id,
            qaa.correct,
            qa.id AS attempt_id,
            qa.created_at,
            qa.submitted_at,
            qq.question_type
          FROM quiz_attempts qa
          JOIN quiz_attempt_answers qaa ON qaa.attempt_id = qa.id
          JOIN quiz_questions qq ON qq.id = qaa.question_id
          WHERE qa.id = ANY($1::uuid[])
            AND qaa.question_id = ANY($2::uuid[])
        `,
        [Array.from(attemptIds), Array.from(questionIds)],
      );

      const grouped = new Map();
      for (const row of answersRes.rows) {
        const latestAttempt = latestAttemptByQuestionId.get(row.question_id);
        if (!latestAttempt) continue;
        if (String(latestAttempt.attempt_id) !== String(row.attempt_id)) continue;

        if (!grouped.has(row.question_id)) {
          grouped.set(row.question_id, {
            questionType: row.question_type,
            attemptId: row.attempt_id,
            answeredAt: row.submitted_at || row.created_at,
            rows: [],
          });
        }
        grouped.get(row.question_id).rows.push(row);
      }

      for (const [questionId, value] of grouped.entries()) {
        const questionInfo = questionsMap.get(questionId);
        const questionType = value.questionType;
        const selectedOptionIds = Array.from(
          new Set(value.rows.map((row) => row.selected_option_id).filter(Boolean)),
        );

        let isCorrect = false;
        if (questionType === 'multiple_choice') {
          const correctSet = new Set(
            (questionInfo?.options || [])
              .filter((option) => Boolean(option.isCorrect))
              .map((option) => option.id),
          );
          const selectedSet = new Set(selectedOptionIds);
          isCorrect =
            selectedSet.size === correctSet.size &&
            selectedOptionIds.every((optionId) => correctSet.has(optionId));
        } else {
          isCorrect = Boolean(value.rows[0]?.correct);
        }

        myAnswersByQuestionId[questionId] = {
          questionType,
          optionId: questionType === 'multiple_choice' ? null : selectedOptionIds[0] || null,
          optionIds: questionType === 'multiple_choice' ? selectedOptionIds : [],
          isCorrect,
          answeredAt: value.answeredAt,
          attemptId: value.attemptId,
        };
      }
    }

    return res.json({ lessonId, questions, myAnswersByQuestionId });
  } catch (err) {
    console.error('Failed to load quiz', err);
    return res.status(500).json({ error: 'Failed to load quiz' });
  }
});

router.post('/lessons/:id/quiz/attempt', requireGlobalRoleAny(['student']), async (req, res) => {
  const lessonId = req.params.id;
  const parseResult = quizAttemptSchema.safeParse(req.body || {});
  if (!parseResult.success) {
    return res.status(400).json({ error: formatZodError(parseResult.error) });
  }
  const { answers } = parseResult.data;

  try {
    const lesson = await getLessonCourse(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    if (!lesson.course_published || !lesson.module_published || !lesson.lesson_published) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const enrolled = await ensureEnrollment(lesson.course_id, req.user.id);
    if (!enrolled) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    const quizRes = await pool.query(
      `
        SELECT
          qq.id AS question_id,
          qq.question_type,
          qq.order_index,
          qq.points,
          qo.id AS option_id,
          qo.is_correct
        FROM quiz_questions qq
        LEFT JOIN quiz_options qo ON qo.question_id = qq.id
        WHERE qq.lesson_id = $1
        ORDER BY qq.order_index ASC, qo.order_index ASC
      `,
      [lessonId],
    );

    if (!quizRes.rows.length) {
      return res.status(400).json({ error: 'Quiz not available for this lesson' });
    }

    const allowedQuestionTypes = new Set(['single_choice', 'true_false', 'multiple_choice']);
    const questionMap = new Map();
    for (const row of quizRes.rows) {
      if (!questionMap.has(row.question_id)) {
        if (!allowedQuestionTypes.has(row.question_type)) {
          return res.status(400).json({ error: `Question ${row.question_id} uses unsupported type` });
        }
        questionMap.set(row.question_id, {
          questionId: row.question_id,
          questionType: row.question_type,
          points: Number(row.points ?? 1),
          optionsMap: new Map(),
          correctOptionIds: new Set(),
        });
      }
      if (row.option_id) {
        const question = questionMap.get(row.question_id);
        if (!question.optionsMap.has(row.option_id)) {
          question.optionsMap.set(row.option_id, { isCorrect: row.is_correct });
        }
        if (row.is_correct) {
          question.correctOptionIds.add(row.option_id);
        }
      }
    }

    for (const question of questionMap.values()) {
      if (!question.optionsMap.size) {
        return res.status(400).json({ error: 'Quiz questions must include valid options' });
      }
      if (['single_choice', 'true_false', 'multiple_choice'].includes(question.questionType)) {
        if (question.optionsMap.size < 2) {
          return res.status(400).json({ error: 'Quiz questions must include at least two options' });
        }
        if (question.questionType === 'multiple_choice' && !question.correctOptionIds.size) {
          return res.status(400).json({ error: 'Multiple choice questions require at least one correct option' });
        }
        if (['single_choice', 'true_false'].includes(question.questionType) && question.correctOptionIds.size < 1) {
          return res.status(400).json({ error: 'Question requires at least one correct option' });
        }
      }
    }

    const normalizedAnswers = new Map();
    for (const answer of answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        return res.status(400).json({ error: 'Answer references invalid question' });
      }
      if (normalizedAnswers.has(answer.questionId)) {
        return res.status(400).json({ error: 'Duplicate answer for a question' });
      }
      if (question.questionType === 'multiple_choice') {
        if (!answer.optionIds) {
          return res.status(400).json({ error: 'Multiple choice answers must include optionIds' });
        }
        const uniqueOptions = Array.from(new Set(answer.optionIds));
        if (!uniqueOptions.length) {
          return res.status(400).json({ error: 'Multiple choice answers must include at least one option' });
        }
        const invalidOption = uniqueOptions.find((optionId) => !question.optionsMap.has(optionId));
        if (invalidOption) {
          return res.status(400).json({ error: 'Answer option does not belong to question' });
        }
        normalizedAnswers.set(answer.questionId, { optionIds: uniqueOptions });
      } else {
        if (!answer.optionId) {
          return res.status(400).json({ error: 'Answer must include optionId' });
        }
        if (!question.optionsMap.has(answer.optionId)) {
          return res.status(400).json({ error: 'Answer option does not belong to question' });
        }
        normalizedAnswers.set(answer.questionId, { optionId: answer.optionId });
      }
    }

    const questionsForScoring = Array.from(normalizedAnswers.keys()).map((questionId) => {
      const question = questionMap.get(questionId);
      return {
        questionId: question.questionId,
        questionType: question.questionType,
        points: question.points,
        correctOptionIds: Array.from(question.correctOptionIds),
      };
    });

    const scoring = computeQuizScore({
      questions: questionsForScoring,
      answers: normalizedAnswers,
    });

    const scorePercent = scoring.totalPoints
      ? Math.round((scoring.earnedPoints / scoring.totalPoints) * 100)
      : 0;
    const passed = scorePercent >= 70;

    const attemptNumberRes = await pool.query(
      `
        SELECT COALESCE(MAX(attempt_number), 0) AS current_max
        FROM quiz_attempts
        WHERE user_id = $1 AND lesson_id = $2
      `,
      [req.user.id, lessonId],
    );
    const attemptNumber = (attemptNumberRes.rows[0]?.current_max || 0) + 1;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const attemptRes = await client.query(
        `
          INSERT INTO quiz_attempts (
            user_id,
            lesson_id,
            attempt_number,
            status,
            started_at,
            score_percent
          )
          VALUES ($1, $2, $3, 'draft', now(), 0)
          RETURNING id
        `,
        [req.user.id, lessonId, attemptNumber],
      );
      const attemptId = attemptRes.rows[0].id;

      for (const detail of scoring.questionResults) {
        const question = questionMap.get(detail.questionId);
        const perOptionPoints =
          detail.selectedOptionIds.length && detail.pointsAwarded
            ? detail.pointsAwarded / detail.selectedOptionIds.length
            : 0;
        for (const optionId of detail.selectedOptionIds) {
          const option = question.optionsMap.get(optionId);
          await client.query(
            `
              INSERT INTO quiz_attempt_answers (
                attempt_id,
                question_id,
                selected_option_id,
                correct,
                points_awarded
              )
              VALUES ($1, $2, $3, $4, $5)
            `,
            [attemptId, detail.questionId, optionId, option?.isCorrect ?? false, perOptionPoints],
          );
        }
      }

      await client.query(
        `
          UPDATE quiz_attempts
          SET status = 'submitted',
              submitted_at = now(),
              score_raw = $1,
              score_percent = $2,
              passed = $3
          WHERE id = $4
        `,
        [scoring.earnedPoints, scorePercent, passed, attemptId],
      );

      if (passed) {
        await client.query(
          `
            INSERT INTO lesson_progress (user_id, lesson_id, status, progress_percent, last_seen_at)
            VALUES ($1, $2, 'done', 100, now())
            ON CONFLICT (user_id, lesson_id) DO UPDATE
            SET status = 'done',
                progress_percent = 100,
                last_seen_at = now()
          `,
          [req.user.id, lessonId],
        );
      }

      await client.query('COMMIT');
      return res.json({ scorePercent, scoreRaw: scoring.earnedPoints, passed });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Failed to submit quiz attempt', err);
    return res.status(500).json({ error: 'Failed to submit quiz attempt' });
  }
});

router.post('/lessons/:lessonId/quiz/questions/:questionId/attempt', requireGlobalRoleAny(['student']), async (req, res) => {
  const { lessonId, questionId } = req.params;
  const parseResult = inlineQuizAttemptSchema.safeParse(req.body || {});
  if (!parseResult.success) {
    return res.status(400).json({ error: formatZodError(parseResult.error) });
  }

  try {
    const lesson = await getLessonCourse(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    if (!lesson.course_published || !lesson.module_published || !lesson.lesson_published) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const enrolled = await ensureEnrollment(lesson.course_id, req.user.id);
    if (!enrolled) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    const questionRes = await pool.query(
      `
        SELECT
          qq.id AS question_id,
          qq.question_type,
          qq.points,
          qo.id AS option_id,
          qo.is_correct
        FROM quiz_questions qq
        LEFT JOIN quiz_options qo ON qo.question_id = qq.id
        WHERE qq.lesson_id = $1
          AND qq.id = $2
        ORDER BY qo.order_index ASC
      `,
      [lessonId, questionId],
    );

    if (!questionRes.rows.length) {
      return res.status(404).json({ error: 'Question not found for this lesson' });
    }

    const allowedQuestionTypes = new Set(['single_choice', 'true_false', 'multiple_choice']);
    const questionType = questionRes.rows[0].question_type;
    if (!allowedQuestionTypes.has(questionType)) {
      return res.status(400).json({ error: 'Question type is not supported for inline attempts' });
    }

    const optionsMap = new Map();
    const correctOptionIds = new Set();
    for (const row of questionRes.rows) {
      if (row.option_id && !optionsMap.has(row.option_id)) {
        optionsMap.set(row.option_id, { isCorrect: Boolean(row.is_correct) });
      }
      if (row.option_id && row.is_correct) {
        correctOptionIds.add(row.option_id);
      }
    }

    if (optionsMap.size < 2) {
      return res.status(400).json({ error: 'Question must include at least two options' });
    }
    if (!correctOptionIds.size) {
      return res.status(400).json({ error: 'Question requires at least one correct option' });
    }

    const answerPayload = parseResult.data;
    const normalizedAnswers = new Map();
    if (questionType === 'multiple_choice') {
      if (!answerPayload.optionIds || !answerPayload.optionIds.length) {
        return res.status(400).json({ error: 'Multiple choice questions require optionIds' });
      }
      const uniqueOptions = Array.from(new Set(answerPayload.optionIds));
      const invalidOption = uniqueOptions.find((optionId) => !optionsMap.has(optionId));
      if (invalidOption) {
        return res.status(400).json({ error: 'Answer option does not belong to question' });
      }
      normalizedAnswers.set(questionId, { optionIds: uniqueOptions });
    } else {
      if (!answerPayload.optionId) {
        return res.status(400).json({ error: 'Question requires optionId' });
      }
      if (!optionsMap.has(answerPayload.optionId)) {
        return res.status(400).json({ error: 'Answer option does not belong to question' });
      }
      normalizedAnswers.set(questionId, { optionId: answerPayload.optionId });
    }

    const scoring = computeQuizScore({
      questions: [
        {
          questionId,
          questionType,
          points: Number(questionRes.rows[0].points ?? 1),
          correctOptionIds: Array.from(correctOptionIds),
        },
      ],
      answers: normalizedAnswers,
    });

    const detail = scoring.questionResults[0];
    const scorePercent = scoring.totalPoints
      ? Math.round((scoring.earnedPoints / scoring.totalPoints) * 100)
      : 0;
    const passed = detail?.correct || false;

    const attemptNumberRes = await pool.query(
      `
        SELECT COALESCE(MAX(attempt_number), 0) AS current_max
        FROM quiz_attempts
        WHERE user_id = $1 AND lesson_id = $2
      `,
      [req.user.id, lessonId],
    );
    const attemptNumber = (attemptNumberRes.rows[0]?.current_max || 0) + 1;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const attemptRes = await client.query(
        `
          INSERT INTO quiz_attempts (
            user_id,
            lesson_id,
            attempt_number,
            status,
            started_at,
            score_percent,
            metadata
          )
          VALUES ($1, $2, $3, 'draft', now(), 0, $4::jsonb)
          RETURNING id
        `,
        [req.user.id, lessonId, attemptNumber, JSON.stringify({ source: 'inline', questionId })],
      );
      const attemptId = attemptRes.rows[0].id;

      const pointsPerSelection =
        detail.selectedOptionIds.length && detail.pointsAwarded
          ? detail.pointsAwarded / detail.selectedOptionIds.length
          : 0;
      for (const optionId of detail.selectedOptionIds) {
        const option = optionsMap.get(optionId);
        await client.query(
          `
            INSERT INTO quiz_attempt_answers (
              attempt_id,
              question_id,
              selected_option_id,
              correct,
              points_awarded
            )
            VALUES ($1, $2, $3, $4, $5)
          `,
          [attemptId, questionId, optionId, option?.isCorrect ?? false, pointsPerSelection],
        );
      }

      await client.query(
        `
          UPDATE quiz_attempts
          SET status = 'submitted',
              submitted_at = now(),
              score_raw = $1,
              score_percent = $2,
              passed = $3
          WHERE id = $4
        `,
        [scoring.earnedPoints, scorePercent, passed, attemptId],
      );

      await client.query('COMMIT');
      const INLINE_ATTEMPT_RETENTION = 10;
      // Retención inline (no bloquear respuesta si falla)
      try {
        const cleanupRes = await pool.query(
          `
            WITH ranked AS (
              SELECT qa.id,
                    ROW_NUMBER() OVER (ORDER BY qa.created_at DESC) AS rn
              FROM quiz_attempts qa
              WHERE qa.user_id = $1
                AND qa.lesson_id = $2
                AND (qa.metadata->>'source') = 'inline'
                AND (qa.metadata->>'questionId') = $3
            )
            SELECT id FROM ranked WHERE rn > $4
          `,
          [req.user.id, lessonId, questionId, INLINE_ATTEMPT_RETENTION],
        );

        const idsToDelete = cleanupRes.rows.map((r) => r.id);

        if (idsToDelete.length) {
          await pool.query(
            `DELETE FROM quiz_attempt_answers WHERE attempt_id = ANY($1)`,
            [idsToDelete],
          );

          await pool.query(
            `DELETE FROM quiz_attempts WHERE id = ANY($1)`,
            [idsToDelete],
          );
        }
      } catch (cleanupErr) {
        console.warn('Inline attempt cleanup failed', cleanupErr);
      }

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return res.json({
      lessonId,
      questionId,
      isCorrect: Boolean(detail?.correct),
      selectedOptionIds: detail?.selectedOptionIds || [],
      correctOptionIds: Array.from(correctOptionIds),
      pointsAwarded: detail?.pointsAwarded || 0,
      scorePercent,
    });
  } catch (err) {
    console.error('Failed to submit inline quiz attempt', err);
    return res.status(500).json({ error: 'Failed to submit inline quiz attempt' });
  }
});

/**
 * Example:
 * curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/lessons/<lessonId>/quiz/score
 */
router.get('/lessons/:id/quiz/score', auth, requireGlobalRoleAny(['student']), async (req, res) => {
  const lessonId = req.params.id;

  try {
    const lesson = await getLessonCourse(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const enrolled = await ensureEnrollment(lesson.course_id, req.user.id);
    if (!enrolled) {
      return res.status(403).json({ error: 'Not enrolled in this course' });
    }

    // Score is computed from the latest answer per question in this lesson, regardless of
    // whether the answer came from inline or final quiz flows (metadata.source is ignored).
    const evaluableTypes = ['single_choice', 'true_false', 'multiple_choice'];

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
        ORDER BY qq.order_index ASC, qo.order_index ASC
      `,
      [lessonId, evaluableTypes],
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

    const evaluableQuestions = Array.from(questionsMap.values());
    if (!evaluableQuestions.length) {
      return res.json({
        lessonId,
        bestScore: null,
        lastScore: null,
      });
    }

    const latestAttemptByQuestionRes = await pool.query(
      `
        SELECT DISTINCT ON (qaa.question_id)
          qaa.question_id,
          qa.id AS attempt_id,
          COALESCE(qa.submitted_at, qa.created_at) AS answered_at
        FROM quiz_attempt_answers qaa
        JOIN quiz_attempts qa ON qa.id = qaa.attempt_id
        JOIN quiz_questions qq ON qq.id = qaa.question_id
        WHERE qa.user_id = $1
          AND qa.lesson_id = $2
          AND qa.status = 'submitted'
          AND qq.question_type = ANY($3::text[])
        ORDER BY qaa.question_id, COALESCE(qa.submitted_at, qa.created_at) DESC, qa.id DESC
      `,
      [req.user.id, lessonId, evaluableTypes],
    );

    if (!latestAttemptByQuestionRes.rows.length) {
      return res.json({
        lessonId,
        bestScore: null,
        lastScore: null,
      });
    }

    const latestAttemptIdByQuestionId = new Map();
    const latestAttemptIds = [];
    const latestQuestionIds = [];
    for (const row of latestAttemptByQuestionRes.rows) {
      latestAttemptIdByQuestionId.set(row.question_id, row.attempt_id);
      latestAttemptIds.push(row.attempt_id);
      latestQuestionIds.push(row.question_id);
    }

    const answersRes = await pool.query(
      `
        SELECT
          qaa.question_id,
          qaa.selected_option_id,
          qa.id AS attempt_id
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
      if (!latestAttemptId) continue;
      if (String(latestAttemptId) !== String(row.attempt_id)) continue;

      if (!selectedOptionIdsByQuestionId.has(row.question_id)) {
        selectedOptionIdsByQuestionId.set(row.question_id, []);
      }
      selectedOptionIdsByQuestionId.get(row.question_id).push(row.selected_option_id);
    }

    let totalPoints = 0;
    let earnedPoints = 0;

    for (const question of evaluableQuestions) {
      const points = Number(question.points ?? 1);
      totalPoints += points;

      const selectedRaw = selectedOptionIdsByQuestionId.get(question.questionId) || [];
      const selected = Array.from(new Set(selectedRaw.filter(Boolean)));
      if (!selected.length) {
        continue;
      }

      const correctSet = question.correctOptionIds;
      let isCorrect = false;

      if (question.questionType === 'multiple_choice') {
        isCorrect =
          selected.length === correctSet.size &&
          selected.every((optionId) => correctSet.has(optionId));
      } else {
        isCorrect = selected.length === 1 && correctSet.has(selected[0]);
      }

      if (isCorrect) {
        earnedPoints += points;
      }
    }

    const scorePercent = totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : null;
    return res.json({
      lessonId,
      bestScore: scorePercent,
      lastScore: scorePercent,
    });
  } catch (err) {
    console.error('Failed to fetch quiz score', err);
    return res.status(500).json({ error: 'Failed to fetch quiz score' });
  }
});

module.exports = router;
module.exports.ensureEnrollment = ensureEnrollment;

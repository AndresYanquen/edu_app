const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireGlobalRoleAny } = require('../middleware/roles');
const { quizAttemptSchema, formatZodError } = require('../utils/validators');
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

router.get('/lessons/:id/quiz', requireGlobalRoleAny(['student']), async (req, res) => {
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
      })),
    }));

    return res.json({ lessonId, questions });
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

    if (normalizedAnswers.size !== questionMap.size) {
      return res.status(400).json({ error: 'All questions must be answered' });
    }

    const scoring = computeQuizScore({
      questions: Array.from(questionMap.values()).map((question) => ({
        questionId: question.questionId,
        questionType: question.questionType,
        points: question.points,
        correctOptionIds: Array.from(question.correctOptionIds),
      })),
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
          INSERT INTO quiz_attempts (user_id, lesson_id, attempt_number, status, started_at)
          VALUES ($1, $2, $3, 'draft', now())
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

    const scoreRes = await pool.query(
      `
        SELECT
          MAX(score_percent)::int AS best_score,
          (
            SELECT qa.score_percent::int
            FROM quiz_attempts qa
            WHERE qa.user_id = $1 AND qa.lesson_id = $2
            ORDER BY qa.created_at DESC
            LIMIT 1
          ) AS last_score
        FROM quiz_attempts
        WHERE user_id = $1 AND lesson_id = $2
      `,
      [req.user.id, lessonId],
    );

    const row = scoreRes.rows[0] || {};
    return res.json({
      lessonId,
      bestScore: row.best_score ?? null,
      lastScore: row.last_score ?? null,
    });
  } catch (err) {
    console.error('Failed to fetch quiz score', err);
    return res.status(500).json({ error: 'Failed to fetch quiz score' });
  }
});

module.exports = router;
module.exports.ensureEnrollment = ensureEnrollment;

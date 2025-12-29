const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireGlobalRoleAny } = require('../middleware/roles');
const { quizAttemptSchema, formatZodError } = require('../utils/validators');

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
    let quizReady = true;
    for (const row of quizRes.rows) {
      if (!questionsMap.has(row.question_id)) {
        questionsMap.set(row.question_id, {
          id: row.question_id,
          questionText: row.question_text,
          questionType: row.question_type,
          orderIndex: row.order_index,
          options: [],
          correctCount: 0,
        });
      }
      if (row.option_id) {
        const question = questionsMap.get(row.question_id);
        question.options.push({
          id: row.option_id,
          optionText: row.option_text,
        });
        if (row.is_correct) {
          question.correctCount += 1;
        }
      }
    }

    for (const question of questionsMap.values()) {
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
    }

    if (!quizReady) {
      return res.status(404).json({ error: 'Quiz not ready' });
    }

    return res.json({
      lessonId,
      questions: Array.from(questionsMap.values()).map((question) => ({
        id: question.id,
        questionText: question.questionText,
        questionType: question.questionType,
        orderIndex: question.orderIndex,
        options: question.options,
      })),
    });
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
          qo.id AS option_id,
          qo.is_correct
        FROM quiz_questions qq
        JOIN quiz_options qo ON qo.question_id = qq.id
        WHERE qq.lesson_id = $1
      `,
      [lessonId],
    );

    if (!quizRes.rows.length) {
      return res.status(400).json({ error: 'Quiz not available for this lesson' });
    }

    const questionMap = new Map();
    for (const row of quizRes.rows) {
      if (!questionMap.has(row.question_id)) {
        questionMap.set(row.question_id, {
          questionId: row.question_id,
          options: [],
        });
      }
      questionMap.get(row.question_id).options.push({
        optionId: row.option_id,
        isCorrect: row.is_correct,
      });
    }

    const providedAnswers = new Map();
    for (const answer of answers) {
      if (!questionMap.has(answer.questionId)) {
        return res.status(400).json({ error: 'Answer references invalid question' });
      }
      if (providedAnswers.has(answer.questionId)) {
        return res.status(400).json({ error: 'Duplicate answer for a question' });
      }
      providedAnswers.set(answer.questionId, answer.optionId);
    }

    if (providedAnswers.size !== questionMap.size) {
      return res.status(400).json({ error: 'All questions must be answered' });
    }

    let correctCount = 0;
    questionMap.forEach((question) => {
      const selectedOptionId = providedAnswers.get(question.questionId);
      const option = question.options.find((opt) => opt.optionId === selectedOptionId);
      if (!option) {
        throw new Error('Answer option does not belong to question');
      }
      if (option.isCorrect) {
        correctCount += 1;
      }
    });

    const totalQuestions = questionMap.size;
    const scorePercent = Math.round((correctCount / totalQuestions) * 100);
    const passed = scorePercent >= 70;

    await pool.query(
      `
        INSERT INTO quiz_attempts (user_id, lesson_id, score_percent)
        VALUES ($1, $2, $3)
      `,
      [req.user.id, lessonId, scorePercent],
    );

    if (passed) {
      await pool.query(
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

    return res.json({ scorePercent, passed });
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

require('dotenv').config();
const assert = require('assert');
const pool = require('../src/db');
const { computeQuizScore } = require('../src/utils/quizScoring');
const { ensureEnrollment } = require('../src/routes/quizzes');

const run = async () => {
  console.log('Running quiz scoring verification...');

  const singleQuestion = [
    {
      questionId: 'single-1',
      questionType: 'single_choice',
      points: 5,
      correctOptionIds: ['option-a'],
    },
  ];
  const singleAnswer = new Map([
    ['single-1', { optionId: 'option-a' }],
  ]);
  const singleResult = computeQuizScore({ questions: singleQuestion, answers: singleAnswer });
  assert.strictEqual(singleResult.earnedPoints, 5, 'Single choice score should award full points');
  assert(singleResult.questionResults[0].correct, 'Single choice answer should be flagged as correct');

  const multiQuestion = [
    {
      questionId: 'multi-1',
      questionType: 'multiple_choice',
      points: 10,
      correctOptionIds: ['option-x', 'option-y'],
    },
  ];
  const multiAnswer = new Map([
    ['multi-1', { optionIds: ['option-x', 'option-y'] }],
  ]);
  const multiResult = computeQuizScore({ questions: multiQuestion, answers: multiAnswer });
  assert.strictEqual(multiResult.earnedPoints, 10, 'Multiple choice should award full points when matches');
  assert(multiResult.questionResults[0].correct, 'Multiple choice set should be marked correct');

  const passedPercent = multiResult.totalPoints
    ? Math.round((multiResult.earnedPoints / multiResult.totalPoints) * 100)
    : 0;
  assert(passedPercent >= 70, 'Passed scenario should exceed threshold for lesson_progress');
  console.log('Scoring checks passed (single-choice, multiple-choice, passing flag).');

  const randomEnrollment = await ensureEnrollment(
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
  );
  if (!randomEnrollment) {
    console.log('Enrollment guard check: non-enrolled user will receive 403 as expected.');
  } else {
    console.warn('Unexpected enrollment for random IDs, verify your database state.');
  }

  await pool.end();
  console.log('Quiz verification script completed.');
};

run().catch((err) => {
  console.error('Quiz verification script failed', err);
  process.exit(1);
});

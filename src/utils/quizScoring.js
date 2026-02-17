const normalizeCorrectSet = (value) => {
  if (!value) {
    return new Set();
  }
  if (value instanceof Set) {
    return value;
  }
  if (Array.isArray(value)) {
    return new Set(value);
  }
  return new Set();
};

const computeQuizScore = ({ questions, answers }) => {
  let totalPoints = 0;
  let earnedPoints = 0;
  const questionResults = [];

  for (const question of questions) {
    const questionId = question.questionId || question.id;
    const points = Number(question.points ?? 0);
    totalPoints += points;

    const answer = answers.get(questionId);
    if (!answer) {
      throw new Error(`Missing answer for question ${questionId}`);
    }

    const correctSet = normalizeCorrectSet(question.correctOptionIds || question.correctOptions);
    const result = {
      questionId,
      questionType: question.questionType,
      points,
      selectedOptionIds: [],
      pointsAwarded: 0,
      correct: false,
    };

    if (question.questionType === 'multiple_choice') {
      if (!answer.optionIds || !answer.optionIds.length) {
        throw new Error(`Multiple choice question ${questionId} must include optionIds`);
      }
      const uniqueIds = Array.from(new Set(answer.optionIds));
      result.selectedOptionIds = uniqueIds;
      if (
        uniqueIds.length === correctSet.size &&
        uniqueIds.every((optionId) => correctSet.has(optionId))
      ) {
        result.pointsAwarded = points;
        result.correct = true;
      }
    } else {
      if (!answer.optionId) {
        throw new Error(`Question ${questionId} requires an optionId`);
      }
      result.selectedOptionIds = [answer.optionId];
      if (correctSet.has(answer.optionId)) {
        result.pointsAwarded = points;
        result.correct = true;
      }
    }

    earnedPoints += result.pointsAwarded;
    questionResults.push(result);
  }

  return { totalPoints, earnedPoints, questionResults };
};

module.exports = {
  computeQuizScore,
};

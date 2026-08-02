const groqClient = require('../utils/groqClient');
const logger = require('../utils/logger');
const { wrapUntrusted, detectInjection, validateGraderOutput } = require('../utils/sanitize');
const { getEvaluatorPrompt } = require('./prompts');

const SYSTEM_PROMPT = getEvaluatorPrompt();

/**
 * Evaluate a single question answer against rubric criteria.
 * @param {object} question - Rubric question object
 * @param {string|null} answerText - Student's answer
 * @returns {object} Evaluation result for this question
 */
async function evaluateQuestion(question, answerText) {
  const { questionNumber, questionText, maxMarks, keyPoints, gradingCriteria } = question;

  logger.debug(`Evaluating ${questionNumber}...`);

  // Prompt-injection defense: scan the untrusted answer for jailbreak patterns.
  const injection = detectInjection(answerText);
  if (injection.suspicious) {
    logger.warn(`Possible prompt-injection in answer for ${questionNumber}`, {
      matches: injection.matches,
    });
  }

  const userMessage = `Question: ${questionText}
Max marks: ${maxMarks}
Grading criteria: ${gradingCriteria}
Key points expected: ${Array.isArray(keyPoints) ? keyPoints.join(', ') : keyPoints}

${wrapUntrusted(answerText, 'STUDENT_ANSWER')}`;

  const result = await groqClient.groqJsonCall({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    label: `evaluator-${questionNumber}`,
  });

  // Validate + clamp the model output (defends against hallucinated/injected scores).
  const validated = validateGraderOutput(result, maxMarks);

  // If the answer looked like an injection attempt, never trust the score —
  // force confidence below the review threshold so a human verifies it.
  const confidence = injection.suspicious
    ? Math.min(validated.confidence, 0.3)
    : validated.confidence;

  return {
    questionNumber,
    questionText,
    studentAnswer: answerText || '',
    score: validated.score,
    maxScore: validated.maxScore,
    feedback: validated.feedback,
    strengths: validated.strengths,
    mistakes: validated.mistakes,
    confidence,
    injectionFlagged: injection.suspicious,
  };
}

/**
 * Evaluate all questions with max 5 concurrent Groq calls.
 * @param {Array} rubricQuestions - Parsed rubric questions
 * @param {Map} answersMap - Map of questionNumber -> answerText
 * @returns {Array} All evaluation results
 */
async function evaluateAllQuestions(rubricQuestions, answersMap) {
  const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_GROQ_CALLS || '5', 10);
  const results = [];

  // Process in batches of MAX_CONCURRENT
  for (let i = 0; i < rubricQuestions.length; i += MAX_CONCURRENT) {
    const batch = rubricQuestions.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(
      batch.map((q) => evaluateQuestion(q, answersMap.get(q.questionNumber) || null))
    );
    results.push(...batchResults);
    logger.info(
      `Evaluated batch ${Math.floor(i / MAX_CONCURRENT) + 1}: questions ${i + 1}–${i + batch.length}`
    );
  }

  return results;
}

module.exports = { evaluateQuestion, evaluateAllQuestions };

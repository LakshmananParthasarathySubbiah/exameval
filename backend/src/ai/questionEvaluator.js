const { groqJsonCall } = require('../utils/groqClient');
const logger = require('../utils/logger');

const SYSTEM_PROMPT = `You are a strict, fair university exam evaluator.
You must evaluate a student's answer against the provided rubric.

Rules:
- Be objective and consistent. Do not infer intent — only evaluate what is written.
- Partial credit is allowed. Award marks proportionally for partially correct answers.
- A blank or null answer receives 0 marks.
- Confidence reflects how clearly the student's answer maps to the rubric (1.0 = unambiguous, 0.0 = cannot determine correctness).
- Return ONLY valid JSON. No markdown, no explanation, no backticks.

Required output shape:
{
  "score": <integer, 0 to maxMarks>,
  "maxScore": <same as maxMarks>,
  "feedback": "<2–4 sentences explaining the mark awarded>",
  "strengths": ["<what the student did well>"],
  "mistakes": ["<what was wrong or missing>"],
  "confidence": <float 0.0–1.0>
}`;

/**
 * Evaluate a single question answer against rubric criteria.
 * @param {object} question - Rubric question object
 * @param {string|null} answerText - Student's answer
 * @returns {object} Evaluation result for this question
 */
async function evaluateQuestion(question, answerText) {
  const { questionNumber, questionText, maxMarks, keyPoints, gradingCriteria } = question;

  logger.debug(`Evaluating ${questionNumber}...`);

  const userMessage = `Question: ${questionText}
Max marks: ${maxMarks}
Grading criteria: ${gradingCriteria}
Key points expected: ${Array.isArray(keyPoints) ? keyPoints.join(', ') : keyPoints}

Student's answer:
${answerText || 'No answer provided'}`;

  const result = await groqJsonCall({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    label: `evaluator-${questionNumber}`,
  });

  // Validate and clamp score
  const score = Math.min(Math.max(Number(result.score) || 0, 0), maxMarks);
  const confidence = Math.min(Math.max(Number(result.confidence) || 0, 0), 1);

  return {
    questionNumber,
    questionText,
    studentAnswer: answerText || '',
    score,
    maxScore: maxMarks,
    feedback: result.feedback || '',
    strengths: Array.isArray(result.strengths) ? result.strengths : [],
    mistakes: Array.isArray(result.mistakes) ? result.mistakes : [],
    confidence,
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
    logger.info(`Evaluated batch ${Math.floor(i / MAX_CONCURRENT) + 1}: questions ${i + 1}–${i + batch.length}`);
  }

  return results;
}

module.exports = { evaluateQuestion, evaluateAllQuestions };

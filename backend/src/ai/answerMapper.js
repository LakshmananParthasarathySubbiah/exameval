const { groqJsonCall } = require('../utils/groqClient');
const logger = require('../utils/logger');

const SYSTEM_PROMPT = `You are a university exam answer sheet parser. Given the raw text extracted from a student's answer sheet, identify and separate each answer by question number.
Return ONLY valid JSON. No markdown, no explanation.
Shape:
[{ "questionNumber": "Q1", "answerText": "..." }]
If you cannot identify an answer for a question, use answerText: null.`;

/**
 * Map student script text to per-question answers.
 * @param {string} extractedText - Raw text from student script
 * @returns {Array} Array of { questionNumber, answerText }
 */
async function mapAnswers(extractedText) {
  logger.info('Mapping student answers with Groq...');

  const mapped = await groqJsonCall({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: extractedText,
    label: 'answerMapper',
  });

  if (!Array.isArray(mapped)) {
    throw new Error('Answer mapper returned non-array response');
  }

  logger.info(`Answers mapped: ${mapped.length} question answers identified`);
  return mapped;
}

/**
 * Find answer for a specific question number.
 * @param {Array} mappedAnswers
 * @param {string} questionNumber
 * @returns {string|null}
 */
function findAnswer(mappedAnswers, questionNumber) {
  const entry = mappedAnswers.find(
    (a) => a.questionNumber?.toLowerCase() === questionNumber?.toLowerCase()
  );
  return entry?.answerText || null;
}

module.exports = { mapAnswers, findAnswer };

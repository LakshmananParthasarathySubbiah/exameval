const { groqJsonCall } = require('../utils/groqClient');
const logger = require('../utils/logger');

const SYSTEM_PROMPT = `You are an expert academic rubric parser. Your job is to extract structured question data from a university exam rubric PDF.
Return ONLY a valid JSON array. No explanation, no markdown, no backticks. Each element must match this exact shape:
{
  "questionNumber": "Q1",
  "questionText": "Full question as written",
  "maxMarks": <integer>,
  "keyPoints": ["key concept 1", "key concept 2"],
  "gradingCriteria": "How marks are awarded — what constitutes full, partial, and zero credit"
}`;

/**
 * Parse rubric text into structured JSON using Groq.
 * @param {string} rubricText - Raw rubric text
 * @returns {Array} Parsed rubric questions
 */
async function parseRubric(rubricText) {
  logger.info('Parsing rubric with Groq...');

  const parsed = await groqJsonCall({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Parse the following exam rubric:\n\n${rubricText}`,
    label: 'rubricParser',
  });

  if (!Array.isArray(parsed)) {
    throw new Error('Rubric parser returned non-array response');
  }

  // Validate structure
  for (const q of parsed) {
    if (!q.questionNumber || !q.questionText || typeof q.maxMarks !== 'number') {
      throw new Error(`Invalid rubric item: ${JSON.stringify(q)}`);
    }
  }

  logger.info(`Rubric parsed: ${parsed.length} questions found`);
  return parsed;
}

module.exports = { parseRubric };

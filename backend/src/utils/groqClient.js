const Groq = require('groq-sdk');
const logger = require('./logger');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = 'llama-3.3-70b-versatile';
const TEMPERATURE = 0;

/**
 * Call Groq with automatic JSON retry on parse failure.
 * Returns parsed JSON object.
 */
async function groqJsonCall({ systemPrompt, userMessage, label = 'groq' }) {
  const makeCall = async (messages) => {
    const response = await groq.chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: 4096,
      messages,
    });

    const usage = response.usage;
    logger.info(`[${label}] tokens — prompt: ${usage?.prompt_tokens}, completion: ${usage?.completion_tokens}, total: ${usage?.total_tokens}`);

    return response.choices[0]?.message?.content || '';
  };

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  let raw = '';
  try {
    raw = await makeCall(messages);
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
    return JSON.parse(cleaned);
  } catch (firstError) {
    logger.warn(`[${label}] JSON parse failed on first attempt, retrying...`, { raw: raw.substring(0, 200) });

    // Retry with explicit JSON fix instruction
    const retryMessages = [
      ...messages,
      { role: 'assistant', content: raw },
      { role: 'user', content: 'The JSON you returned is invalid. Fix it and return ONLY valid JSON, no markdown, no backticks, no explanation.' },
    ];

    try {
      const retryRaw = await makeCall(retryMessages);
      const cleaned = retryRaw.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
      return JSON.parse(cleaned);
    } catch (secondError) {
      logger.error(`[${label}] JSON parse failed on retry`, { error: secondError.message });
      throw new Error(`Groq response could not be parsed as JSON after retry: ${secondError.message}`);
    }
  }
}

module.exports = { groq, groqJsonCall, MODEL };

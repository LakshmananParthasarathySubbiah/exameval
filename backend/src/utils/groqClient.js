const Groq = require('groq-sdk');
const logger = require('./logger');
const { llmTokensTotal } = require('./metrics');
const { loadConfig } = require('../config');
const config = loadConfig({ throwOnMissing: false });

const MODEL = config.llm.groq.textModel;
const TEMPERATURE = 0;

// Lazily instantiate the client so importing this module never throws on a
// missing API key (e.g. in unit tests) and the SDK is only created when needed.
let _client = null;
function getClient() {
  if (!_client) {
    _client = new Groq({ apiKey: config.llm.groq.apiKey });
  }
  return _client;
}

function getPrimaryProvider() {
  return config.llm.primaryProvider;
}

async function executeGroqJsonCall({ systemPrompt, userMessage, label }) {
  const makeCall = async (messages) => {
    const response = await getClient().chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: 4096,
      messages,
    });

    const usage = response.usage;
    logger.info(
      `[${label}] tokens — prompt: ${usage?.prompt_tokens}, completion: ${usage?.completion_tokens}, total: ${usage?.total_tokens}`
    );
    if (usage?.total_tokens) llmTokensTotal.inc({ label }, usage.total_tokens);

    return response.choices[0]?.message?.content || '';
  };

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  let raw = '';
  try {
    raw = await makeCall(messages);
    const cleaned = raw
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim();
    return JSON.parse(cleaned);
  } catch (firstError) {
    logger.warn(`[${label}] JSON parse failed on first attempt, retrying...`, {
      raw: raw.substring(0, 200),
    });

    const retryMessages = [
      ...messages,
      { role: 'assistant', content: raw },
      {
        role: 'user',
        content:
          'The JSON you returned is invalid. Fix it and return ONLY valid JSON, no markdown, no backticks, no explanation.',
      },
    ];

    try {
      const retryRaw = await makeCall(retryMessages);
      const cleaned = retryRaw
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/gi, '')
        .trim();
      return JSON.parse(cleaned);
    } catch (secondError) {
      logger.error(`[${label}] JSON parse failed on retry`, { error: secondError.message });
      throw new Error(
        `Groq response could not be parsed as JSON after retry: ${secondError.message}`
      );
    }
  }
}

async function executeGroqTextCall({ systemPrompt, userMessage, label, maxTokens }) {
  const response = await getClient().chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });
  const usage = response.usage;
  logger.info(`[${label}] tokens — total: ${usage?.total_tokens}`);
  if (usage?.total_tokens) llmTokensTotal.inc({ label }, usage.total_tokens);
  return response.choices[0]?.message?.content || '';
}

/**
 * Call the configured primary LLM with automatic fallback.
 * Returns parsed JSON object.
 */
async function groqJsonCall({ systemPrompt, userMessage, label = 'groq' }) {
  const provider = getPrimaryProvider();

  if (provider === 'gemini') {
    try {
      const { geminiJsonCall } = require('./geminiClient');
      return await geminiJsonCall({ systemPrompt, userMessage, label });
    } catch (err) {
      const hasGroq = !!config.llm.groq.apiKey;
      if (hasGroq) {
        logger.warn(`[${label}] Gemini call failed, falling back to Groq... error: ${err.message}`);
        return await executeGroqJsonCall({ systemPrompt, userMessage, label });
      }
      throw err;
    }
  } else {
    try {
      return await executeGroqJsonCall({ systemPrompt, userMessage, label });
    } catch (err) {
      const { geminiAvailable, geminiJsonCall } = require('./geminiClient');
      if (geminiAvailable()) {
        logger.warn(`[${label}] Groq call failed, falling back to Gemini... error: ${err.message}`);
        return await geminiJsonCall({ systemPrompt, userMessage, label });
      }
      throw err;
    }
  }
}

/**
 * Plain-text LLM call with automatic fallback.
 */
async function groqTextCall({ systemPrompt, userMessage, label = 'groq-text', maxTokens = 1024 }) {
  const provider = getPrimaryProvider();

  if (provider === 'gemini') {
    try {
      const { geminiTextCall } = require('./geminiClient');
      return await geminiTextCall({ systemPrompt, userMessage, label });
    } catch (err) {
      const hasGroq = !!config.llm.groq.apiKey;
      if (hasGroq) {
        logger.warn(`[${label}] Gemini text call failed, falling back to Groq... error: ${err.message}`);
        return await executeGroqTextCall({ systemPrompt, userMessage, label, maxTokens });
      }
      throw err;
    }
  } else {
    try {
      return await executeGroqTextCall({ systemPrompt, userMessage, label, maxTokens });
    } catch (err) {
      const { geminiAvailable, geminiTextCall } = require('./geminiClient');
      if (geminiAvailable()) {
        logger.warn(`[${label}] Groq text call failed, falling back to Gemini... error: ${err.message}`);
        return await geminiTextCall({ systemPrompt, userMessage, label });
      }
      throw err;
    }
  }
}

/**
 * Vision Groq call (multimodal) — used for OCR of handwritten/scanned answers.
 * Requires GROQ_VISION_MODEL to be set to a vision-capable model id.
 */
async function groqVisionCall({
  imagesBase64 = [],
  prompt,
  label = 'vision',
  model = config.llm.groq.visionModel,
  maxTokens = 2048,
}) {
  if (!model) throw new Error('GROQ_VISION_MODEL is not configured');
  const content = [{ type: 'text', text: prompt }];
  for (const b64 of imagesBase64) {
    content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } });
  }

  let attempts = 0;
  const maxAttempts = 3;
  let delay = 1000;

  while (attempts < maxAttempts) {
    try {
      const response = await getClient().chat.completions.create({
        model,
        temperature: 0,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content }],
      });
      const usage = response.usage;
      logger.info(`[${label}] tokens — total: ${usage?.total_tokens}`);
      if (usage?.total_tokens) llmTokensTotal.inc({ label }, usage.total_tokens);
      return response.choices[0]?.message?.content || '';
    } catch (err) {
      attempts++;
      if (attempts >= maxAttempts) {
        throw err;
      }
      const is429 = err.status === 429 || /429|rate limit/i.test(err.message);
      const sleepTime = is429 ? delay * 2 : delay;
      logger.warn(
        `Groq Vision API call failed (attempt ${attempts}/${maxAttempts}), retrying in ${sleepTime}ms... error: ${err.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
      delay *= 2;
    }
  }
}

/**
 * Tool-calling Groq call for the agentic assistant. Returns the raw assistant
 * message (which may contain `tool_calls`). The caller runs the tools and calls
 * again with the results until the model produces a final answer.
 */
async function groqToolCall({ messages, tools, label = 'agent', toolChoice = 'auto' }) {
  const response = await getClient().chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 1024,
    messages,
    tools,
    tool_choice: toolChoice,
  });
  const usage = response.usage;
  logger.info(`[${label}] tokens — total: ${usage?.total_tokens}`);
  if (usage?.total_tokens) llmTokensTotal.inc({ label }, usage.total_tokens);
  return response.choices[0]?.message || { content: '' };
}

module.exports = { getClient, groqJsonCall, groqTextCall, groqToolCall, groqVisionCall, MODEL };

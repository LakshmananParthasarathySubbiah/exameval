/**
 * Google Gemini (Google AI Studio) client for vision OCR.
 *
 * Uses the AI Studio REST API directly (no SDK dependency) via global fetch.
 * Gemini reads images AND PDFs natively, and is strong on handwriting — ideal
 * for transcribing scanned/handwritten answer scripts. Get a free key at
 * https://aistudio.google.com/app/apikey and set GEMINI_API_KEY.
 */
const logger = require('./logger');
const { llmTokensTotal } = require('./metrics');
const { loadConfig } = require('../config');
const config = loadConfig({ throwOnMissing: false });

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

async function fetchWithTimeout(url, options = {}, timeout = 45000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw err;
  }
}

/**
 * Send one file (image or PDF) + a prompt to Gemini and return the text.
 * @param {{ data:string, mimeType:string, prompt:string, model?:string, label?:string }} opts
 *   data = base64 file contents.
 */
async function geminiVisionCall({
  data,
  mimeType,
  prompt,
  model = config.llm.gemini.visionModel,
  label = 'gemini-vision',
}) {
  const apiKey = config.llm.gemini.apiKey;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const url = `${ENDPOINT}/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data } }],
      },
    ],
    generationConfig: { temperature: 0 },
  };

  let attempts = 0;
  const maxAttempts = 3;
  let delay = 1000;

  while (attempts < maxAttempts) {
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        throw new Error('RATE_LIMIT_429');
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 300)}`);
      }

      const json = await res.json();
      const text =
        json?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text)
          .filter(Boolean)
          .join('') || '';

      const used = json?.usageMetadata?.totalTokenCount;
      logger.info(`[${label}] tokens — total: ${used}`);
      if (used) llmTokensTotal.inc({ label }, used);

      return text;
    } catch (err) {
      attempts++;
      if (attempts >= maxAttempts) {
        throw err;
      }
      const sleepTime = err.message === 'RATE_LIMIT_429' ? delay * 2 : delay;
      logger.warn(
        `Gemini API call failed (attempt ${attempts}/${maxAttempts}), retrying in ${sleepTime}ms... error: ${err.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
      delay *= 2;
    }
  }
}

function geminiAvailable() {
  return !!process.env.GEMINI_API_KEY;
}

async function geminiJsonCall({
  systemPrompt,
  userMessage,
  model = config.llm.gemini.textModel,
  label = 'gemini-json',
}) {
  const apiKey = config.llm.gemini.apiKey;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const url = `${ENDPOINT}/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage }],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
    },
  };

  if (systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  let attempts = 0;
  const maxAttempts = 3;
  let delay = 1000;

  while (attempts < maxAttempts) {
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        throw new Error('RATE_LIMIT_429');
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 300)}`);
      }

      const json = await res.json();
      const rawText =
        json?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text)
          .filter(Boolean)
          .join('') || '';

      const used = json?.usageMetadata?.totalTokenCount;
      logger.info(`[${label}] tokens — total: ${used}`);
      if (used) llmTokensTotal.inc({ label }, used);

      const cleaned = rawText
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/gi, '')
        .trim();

      return JSON.parse(cleaned);
    } catch (err) {
      attempts++;
      if (attempts >= maxAttempts) {
        throw err;
      }
      const sleepTime = err.message === 'RATE_LIMIT_429' ? delay * 2 : delay;
      logger.warn(
        `Gemini JSON call failed (attempt ${attempts}/${maxAttempts}), retrying in ${sleepTime}ms... error: ${err.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
      delay *= 2;
    }
  }
}

async function geminiTextCall({
  systemPrompt,
  userMessage,
  model = config.llm.gemini.textModel,
  label = 'gemini-text',
  temperature = 0.2,
}) {
  const apiKey = config.llm.gemini.apiKey;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const url = `${ENDPOINT}/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage }],
      },
    ],
    generationConfig: {
      temperature,
    },
  };

  if (systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  let attempts = 0;
  const maxAttempts = 3;
  let delay = 1000;

  while (attempts < maxAttempts) {
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        throw new Error('RATE_LIMIT_429');
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 300)}`);
      }

      const json = await res.json();
      const text =
        json?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text)
          .filter(Boolean)
          .join('') || '';

      const used = json?.usageMetadata?.totalTokenCount;
      logger.info(`[${label}] tokens — total: ${used}`);
      if (used) llmTokensTotal.inc({ label }, used);

      return text;
    } catch (err) {
      attempts++;
      if (attempts >= maxAttempts) {
        throw err;
      }
      const sleepTime = err.message === 'RATE_LIMIT_429' ? delay * 2 : delay;
      logger.warn(
        `Gemini Text call failed (attempt ${attempts}/${maxAttempts}), retrying in ${sleepTime}ms... error: ${err.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
      delay *= 2;
    }
  }
}

module.exports = { geminiVisionCall, geminiAvailable, geminiJsonCall, geminiTextCall };

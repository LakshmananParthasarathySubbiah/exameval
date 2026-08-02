/**
 * Vision-model OCR for handwritten / scanned answer scripts.
 *
 * Provider routing (first available wins):
 *   1. Gemini (Google AI Studio) — set GEMINI_API_KEY. Reads images AND PDFs
 *      natively; best for handwriting. Preferred.
 *   2. Groq vision — set GROQ_API_KEY + GROQ_VISION_MODEL. PDFs are rendered to
 *      page images first (pdf-to-img), then transcribed.
 * If neither is configured, the caller falls back to Tesseract OCR.
 */
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const groqClient = require('./groqClient');
const { geminiVisionCall, geminiAvailable } = require('./geminiClient');

const OCR_PROMPT =
  'You are an OCR engine for exam answer sheets. Transcribe ALL text in this document verbatim, ' +
  'preserving question numbers, math, and line breaks. Output ONLY the transcribed text — no commentary.';

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

/** Which vision provider is configured, if any. */
function provider() {
  if (geminiAvailable()) return 'gemini';
  if (process.env.GROQ_API_KEY && process.env.GROQ_VISION_MODEL) return 'groq';
  return null;
}

/** True when any vision OCR provider is available. */
function visionAvailable() {
  return provider() !== null;
}

async function ocrWithGemini(localPath, isImage) {
  const ext = path.extname(localPath).toLowerCase();
  const mimeType = isImage ? MIME[ext] || 'image/png' : 'application/pdf';
  const data = fs.readFileSync(localPath).toString('base64');
  const text = await geminiVisionCall({ data, mimeType, prompt: OCR_PROMPT });
  return (text || '').trim();
}

async function ocrImageBufferGroq(buf) {
  const b64 = Buffer.from(buf).toString('base64');
  return groqClient.groqVisionCall({
    imagesBase64: [b64],
    prompt: OCR_PROMPT,
    label: 'vision-ocr',
  });
}

/** Render each PDF page to an image and OCR it with Groq; join page texts. */
async function ocrPdfGroq(localPath, { maxPages = 20 } = {}) {
  const { pdf } = await import('pdf-to-img'); // ESM-only → dynamic import from CJS
  const document = await pdf(localPath, { scale: 2 });
  const texts = [];
  let page = 0;
  for await (const image of document) {
    page += 1;
    if (page > maxPages) break;
    try {
      const b64 = Buffer.from(image).toString('base64');
      const text = await groqClient.groqVisionCall({
        imagesBase64: [b64],
        prompt: OCR_PROMPT,
        label: `vision-ocr-p${page}`,
      });
      if (text) texts.push(text);
    } catch (err) {
      logger.warn(`Groq vision OCR failed on page ${page}: ${err.message}`);
    }
  }
  return texts.join('\n\n').trim();
}

/** OCR a local file (image or pdf) using a cascading fallback of providers. */
async function ocrFile(localPath, isImage) {
  const errors = [];

  if (geminiAvailable()) {
    try {
      logger.info('Trying Gemini Vision OCR...');
      const text = await ocrWithGemini(localPath, isImage);
      if (text && text.trim().length) {
        return { text: text.trim(), provider: 'gemini' };
      }
    } catch (err) {
      logger.warn(`Gemini Vision OCR failed: ${err.message}`);
      errors.push(`Gemini: ${err.message}`);
    }
  }

  const groqConfigured = !!(process.env.GROQ_API_KEY && process.env.GROQ_VISION_MODEL);
  if (groqConfigured) {
    try {
      logger.info('Trying Groq Vision OCR...');
      let text;
      if (isImage) {
        text = await ocrImageBufferGroq(fs.readFileSync(localPath));
      } else {
        text = await ocrPdfGroq(localPath);
      }
      if (text && text.trim().length) {
        return { text: text.trim(), provider: 'groq' };
      }
    } catch (err) {
      logger.warn(`Groq Vision OCR failed: ${err.message}`);
      errors.push(`Groq: ${err.message}`);
    }
  }

  if (errors.length) {
    throw new Error(`All vision providers failed: ${errors.join('; ')}`);
  }
  throw new Error('No vision provider configured');
}

module.exports = { visionAvailable, provider, ocrFile, OCR_PROMPT };

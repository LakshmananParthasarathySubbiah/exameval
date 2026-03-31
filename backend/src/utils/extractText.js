const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Extract text from a PDF file.
 * Falls back to Tesseract OCR if pdf-parse yields < 100 characters.
 *
 * @param {string} filePath - Absolute path to the PDF file
 * @returns {{ text: string, ocrUsed: boolean }}
 */
async function extractText(filePath) {
  logger.info(`Extracting text from: ${filePath}`);

  // Attempt pdf-parse first
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    const text = (data.text || '').trim();

    if (text.length >= 100) {
      logger.info(`pdf-parse succeeded, ${text.length} chars extracted`);
      return { text, ocrUsed: false };
    }

    logger.info(`pdf-parse returned only ${text.length} chars — falling back to OCR`);
  } catch (err) {
    logger.warn(`pdf-parse failed: ${err.message} — falling back to OCR`);
  }

  // OCR fallback using tesseract.js
  try {
    logger.info('Running Tesseract OCR...');
    const { data } = await Tesseract.recognize(filePath, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          logger.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    const ocrText = (data.text || '').trim();
    logger.info(`Tesseract OCR completed, ${ocrText.length} chars extracted`);
    return { text: ocrText, ocrUsed: true };
  } catch (ocrErr) {
    logger.error(`Tesseract OCR failed: ${ocrErr.message}`);
    throw new Error(`Text extraction failed: ${ocrErr.message}`);
  }
}

module.exports = { extractText };

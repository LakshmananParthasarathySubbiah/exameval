const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');
const os = require('os');
const logger = require('./logger');
const { visionAvailable, provider, ocrFile } = require('./visionOcr');

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

/** True if the path looks like an image (vs a PDF). Pure + testable. */
function isImagePath(p) {
  return IMAGE_EXTS.includes(path.extname(String(p || '')).toLowerCase());
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function downloadFile(url) {
  const tmpPath = path.join(os.tmpdir(), `exameval_${Date.now()}.pdf`);

  if (url.includes('cloudinary.com')) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const uploadIndex = pathParts.indexOf('upload');

      if (uploadIndex !== -1) {
        let publicIdParts = pathParts.slice(uploadIndex + 1);
        if (publicIdParts[0] && /^v\d+$/.test(publicIdParts[0])) {
          publicIdParts = publicIdParts.slice(1);
        }
        const publicId = publicIdParts.join('/').replace(/\.[^/.]+$/, '');

        logger.info(`Original URL: ${url}`);
        logger.info(`Extracted publicId: ${publicId}`);

        const signedUrl = cloudinary.url(publicId, {
          resource_type: 'raw',
          sign_url: true,
          secure: true,
          type: 'upload',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        });

        logger.info(`Signed URL: ${signedUrl}`);
        url = signedUrl;
      }
    } catch (e) {
      logger.warn(`Could not generate signed URL: ${e.message}`);
    }
  }

  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(tmpPath);

    proto
      .get(url, (res) => {
        logger.info(`Download response status: ${res.statusCode}`);

        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlink(tmpPath, () => {});
          downloadFile(res.headers.location).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(tmpPath, () => {});
          reject(new Error(`Failed to download file: HTTP ${res.statusCode}`));
          return;
        }

        res.pipe(file);

        file.on('finish', () => {
          file.close(() => {
            const stats = fs.statSync(tmpPath);
            if (stats.size === 0) {
              reject(new Error('Downloaded file is empty'));
              return;
            }
            logger.info(`Downloaded ${stats.size} bytes to ${tmpPath}`);
            resolve(tmpPath);
          });
        });

        file.on('error', (err) => {
          fs.unlink(tmpPath, () => {});
          reject(err);
        });

        res.on('error', (err) => {
          fs.unlink(tmpPath, () => {});
          reject(err);
        });
      })
      .on('error', (err) => {
        fs.unlink(tmpPath, () => {});
        reject(err);
      });
  });
}

async function extractText(filePath) {
  logger.info(`Extracting text from: ${filePath}`);

  let localPath = filePath;
  let isTemp = false;

  if (filePath.startsWith('http')) {
    // If it's a local static resource fallback, don't download it over HTTP from itself
    if (filePath.includes('/uploads/')) {
      const idx = filePath.indexOf('/uploads/');
      localPath = filePath.substring(idx + 1); // e.g., "uploads/scripts/foo.pdf"
      logger.info(`Local upload file detected, using local path directly: ${localPath}`);
    } else {
      localPath = await downloadFile(filePath);
      isTemp = true;
      logger.info(`Downloaded to temp: ${localPath}`);
    }
  }

  const cleanup = () => {
    if (isTemp)
      try {
        fs.unlinkSync(localPath);
      } catch {
        /* ignore */
      }
  };

  const isImage = isImagePath(localPath);

  // ── Tier 1: digital text (skip for images) ──────────────────────
  if (!isImage) {
    try {
      const buffer = fs.readFileSync(localPath);
      const data = await pdfParse(buffer);
      const text = (data.text || '').trim();
      if (text.length >= 100) {
        logger.info(`pdf-parse succeeded, ${text.length} chars extracted`);
        cleanup();
        return { text, ocrUsed: false, ocrMethod: null };
      }
      logger.info(`pdf-parse returned only ${text.length} chars — handwritten/scanned, using OCR`);
    } catch (err) {
      logger.warn(`pdf-parse failed: ${err.message} — falling back to OCR`);
    }
  }

  // ── Tier 2: vision-model OCR (best for handwriting) ─────────────
  if (visionAvailable()) {
    try {
      logger.info('Running vision-model OCR...');
      const result = await ocrFile(localPath, isImage);
      if (result && result.text && result.text.length) {
        logger.info(`Vision OCR completed via ${result.provider}, ${result.text.length} chars extracted`);
        cleanup();
        return { text: result.text, ocrUsed: true, ocrMethod: result.provider };
      }
      logger.warn('Vision OCR returned empty — falling back to Tesseract');
    } catch (err) {
      logger.warn(`Vision OCR failed: ${err.message} — falling back to Tesseract`);
    }
  }

  // ── Tier 3: Tesseract fallback ──────────────────────────────────
  try {
    logger.info('Running Tesseract OCR...');
    let ocrText = '';
    const { createWorker } = require('tesseract.js');
    const worker = await createWorker('eng');

    if (isImage) {
      const { data } = await worker.recognize(localPath);
      ocrText = (data.text || '').trim();
    } else {
      // PDF file — must render each page to an image before running Tesseract
      logger.info('PDF detected, rendering pages to images for Tesseract OCR...');
      const { pdf } = await import('pdf-to-img');
      const document = await pdf(localPath, { scale: 2 });
      const texts = [];
      let page = 0;
      for await (const image of document) {
        page += 1;
        if (page > 20) break; // Limit to first 20 pages
        logger.info(`Running Tesseract OCR on PDF page ${page}...`);
        const { data } = await worker.recognize(Buffer.from(image));
        if (data.text) {
          texts.push(data.text);
        }
      }
      ocrText = texts.join('\n\n').trim();
    }
    await worker.terminate();
    cleanup();
    logger.info(`Tesseract OCR completed, ${ocrText.length} chars extracted`);
    return { text: ocrText, ocrUsed: true, ocrMethod: 'tesseract' };
  } catch (ocrErr) {
    cleanup();
    logger.error(`Tesseract OCR failed: ${ocrErr.message}`);
    throw new Error(`Text extraction failed: ${ocrErr.message}`);
  }
}

module.exports = { extractText, isImagePath };

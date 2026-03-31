const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');
const os = require('os');
const logger = require('./logger');

async function downloadFile(url) {
  const tmpPath = path.join(os.tmpdir(), `exameval_${Date.now()}.pdf`);
  
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(tmpPath);
    
    proto.get(url, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        downloadFile(res.headers.location).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`Failed to download file: HTTP ${res.statusCode}`));
        return;
      }
      
      res.pipe(file);
      
      file.on('finish', () => {
        file.close(() => {
          // Verify file size
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
    }).on('error', (err) => {
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
    localPath = await downloadFile(filePath);
    isTemp = true;
    logger.info(`Downloaded to temp: ${localPath}`);
  }

  try {
    const buffer = fs.readFileSync(localPath);
    const data = await pdfParse(buffer);
    const text = (data.text || '').trim();

    if (text.length >= 100) {
      logger.info(`pdf-parse succeeded, ${text.length} chars extracted`);
      if (isTemp) try { fs.unlinkSync(localPath); } catch {}
      return { text, ocrUsed: false };
    }
    logger.info(`pdf-parse returned only ${text.length} chars — falling back to OCR`);
  } catch (err) {
    logger.warn(`pdf-parse failed: ${err.message} — falling back to OCR`);
  }

  try {
    logger.info('Running Tesseract OCR...');
    const { data } = await Tesseract.recognize(localPath, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          logger.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    if (isTemp) try { fs.unlinkSync(localPath); } catch {}
    const ocrText = (data.text || '').trim();
    logger.info(`Tesseract OCR completed, ${ocrText.length} chars extracted`);
    return { text: ocrText, ocrUsed: true };
  } catch (ocrErr) {
    if (isTemp) try { fs.unlinkSync(localPath); } catch {}
    logger.error(`Tesseract OCR failed: ${ocrErr.message}`);
    throw new Error(`Text extraction failed: ${ocrErr.message}`);
  }
}

module.exports = { extractText };
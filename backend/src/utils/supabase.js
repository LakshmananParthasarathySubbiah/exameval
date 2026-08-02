const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Lazily create the client so importing this module never throws when SUPABASE_*
// is unset (e.g. unit tests); it's only needed when an upload actually happens.
let _client = null;
function getClient() {
  if (!_client) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('Supabase not configured: set SUPABASE_URL and SUPABASE_SERVICE_KEY');
    }
    _client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return _client;
}

const CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/** Create the bucket if it doesn't exist (idempotent; needs the service_role key). */
async function ensureBucket(folder) {
  try {
    const { error } = await getClient().storage.createBucket(folder, { public: true });
    if (!error) logger.info(`Created Supabase bucket: ${folder}`);
    else if (!/exist/i.test(error.message || ''))
      logger.debug(`ensureBucket(${folder}): ${error.message}`);
  } catch (err) {
    // Don't mask the real upload error if bucket creation isn't permitted.
    logger.debug(`ensureBucket(${folder}) skipped: ${err.message}`);
  }
}

async function uploadToSupabase(filePath, folder = 'scripts') {
  try {
    const fileName = `${Date.now()}_${path.basename(filePath)}`;
    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

    await ensureBucket(folder);

    const { data, error } = await getClient().storage.from(folder).upload(fileName, fileBuffer, {
      contentType,
      upsert: false,
    });

    if (error) {
      // The classic "new row violates row-level security policy" means the bucket
      // has RLS and the key can't insert — almost always the wrong Supabase key.
      if (/row-level security|violates|not authorized/i.test(error.message)) {
        throw new Error(
          `Supabase storage rejected the upload (${error.message}). Ensure the "${folder}" bucket exists and SUPABASE_SERVICE_KEY is the project's service_role secret (not the publishable/anon key).`
        );
      }
      throw new Error(error.message);
    }

    // Get public URL
    const { data: urlData } = getClient().storage.from(folder).getPublicUrl(fileName);

    // Delete local file
    try {
      fs.unlinkSync(filePath);
    } catch {}

    logger.info(`Uploaded to Supabase: ${urlData.publicUrl}`);
    return { url: urlData.publicUrl, path: data.path };
  } catch (err) {
    logger.warn(`Supabase upload failed: ${err.message}. Falling back to local storage fallback.`);
    const port = process.env.PORT || 5000;
    const localFileName = path.basename(filePath);
    const localUrl = `http://localhost:${port}/uploads/${folder}/${localFileName}`;
    logger.info(`Local storage fallback URL generated: ${localUrl}`);
    return { url: localUrl, path: `local_${localFileName}` };
  }
}

async function deleteFromSupabase(filePath, folder = 'scripts') {
  try {
    const { error } = await getClient().storage.from(folder).remove([filePath]);
    if (error) throw new Error(error.message);
    logger.info(`Deleted from Supabase: ${filePath}`);
  } catch (err) {
    logger.warn(`Supabase delete failed: ${err.message}`);
  }
}

module.exports = { uploadToSupabase, deleteFromSupabase };

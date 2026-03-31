const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function uploadToSupabase(filePath, folder = 'scripts') {
  try {
    const fileName = `${Date.now()}_${path.basename(filePath)}`;
    const fileBuffer = fs.readFileSync(filePath);
    const contentType = 'application/pdf';

    const { data, error } = await supabase.storage
      .from(folder)
      .upload(fileName, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (error) throw new Error(error.message);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(folder)
      .getPublicUrl(fileName);

    // Delete local file
    try { fs.unlinkSync(filePath); } catch {}

    logger.info(`Uploaded to Supabase: ${urlData.publicUrl}`);
    return { url: urlData.publicUrl, path: data.path };
  } catch (err) {
    logger.error(`Supabase upload failed: ${err.message}`);
    throw err;
  }
}

async function deleteFromSupabase(filePath, folder = 'scripts') {
  try {
    const { error } = await supabase.storage
      .from(folder)
      .remove([filePath]);
    if (error) throw new Error(error.message);
    logger.info(`Deleted from Supabase: ${filePath}`);
  } catch (err) {
    logger.warn(`Supabase delete failed: ${err.message}`);
  }
}

module.exports = { uploadToSupabase, deleteFromSupabase };
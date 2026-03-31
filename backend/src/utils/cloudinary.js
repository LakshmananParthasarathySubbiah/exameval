const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const logger = require('./logger');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadToCloudinary(filePath, folder = 'exameval') {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'raw',
      use_filename: true,
      unique_filename: true,
    });
    try { fs.unlinkSync(filePath); } catch {}
    logger.info(`Uploaded to Cloudinary: ${result.secure_url}`);
    return { url: result.secure_url, publicId: result.public_id };
  } catch (err) {
    logger.error(`Cloudinary upload failed: ${err.message}`);
    throw err;
  }
}

async function deleteFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    logger.info(`Deleted from Cloudinary: ${publicId}`);
  } catch (err) {
    logger.warn(`Cloudinary delete failed: ${err.message}`);
  }
}

module.exports = { uploadToCloudinary, deleteFromCloudinary };
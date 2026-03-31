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
      access_mode: 'public',
      type: 'upload',
    });
    try { fs.unlinkSync(filePath); } catch {}
    logger.info(`Uploaded to Cloudinary: ${result.secure_url}`);
    return { url: result.secure_url, publicId: result.public_id };
  } catch (err) {
    logger.error(`Cloudinary upload failed: ${err.message}`);
    throw err;
  }
}

async function getSignedUrl(cloudinaryUrl) {
  try {
    const urlObj = new URL(cloudinaryUrl);
    const pathParts = urlObj.pathname.split('/');
    const uploadIndex = pathParts.indexOf('upload');
    if (uploadIndex === -1) return cloudinaryUrl;

    let publicIdParts = pathParts.slice(uploadIndex + 1);
    if (publicIdParts[0] && /^v\d+$/.test(publicIdParts[0])) {
      publicIdParts = publicIdParts.slice(1);
    }
    const publicId = publicIdParts.join('/').replace(/\.[^/.]+$/, '');

    const signed = cloudinary.url(publicId, {
      resource_type: 'raw',
      sign_url: true,
      secure: true,
      type: 'upload',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });

    logger.info(`Generated signed URL for: ${publicId}`);
    return signed;
  } catch (err) {
    logger.warn(`Could not generate signed URL: ${err.message}`);
    return cloudinaryUrl;
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

module.exports = { uploadToCloudinary, deleteFromCloudinary, getSignedUrl };
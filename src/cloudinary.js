const cloudinary = require('cloudinary').v2;

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || null;
const API_KEY = process.env.CLOUDINARY_API_KEY || null;
const API_SECRET = process.env.CLOUDINARY_API_SECRET || null;

let isConfigured = false;

function configure() {
  if (CLOUD_NAME && API_KEY && API_SECRET) {
    cloudinary.config({
      cloud_name: CLOUD_NAME,
      api_key: API_KEY,
      api_secret: API_SECRET,
    });
    isConfigured = true;
    console.log('[CLOUDINARY] Configurado correctamente');
    return true;
  }
  console.log('[CLOUDINARY] No configurado. Usando URLs directas.');
  return false;
}

async function uploadImage(buffer, filename) {
  if (!isConfigured) return null;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'pokemon-bot',
        public_id: filename || `img_${Date.now()}`,
        resource_type: 'image',
        format: 'jpg',
      },
      (error, result) => {
        if (error) {
          console.error('[CLOUDINARY] Error subiendo imagen:', error.message);
          resolve(null);
        } else {
          console.log('[CLOUDINARY] Imagen subida:', result.secure_url);
          resolve(result.secure_url);
        }
      }
    );
    uploadStream.end(buffer);
  });
}

async function uploadVideo(buffer, filename) {
  if (!isConfigured) return null;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'pokemon-bot',
        public_id: filename || `vid_${Date.now()}`,
        resource_type: 'video',
        format: 'mp4',
      },
      (error, result) => {
        if (error) {
          console.error('[CLOUDINARY] Error subiendo video:', error.message);
          resolve(null);
        } else {
          console.log('[CLOUDINARY] Video subido:', result.secure_url);
          resolve(result.secure_url);
        }
      }
    );
    uploadStream.end(buffer);
  });
}

async function uploadFromUrl(url, filename) {
  if (!isConfigured) return null;

  try {
    const isVideo = url.match(/\.(mp4|webm|avi|mov)$/i) || url.includes('video');
    const resourceType = isVideo ? 'video' : 'image';

    const result = await cloudinary.uploader.upload(url, {
      folder: 'pokemon-bot',
      public_id: filename || `media_${Date.now()}`,
      resource_type: resourceType,
    });

    console.log('[CLOUDINARY] Media subida:', result.secure_url);
    return result.secure_url;
  } catch (e) {
    console.error('[CLOUDINARY] Error subiendo desde URL:', e.message);
    return null;
  }
}

function isAvailable() {
  return isConfigured;
}

module.exports = {
  configure,
  uploadImage,
  uploadVideo,
  uploadFromUrl,
  isAvailable,
};

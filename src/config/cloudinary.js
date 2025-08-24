// config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ,
  api_key: process.env.CLOUDINARY_API_KEY ,
  api_secret: process.env.CLOUDINARY_API_SECRET ,
});

// Debug: Check if config is loaded properly
console.log('Cloudinary Config Check:');
console.log('Cloud Name:', cloudinary.config().cloud_name);
console.log('API Key:', cloudinary.config().api_key ? 'Loaded' : 'Missing');
console.log('API Secret:', cloudinary.config().api_secret ? 'Loaded' : 'Missing');

// Test cloudinary connection
const testCloudinaryConnection = async () => {
  try {
    const result = await cloudinary.api.ping();
    console.log('✅ Cloudinary connection successful:', result);
  } catch (error) {
    console.log('❌ Cloudinary connection failed:', error.message);
  }
};

// Call test function
testCloudinaryConnection();

// Memory storage for multer (no file system needed)
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // File type validation
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('শুধুমাত্র image files allowed!'), false);
    }
  }
});

// Helper function to upload to Cloudinary from buffer
const uploadToCloudinary = async (buffer, options = {}) => {
  try {
    // Debug: Check config before upload
    const config = cloudinary.config();
    if (!config.api_key || !config.api_secret || !config.cloud_name) {
      throw new Error('Cloudinary configuration is incomplete');
    }

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: options.folder || 'uploads',
          transformation: [
            { width: 1200, height: 1200, crop: 'limit' },
            { quality: 'auto' }
          ],
          ...options
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      ).end(buffer);
    });
  } catch (error) {
    throw error;
  }
};

module.exports = { cloudinary, upload, uploadToCloudinary };
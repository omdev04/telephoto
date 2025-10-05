/**
 * Error handling middleware and utility functions
 */

/**
 * Custom error class with status code
 */
class ApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validate if the file is an allowed type
 * @param {string} mimetype - The MIME type of the file
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidImageType(mimetype) {
  const validTypes = [
    // Images
    'image/jpeg', 'image/png', 'image/jpg', 'image/gif',
    'image/webp', 'image/bmp', 'image/tiff', 'image/svg+xml',
    // Documents
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    // Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    // Videos
    'video/mp4', 'video/mpeg', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    // Audio
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'
  ];
  return validTypes.includes(mimetype);
}

/**
 * Middleware to validate the uploaded file
 */
function validateImageUpload(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  if (!isValidImageType(req.file.mimetype)) {
    return res.status(400).json({ 
      error: 'Unsupported file type. Allowed: Images, PDFs, Office docs, Videos, Audio, Archives',
      mimetype: req.file.mimetype 
    });
  }

  // Check file size (50MB max for Telegram documents)
  const maxSize = 50 * 1024 * 1024; // 50MB in bytes
  if (req.file.size > maxSize) {
    return res.status(400).json({ error: 'File size exceeds the 50MB limit' });
  }

  next();
}

/**
 * Global error handling middleware for Express
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  console.error('Stack:', err.stack);

  // Handle multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File size exceeds the 50MB limit',
        code: 'FILE_TOO_LARGE'
      });
    }
    return res.status(400).json({ 
      error: err.message,
      code: err.code
    });
  }

  // Handle file filter errors from multer
  if (err.message && err.message.includes('Unsupported file type')) {
    return res.status(400).json({ 
      error: err.message,
      code: 'UNSUPPORTED_FILE_TYPE'
    });
  }

  // Handle Telegram API errors
  if (err.message && err.message.includes('Telegram')) {
    return res.status(502).json({ 
      error: 'Error communicating with Telegram API', 
      details: err.message,
      code: 'TELEGRAM_API_ERROR'
    });
  }

  // Handle custom API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ 
      error: err.message,
      code: 'API_ERROR'
    });
  }

  // Default error handling
  res.status(500).json({ 
    error: 'An unexpected error occurred', 
    details: process.env.NODE_ENV === 'development' ? err.message : 'Please try again later',
    code: 'INTERNAL_SERVER_ERROR'
  });
}

module.exports = {
  ApiError,
  isValidImageType,
  validateImageUpload,
  errorHandler
};
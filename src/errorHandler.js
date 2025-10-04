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
 * Validate if the file is an allowed image type
 * @param {string} mimetype - The MIME type of the file
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidImageType(mimetype) {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  return validTypes.includes(mimetype);
}

/**
 * Middleware to validate the uploaded file
 */
function validateImageUpload(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  if (!isValidImageType(req.file.mimetype)) {
    return res.status(400).json({ error: 'Only JPEG, JPG, and PNG files are allowed' });
  }

  // Check file size (20MB max for Telegram)
  const maxSize = 20 * 1024 * 1024; // 20MB in bytes
  if (req.file.size > maxSize) {
    return res.status(400).json({ error: 'File size exceeds the 20MB limit' });
  }

  next();
}

/**
 * Global error handling middleware for Express
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Handle multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds the limit' });
    }
    return res.status(400).json({ error: err.message });
  }

  // Handle Telegram API errors
  if (err.message && err.message.includes('Telegram')) {
    return res.status(502).json({ 
      error: 'Error communicating with Telegram API', 
      details: err.message 
    });
  }

  // Handle custom API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Default error handling
  res.status(500).json({ 
    error: 'An unexpected error occurred', 
    details: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
}

module.exports = {
  ApiError,
  isValidImageType,
  validateImageUpload,
  errorHandler
};
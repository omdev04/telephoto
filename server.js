require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { v4: uuidv4 } = require('uuid');
const telegramService = require('./src/telegramService');
const imageStore = require('./src/imageStore');
const { validateImageUpload, errorHandler } = require('./src/errorHandler');
const { generateSecureToken, verifySecureToken } = require('./src/securityUtils');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Set up gallery password from environment variables
const GALLERY_PASSWORD = process.env.GALLERY_PASSWORD || 'SecureGallery123!';

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For parsing form data
app.use(express.static('public'));

// Session middleware configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || uuidv4(), // Use env variable or random UUID
  resave: false,
  saveUninitialized: false, // Don't create sessions until something is stored
  cookie: { 
    secure: process.env.NODE_ENV === 'production' && process.env.USE_HTTPS === 'true', // Only use secure cookies in production with HTTPS
    maxAge: 31536000000, // 1 year session (365 days)
    httpOnly: true, // Prevent XSS attacks
    sameSite: 'lax' // CSRF protection
  }
};

// Use MongoDB session store if MONGODB_URI is provided (recommended for production)
if (process.env.MONGODB_URI) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 365 * 24 * 60 * 60, // 1 year in seconds
    autoRemove: 'native' // Let MongoDB handle expired session cleanup
  });
  console.log('Using MongoDB session store');
} else {
  console.warn('Warning: Using default MemoryStore for sessions. This is not recommended for production.');
  console.warn('Set MONGODB_URI environment variable to use a production-ready session store.');
}

app.use(session(sessionConfig));

// Authentication middleware for gallery access
const requireAuth = (req, res, next) => {
  // If user is authenticated, allow access
  if (req.session && req.session.isAuthenticated) {
    return next();
  }
  
  // Check for form submissions, file uploads, and API endpoints
  if (req.xhr || 
      req.path.startsWith('/api/') || 
      req.headers.accept?.includes('application/json') ||
      req.method === 'POST' || 
      req.headers['content-type']?.includes('multipart/form-data')) {
    // For API requests and uploads, return JSON response
    return res.status(401).json({ error: 'Authentication required', requireAuth: true });
  }
  
  // For regular page requests, redirect to login
  return res.redirect('/login.html');
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// File filter for images and documents
const fileFilter = (req, file, cb) => {
  // Accept image files and some common document formats
  const allowedTypes = [
    'image/jpeg',
    'image/png', 
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
    // Allow common document types that might contain images
    'application/pdf',
    'image/svg+xml'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Allowed: JPEG, PNG, GIF, WebP, BMP, TIFF, PDF, SVG'), false);
  }
};

const upload = multer({ 
  storage: storage, 
  fileFilter: fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit (Telegram bot limit)
  }
});

// Routes
// Upload route - protected by auth middleware
app.post('/upload', requireAuth, upload.single('image'), validateImageUpload, async (req, res, next) => {
  try {
    // Upload to Telegram as document to preserve quality
    const result = await telegramService.uploadToTelegram(req.file.path);
    
    // Store image metadata
    const imageId = await imageStore.saveImage({
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      fileId: result.fileId,
      filePath: result.filePath,
      messageId: result.messageId, // Store the message ID for deletion purposes
      cdnUrl: result.cdnUrl,
      isDocument: true // Flag to indicate this is stored as a document
    });

    // Delete the temporary file
    fs.unlinkSync(req.file.path);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      imageId: imageId,
      cdnUrl: `/cdn/${imageId}`
    });
  } catch (error) {
    next(error); // Pass error to error handling middleware
  }
});

// CDN endpoint
app.get('/cdn/:id', async (req, res, next) => {
  try {
    const imageId = req.params.id;
    const size = req.query.size; // Optional size parameter (small, medium, original)
    
    // Use raw=true to get the unsanitized image data with fileId and filePath
    const image = await imageStore.getImageById(imageId, true);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Generate ETag based on image ID and size (if provided)
    const etag = `"${image.id}-${size || 'original'}"`;
    
    // Set comprehensive cache headers
    res.set({
      'Content-Type': image.mimetype,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      'ETag': etag,
      'Last-Modified': new Date(image.createdAt).toUTCString(),
      'Expires': new Date(Date.now() + 31536000000).toUTCString(), // 1 year from now
      'Vary': 'Accept-Encoding'
    });
    
    // Check if the image is cached in the browser
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch && ifNoneMatch === etag) {
      return res.status(304).end(); // Not Modified
    }
    
    // Stream the image from Telegram
    await telegramService.streamImageFromTelegram(image, size, res);
  } catch (error) {
    next(error); // Pass error to error handling middleware
  }
});

// Authentication endpoints
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  
  // Check if password matches
  if (password === GALLERY_PASSWORD) {
    // Set session as authenticated
    req.session.isAuthenticated = true;
    return res.json({ success: true });
  }
  
  // Wrong password
  res.status(401).json({ 
    success: false, 
    message: 'Invalid password'
  });
});

// Check authentication status
app.get('/api/auth-status', (req, res) => {
  res.json({ 
    isAuthenticated: !!(req.session && req.session.isAuthenticated)
  });
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// List images endpoint - protected by auth middleware
app.get('/images', requireAuth, async (req, res, next) => {
  try {
    const images = await imageStore.getAllImages();
    res.json(images);
  } catch (error) {
    next(error); // Pass error to error handling middleware
  }
});

// Get direct Telegram CDN URL (with secure token) - protected by auth middleware
app.get('/direct-cdn/:id/token', requireAuth, async (req, res, next) => {
  try {
    const imageId = req.params.id;
    
    // Get the image data (including sensitive info)
    const image = await imageStore.getImageById(imageId, true);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Generate a secure token with 1 hour validity
    const { token, expiresAt } = generateSecureToken(imageId);
    
    res.json({
      success: true,
      imageId: imageId,
      token: token,
      expiresAt: expiresAt
    });
  } catch (error) {
    next(error);
  }
});

// Access direct Telegram CDN URL (requires valid token)
app.get('/direct-cdn/:id', async (req, res, next) => {
  try {
    const imageId = req.params.id;
    const token = req.query.token;
    
    // Check if token is provided
    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }
    
    // Verify the token
    if (!verifySecureToken(token, imageId)) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    // Get the image data (including sensitive info)
    const image = await imageStore.getImageById(imageId, true);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Return the direct CDN URL (has bot token in it, so we need to be careful)
    res.json({
      success: true,
      imageId: imageId,
      originalName: image.originalName,
      directCdnUrl: image.cdnUrl,
      note: "This URL contains sensitive information. Do not share and use only for direct image embedding."
    });
  } catch (error) {
    next(error);
  }
});

// Delete image endpoint - protected by auth middleware
app.delete('/images/:id', requireAuth, async (req, res, next) => {
  try {
    const imageId = req.params.id;
    
    // Get the image data before deletion (to access fileId)
    const image = await imageStore.getImageById(imageId, true);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Try to delete from Telegram first (if we have messageId)
    // Note: In a real app, you'd store messageId when uploading
    const telegramDeleted = await telegramService.deleteFromTelegram(image.fileId, image.messageId);
    
    // Delete from our JSON storage
    const deleted = await imageStore.deleteImage(imageId);
    
    if (deleted) {
      return res.status(200).json({ 
        success: true, 
        message: 'Image deleted successfully',
        telegramDeleted: telegramDeleted // Let the client know if it was also deleted from Telegram
      });
    } else {
      return res.status(500).json({ error: 'Failed to delete image' });
    }
  } catch (error) {
    next(error);
  }
});

// Register error handling middleware
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the application at http://localhost:${PORT}`);
});
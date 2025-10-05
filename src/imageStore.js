const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Path to the JSON file storing file metadata (images, documents, videos, etc.)
const imagesFilePath = path.join(__dirname, '../data/images.json');

/**
 * Get all files from the JSON storage
 * @returns {Promise<Array>} - Array of file objects
 */
/**
 * Get all raw file data (private function for internal use)
 * @returns {Promise<Array>} - Array of complete file objects with sensitive data
 */
async function _getAllImagesRaw() {
  try {
    // Ensure the data directory exists
    const dataDir = path.dirname(imagesFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Create images.json if it doesn't exist
    if (!fs.existsSync(imagesFilePath)) {
      fs.writeFileSync(imagesFilePath, JSON.stringify({ images: [] }));
    }

    // Read the images file
    const data = fs.readFileSync(imagesFilePath, 'utf8');
    const parsedData = JSON.parse(data);
    
    return parsedData.images;
  } catch (error) {
    console.error('Error reading images file:', error);
    throw new Error('Failed to retrieve images');
  }
}

/**
 * Get all files - public function that sanitizes sensitive data
 * @returns {Promise<Array>} - Array of sanitized file objects
 */
async function getAllImages() {
  try {
    const images = await _getAllImagesRaw();
    
    // Sanitize the data before sending to client
    const sanitizedImages = images.map(img => {
      // Create a sanitized version without sensitive data
      return {
        id: img.id,
        createdAt: img.createdAt,
        originalName: img.originalName,
        mimetype: img.mimetype,
        size: img.size,
        isDocument: img.isDocument || false, // Include the document flag but not sensitive info
        fileType: getFileType(img.mimetype) // Add file type for easier frontend handling
        // Removed: fileId, filePath, cdnUrl which contain sensitive information
      };
    });
    
    return sanitizedImages;
  } catch (error) {
    console.error('Error reading images file:', error);
    throw new Error('Failed to retrieve images');
  }
}

/**
 * Helper function to determine file type category from mimetype
 * @param {string} mimetype - MIME type of the file
 * @returns {string} - File type category
 */
function getFileType(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.includes('word') || mimetype.includes('document')) return 'document';
  if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'spreadsheet';
  if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return 'presentation';
  if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('7z')) return 'archive';
  return 'file';
}

/**
 * Save file metadata to storage (images, documents, videos, etc.)
 * @param {Object} imageData - The file metadata to save
 * @returns {Promise<string>} - The generated file ID
 */
async function saveImage(imageData) {
  try {
    // Generate a unique ID for the file
    const imageId = uuidv4();
    
    // Get current files (use raw data)
    let images = await _getAllImagesRaw();
    
    // Add the new file with ID and timestamp
    const newImage = {
      id: imageId,
      createdAt: new Date().toISOString(),
      fileType: getFileType(imageData.mimetype), // Add file type category
      ...imageData
    };
    
    // Add to files array
    images.push(newImage);
    
    // Write back to the file
    fs.writeFileSync(imagesFilePath, JSON.stringify({ images }, null, 2));
    
    return imageId;
  } catch (error) {
    console.error('Error saving file metadata:', error);
    throw new Error('Failed to save file metadata');
  }
}

/**
 * Get file by ID from storage
 * @param {string} id - The file ID to look for
 * @param {boolean} raw - If true, returns the unsanitized data with sensitive info (for internal use)
 * @returns {Promise<Object|null>} - The file object or null if not found
 */
async function getImageById(id, raw = false) {
  try {
    const images = raw ? await _getAllImagesRaw() : await getAllImages();
    return images.find(img => img.id === id) || null;
  } catch (error) {
    console.error('Error fetching file by ID:', error);
    throw new Error('Failed to retrieve file');
  }
}

/**
 * Delete file by ID from storage
 * @param {string} id - The file ID to delete
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
async function deleteImage(id) {
  try {
    let images = await _getAllImagesRaw();
    const initialLength = images.length;
    
    // Filter out the file with the given ID
    images = images.filter(img => img.id !== id);
    
    // If no file was removed, return false
    if (images.length === initialLength) {
      return false;
    }
    
    // Write back to the file
    fs.writeFileSync(imagesFilePath, JSON.stringify({ images }, null, 2));
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error('Failed to delete file');
  }
}

module.exports = {
  getAllImages,
  saveImage,
  getImageById,
  deleteImage
};
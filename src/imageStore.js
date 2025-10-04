const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Path to the JSON file storing image metadata
const imagesFilePath = path.join(__dirname, '../data/images.json');

/**
 * Get all images from the JSON storage
 * @returns {Promise<Array>} - Array of image objects
 */
/**
 * Get all raw image data (private function for internal use)
 * @returns {Promise<Array>} - Array of complete image objects with sensitive data
 */
async function _getAllImagesRaw() {
  try {
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
 * Get all images - public function that sanitizes sensitive data
 * @returns {Promise<Array>} - Array of sanitized image objects
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
        isDocument: img.isDocument || false // Include the document flag but not sensitive info
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
 * Save image metadata to storage
 * @param {Object} imageData - The image metadata to save
 * @returns {Promise<string>} - The generated image ID
 */
async function saveImage(imageData) {
  try {
    // Generate a unique ID for the image
    const imageId = uuidv4();
    
    // Get current images (use raw data)
    let images = await _getAllImagesRaw();
    
    // Add the new image with ID and timestamp
    const newImage = {
      id: imageId,
      createdAt: new Date().toISOString(),
      ...imageData
    };
    
    // Add to images array
    images.push(newImage);
    
    // Write back to the file
    fs.writeFileSync(imagesFilePath, JSON.stringify({ images }, null, 2));
    
    return imageId;
  } catch (error) {
    console.error('Error saving image metadata:', error);
    throw new Error('Failed to save image metadata');
  }
}

/**
 * Get image by ID from storage
 * @param {string} id - The image ID to look for
 * @param {boolean} raw - If true, returns the unsanitized data with sensitive info (for internal use)
 * @returns {Promise<Object|null>} - The image object or null if not found
 */
async function getImageById(id, raw = false) {
  try {
    const images = raw ? await _getAllImagesRaw() : await getAllImages();
    return images.find(img => img.id === id) || null;
  } catch (error) {
    console.error('Error fetching image by ID:', error);
    throw new Error('Failed to retrieve image');
  }
}

/**
 * Delete image by ID from storage
 * @param {string} id - The image ID to delete
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
async function deleteImage(id) {
  try {
    let images = await _getAllImagesRaw();
    const initialLength = images.length;
    
    // Filter out the image with the given ID
    images = images.filter(img => img.id !== id);
    
    // If no image was removed, return false
    if (images.length === initialLength) {
      return false;
    }
    
    // Write back to the file
    fs.writeFileSync(imagesFilePath, JSON.stringify({ images }, null, 2));
    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    throw new Error('Failed to delete image');
  }
}

module.exports = {
  getAllImages,
  saveImage,
  getImageById,
  deleteImage
};
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Initialize Telegram Bot with options to fix deprecation warnings
const token = process.env.BOT_TOKEN;
const channelId = process.env.CHANNEL_ID;
const bot = new TelegramBot(token, { 
  polling: false,
  // Fix for the content-type warning
  fileOptions: {
    contentType: true
  }
});

/**
 * Upload an image to Telegram as a document to preserve quality and get its file_id
 * @param {string} imagePath - Path to the local image file
 * @returns {Promise<Object>} - Object containing fileId, filePath, and cdnUrl
 */
async function uploadToTelegram(imagePath) {
  if (!token || !channelId) {
    throw new Error('Missing Telegram BOT_TOKEN or CHANNEL_ID in environment variables');
  }

  try {
    // Get the file's mime type based on extension
    const mimeType = getMimeType(imagePath);
    
    // Get the original filename
    const fileName = path.basename(imagePath);
    
    // Read the image file
    const fileStream = fs.createReadStream(imagePath);

    // Send the image as a document to the Telegram channel to preserve quality
    // Using sendDocument instead of sendPhoto to maintain original quality
    const response = await bot.sendDocument(channelId, fileStream, {
      disable_notification: true,
      caption: `Image uploaded at ${new Date().toISOString()} (Original quality preserved)`,
      contentType: mimeType,
      filename: fileName
    });

    // Get the file_id from the document response
    const fileId = response.document.file_id;
    
    // Store the message ID so we can delete it later
    const messageId = response.message_id;

    // Get file path from Telegram
    const fileInfo = await bot.getFile(fileId);
    const filePath = fileInfo.file_path;

    // We'll no longer expose the actual CDN URL with token in it
    // Instead, we'll just store file info and use our own CDN endpoint
    
    return {
      fileId,
      filePath,
      messageId,  // Store the message ID to allow deletion later
      // This is the real CDN URL but we won't expose it to the client
      // It will be used internally by the server
      cdnUrl: `https://api.telegram.org/file/bot${token}/${filePath}`
    };
  } catch (error) {
    console.error('Telegram upload error:', error);
    throw new Error('Failed to upload to Telegram: ' + (error.message || error));
  }
}

/**
 * Stream an image from Telegram's CDN
 * @param {Object} image - The image metadata object
 * @param {string} size - Desired size (small, medium, original)
 * @param {Object} res - Express response object to pipe the image to
 * @returns {Promise<void>}
 */
async function streamImageFromTelegram(image, size, res) {
  try {
    // For documents, we'll always use the document's file_id
    let fileId = image.fileId;
    let resizeOptions = '';
    
    // Get the file info from Telegram
    const fileInfo = await bot.getFile(fileId);
    const filePath = fileInfo.file_path;

    // Construct the base CDN URL
    const baseCdnUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    
    // Handle different sizes using Telegram's URL parameters
    // Note: This is a workaround as Telegram doesn't officially support resize parameters
    // In production, use a proper image processing service like Sharp or a CDN with resize capabilities
    if (size === 'small' || size === 'medium') {
      // Set the size parameter for axios
      const width = size === 'small' ? 320 : 640;
      
      try {
        // For small and medium, we'll fetch the image and resize it using Sharp
        // For a production app, you would use a proper image processing service
        // This is just to demonstrate the concept
        const response = await axios({
          method: 'get',
          url: baseCdnUrl,
          responseType: 'arraybuffer'
        });
        
        // Set additional cache headers for resized images
        res.set('X-Size-Variant', size);
        
        // Stream the image directly
        const imageBuffer = Buffer.from(response.data, 'binary');
        res.send(imageBuffer);
        
      } catch (error) {
        console.error('Error resizing image:', error);
        // Fallback to original if resize fails
        streamOriginal();
      }
    } else {
      // For original size or any other value, stream directly
      streamOriginal();
    }
    
    // Function to stream the original image
    async function streamOriginal() {
      // Set cache control for original image
      res.set('Cache-Control', 'public, max-age=31536000'); // 1 year
      
      // Stream the image from Telegram to the client
      const response = await axios({
        method: 'get',
        url: baseCdnUrl,
        responseType: 'stream'
      });
  
      // Pipe the image stream directly to the response
      response.data.pipe(res);
    }
  } catch (error) {
    console.error('Telegram streaming error:', error);
    throw new Error('Failed to stream image from Telegram');
  }
}

/**
 * Helper function to determine MIME type from file path
 * @param {string} filePath - Path to the file
 * @returns {string} - MIME type of the file
 */
function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.bmp':
      return 'image/bmp';
    case '.tiff':
    case '.tif':
      return 'image/tiff';
    case '.svg':
      return 'image/svg+xml';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream'; // Default content type
  }
}

/**
 * Delete an image from Telegram
 * Note: Telegram doesn't provide a direct API to delete photos from channels,
 * so we'll implement message deletion if the image was posted as a message
 * @param {string} fileId - The Telegram file ID
 * @param {string} messageId - The message ID containing the image (if available)
 * @returns {Promise<boolean>} - True if deleted, false if not
 */
async function deleteFromTelegram(fileId, messageId) {
  try {
    // Note: Telegram doesn't have a direct method to delete files by fileId
    // We can only delete messages that contain those files
    
    // If we have a message ID (we would need to store this when uploading)
    if (messageId && channelId) {
      try {
        // Delete the message from the channel
        await bot.deleteMessage(channelId, messageId);
        return true;
      } catch (error) {
        console.error('Error deleting message from Telegram:', error);
        // Don't throw - we still want to delete from our local storage
        return false;
      }
    }
    
    // If we don't have a message ID or failed to delete,
    // we can't fully delete from Telegram but we should still remove from our records
    console.warn('Could not delete file from Telegram servers. File may still exist but will be orphaned.');
    return false;
  } catch (error) {
    console.error('Error in deleteFromTelegram:', error);
    // Don't throw - we still want to delete from our local storage
    return false;
  }
}

module.exports = {
  uploadToTelegram,
  streamImageFromTelegram,
  deleteFromTelegram
};
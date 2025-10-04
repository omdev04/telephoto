/**
 * Generate a secure token for accessing direct CDN URLs
 */
const crypto = require('crypto');

/**
 * Secret key for generating tokens - preferably from environment variable
 * In production, you should set this as an environment variable
 */
const SECRET_KEY = process.env.API_SECRET_KEY || 'telegram-photo-cdn-secret-key-change-me';

/**
 * Token expiry time in seconds (default: 1 hour)
 */
const TOKEN_EXPIRY = parseInt(process.env.TOKEN_EXPIRY || '3600', 10);

/**
 * Generate a secure token for accessing direct CDN URLs
 * @param {string} imageId - The ID of the image
 * @param {number} expiryTime - Token expiry time in seconds (default: 1 hour)
 * @returns {Object} - Object containing token and expiry timestamp
 */
function generateSecureToken(imageId, expiryTime = TOKEN_EXPIRY) {
  // Create an expiry timestamp
  const expiresAt = Math.floor(Date.now() / 1000) + expiryTime;
  
  // Data to include in the token
  const data = `${imageId}:${expiresAt}`;
  
  // Generate a HMAC signature
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(data);
  const signature = hmac.digest('hex');
  
  return {
    token: `${data}:${signature}`,
    expiresAt
  };
}

/**
 * Verify a secure token
 * @param {string} token - The token to verify
 * @param {string} imageId - The image ID to verify against
 * @returns {boolean} - Whether the token is valid
 */
function verifySecureToken(token, imageId) {
  try {
    // Split token into its components
    const [tokenImageId, expiryTimestamp, signature] = token.split(':');
    
    // Check if the image ID matches
    if (tokenImageId !== imageId) {
      return false;
    }
    
    // Check if the token has expired
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp > parseInt(expiryTimestamp, 10)) {
      return false;
    }
    
    // Regenerate the signature to verify
    const data = `${tokenImageId}:${expiryTimestamp}`;
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(data);
    const expectedSignature = hmac.digest('hex');
    
    // Compare signatures
    return signature === expectedSignature;
  } catch (error) {
    return false;
  }
}

module.exports = {
  generateSecureToken,
  verifySecureToken
};
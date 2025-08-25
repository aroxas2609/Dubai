const cloudinary = require('cloudinary').v2;

class CloudinaryStorage {
  constructor() {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    
    // Set default folder for organization
    this.defaultFolder = 'dubai-trip-images';
  }

  // Check if Cloudinary is configured
  isConfigured() {
    return !!(process.env.CLOUDINARY_CLOUD_NAME && 
              process.env.CLOUDINARY_API_KEY && 
              process.env.CLOUDINARY_API_SECRET);
  }

  // Upload image to Cloudinary
  async uploadImage(imageBuffer, originalName) {
    try {
      if (!this.isConfigured()) {
        throw new Error('Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
      }

      // Generate unique public ID
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const extension = this.getFileExtension(originalName);
      const publicId = `${this.defaultFolder}/${timestamp}_${randomString}`;

      // Convert buffer to base64 for Cloudinary
      const base64Image = imageBuffer.toString('base64');
      const dataURI = `data:image/${this.getMimeType(extension)};base64,${base64Image}`;

      // Upload to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(dataURI, {
        public_id: publicId,
        folder: this.defaultFolder,
        resource_type: 'image',
        overwrite: false,
        unique_filename: true,
        // Optimize for web
        quality: 'auto',
        fetch_format: 'auto',
        // Add transformation for better mobile performance
        transformation: [
          { width: 800, height: 600, crop: 'limit' },
          { quality: 'auto:good' }
        ]
      });

      console.log('✅ Image uploaded to Cloudinary:', uploadResult.public_id);
      
      // Return optimized URLs
      return {
        imageUrl: uploadResult.secure_url,
        thumbnailUrl: this.getOptimizedUrl(uploadResult.public_id, 300, 200),
        publicId: uploadResult.public_id,
        storageType: 'cloudinary'
      };

    } catch (error) {
      console.error('❌ Error uploading to Cloudinary:', error);
      throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
  }

  // Get optimized URL for different sizes
  getOptimizedUrl(publicId, width = 800, height = 600) {
    if (!this.isConfigured()) return null;
    
    return cloudinary.url(publicId, {
      width: width,
      height: height,
      crop: 'fill',
      quality: 'auto:good',
      fetch_format: 'auto'
    });
  }

  // Delete image from Cloudinary
  async deleteImage(publicId) {
    try {
      if (!this.isConfigured()) {
        throw new Error('Cloudinary not configured');
      }

      const result = await cloudinary.uploader.destroy(publicId);
      
      if (result.result === 'ok') {
        console.log('🗑️ Image deleted from Cloudinary:', publicId);
        return true;
      } else {
        console.log('⚠️ Image deletion result:', result.result);
        return false;
      }
    } catch (error) {
      console.error('❌ Error deleting from Cloudinary:', error);
      return false;
    }
  }

  // Get storage info (Cloudinary doesn't provide detailed storage info in free tier)
  getStorageInfo() {
    return {
      storageType: 'cloudinary',
      provider: 'Cloudinary',
      note: 'Storage info not available in free tier',
      configured: this.isConfigured()
    };
  }

  // Helper: Get file extension
  getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase() || 'jpg';
  }

  // Helper: Get MIME type from extension
  getMimeType(extension) {
    const mimeTypes = {
      'jpg': 'jpeg',
      'jpeg': 'jpeg',
      'png': 'png',
      'gif': 'gif',
      'webp': 'webp'
    };
    return mimeTypes[extension] || 'jpeg';
  }

  // Test connection
  async testConnection() {
    try {
      if (!this.isConfigured()) {
        return { success: false, error: 'Not configured' };
      }

      // Try to get account info
      const result = await cloudinary.api.ping();
      return { success: true, message: 'Connection successful', result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new CloudinaryStorage();

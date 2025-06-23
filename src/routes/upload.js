const express = require('express');
const router = express.Router();
const { upload, deleteImage, getPublicIdFromUrl } = require('../config/cloudinary');
const { authenticateUser } = require('../middlewares/auth');
const User = require('../models/User');

// Upload single image
router.post('/upload/image', authenticateUser, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({
        message: 'No image file provided'
      });
    }

    // Return the Cloudinary URL
    res.status(200).send({
      message: 'Image uploaded successfully',
      data: {
        url: req.file.path,
        publicId: req.file.filename
      }
    });

  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).send({
      message: 'Failed to upload image',
      error: error.message
    });
  }
});

// Upload multiple images (up to 5)
router.post('/upload/images', authenticateUser, upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).send({
        message: 'No image files provided'
      });
    }

    // Process uploaded images
    const uploadedImages = req.files.map((file, index) => ({
      url: file.path,
      publicId: file.filename,
      isPrimary: index === 0 // First image is primary
    }));

    res.status(200).send({
      message: 'Images uploaded successfully',
      data: {
        images: uploadedImages,
        count: uploadedImages.length
      }
    });

  } catch (error) {
    console.error('Images upload error:', error);
    res.status(500).send({
      message: 'Failed to upload images',
      error: error.message
    });
  }
});

// Delete image
router.delete('/upload/image/:publicId', authenticateUser, async (req, res) => {
  try {
    const { publicId } = req.params;
    
    // Delete from Cloudinary
    const result = await deleteImage(publicId);
    
    if (result.result === 'ok') {
      res.status(200).send({
        message: 'Image deleted successfully'
      });
    } else {
      res.status(400).send({
        message: 'Failed to delete image'
      });
    }

  } catch (error) {
    console.error('Image deletion error:', error);
    res.status(500).send({
      message: 'Failed to delete image',
      error: error.message
    });
  }
});

// Update user photos in database
router.post('/upload/save-photos', authenticateUser, async (req, res) => {
  try {
    const { photos } = req.body;
    
    if (!photos || !Array.isArray(photos)) {
      return res.status(400).send({
        message: 'Photos array is required'
      });
    }

    // Validate photos format
    const validPhotos = photos.map((photo, index) => ({
      url: photo.url,
      isPrimary: index === 0 || photo.isPrimary === true,
      uploadedAt: new Date()
    }));

    // Update user photos
    const user = await User.findByIdAndUpdate(
      req.userId,
      { photos: validPhotos },
      { new: true }
    );

    if (!user) {
      return res.status(404).send({
        message: 'User not found'
      });
    }

    res.status(200).send({
      message: 'Photos saved successfully',
      data: {
        photos: user.photos
      }
    });

  } catch (error) {
    console.error('Save photos error:', error);
    res.status(500).send({
      message: 'Failed to save photos',
      error: error.message
    });
  }
});

module.exports = router; 
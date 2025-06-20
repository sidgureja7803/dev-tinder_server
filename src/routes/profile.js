const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authenticateUser } = require("../middlewares/auth");

// Get current user profile
router.get("/profile", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    if (!user) {
      return res.status(404).send({
        message: "User not found"
      });
    }

    res.status(200).send({
      data: user
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Edit profile (legacy endpoint)
router.patch("/profile/edit", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).send({
        message: "User not found"
      });
    }

    // Legacy field mapping for backward compatibility
    const { firstName, lastName, photoUrl, age, gender, about, skills } = req.body;

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (photoUrl) {
      user.photoUrl = photoUrl;
      // Also update photos array if it doesn't exist
      if (!user.photos || user.photos.length === 0) {
        user.photos = [{ url: photoUrl, isPrimary: true }];
      }
    }
    if (age) user.age = age;
    if (gender) user.gender = gender;
    if (about) user.about = about;
    if (Array.isArray(skills)) user.skills = skills;

    await user.save();

    res.status(200).send({
      message: `${user.firstName}, your profile updated successfully`,
      data: user
    });
  } catch (err) {
    res.status(400).send({
      message: "Failed to update profile",
      error: err.message
    });
  }
});

// Enhanced profile update endpoint
router.put("/profile", authenticateUser, async (req, res) => {
  try {
    const updates = req.body;
    
    // Fields that cannot be updated via this endpoint
    const restrictedFields = ['password', 'emailId', 'isVerified', '_id'];
    
    // Remove restricted fields
    restrictedFields.forEach(field => {
      delete updates[field];
    });

    // Handle date of birth and age calculation
    if (updates.dateOfBirth) {
      const birthDate = new Date(updates.dateOfBirth);
      const age = Math.floor((Date.now() - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
      
      if (age < 18) {
        return res.status(400).send({
          message: "Must be at least 18 years old"
        });
      }
      
      updates.age = age;
    }

    // Handle photos array
    if (updates.photos && Array.isArray(updates.photos)) {
      // Ensure first photo is marked as primary
      updates.photos = updates.photos.map((photo, index) => ({
        ...photo,
        isPrimary: index === 0,
        uploadedAt: photo.uploadedAt || new Date()
      }));

      // Update legacy photoUrl field for backward compatibility
      if (updates.photos.length > 0) {
        updates.photoUrl = updates.photos[0].url;
      }
    }

    // Validate location if provided
    if (updates.location && updates.location.coordinates) {
      if (!Array.isArray(updates.location.coordinates) || 
          updates.location.coordinates.length !== 2 ||
          typeof updates.location.coordinates[0] !== 'number' || 
          typeof updates.location.coordinates[1] !== 'number') {
        return res.status(400).send({
          message: "Invalid location coordinates. Must be [longitude, latitude]"
        });
      }
      
      updates.location.type = 'Point';
    }

    // Handle preferences
    if (updates.preferences) {
      // Merge with existing preferences to avoid overwriting
      const currentUser = await User.findById(req.userId);
      updates.preferences = {
        ...currentUser.preferences,
        ...updates.preferences
      };

      // Update legacy preference fields for backward compatibility
      if (updates.preferences.ageRange) {
        updates.preferredAgeMin = updates.preferences.ageRange.min;
        updates.preferredAgeMax = updates.preferences.ageRange.max;
      }
      if (updates.preferences.distance) {
        updates.preferredDistance = updates.preferences.distance;
      }
      if (updates.preferences.genders) {
        updates.preferredGenders = updates.preferences.genders;
      }
    }

    // Handle professional information validation
    if (updates.company && updates.company.isCurrentlyWorking && !updates.company.name) {
      return res.status(400).send({
        message: "Company name is required when currently working"
      });
    }

    // Only show CTC if user is currently working
    if (updates.ctcRange && (!updates.company || !updates.company.isCurrentlyWorking)) {
      delete updates.ctcRange;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).send({
        message: "User not found"
      });
    }
    
    res.status(200).send({
      message: "Profile updated successfully",
      data: user
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).send({
        message: "Validation error",
        error: err.message
      });
    }
    
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Update preferences specifically
router.put("/profile/preferences", authenticateUser, async (req, res) => {
  try {
    const { ageRange, distance, genders, religions, professions } = req.body;
    
    const updates = {
      preferences: {}
    };
    
    if (ageRange) {
      updates.preferences.ageRange = ageRange;
      // Update legacy fields
      updates.preferredAgeMin = ageRange.min;
      updates.preferredAgeMax = ageRange.max;
    }
    
    if (distance) {
      updates.preferences.distance = distance;
      updates.preferredDistance = distance;
    }
    
    if (genders) {
      updates.preferences.genders = genders;
      updates.preferredGenders = genders;
    }
    
    if (religions) updates.preferences.religions = religions;
    if (professions) updates.preferences.professions = professions;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).send({
        message: "User not found"
      });
    }
    
    res.status(200).send({
      message: "Preferences updated successfully",
      data: {
        preferences: user.preferences,
        // Legacy fields for backward compatibility
        preferredAgeMin: user.preferredAgeMin,
        preferredAgeMax: user.preferredAgeMax,
        preferredDistance: user.preferredDistance,
        preferredGenders: user.preferredGenders
      }
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Update location
router.put("/profile/location", authenticateUser, async (req, res) => {
  try {
    const { latitude, longitude, city, state, country, address } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).send({
        message: "Latitude and longitude are required"
      });
    }
    
    const location = {
      type: 'Point',
      coordinates: [longitude, latitude], // GeoJSON format is [longitude, latitude]
      city,
      state,
      country,
      address
    };
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { location } },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).send({
        message: "User not found"
      });
    }
    
    res.status(200).send({
      message: "Location updated successfully",
      data: {
        location: user.location
      }
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Add/update photos
router.post("/profile/photos", authenticateUser, async (req, res) => {
  try {
    const { photoUrl, isPrimary = false } = req.body;
    
    if (!photoUrl) {
      return res.status(400).send({
        message: "Photo URL is required"
      });
    }

    const user = await User.findById(req.userId);
    
    if (!user.photos) {
      user.photos = [];
    }

    // Check if user already has 5 photos
    if (user.photos.length >= 5) {
      return res.status(400).send({
        message: "Maximum 5 photos allowed"
      });
    }

    // If this is set as primary, unset other primary photos
    if (isPrimary) {
      user.photos.forEach(photo => {
        photo.isPrimary = false;
      });
      user.photoUrl = photoUrl; // Update legacy field
    }

    // Add new photo
    user.photos.push({
      url: photoUrl,
      isPrimary: isPrimary || user.photos.length === 0, // First photo is always primary
      uploadedAt: new Date()
    });

    // If this is the first photo, set as primary and update legacy field
    if (user.photos.length === 1) {
      user.photos[0].isPrimary = true;
      user.photoUrl = photoUrl;
    }

    await user.save();

    res.status(200).send({
      message: "Photo added successfully",
      data: {
        photos: user.photos,
        photoUrl: user.photoUrl
      }
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Delete photo
router.delete("/profile/photos/:photoIndex", authenticateUser, async (req, res) => {
  try {
    const { photoIndex } = req.params;
    const index = parseInt(photoIndex);

    const user = await User.findById(req.userId);
    
    if (!user.photos || index < 0 || index >= user.photos.length) {
      return res.status(400).send({
        message: "Invalid photo index"
      });
    }

    const wasRemovingPrimary = user.photos[index].isPrimary;
    
    // Remove photo
    user.photos.splice(index, 1);

    // If we removed the primary photo, set the first remaining photo as primary
    if (wasRemovingPrimary && user.photos.length > 0) {
      user.photos[0].isPrimary = true;
      user.photoUrl = user.photos[0].url;
    } else if (user.photos.length === 0) {
      user.photoUrl = "https://geographyandyou.com/images/user-profile.png";
    }

    await user.save();

    res.status(200).send({
      message: "Photo deleted successfully",
      data: {
        photos: user.photos,
        photoUrl: user.photoUrl
      }
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Get profile completion status
router.get("/profile/completion", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).send({
        message: "User not found"
      });
    }

    const completionPercentage = user.calculateProfileCompletion();
    const isComplete = user.isProfileComplete();

    res.status(200).send({
      data: {
        completionPercentage,
        isComplete,
        onboardingCompleted: user.onboardingCompleted,
        missingFields: getMissingFields(user)
      }
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Helper function to identify missing required fields
function getMissingFields(user) {
  const missing = [];
  
  if (!user.firstName) missing.push('firstName');
  if (!user.dateOfBirth) missing.push('dateOfBirth');
  if (!user.gender) missing.push('gender');
  if (!user.bio || user.bio.length < 20) missing.push('bio');
  if (!user.photos || user.photos.length === 0) missing.push('photos');
  if (!user.profession) missing.push('profession');
  if (!user.location || !user.location.city) missing.push('location');
  if (!user.skills || user.skills.length < 3) missing.push('skills');
  
  return missing;
}

module.exports = router;

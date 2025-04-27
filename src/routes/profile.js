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

// Edit profile
router.patch("/profile/edit", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).send({
        message: "User not found"
      });
    }

    // Ensure that the fields sent in the request body are validated properly
    const { firstName, lastName, photoUrl, age, gender, about, skills } = req.body;

    // Only allow updating fields that aren't sensitive
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (photoUrl) user.photoUrl = photoUrl;  // Ensure this URL is properly validated on the client-side
    if (age) user.age = age;
    if (gender) user.gender = gender;
    if (about) user.about = about;
    if (Array.isArray(skills)) user.skills = skills;  // Assuming skills are passed as an array

    // Save the updated user data
    await user.save();

    // Send success response with updated user data
    res.status(200).send({
      message: `${user.firstName}, your profile updated successfully`,
      data: user
    });
  } catch (err) {
    // Send error response if something goes wrong
    res.status(400).send({
      message: "Failed to update profile",
      error: err.message
    });
  }
});


// Update user profile
router.put("/profile", authenticateUser, async (req, res) => {
  try {
    const updates = req.body;
    
    // Fields that cannot be updated via this endpoint
    const restrictedFields = ['password', 'emailId', 'isVerified', 'isPremium', 'membershipType'];
    
    // Remove restricted fields
    restrictedFields.forEach(field => {
      delete updates[field];
    });
    
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
      
      // Set location type
      updates.location.type = 'Point';
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

// Update location
router.put("/profile/location", authenticateUser, async (req, res) => {
  try {
    const { latitude, longitude, city, country } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).send({
        message: "Latitude and longitude are required"
      });
    }
    
    const location = {
      type: 'Point',
      coordinates: [longitude, latitude], // GeoJSON format is [longitude, latitude]
      city,
      country
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

// Update interests
router.put("/profile/interests", authenticateUser, async (req, res) => {
  try {
    const { interests } = req.body;
    
    if (!interests || !Array.isArray(interests)) {
      return res.status(400).send({
        message: "Interests must be an array"
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { interests } },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).send({
        message: "User not found"
      });
    }
    
    res.status(200).send({
      message: "Interests updated successfully",
      data: {
        interests: user.interests
      }
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

module.exports = router;

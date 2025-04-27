const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authenticateUser } = require("../middlewares/auth");

// Calculate skill match percentage between two users
const calculateSkillMatch = (user1Skills = [], user2Skills = []) => {
  if (!user1Skills.length || !user2Skills.length) return 0;
  
  const matchingSkills = user1Skills.filter(skill => 
    user2Skills.includes(skill)
  );
  
  return (matchingSkills.length / Math.max(user1Skills.length, user2Skills.length)) * 100;
};

// Get feed with location-based and skill-based matching
router.get("/feed", authenticateUser, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).send({
        message: "User not found"
      });
    }
    
    // Update user's swipe count for free users
    if (!currentUser.isPremium && currentUser.hasReachedSwipeLimit()) {
      return res.status(403).send({
        message: "Daily swipe limit reached. Upgrade to premium for unlimited swipes!",
        limitReached: true
      });
    }

    // Base query
    let query = {
      _id: { $ne: currentUser._id }, // Exclude current user
      isVerified: true // Only verified users
    };
    
    // Apply gender preference filters if set
    if (currentUser.preferredGenders && currentUser.preferredGenders.length > 0) {
      query.gender = { $in: currentUser.preferredGenders };
    }
    
    // Apply age filters if set
    if (currentUser.preferredAgeMin || currentUser.preferredAgeMax) {
      query.age = {};
      
      if (currentUser.preferredAgeMin) {
        query.age.$gte = currentUser.preferredAgeMin;
      }
      
      if (currentUser.preferredAgeMax) {
        query.age.$lte = currentUser.preferredAgeMax;
      }
    }
    
    let users = [];
    
    // If user has location data, use geospatial query
    if (currentUser.location && 
        currentUser.location.type === 'Point' && 
        currentUser.location.coordinates && 
        currentUser.location.coordinates.length === 2) {
      
      // Find users within the preferred distance radius
      users = await User.find({
        ...query,
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: currentUser.location.coordinates
            },
            $maxDistance: (currentUser.preferredDistance || 50) * 1000 // Convert km to meters
          }
        }
      })
      .select('-password')
      .sort({ lastActive: -1 })
      .limit(100); // Increased limit for better matching
    } else {
      // If no location data, just get random matches
      users = await User.find(query)
        .select('-password')
        .sort({ lastActive: -1 })
        .limit(100);
    }
    
    // Apply skill-based matching and sorting
    if (currentUser.skills && currentUser.skills.length > 0) {
      // Calculate match percentage for each user
      users = users.map(user => ({
        ...user.toObject(),
        skillMatchPercentage: calculateSkillMatch(currentUser.skills, user.skills)
      }));

      // Sort by matching skills (higher percentage first)
      users.sort((a, b) => b.skillMatchPercentage - a.skillMatchPercentage);

      // Take top 50 matches
      users = users.slice(0, 50);
    }
    
    res.status(200).send({
      data: users,
      remaining: currentUser.isPremium ? "unlimited" : (currentUser.dailySwipesLimit - currentUser.swipesCount)
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Record a swipe action
router.post("/swipe/:action/:userId", authenticateUser, async (req, res) => {
  try {
    const { action, userId } = req.params;
    
    if (!["like", "pass", "superlike"].includes(action)) {
      return res.status(400).send({
        message: "Invalid action. Must be 'like', 'pass', or 'superlike'"
      });
    }
    
    // Get current user
    const currentUser = await User.findById(req.userId);
    
    // Check if user has reached free swipe limit
    if (!currentUser.isPremium && currentUser.hasReachedSwipeLimit()) {
      return res.status(403).send({
        message: "Daily swipe limit reached. Upgrade to premium for unlimited swipes!",
        limitReached: true
      });
    }
    
    // Update swipe count (except for premium users)
    if (!currentUser.isPremium) {
      currentUser.swipesCount += 1;
      await currentUser.save();
    }

    // Get target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).send({
        message: "Target user not found"
      });
    }

    // Calculate skill match percentage
    const skillMatchPercentage = calculateSkillMatch(currentUser.skills, targetUser.skills);

    // If it's a like/superlike and there's a high skill match, create a match
    if ((action === 'like' || action === 'superlike') && skillMatchPercentage >= 70) {
      // Create match logic here (you'll need to implement this)
      // This could involve creating a Match document and notifying both users
    }
    
    res.status(200).send({
      message: `User ${action}ed successfully`,
      skillMatchPercentage,
      remaining: currentUser.isPremium ? "unlimited" : (currentUser.dailySwipesLimit - currentUser.swipesCount)
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Get user preferences
router.get("/preferences", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).send({
        message: "User not found"
      });
    }
    
    res.status(200).send({
      data: {
        preferredAgeMin: user.preferredAgeMin,
        preferredAgeMax: user.preferredAgeMax,
        preferredDistance: user.preferredDistance,
        preferredGenders: user.preferredGenders,
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

// Update user preferences
router.put("/preferences", authenticateUser, async (req, res) => {
  try {
    const { 
      preferredAgeMin, 
      preferredAgeMax, 
      preferredDistance, 
      preferredGenders,
      interests
    } = req.body;
    
    const updates = {};
    
    if (preferredAgeMin !== undefined) updates.preferredAgeMin = preferredAgeMin;
    if (preferredAgeMax !== undefined) updates.preferredAgeMax = preferredAgeMax;
    if (preferredDistance !== undefined) updates.preferredDistance = preferredDistance;
    if (preferredGenders !== undefined) updates.preferredGenders = preferredGenders;
    if (interests !== undefined) updates.interests = interests;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).send({
        message: "User not found"
      });
    }
    
    res.status(200).send({
      message: "Preferences updated successfully",
      data: {
        preferredAgeMin: user.preferredAgeMin,
        preferredAgeMax: user.preferredAgeMax,
        preferredDistance: user.preferredDistance,
        preferredGenders: user.preferredGenders,
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
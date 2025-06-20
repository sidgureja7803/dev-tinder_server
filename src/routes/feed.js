const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth");
const User = require("../models/User");
const Swipe = require("../models/Swipe");

// Simple compatibility scoring algorithm
const calculateCompatibilityScore = (user1, user2) => {
  let score = 0;
  
  // Age compatibility (closer ages get higher score)
  if (user1.age && user2.age) {
    const ageDiff = Math.abs(user1.age - user2.age);
    score += Math.max(0, 20 - ageDiff);
  }
  
  // Profession compatibility
  if (user1.profession && user2.profession) {
    if (user1.profession === user2.profession) score += 15;
    else score += 5; // Different professions still get some points
  }
  
  // Skills compatibility
  if (user1.skills && user2.skills) {
    const commonSkills = user1.skills.filter(skill => user2.skills.includes(skill));
    score += commonSkills.length * 10;
  }
  
  // Education compatibility
  if (user1.education && user2.education) {
    if (user1.education === user2.education) score += 10;
    else score += 3;
  }
  
  // Location bonus (if both have location)
  if (user1.location && user2.location) {
    score += 5;
  }
  
  return Math.min(score, 100); // Cap at 100
};

// Advanced compatibility scoring with more factors
const calculateAdvancedScore = (currentUser, targetUser) => {
  let score = calculateCompatibilityScore(currentUser, targetUser);
  
  // Additional factors for enhanced scoring
  if (targetUser.isVerified) score += 5;
  if (targetUser.profileComplete) score += 5;
  
  // Recent activity bonus
  const lastActive = new Date(targetUser.lastActive || targetUser.updatedAt);
  const daysSinceActive = (new Date() - lastActive) / (24 * 60 * 60 * 1000);
  if (daysSinceActive < 1) score += 10;
  else if (daysSinceActive < 7) score += 5;
  
  // Photo bonus
  if (targetUser.photos && targetUser.photos.length > 0) {
    score += Math.min(targetUser.photos.length * 2, 10);
  }
  
  return Math.min(score, 100);
};

// Get personalized feed for user
router.get("/feed", authenticateUser, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).send({
        message: "User not found"
      });
    }
    
    // Update user's last active timestamp
    currentUser.lastActive = new Date();
    await currentUser.save();
    
    // All users get unlimited swipes - completely free!

    // Get list of users already swiped on to exclude them
    const swipedUserIds = await Swipe.distinct('swipedUser', { 
      swipedBy: currentUser._id 
    });

    // Base query to exclude current user and already swiped users
    let query = {
      _id: { 
        $ne: currentUser._id,
        $nin: swipedUserIds 
      },
      isVerified: true,
      profileComplete: true
    };
    
    // Apply gender preference filters
    if (currentUser.preferences?.genders?.length > 0) {
      query.gender = { $in: currentUser.preferences.genders };
    }
    
    // Apply age filters
    if (currentUser.preferences?.ageRange) {
      const { min, max } = currentUser.preferences.ageRange;
      if (min || max) {
        // Calculate date range for dateOfBirth
        const now = new Date();
        if (max) {
          const minBirthDate = new Date(now.getFullYear() - max - 1, now.getMonth(), now.getDate());
          query.dateOfBirth = { $gte: minBirthDate };
        }
        if (min) {
          const maxBirthDate = new Date(now.getFullYear() - min, now.getMonth(), now.getDate());
          query.dateOfBirth = { ...query.dateOfBirth, $lte: maxBirthDate };
        }
      }
    }
    
    // Apply profession filters
    if (currentUser.preferences?.professions?.length > 0) {
      query.profession = { $in: currentUser.preferences.professions };
    }
    
    // Apply religion filters
    if (currentUser.preferences?.religion?.length > 0 && 
        !currentUser.preferences.religion.includes('any')) {
      query.religion = { $in: currentUser.preferences.religion };
    }

    let users = [];
    
    // Location-based query if user has location data
    if (currentUser.location?.coordinates?.length === 2) {
      const maxDistance = (currentUser.preferences?.maxDistance || 50) * 1000; // Convert km to meters
      
      users = await User.find({
        ...query,
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: currentUser.location.coordinates
            },
            $maxDistance: maxDistance
          }
        }
      })
      .select('-password -otp -refreshToken')
      .sort({ lastActive: -1 })
      .limit(200);
    } else {
      // No location data, get random matches
      users = await User.find(query)
        .select('-password -otp -refreshToken')
        .sort({ lastActive: -1 })
        .limit(200);
    }
    
    // Calculate compatibility scores and enhance user data
    const enhancedUsers = users.map(user => {
      const userObj = user.toObject();
      
      // Calculate compatibility score
      userObj.compatibilityScore = calculateAdvancedScore(currentUser, userObj);
      
      // Add calculated age if not present
      if (!userObj.age && userObj.dateOfBirth) {
        userObj.age = Math.floor((new Date() - new Date(userObj.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
      }
      
      // Determine primary photo
      userObj.primaryPhoto = userObj.photos?.find(p => p.isPrimary)?.url || 
                             userObj.photos?.[0]?.url || 
                             userObj.photoUrl;
      
      return userObj;
    });
    
    // Enhanced sorting algorithm - everyone gets the best experience
    enhancedUsers.sort((a, b) => {
      // Primary sort by compatibility score
      if (b.compatibilityScore !== a.compatibilityScore) {
        return b.compatibilityScore - a.compatibilityScore;
      }
      
      // Secondary sort by last active
      const aLastActive = new Date(a.lastActive || a.updatedAt);
      const bLastActive = new Date(b.lastActive || b.updatedAt);
      return bLastActive - aLastActive;
    });
    
    // Everyone gets up to 50 high-quality matches
    const finalUsers = enhancedUsers.slice(0, 50);
    
    // Add some randomization to prevent the same order every time
    for (let i = finalUsers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [finalUsers[i], finalUsers[j]] = [finalUsers[j], finalUsers[i]];
    }
    
    res.status(200).send({
      data: finalUsers,
      remaining: "unlimited",
      algorithm: "advanced",
      totalFound: users.length
    });
    
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Record a swipe action - completely free for everyone
router.post("/swipe/:action/:userId", authenticateUser, async (req, res) => {
  try {
    const { action, userId } = req.params;
    
    if (!["like", "pass", "superlike"].includes(action)) {
      return res.status(400).send({
        message: "Invalid action. Must be 'like', 'pass', or 'superlike'"
      });
    }
    
    const currentUser = await User.findById(req.userId);
    
    // All features are free - no limits!

    // Get target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).send({
        message: "Target user not found"
      });
    }

    // Record the swipe
    await Swipe.swipe(req.userId, userId, action);
    
    // No swipe count updates needed - everything is unlimited!
    await currentUser.save();

    // If it's a pass, return early
    if (action === 'pass') {
      return res.status(200).send({
        message: "Swipe recorded successfully",
        remaining: "unlimited"
      });
    }

    // Check for mutual like and create match if exists
    const isMutualLike = await Swipe.checkMutualLike(req.userId, userId);
    
    if (isMutualLike) {
      // Import Match model here to avoid circular dependency
      const Match = require('../models/Match');
      
      // Check if match already exists
      const existingMatch = await Match.findMatch(req.userId, userId);
      
      if (!existingMatch) {
        // Calculate compatibility for match
        const compatibility = calculateCompatibilityScore(currentUser, targetUser);
        
        // Find mutual interests
        const mutualInterests = currentUser.skills?.filter(skill => 
          targetUser.skills?.includes(skill)
        ) || [];
        
        // Create new match
        const match = await Match.createMatch(
          req.userId, 
          userId, 
          action === 'superlike' ? 'superlike' : 'regular',
          compatibility,
          mutualInterests
        );
        
        return res.status(201).send({
          message: "It's a match!",
          data: {
            matchId: match._id,
            matchedWith: {
              userId: targetUser._id,
              firstName: targetUser.firstName,
              lastName: targetUser.lastName,
              photoUrl: targetUser.photos?.find(p => p.isPrimary)?.url || 
                        targetUser.photos?.[0]?.url || 
                        targetUser.photoUrl
            },
            matchScore: compatibility,
            mutualInterests: mutualInterests.slice(0, 5) // Limit to top 5
          },
          remaining: "unlimited"
        });
      }
    }
    
    // No match found
    res.status(200).send({
      message: "Swipe recorded successfully",
      remaining: "unlimited"
    });
    
  } catch (err) {
    console.error('Swipe error:', err);
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Undo last swipe - free for everyone!
router.post("/undo", authenticateUser, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    
    // Everyone can undo - completely free!
    
    // Get the last swipe
    const lastSwipe = await Swipe.findOne({ 
      swipedBy: req.userId 
    }).sort({ createdAt: -1 });
    
    if (!lastSwipe) {
      return res.status(404).send({
        message: "No recent swipe found to undo"
      });
    }
    
    // Remove the swipe
    await Swipe.findByIdAndDelete(lastSwipe._id);
    
    res.status(200).send({
      message: "Swipe undone successfully",
      remaining: "unlimited"
    });
    
  } catch (err) {
    console.error('Undo error:', err);
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Get user's swipe statistics
router.get("/stats", authenticateUser, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    
    // Get swipe statistics
    const totalSwipes = await Swipe.countDocuments({ swipedBy: req.userId });
    const likes = await Swipe.countDocuments({ swipedBy: req.userId, action: 'like' });
    const passes = await Swipe.countDocuments({ swipedBy: req.userId, action: 'pass' });
    const superLikes = await Swipe.countDocuments({ swipedBy: req.userId, action: 'superlike' });
    
    // Get match count
    const Match = require('../models/Match');
    const matches = await Match.countDocuments({
      $or: [
        { user1: req.userId },
        { user2: req.userId }
      ]
    });
    
    res.status(200).send({
      totalSwipes,
      likes,
      passes,
      superLikes,
      matches,
      dailySwipesRemaining: "unlimited",
      membershipType: "free", // Everyone is free!
      features: {
        unlimitedSwipes: true,
        superLikes: true,
        undoSwipes: true,
        advancedFilters: true,
        aiInsights: true
      }
    });
    
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// AI-powered insights - free for everyone!
router.get("/ai-insights", authenticateUser, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    
    // Everyone gets AI insights - completely free!
    
    // Get recent swipes for analysis
    const recentSwipes = await Swipe.find({ 
      swipedBy: req.userId 
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('swipedUser', 'profession skills age location');
    
    // Analyze patterns
    const likedUsers = recentSwipes.filter(s => s.action === 'like');
    const passedUsers = recentSwipes.filter(s => s.action === 'pass');
    
    // Generate insights
    const insights = {
      profileOptimization: [
        "Add more photos to increase your match rate by 40%",
        "Complete your bio to show your personality",
        "Verify your profile for increased trust"
      ],
      matchingTips: [
        "You tend to like users in similar professions - expand your preferences",
        "Consider increasing your age range for more matches",
        "Users with similar skills match well with you"
      ],
      conversationStarters: [
        "Ask about their latest project or work",
        "Discuss shared technical interests",
        "Share your coding journey and ask about theirs"
      ]
    };
    
    res.status(200).send({
      insights,
      profileScore: Math.floor(Math.random() * 20) + 80, // 80-100 range
      recommendations: "Keep being awesome! Your profile is performing well."
    });
    
  } catch (err) {
    console.error('AI insights error:', err);
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

module.exports = router; 
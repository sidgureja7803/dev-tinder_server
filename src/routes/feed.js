const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Swipe = require("../models/Swipe");
const { authenticateUser } = require("../middlewares/auth");
const aiService = require("../services/aiService");

// Calculate advanced compatibility score between two users
const calculateCompatibilityScore = (user1, user2) => {
  let score = 0;
  let maxScore = 0;
  
  // Age compatibility (20 points)
  maxScore += 20;
  if (user1.preferences?.ageRange && user2.dateOfBirth) {
    const user2Age = Math.floor((new Date() - new Date(user2.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
    if (user2Age >= user1.preferences.ageRange.min && user2Age <= user1.preferences.ageRange.max) {
      score += 20;
    } else {
      // Partial points for close ages
      const ageDiff = Math.min(
        Math.abs(user2Age - user1.preferences.ageRange.min),
        Math.abs(user2Age - user1.preferences.ageRange.max)
      );
      score += Math.max(0, 20 - ageDiff * 2);
    }
  }
  
  // Skills/Technology compatibility (25 points)
  maxScore += 25;
  if (user1.skills?.length && user2.skills?.length) {
    const commonSkills = user1.skills.filter(skill => user2.skills.includes(skill));
    const skillMatch = (commonSkills.length / Math.max(user1.skills.length, user2.skills.length)) * 25;
    score += skillMatch;
  }
  
  // Education level compatibility (15 points)
  maxScore += 15;
  if (user1.education?.level && user2.education?.level) {
    if (user1.education.level === user2.education.level) {
      score += 15;
    } else {
      // Partial match for related education levels
      const educationLevels = ['high-school', 'diploma', 'bachelors', 'masters', 'phd'];
      const level1Index = educationLevels.indexOf(user1.education.level);
      const level2Index = educationLevels.indexOf(user2.education.level);
      if (level1Index !== -1 && level2Index !== -1) {
        const levelDiff = Math.abs(level1Index - level2Index);
        score += Math.max(0, 15 - levelDiff * 3);
      }
    }
  }
  
  // Profession compatibility (15 points)
  maxScore += 15;
  if (user1.profession && user2.profession) {
    if (user1.profession === user2.profession) {
      score += 15;
    } else {
      // Related professions get partial points
      const techProfessions = ['software-engineer', 'data-scientist', 'product-manager', 'designer'];
      if (techProfessions.includes(user1.profession) && techProfessions.includes(user2.profession)) {
        score += 8;
      } else {
        score += 3; // Different but both professionals
      }
    }
  }
  
  // Religion compatibility (10 points)
  maxScore += 10;
  if (user1.preferences?.religion?.length && user2.religion) {
    if (user1.preferences.religion.includes(user2.religion) || user1.preferences.religion.includes('any')) {
      score += 10;
    }
  }
  
  // Location proximity (15 points)
  maxScore += 15;
  if (user1.location?.coordinates && user2.location?.coordinates) {
    // This is handled by the geospatial query, so give full points if within preferred distance
    score += 15;
  }
  
  return Math.round((score / maxScore) * 100);
};

// Advanced matching algorithm with ML-like scoring
const calculateAdvancedScore = (currentUser, targetUser) => {
  const compatibility = calculateCompatibilityScore(currentUser, targetUser);
  
  // Additional factors for premium users
  let bonusScore = 0;
  
  // Active user bonus
  const lastActive = new Date(targetUser.lastActive || targetUser.updatedAt);
  const daysSinceActive = (new Date() - lastActive) / (1000 * 60 * 60 * 24);
  if (daysSinceActive < 1) bonusScore += 10;
  else if (daysSinceActive < 7) bonusScore += 5;
  
  // Verified user bonus
  if (targetUser.isVerified) bonusScore += 5;
  
  // Complete profile bonus
  if (targetUser.profileComplete) bonusScore += 5;
  
  // Photo completeness bonus
  if (targetUser.photos?.length >= 3) bonusScore += 5;
  
  return Math.min(100, compatibility + bonusScore);
};

// Get intelligent feed with advanced matching
router.get("/feed", authenticateUser, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).send({
        message: "User not found"
      });
    }
    
    // Check if profile is complete enough for matching
    if (!currentUser.profileComplete || currentUser.profileCompletion < 70) {
      return res.status(400).send({
        message: "Please complete your profile to start matching",
        redirectTo: "/onboarding"
      });
    }
    
    // Update user's last active timestamp
    currentUser.lastActive = new Date();
    await currentUser.save();
    
    // Check premium status and swipe limits
    if (!currentUser.isPremium && currentUser.hasReachedSwipeLimit()) {
      return res.status(403).send({
        message: "Daily swipe limit reached. Upgrade to premium for unlimited swipes!",
        limitReached: true
      });
    }

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
      .limit(currentUser.isPremium ? 200 : 100);
    } else {
      // No location data, get random matches
      users = await User.find(query)
        .select('-password -otp -refreshToken')
        .sort({ lastActive: -1 })
        .limit(currentUser.isPremium ? 200 : 100);
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
    
    // Advanced sorting algorithm
    enhancedUsers.sort((a, b) => {
      // For premium users, use advanced algorithm
      if (currentUser.isPremium) {
        // Primary sort by compatibility score
        if (b.compatibilityScore !== a.compatibilityScore) {
          return b.compatibilityScore - a.compatibilityScore;
        }
        
        // Secondary sort by last active
        const aLastActive = new Date(a.lastActive || a.updatedAt);
        const bLastActive = new Date(b.lastActive || b.updatedAt);
        return bLastActive - aLastActive;
      } else {
        // Free users get simpler algorithm
        // Prioritize verified and active users
        if (b.isVerified !== a.isVerified) {
          return b.isVerified - a.isVerified;
        }
        
        return b.compatibilityScore - a.compatibilityScore;
      }
    });
    
    // Limit results based on user type
    const finalUsers = enhancedUsers.slice(0, currentUser.isPremium ? 50 : 20);
    
    // Add some randomization to prevent the same order every time
    for (let i = finalUsers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [finalUsers[i], finalUsers[j]] = [finalUsers[j], finalUsers[i]];
    }
    
    res.status(200).send({
      data: finalUsers,
      remaining: currentUser.isPremium ? "unlimited" : (currentUser.dailySwipesLimit - currentUser.swipesCount),
      algorithm: currentUser.isPremium ? "advanced" : "basic",
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

// Record a swipe action with enhanced logic
router.post("/swipe/:action/:userId", authenticateUser, async (req, res) => {
  try {
    const { action, userId } = req.params;
    
    if (!["like", "pass", "superlike"].includes(action)) {
      return res.status(400).send({
        message: "Invalid action. Must be 'like', 'pass', or 'superlike'"
      });
    }
    
    const currentUser = await User.findById(req.userId);
    
    // Check swipe limits for free users
    if (!currentUser.isPremium && currentUser.hasReachedSwipeLimit()) {
      return res.status(403).send({
        message: "Daily swipe limit reached. Upgrade to premium for unlimited swipes!",
        limitReached: true
      });
    }
    
    // Check super like limits for premium users
    if (action === 'superlike' && currentUser.isPremium) {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (!currentUser.lastSuperLikeDate || currentUser.lastSuperLikeDate < todayStart) {
        currentUser.superLikesUsedToday = 0;
      }
      
      const dailyLimit = currentUser.premiumFeatures?.superLikes?.daily || 1;
      if (currentUser.superLikesUsedToday >= dailyLimit) {
        return res.status(400).send({
          message: "Daily super like limit reached"
        });
      }
      
      currentUser.superLikesUsedToday = (currentUser.superLikesUsedToday || 0) + 1;
      currentUser.lastSuperLikeDate = now;
    } else if (action === 'superlike') {
      return res.status(403).send({
        message: "Super likes are a premium feature"
      });
    }

    // Get target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).send({
        message: "Target user not found"
      });
    }

    // Record the swipe
    await Swipe.swipe(req.userId, userId, action);
    
    // Update swipe count for non-premium users
    if (!currentUser.isPremium) {
      currentUser.swipesCount += 1;
    }
    
    await currentUser.save();

    // If it's a pass, return early
    if (action === 'pass') {
      return res.status(200).send({
        message: "Swipe recorded successfully",
        remaining: currentUser.isPremium ? "unlimited" : (currentUser.dailySwipesLimit - currentUser.swipesCount)
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
          remaining: currentUser.isPremium ? "unlimited" : (currentUser.dailySwipesLimit - currentUser.swipesCount)
        });
      }
    }
    
    // No match yet
    res.status(200).send({
      message: "Swipe recorded successfully",
      remaining: currentUser.isPremium ? "unlimited" : (currentUser.dailySwipesLimit - currentUser.swipesCount)
    });
    
  } catch (err) {
    console.error('Swipe error:', err);
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Get feed statistics for current user
router.get("/feed/stats", authenticateUser, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    
    const swipeStats = await Swipe.getSwipeStats(req.userId);
    
    // Calculate match rate
    const totalLikes = swipeStats.sent.like || 0;
    const totalSuperLikes = swipeStats.sent.superlike || 0;
    const totalLikesReceived = swipeStats.received.like || 0;
    
    const matchRate = totalLikes > 0 ? 
      Math.round((totalLikesReceived / totalLikes) * 100) : 0;
    
    const stats = {
      swipesSent: {
        likes: totalLikes,
        passes: swipeStats.sent.pass || 0,
        superLikes: totalSuperLikes
      },
      swipesReceived: {
        likes: swipeStats.received.like || 0,
        passes: swipeStats.received.pass || 0,
        superLikes: swipeStats.received.superlike || 0
      },
      matchRate,
      dailySwipesRemaining: currentUser.isPremium ? "unlimited" : 
        (currentUser.dailySwipesLimit - currentUser.swipesCount),
      profileViews: currentUser.profileViews || 0,
      isVerified: currentUser.isVerified,
      profileCompletion: currentUser.profileCompletion
    };
    
    res.status(200).send({ data: stats });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Get AI-powered matchmaking insights
router.get("/ai-insights", authenticateUser, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).send({
        message: "User not found"
      });
    }

    // Check if user is premium for AI insights
    if (!currentUser.isPremium) {
      return res.status(403).send({
        message: "AI insights are a premium feature. Upgrade to Gold or Platinum to access personalized matchmaking recommendations!",
        upgradeRequired: true
      });
    }

    // Get potential matches (similar to feed logic but simplified)
    const swipedUserIds = await Swipe.distinct('swipedUser', { 
      swipedBy: currentUser._id 
    });

    let query = {
      _id: { 
        $ne: currentUser._id,
        $nin: swipedUserIds 
      },
      isVerified: true,
      profileComplete: true
    };
    
    // Apply basic filters
    if (currentUser.preferences?.genders?.length > 0) {
      query.gender = { $in: currentUser.preferences.genders };
    }

    const potentialMatches = await User.find(query).limit(20);

    // Generate AI insights
    const insights = await aiService.generateMatchmakingInsights(currentUser, potentialMatches);

    // Calculate compatibility scores for top matches
    const scoredMatches = [];
    for (const match of potentialMatches.slice(0, 5)) {
      const compatibility = await aiService.calculateCompatibilityScore(currentUser, match);
      scoredMatches.push({
        user: {
          _id: match._id,
          firstName: match.firstName,
          lastName: match.lastName,
          profession: match.profession,
          skills: match.skills,
          photoUrl: match.photos?.find(p => p.isPrimary)?.url || 
                   match.photos?.[0]?.url || 
                   match.photoUrl
        },
        compatibility: compatibility.score,
        factors: compatibility.factors,
        commonSkills: compatibility.commonSkills
      });
    }

    // Sort by compatibility score
    scoredMatches.sort((a, b) => b.compatibility - a.compatibility);

    res.status(200).send({
      insights,
      topMatches: scoredMatches,
      totalPotentialMatches: potentialMatches.length,
      generatedAt: new Date()
    });

  } catch (err) {
    console.error('AI insights error:', err);
    res.status(500).send({
      message: "Something went wrong generating AI insights",
      error: err.message
    });
  }
});

module.exports = router; 
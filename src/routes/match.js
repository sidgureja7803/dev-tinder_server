const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/auth');
const User = require('../models/User');
const Match = require('../models/Match');
const Swipe = require('../models/Swipe');

// Record a swipe and check for match
router.post('/swipe/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId: swipedUserId } = req.params;
    const { action } = req.body;
    
    if (!['like', 'pass', 'superlike'].includes(action)) {
      return res.status(400).send({
        message: "Invalid action. Must be 'like', 'pass', or 'superlike'."
      });
    }
    
    // Get current user
    const currentUser = await User.findById(req.userId);
    
    // Free for everyone - no daily swipe limits
    
    // Make sure swiped user exists
    const swipedUser = await User.findById(swipedUserId);
    if (!swipedUser) {
      return res.status(404).send({
        message: "User not found"
      });
    }
    
    // Record swipe
    await Swipe.swipe(req.userId, swipedUserId, action);
    
    // No swipe counting needed - unlimited swipes for everyone
    
    // Return early if action is 'pass'
    if (action === 'pass') {
      return res.status(200).send({
        message: "Swipe recorded successfully",
        remaining: "unlimited"
      });
    }
    
    // Check if there's a mutual like (create a match if there is)
    const isMutualLike = await Swipe.checkMutualLike(req.userId, swipedUserId);
    
    if (isMutualLike) {
      // Check if match already exists
      const existingMatch = await Match.findMatch(req.userId, swipedUserId);
      
      if (!existingMatch) {
        // Create new match
        const match = await Match.createMatch(
          req.userId, 
          swipedUserId, 
          action === 'superlike' ? 'superlike' : 'regular'
        );
        
        return res.status(201).send({
          message: "It's a match!",
          data: {
            matchId: match._id,
            matchedWith: {
              userId: swipedUser._id,
              firstName: swipedUser.firstName,
              lastName: swipedUser.lastName,
              photoUrl: swipedUser.photoUrl
            },
            matchScore: match.matchScore,
            mutualInterests: match.mutualInterests
          },
          remaining: "unlimited"
        });
      }
    }
    
    // No match yet
    res.status(200).send({
      message: "Swipe recorded successfully",
      remaining: "unlimited"
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Get all matches for the current user
router.get('/matches', authenticateUser, async (req, res) => {
  try {
    // Find all matches where the current user is involved
    const matches = await Match.find({
      users: req.userId,
      isActive: true
    })
    .sort({ lastMessageAt: -1, matchedOn: -1 })
    .populate('users', 'firstName lastName photoUrl lastActive')
    .lean();
    
    // Transform data for client
    const transformedMatches = matches.map(match => {
      // Get the other user in the match
      const otherUser = match.users.find(user => user._id.toString() !== req.userId.toString());
      
      return {
        matchId: match._id,
        user: otherUser,
        matchScore: match.matchScore,
        mutualInterests: match.mutualInterests,
        matchedOn: match.matchedOn,
        lastMessageAt: match.lastMessageAt
      };
    });
    
    res.status(200).send({
      data: transformedMatches
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Unmatch with a user
router.delete('/unmatch/:matchId', authenticateUser, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    // Find match and ensure current user is part of it
    const match = await Match.findOne({
      _id: matchId,
      users: req.userId
    });
    
    if (!match) {
      return res.status(404).send({
        message: "Match not found"
      });
    }
    
    // Soft delete the match
    match.isActive = false;
    await match.save();
    
    res.status(200).send({
      message: "Unmatched successfully"
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message
    });
  }
});

// Get match statistics
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    // Total matches count
    const totalMatches = await Match.countDocuments({
      users: req.userId,
      isActive: true
    });
    
    // Count by match type
    const matchTypeStats = await Match.aggregate([
      { $match: { users: mongoose.Types.ObjectId(req.userId), isActive: true } },
      { $group: { _id: '$matchType', count: { $sum: 1 } } }
    ]);
    
    // Average match score
    const avgMatchScore = await Match.aggregate([
      { $match: { users: mongoose.Types.ObjectId(req.userId), isActive: true } },
      { $group: { _id: null, avgScore: { $avg: '$matchScore' } } }
    ]);
    
    // Most common mutual interests
    const mutualInterestsStats = await Match.aggregate([
      { $match: { users: mongoose.Types.ObjectId(req.userId), isActive: true } },
      { $unwind: '$mutualInterests' },
      { $group: { _id: '$mutualInterests', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    res.status(200).send({
      data: {
        totalMatches,
        matchTypes: matchTypeStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        averageMatchScore: avgMatchScore.length > 0 ? avgMatchScore[0].avgScore : 0,
        topMutualInterests: mutualInterestsStats.map(stat => ({
          interest: stat._id,
          count: stat.count
        }))
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
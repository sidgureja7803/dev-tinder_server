const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  matchedOn: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastMessageAt: {
    type: Date,
    default: null
  },
  mutualInterests: [{
    type: String
  }],
  matchScore: {
    type: Number,
    default: 0 // A score from 0-100 indicating the strength of the match
  },
  matchType: {
    type: String,
    enum: ['regular', 'superlike'],
    default: 'regular'
  },
  initiator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound index to ensure uniqueness of matches between two users
matchSchema.index({ users: 1 }, { unique: true });

// Method to check if a match exists between two users
matchSchema.statics.findMatch = async function(userId1, userId2) {
  const sortedUsers = [userId1, userId2].sort();
  return this.findOne({
    users: { $all: sortedUsers }
  });
};

// Method to create a match between two users
matchSchema.statics.createMatch = async function(userId1, userId2, matchType = 'regular') {
  const sortedUsers = [userId1, userId2].sort();
  
  // Find users to get their interests
  const User = mongoose.model('User');
  const [user1, user2] = await Promise.all([
    User.findById(userId1),
    User.findById(userId2)
  ]);
  
  // Calculate mutual interests
  const mutualInterests = [];
  if (user1.interests && user2.interests) {
    user1.interests.forEach(interest => {
      if (user2.interests.includes(interest)) {
        mutualInterests.push(interest);
      }
    });
  }
  
  // Calculate match score (simple algorithm, can be made more complex)
  const interestScore = mutualInterests.length * 10; // Each mutual interest adds 10 points
  const matchScore = Math.min(interestScore, 100);
  
  return this.create({
    users: sortedUsers,
    initiator: userId1,
    matchType,
    mutualInterests,
    matchScore
  });
};

module.exports = mongoose.models.Match || mongoose.model('Match', matchSchema); 
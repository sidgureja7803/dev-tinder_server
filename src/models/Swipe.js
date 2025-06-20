const mongoose = require('mongoose');

const swipeSchema = new mongoose.Schema({
  swipedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  swipedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['like', 'pass', 'superlike'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '30d' // Automatically remove swipe data after 30 days (for data management)
  }
});

// Compound index to make querying efficient
swipeSchema.index({ swipedBy: 1, swipedUser: 1 }, { unique: true });
swipeSchema.index({ swipedUser: 1, action: 1 }); // For who-liked-me queries
swipeSchema.index({ swipedBy: 1, createdAt: -1 }); // For user's swipe history

// Static method to check if there's a mutual like
swipeSchema.statics.checkMutualLike = async function(userId1, userId2) {
  const [swipe1, swipe2] = await Promise.all([
    this.findOne({ swipedBy: userId1, swipedUser: userId2 }),
    this.findOne({ swipedBy: userId2, swipedUser: userId1 })
  ]);
  
  // Both users must have liked each other (regular like or superlike)
  return (
    swipe1 && 
    swipe2 && 
    (swipe1.action === 'like' || swipe1.action === 'superlike') && 
    (swipe2.action === 'like' || swipe2.action === 'superlike')
  );
};

// Static method to create or update a swipe
swipeSchema.statics.swipe = async function(swipedById, swipedUserId, action) {
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  
  return this.findOneAndUpdate(
    { swipedBy: swipedById, swipedUser: swipedUserId },
    { action, createdAt: new Date() }, // Update timestamp on action change
    options
  );
};

// Method to get swipe statistics for a user
swipeSchema.statics.getSwipeStats = async function(userId) {
  const [sentStats, receivedStats] = await Promise.all([
    this.aggregate([
      { $match: { swipedBy: mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$action', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: { swipedUser: mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$action', count: { $sum: 1 } } }
    ])
  ]);
  
  return {
    sent: sentStats.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {}),
    received: receivedStats.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {})
  };
};

module.exports = mongoose.models.Swipe || mongoose.model('Swipe', swipeSchema); 
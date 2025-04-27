const mongoose = require('mongoose');

const swipeSchema = new mongoose.Schema({
  swiper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  swiped: {
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
swipeSchema.index({ swiper: 1, swiped: 1 }, { unique: true });

// Static method to check if there's a mutual like
swipeSchema.statics.checkMutualLike = async function(userId1, userId2) {
  const [swipe1, swipe2] = await Promise.all([
    this.findOne({ swiper: userId1, swiped: userId2 }),
    this.findOne({ swiper: userId2, swiped: userId1 })
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
swipeSchema.statics.swipe = async function(swiperId, swipedId, action) {
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  
  return this.findOneAndUpdate(
    { swiper: swiperId, swiped: swipedId },
    { action },
    options
  );
};

module.exports = mongoose.models.Swipe || mongoose.model('Swipe', swipeSchema); 
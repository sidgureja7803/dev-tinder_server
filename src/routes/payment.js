const express = require("express");
const { authenticateUser } = require("../middlewares/auth");
const paymentRouter = express.Router();
const razorpayInstance = require("../utils/razorpay");
const Payment = require("../models/payment");
const User = require("../models/User");
const Swipe = require("../models/Swipe");
const { membershipAmount } = require("../utils/constants");
const {
  validateWebhookSignature,
} = require("razorpay/dist/utils/razorpay-utils");

paymentRouter.post("/payment/create", authenticateUser, async (req, res) => {
  try {
    const { membershipType } = req.body;
    
    // Validate membership type
    if (!['gold', 'platinum'].includes(membershipType)) {
      return res.status(400).json({ msg: "Invalid membership type" });
    }
    
    // Get user info since req.user isn't directly available
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    
    const { firstName, lastName, emailId } = user;

    const order = await razorpayInstance.orders.create({
      amount: membershipAmount[membershipType] * 100,
      currency: "INR",
      receipt: "receipt#1",
      notes: {
        firstName,
        lastName,
        emailId,
        membershipType: membershipType,
      },
    });

    // Save it in my database
    console.log(order);

    const payment = new Payment({
      userId: req.userId,
      orderId: order.id,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      notes: order.notes,
    });

    const savedPayment = await payment.save();

    // Return back my order details to frontend
    res.json({ ...savedPayment.toJSON(), keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

paymentRouter.post("/payment/webhook", async (req, res) => {
  try {
    console.log("Webhook Called");
    const webhookSignature = req.get("X-Razorpay-Signature");
    console.log("Webhook Signature", webhookSignature);

    const isWebhookValid = validateWebhookSignature(
      JSON.stringify(req.body),
      webhookSignature,
      process.env.RAZORPAY_WEBHOOK_SECRET
    );

    if (!isWebhookValid) {
      console.log("INvalid Webhook Signature");
      return res.status(400).json({ msg: "Webhook signature is invalid" });
    }
    console.log("Valid Webhook Signature");

    // Update my payment Status in DB
    const paymentDetails = req.body.payload.payment.entity;

    const payment = await Payment.findOne({ orderId: paymentDetails.order_id });
    payment.status = paymentDetails.status;
    await payment.save();
    console.log("Payment saved");

    const user = await User.findOne({ _id: payment.userId });
    user.isPremium = true;
    user.membershipType = payment.notes.membershipType;
    
    // Set premium expiry based on membership type
    const now = new Date();
    if (payment.notes.membershipType === 'gold') {
      user.premiumExpiresAt = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000)); // 3 months
      user.premiumFeatures = {
        unlimitedSwipes: true,
        seeWhoLikedMe: true,
        undoSwipes: true,
        profileBoost: { daily: 0, weekly: 1 },
        aiSuggestions: true,
        prioritySupport: true
      };
    } else if (payment.notes.membershipType === 'platinum') {
      user.premiumExpiresAt = new Date(now.getTime() + (180 * 24 * 60 * 60 * 1000)); // 6 months
      user.premiumFeatures = {
        unlimitedSwipes: true,
        seeWhoLikedMe: true,
        undoSwipes: true,
        profileBoost: { daily: 0, weekly: 3 },
        aiSuggestions: true,
        superLikes: { daily: 5 },
        hideAds: true,
        vipSupport: true
      };
    }
    
    // Reset daily counters
    user.swipesCount = 0;
    user.dailySwipesLimit = 999999; // Unlimited for premium
    
    console.log("User saved");
    await user.save();

    return res.status(200).json({ msg: "Webhook received successfully" });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

paymentRouter.get("/premium/verify", authenticateUser, async (req, res) => {
  try {
    // Get user info
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    
    // Check if premium has expired
    if (user.isPremium && user.premiumExpiresAt && new Date() > user.premiumExpiresAt) {
      user.isPremium = false;
      user.premiumFeatures = {};
      user.membershipType = null;
      user.dailySwipesLimit = 10; // Reset to free limit
      await user.save();
    }
    
    // Convert to JSON object
    const userObj = user.toJSON();
    console.log(userObj);
    
    return res.json({ ...userObj });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// Get who liked me (Premium feature)
paymentRouter.get("/premium/who-liked-me", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user.isPremium) {
      return res.status(403).json({ msg: "Premium feature - upgrade to access" });
    }
    
    // Get users who liked current user
    const likesReceived = await Swipe.find({
      swipedUser: req.userId,
      action: { $in: ['like', 'superlike'] }
    })
    .populate('swipedBy', 'firstName lastName photoUrl age photos dateOfBirth')
    .sort({ createdAt: -1 })
    .limit(50);
    
    const whoLikedMe = likesReceived.map(swipe => {
      const likedByUser = swipe.swipedBy;
      return {
        userId: likedByUser._id,
        firstName: likedByUser.firstName,
        lastName: likedByUser.lastName,
        photoUrl: likedByUser.photos?.find(p => p.isPrimary)?.url || 
                  likedByUser.photos?.[0]?.url || 
                  likedByUser.photoUrl,
        age: likedByUser.age || (likedByUser.dateOfBirth ? 
             Math.floor((new Date() - new Date(likedByUser.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : null),
        likedAt: swipe.createdAt
      };
    });
    
    res.json({
      data: whoLikedMe,
      count: whoLikedMe.length
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Profile boost functionality
paymentRouter.get("/premium/boost-status", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user.isPremium) {
      return res.status(403).json({ msg: "Premium feature - upgrade to access" });
    }
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Check current boost status
    const boostStatus = {
      isActive: user.boostExpiresAt && now < user.boostExpiresAt,
      remainingMinutes: user.boostExpiresAt && now < user.boostExpiresAt ? 
                       Math.ceil((user.boostExpiresAt - now) / (1000 * 60)) : 0,
      usedToday: user.boostsUsedToday || 0,
      dailyLimit: user.premiumFeatures?.profileBoost?.weekly || 1,
      lastBoostDate: user.lastBoostDate
    };
    
    res.json({ data: boostStatus });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

paymentRouter.post("/premium/activate-boost", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user.isPremium) {
      return res.status(403).json({ msg: "Premium feature - upgrade to access" });
    }
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Check if user has boosts remaining
    const weeklyLimit = user.premiumFeatures?.profileBoost?.weekly || 1;
    const weekStart = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    if (user.boostExpiresAt && now < user.boostExpiresAt) {
      return res.status(400).json({ msg: "Boost is already active" });
    }
    
    // Reset weekly counter if needed
    if (!user.lastBoostDate || user.lastBoostDate < weekStart) {
      user.boostsUsedThisWeek = 0;
    }
    
    if (user.boostsUsedThisWeek >= weeklyLimit) {
      return res.status(400).json({ msg: "Weekly boost limit reached" });
    }
    
    // Activate boost for 30 minutes
    user.boostExpiresAt = new Date(now.getTime() + (30 * 60 * 1000));
    user.boostsUsedThisWeek = (user.boostsUsedThisWeek || 0) + 1;
    user.lastBoostDate = now;
    
    await user.save();
    
    const boostStatus = {
      isActive: true,
      remainingMinutes: 30,
      usedToday: user.boostsUsedThisWeek,
      dailyLimit: weeklyLimit
    };
    
    res.json({ 
      msg: "Boost activated successfully",
      data: boostStatus 
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// AI Suggestions (placeholder for future implementation)
paymentRouter.get("/premium/ai-suggestions", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user.isPremium) {
      return res.status(403).json({ msg: "Premium feature - upgrade to access" });
    }
    
    // Placeholder AI logic - in production, this would use ML algorithms
    const suggestions = await User.find({
      _id: { $ne: req.userId },
      isVerified: true,
      // Add AI-based filtering logic here
      skills: { $in: user.skills || [] }
    })
    .limit(10)
    .select('firstName lastName photoUrl age profession skills');
    
    res.json({
      data: suggestions.map(suggestion => ({
        ...suggestion.toJSON(),
        aiScore: Math.floor(Math.random() * 40) + 60, // Placeholder score 60-100
        reason: "Shared professional interests and compatible skills"
      }))
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Super like functionality
paymentRouter.post("/premium/super-like/:userId", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const targetUserId = req.params.userId;
    
    if (!user.isPremium) {
      return res.status(403).json({ msg: "Premium feature - upgrade to access" });
    }
    
    // Check daily super like limit
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (!user.lastSuperLikeDate || user.lastSuperLikeDate < todayStart) {
      user.superLikesUsedToday = 0;
    }
    
    const dailyLimit = user.premiumFeatures?.superLikes?.daily || 1;
    if (user.superLikesUsedToday >= dailyLimit) {
      return res.status(400).json({ msg: "Daily super like limit reached" });
    }
    
    // Record super like
    await Swipe.swipe(req.userId, targetUserId, 'superlike');
    
    user.superLikesUsedToday = (user.superLikesUsedToday || 0) + 1;
    user.lastSuperLikeDate = now;
    await user.save();
    
    res.json({ 
      msg: "Super like sent successfully",
      remaining: dailyLimit - user.superLikesUsedToday
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Premium stats dashboard
paymentRouter.get("/premium/stats", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user.isPremium) {
      return res.status(403).json({ msg: "Premium feature - upgrade to access" });
    }
    
    const likesReceived = await Swipe.countDocuments({
      swipedUser: req.userId,
      action: { $in: ['like', 'superlike'] }
    });
    
    const likesSent = await Swipe.countDocuments({
      swipedBy: req.userId,
      action: { $in: ['like', 'superlike'] }
    });
    
    const stats = {
      membershipType: user.membershipType,
      premiumSince: user.premiumSince || user.updatedAt,
      expiresAt: user.premiumExpiresAt,
      likesReceived,
      likesSent,
      boostsUsed: user.boostsUsedThisWeek || 0,
      superLikesUsed: user.superLikesUsedToday || 0,
      features: user.premiumFeatures
    };
    
    res.json({ data: stats });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = paymentRouter;

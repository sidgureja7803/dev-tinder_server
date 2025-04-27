const mongoose = require("mongoose");
const validator = require("validator");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    emailId: {
      type: String,
      lowercase: true,
      required: true,
      unique: true,
      trim: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error("Invalid email address");
        }
      },
    },
    password: {
      type: String,
      required: true,
    },
    age: {
      type: Number,
      min: 18,
    },
    gender: {
      type: String,
      enum: {
        values: ["Male", "Female", "Other"],
        message: `{VALUE} is not a valid gender type`,
      },
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    membershipType: {
      type: String,
      enum: ["free", "gold", "platinum"],
      default: "free",
    },
    photoUrl: {
      type: String,
      default: "https://geographyandyou.com/images/user-profile.png",
    },
    about: {
      type: String,
      default: "Hey there! I'm using Tinder Clone!",
    },
    skills: {
      type: [String],
      trim: true
    },
    interests: {
      type: [String],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
      },
      city: String,
      country: String,
    },
    preferredAgeMin: {
      type: Number,
      default: 18,
      min: 18
    },
    preferredAgeMax: {
      type: Number,
      default: 100
    },
    preferredDistance: {
      type: Number,
      default: 50 // in kilometers
    },
    preferredGenders: {
      type: [String],
      default: ["male", "female", "other"]
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    lastActive: {
      type: Date,
      default: Date.now
    },
    bio: {
      type: String,
      maxlength: 500
    },
    occupation: String,
    education: String,
    socialLinks: {
      instagram: String,
      twitter: String,
      linkedin: String,
      github: String
    },
    swipesCount: {
      type: Number,
      default: 0
    },
    dailySwipesLimit: {
      type: Number,
      default: 50
    },
    swipeReset: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
  }
);

// Add index for geospatial queries
userSchema.index({ location: '2dsphere' });

// Method to generate JWT token
userSchema.methods.generateToken = function() {
  return jwt.sign(
    { userId: this._id, email: this.emailId },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "7d" }
  );
};

// Check if user has reached daily swipe limit
userSchema.methods.hasReachedSwipeLimit = function() {
  // Reset swipe count if it's a new day
  const today = new Date();
  const resetDate = new Date(this.swipeReset);
  
  if (today.getDate() !== resetDate.getDate() || 
      today.getMonth() !== resetDate.getMonth() || 
      today.getFullYear() !== resetDate.getFullYear()) {
    this.swipesCount = 0;
    this.swipeReset = today;
    return false;
  }
  
  return this.swipesCount >= this.dailySwipesLimit;
};

// For backward compatibility
userSchema.methods.getJWT = function() {
  return this.generateToken();
};

userSchema.methods.validatePassword = async function(passwordInputByUser) {
  return bcrypt.compare(passwordInputByUser, this.password);
};

// Hash password before saving
userSchema.pre("save", async function(next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Export model - ensure it's not redefined
const User = mongoose.models.User || mongoose.model("User", userSchema);
module.exports = User;

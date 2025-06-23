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
    firebaseUid: {
      type: String,
      sparse: true, // Allows null values but ensures uniqueness when present
      unique: true
    },
    dateOfBirth: {
      type: Date,
      required: false,
      validate: {
        validator: function(value) {
          if (!value) return true; // Allow empty for existing users
          const age = Math.floor((Date.now() - value) / (365.25 * 24 * 60 * 60 * 1000));
          return age >= 18;
        },
        message: "Must be at least 18 years old"
      }
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
      required: false, // Will be required during onboarding
      immutable: function() {
        return this.isModified('gender') && this.gender; // Can't change once set
      }
    },
    religion: {
      type: String,
      enum: ["Hindu", "Muslim", "Christian", "Sikh", "Jain", "Buddhist", "Other", "Prefer not to say"],
      required: false
    },
    height: {
      feet: {
        type: Number,
        min: 3,
        max: 8
      },
      inches: {
        type: Number,
        min: 0,
        max: 11
      }
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
    // Enhanced photo system - support up to 5 photos
    photos: [{
      url: {
        type: String,
        required: true
      },
      isPrimary: {
        type: Boolean,
        default: false
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    // Backward compatibility
    photoUrl: {
      type: String,
      default: "https://geographyandyou.com/images/user-profile.png",
    },
    about: {
      type: String,
      default: "Hey there! I'm using Dev Tinder!",
    },
    bio: {
      type: String,
      maxlength: 500
    },
    // Professional Information
    profession: {
      type: String,
      enum: [
        "Software Engineer", 
        "Frontend Developer", 
        "Backend Developer", 
        "Full Stack Developer", 
        "Mobile Developer", 
        "DevOps Engineer", 
        "Data Scientist", 
        "ML Engineer", 
        "Product Manager", 
        "Designer", 
        "Student", 
        "Freelancer", 
        "Entrepreneur", 
        "Other"
      ]
    },
    company: {
      name: String,
      position: String,
      isCurrentlyWorking: {
        type: Boolean,
        default: false
      }
    },
    ctcRange: {
      type: String,
      enum: [
        "0-3 LPA", 
        "3-6 LPA", 
        "6-10 LPA", 
        "10-15 LPA", 
        "15-25 LPA", 
        "25-50 LPA", 
        "50+ LPA", 
        "Prefer not to say"
      ]
    },
    education: {
      college: String,
      degree: String,
      graduationYear: Number,
      level: {
        type: String,
        enum: ["High School", "Diploma", "Bachelor's", "Master's", "PhD", "Other"]
      },
      isStudent: {
        type: Boolean,
        default: false
      }
    },
    experienceLevel: {
      type: String,
      enum: ["Fresher", "0-2 years", "2-5 years", "5-10 years", "10+ years"]
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
      state: String,
      country: String,
      address: String
    },
    // Enhanced Preferences
    preferences: {
      ageRange: {
        min: {
          type: Number,
          default: 18,
          min: 18
        },
        max: {
          type: Number,
          default: 35
        }
      },
      religions: [{
        type: String,
        enum: ["Hindu", "Muslim", "Christian", "Sikh", "Jain", "Buddhist", "Other", "Prefer not to say"]
      }],
      professions: [{
        type: String
      }],
      distance: {
        type: Number,
        default: 50 // in kilometers
      },
      genders: [{
        type: String,
        enum: ["Male", "Female", "Other"]
      }],
      experienceLevels: [{
        type: String,
        enum: ["Fresher", "0-2 years", "2-5 years", "5-10 years", "10+ years"]
      }],
      educationLevels: [{
        type: String,
        enum: ["High School", "Diploma", "Bachelor's", "Master's", "PhD", "Other"]
      }],
      skills: [{
        type: String
      }],
      maxDistance: {
        type: Number,
        default: 50,
        min: 1,
        max: 500
      }
    },
    // Legacy preference fields for backward compatibility
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
      default: ["Male", "Female", "Other"]
    },
    // Enhanced Social Links
    socialLinks: {
      instagram: String,
      linkedin: String,
      twitter: String,
      github: String,
      leetcode: String,
      portfolio: String
    },
    // Swipe & Match tracking
    swipingData: {
      dailySwipeCount: {
        type: Number,
        default: 0
      },
      dailySwipeLimit: {
        type: Number,
        default: 50
      },
      lastSwipeReset: {
        type: Date,
        default: Date.now
      },
      sentLikes: [{
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        timestamp: {
          type: Date,
          default: Date.now
        }
      }],
      receivedLikes: [{
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        timestamp: {
          type: Date,
          default: Date.now
        }
      }],
      matches: [{
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        matchedAt: {
          type: Date,
          default: Date.now
        }
      }]
    },
    // Legacy swipe fields for backward compatibility
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
    },
    // User status and activity
    isVerified: {
      type: Boolean,
      default: false
    },
    lastActive: {
      type: Date,
      default: Date.now
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    profileCompletion: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    onboardingCompleted: {
      type: Boolean,
      default: false
    },
    onboardingStep: {
      type: Number,
      default: 0, // 0 means not started, 1-8 for each step, 8 means all steps complete
      min: 0,
      max: 8
    },
    // Premium features
    premiumFeatures: {
      unlimitedSwipes: {
        type: Boolean,
        default: false
      },
      whoLikedMe: {
        type: Boolean,
        default: false
      },
      undoLastSwipe: {
        type: Boolean,
        default: false
      },
      profileBoost: {
        type: Boolean,
        default: false
      },
      aiMatching: {
        type: Boolean,
        default: false
      }
    },
    // Account settings
    privacy: {
      showOnlineStatus: {
        type: Boolean,
        default: true
      },
      showLastSeen: {
        type: Boolean,
        default: true
      }
    },
    // Moderation
    blockedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    reportedUsers: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reason: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
userSchema.index({ location: '2dsphere' });
userSchema.index({ 'swipingData.lastSwipeReset': 1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ profession: 1 });
userSchema.index({ 'preferences.ageRange.min': 1, 'preferences.ageRange.max': 1 });

// Virtual for calculating age from DOB
userSchema.virtual('calculatedAge').get(function() {
  if (this.dateOfBirth) {
    return Math.floor((Date.now() - this.dateOfBirth) / (365.25 * 24 * 60 * 60 * 1000));
  }
  return this.age;
});

// Virtual for primary photo
userSchema.virtual('primaryPhoto').get(function() {
  const primary = this.photos.find(photo => photo.isPrimary);
  return primary ? primary.url : (this.photoUrl || "https://geographyandyou.com/images/user-profile.png");
});

// Method to generate JWT token
userSchema.methods.generateToken = function() {
  return jwt.sign(
    { userId: this._id, email: this.emailId },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "7d" }
  );
};

// Everyone gets unlimited swipes - app is free
userSchema.methods.hasReachedSwipeLimit = function() {
  return false; // No limits for anyone
};

// Calculate profile completion percentage
userSchema.methods.calculateProfileCompletion = function() {
  let completionScore = 0;
  const totalFields = 15; // Total important fields
  
  // Essential fields (higher weight)
  if (this.firstName) completionScore += 2;
  if (this.dateOfBirth) completionScore += 2;
  if (this.gender) completionScore += 2;
  if (this.bio && this.bio.length > 20) completionScore += 2;
  if (this.photos && this.photos.length > 0) completionScore += 2;
  
  // Professional fields
  if (this.profession) completionScore += 1;
  if (this.education && this.education.college) completionScore += 1;
  
  // Social fields
  if (this.socialLinks && Object.keys(this.socialLinks).some(key => this.socialLinks[key])) completionScore += 1;
  if (this.skills && this.skills.length > 0) completionScore += 1;
  
  // Location
  if (this.location && this.location.city) completionScore += 1;
  
  // Religion
  if (this.religion) completionScore += 1;

  this.profileCompletion = Math.round((completionScore / totalFields) * 100);
  return this.profileCompletion;
};

// Check if profile is complete enough for onboarding
userSchema.methods.isProfileComplete = function() {
  return this.firstName && 
         this.dateOfBirth && 
         this.gender && 
         this.bio && 
         this.photos && 
         this.photos.length > 0 &&
         this.profession;
};

// For backward compatibility
userSchema.methods.getJWT = function() {
  return this.generateToken();
};

userSchema.methods.validatePassword = async function(passwordInputByUser) {
  return bcrypt.compare(passwordInputByUser, this.password);
};

// Update last active and calculate age before saving
userSchema.pre("save", async function(next) {
  // NOTE: Password hashing is now handled manually in routes, not here
  
  // Update age from DOB if DOB is set
  if (this.dateOfBirth && this.isModified("dateOfBirth")) {
    this.age = Math.floor((Date.now() - this.dateOfBirth) / (365.25 * 24 * 60 * 60 * 1000));
  }
  
  // Calculate profile completion
  this.calculateProfileCompletion();
  
  // Update last active
  this.lastActive = new Date();
  
  next();
});

// Export model - ensure it's not redefined
const User = mongoose.models.User || mongoose.model("User", userSchema);
module.exports = User;

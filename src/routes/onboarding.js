const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth");
const User = require("../models/User");
const { validateProfileData } = require("../utils/validation");

// Get current onboarding status and data
router.get("/onboarding/status", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }
    
    const profileCompletion = user.calculateProfileCompletion();
    const currentStep = user.onboardingStep || 0;
    
    res.status(200).send({
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: currentStep,
      profileCompletion,
      totalSteps: 8,
      currentStepData: getCurrentStepData(user, currentStep),
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        emailId: user.emailId,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        religion: user.religion,
        height: user.height,
        bio: user.bio,
        location: user.location,
        profession: user.profession,
        company: user.company,
        ctcRange: user.ctcRange,
        education: user.education,
        photos: user.photos,
        socialLinks: user.socialLinks,
        skills: user.skills,
        interests: user.interests,
        preferences: user.preferences
      }
    });
  } catch (err) {
    console.error('Onboarding status error:', err);
    res.status(500).send({ message: "Something went wrong" });
  }
});

// Save progress for a specific step and advance to next
router.post("/onboarding/step/:stepNumber", authenticateUser, async (req, res) => {
  try {
    const { stepNumber } = req.params;
    const stepNum = parseInt(stepNumber);
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }
    
    if (stepNum < 0 || stepNum > 8) {
      return res.status(400).send({ message: "Invalid step number" });
    }
    
    const stepData = req.body;
    let updateData = {};
    
    // Validate and process each step
    switch (stepNum) {
      case 0: // Basic Information (Step 1)
        const { dateOfBirth, gender, religion, height, bio } = stepData;
        
        if (!dateOfBirth || !gender || !bio || bio.length < 20) {
          return res.status(400).send({ 
            message: "Date of birth, gender, and bio (minimum 20 characters) are required" 
          });
        }
        
        // Calculate age from date of birth
        const age = Math.floor((Date.now() - new Date(dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
        
        if (age < 18) {
          return res.status(400).send({ 
            message: "You must be 18 or older to use MergeMates" 
          });
        }
        
        updateData = {
          dateOfBirth: new Date(dateOfBirth),
          gender,
          bio: bio.trim(),
          age,
          onboardingStep: 1
        };
        
        if (religion) updateData.religion = religion;
        if (height) updateData.height = height;
        break;
        
      case 1: // Location (Step 2)
        const { location } = stepData;
        
        if (!location || !location.city || !location.country) {
          return res.status(400).send({ 
            message: "City and country are required" 
          });
        }
        
        updateData = {
          location,
          onboardingStep: 2
        };
        break;
        
      case 2: // Professional Details (Step 3)
        const { profession, company, ctcRange } = stepData;
        
        if (!profession) {
          return res.status(400).send({ 
            message: "Profession is required" 
          });
        }
        
        updateData = {
          profession,
          onboardingStep: 3
        };
        
        if (company) updateData.company = company;
        if (ctcRange) updateData.ctcRange = ctcRange;
        break;
        
      case 3: // Education (Step 4)
        const { education } = stepData;
        
        if (!education || (!education.college && !education.isStudent)) {
          return res.status(400).send({ 
            message: "Education information is required" 
          });
        }
        
        updateData = {
          education,
          onboardingStep: 4
        };
        break;
        
      case 4: // Photos (Step 5)
        const { photos } = stepData;
        
        if (!photos || photos.length === 0) {
          return res.status(400).send({ 
            message: "At least one photo is required" 
          });
        }
        
        // Process photos - ensure first is primary if none specified
        const processedPhotos = photos.map((photo, index) => ({
          url: photo.url || photo,
          isPrimary: photo.isPrimary || index === 0,
          uploadedAt: new Date()
        }));
        
        updateData = {
          photos: processedPhotos,
          onboardingStep: 5
        };
        break;
        
      case 5: // Social Links (Step 6)
        const { socialLinks } = stepData;
        
        updateData = {
          socialLinks: socialLinks || {},
          onboardingStep: 6
        };
        break;
        
      case 6: // Skills & Interests (Step 7)
        const { skills, interests } = stepData;
        
        if (!skills || skills.length < 3) {
          return res.status(400).send({ 
            message: "Please select at least 3 skills" 
          });
        }
        
        updateData = {
          skills,
          interests: interests || [],
          onboardingStep: 7
        };
        break;
        
      case 7: // Preferences (Step 8 - Final)
        const { preferences } = stepData;
        
        if (!preferences?.ageRange?.min || !preferences?.ageRange?.max) {
          return res.status(400).send({ 
            message: "Age preferences are required" 
          });
        }
        
        updateData = {
          preferences,
          onboardingStep: 8,
          onboardingCompleted: true
        };
        break;
        
      default:
        return res.status(400).send({ message: "Invalid step number" });
    }
    
    // Update user with step data
    Object.assign(user, updateData);
    await user.save();
    
    const nextStep = user.onboardingCompleted ? null : user.onboardingStep;
    
    res.status(200).send({
      message: user.onboardingCompleted ? "Onboarding completed successfully!" : "Step saved successfully",
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep,
      nextStep,
      profileCompletion: user.profileCompletion,
      currentStepData: nextStep ? getCurrentStepData(user, nextStep) : null,
      redirectTo: user.onboardingCompleted ? '/app/feed' : null
    });
    
  } catch (err) {
    console.error('Onboarding step error:', err);
    res.status(500).send({ message: "Something went wrong", error: err.message });
  }
});

// Get data for the current step (for pre-populating forms)
router.get("/onboarding/step/:stepNumber", authenticateUser, async (req, res) => {
  try {
    const { stepNumber } = req.params;
    const stepNum = parseInt(stepNumber);
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }
    
    const stepData = getCurrentStepData(user, stepNum);
    
    res.status(200).send({
      stepNumber: stepNum,
      data: stepData,
      isCompleted: stepNum < (user.onboardingStep || 0),
      canAccess: stepNum <= (user.onboardingStep || 0) // Allow access to current and previous steps
    });
    
  } catch (err) {
    console.error('Get step data error:', err);
    res.status(500).send({ message: "Something went wrong" });
  }
});

// Complete entire onboarding at once (for bulk updates)
router.post("/onboarding/complete", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }
    
    const {
      dateOfBirth, gender, religion, height, bio,
      location, profession, company, ctcRange,
      education, photos, socialLinks, skills, interests, preferences
    } = req.body;
    
    // Validate all required fields
    if (!dateOfBirth || !gender || !bio || !location?.city || !profession || !photos?.length || !skills?.length >= 3 || !preferences?.ageRange) {
      return res.status(400).send({ 
        message: "Missing required fields for onboarding completion" 
      });
    }
    
    // Calculate age
    const age = Math.floor((Date.now() - new Date(dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
    
    if (age < 18) {
      return res.status(400).send({ 
        message: "You must be 18 or older to use MergeMates" 
      });
    }
    
    // Update all fields
    Object.assign(user, {
      dateOfBirth: new Date(dateOfBirth),
      gender, religion, height, bio: bio.trim(), age,
      location, profession, company, ctcRange,
      education, photos, socialLinks: socialLinks || {},
      skills, interests: interests || [], preferences,
      onboardingStep: 8,
      onboardingCompleted: true
    });
    
    await user.save();
    
    res.status(200).send({
      message: "Onboarding completed successfully",
      onboardingCompleted: true,
      onboardingStep: 8,
      profileCompletion: user.profileCompletion,
      redirectTo: '/app/feed'
    });
    
  } catch (err) {
    console.error('Complete onboarding error:', err);
    res.status(500).send({ message: "Something went wrong" });
  }
});

// Helper function to get current step data for pre-populating forms
const getCurrentStepData = (user, stepNumber) => {
  switch (stepNumber) {
    case 0:
      return {
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        religion: user.religion,
        height: user.height,
        bio: user.bio
      };
    case 1:
      return {
        location: user.location
      };
    case 2:
      return {
        profession: user.profession,
        company: user.company,
        ctcRange: user.ctcRange
      };
    case 3:
      return {
        education: user.education
      };
    case 4:
      return {
        photos: user.photos
      };
    case 5:
      return {
        socialLinks: user.socialLinks
      };
    case 6:
      return {
        skills: user.skills,
        interests: user.interests
      };
    case 7:
      return {
        preferences: user.preferences
      };
    default:
      return {};
  }
};

module.exports = router; 
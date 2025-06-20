const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth");
const User = require("../models/User");
const { validateProfileData } = require("../utils/validation");

// Get current onboarding status
router.get("/onboarding/status", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }
    
    const missingFields = getMissingFields(user);
    const profileCompletion = user.calculateProfileCompletion();
    
    res.status(200).send({
      onboardingCompleted: user.onboardingCompleted,
      profileCompletion,
      missingFields,
      currentStep: getCurrentStep(missingFields),
      totalSteps: 6,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        emailId: user.emailId,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        bio: user.bio,
        profession: user.profession,
        skills: user.skills,
        photos: user.photos,
        location: user.location,
        preferences: user.preferences,
        height: user.height,
        religion: user.religion,
        education: user.education
      }
    });
  } catch (err) {
    console.error('Onboarding status error:', err);
    res.status(500).send({ message: "Something went wrong" });
  }
});

// Complete onboarding step
router.post("/onboarding/step/:stepNumber", authenticateUser, async (req, res) => {
  try {
    const { stepNumber } = req.params;
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }
    
    const stepData = req.body;
    let updateData = {};
    
    // Validate and process each step
    switch (parseInt(stepNumber)) {
      case 1: // Basic Information
        const { firstName, lastName, dateOfBirth, gender } = stepData;
        
        if (!firstName || !lastName || !dateOfBirth || !gender) {
          return res.status(400).send({ 
            message: "All basic information fields are required" 
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
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth: new Date(dateOfBirth),
          gender,
          age
        };
        break;
        
      case 2: // Bio and About
        const { bio, height, religion } = stepData;
        
        if (!bio || bio.length < 20) {
          return res.status(400).send({ 
            message: "Bio must be at least 20 characters long" 
          });
        }
        
        updateData = { bio: bio.trim() };
        if (height) updateData.height = height;
        if (religion) updateData.religion = religion;
        break;
        
      case 3: // Professional Information
        const { profession, company, education, experienceLevel } = stepData;
        
        if (!profession) {
          return res.status(400).send({ 
            message: "Profession is required" 
          });
        }
        
        updateData = { profession };
        if (company) updateData.company = company;
        if (education) updateData.education = education;
        if (experienceLevel) updateData.experienceLevel = experienceLevel;
        break;
        
      case 4: // Skills and Interests
        const { skills, interests } = stepData;
        
        if (!skills || skills.length < 3) {
          return res.status(400).send({ 
            message: "Please select at least 3 skills" 
          });
        }
        
        updateData = { skills };
        if (interests) updateData.interests = interests;
        break;
        
      case 5: // Photos
        const { photos } = stepData;
        
        if (!photos || photos.length === 0) {
          return res.status(400).send({ 
            message: "At least one photo is required" 
          });
        }
        
        // Ensure the first photo is marked as primary if no primary is set
        const processedPhotos = photos.map((photo, index) => ({
          url: photo.url,
          isPrimary: photo.isPrimary || index === 0
        }));
        
        updateData = { photos: processedPhotos };
        break;
        
      case 6: // Preferences and Location
        const { preferences, location } = stepData;
        
        if (!preferences?.ageRange?.min || !preferences?.ageRange?.max) {
          return res.status(400).send({ 
            message: "Age preferences are required" 
          });
        }
        
        if (!preferences?.genders || preferences.genders.length === 0) {
          return res.status(400).send({ 
            message: "Gender preferences are required" 
          });
        }
        
        updateData = { preferences };
        if (location) updateData.location = location;
        break;
        
      default:
        return res.status(400).send({ message: "Invalid step number" });
    }
    
    // Update user with step data
    Object.assign(user, updateData);
    
    // Check if onboarding is complete
    const missingFields = getMissingFields(user);
    if (missingFields.length === 0) {
      user.onboardingCompleted = true;
    }
    
    await user.save();
    
    res.status(200).send({
      message: "Step completed successfully",
      onboardingCompleted: user.onboardingCompleted,
      profileCompletion: user.profileCompletion,
      missingFields: getMissingFields(user),
      nextStep: user.onboardingCompleted ? null : getCurrentStep(getMissingFields(user))
    });
    
  } catch (err) {
    console.error('Onboarding step error:', err);
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
    
    const profileData = req.body;
    
    // Validate all required fields
    const validation = validateProfileData(profileData);
    if (!validation.isValid) {
      return res.status(400).send({ 
        message: "Profile validation failed",
        errors: validation.errors 
      });
    }
    
    // Update user with all profile data
    Object.assign(user, profileData);
    user.onboardingCompleted = true;
    
    await user.save();
    
    res.status(200).send({
      message: "Onboarding completed successfully",
      onboardingCompleted: true,
      profileCompletion: user.profileCompletion,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        profileCompletion: user.profileCompletion,
        onboardingCompleted: user.onboardingCompleted
      }
    });
    
  } catch (err) {
    console.error('Complete onboarding error:', err);
    res.status(500).send({ message: "Something went wrong" });
  }
});

// Helper functions
const getMissingFields = (user) => {
  const missing = [];
  
  if (!user.firstName) missing.push('firstName');
  if (!user.lastName) missing.push('lastName');
  if (!user.dateOfBirth) missing.push('dateOfBirth');
  if (!user.gender) missing.push('gender');
  if (!user.bio || user.bio.length < 20) missing.push('bio');
  if (!user.photos || user.photos.length === 0) missing.push('photos');
  if (!user.profession) missing.push('profession');
  if (!user.skills || user.skills.length === 0) missing.push('skills');
  if (!user.location || !user.location.city) missing.push('location');
  if (!user.preferences || !user.preferences.ageRange) missing.push('preferences');
  
  return missing;
};

const getCurrentStep = (missingFields) => {
  if (missingFields.includes('firstName') || missingFields.includes('lastName') || 
      missingFields.includes('dateOfBirth') || missingFields.includes('gender')) {
    return 1; // Basic Information
  }
  if (missingFields.includes('bio')) {
    return 2; // Bio and About
  }
  if (missingFields.includes('profession')) {
    return 3; // Professional Information
  }
  if (missingFields.includes('skills')) {
    return 4; // Skills and Interests
  }
  if (missingFields.includes('photos')) {
    return 5; // Photos
  }
  if (missingFields.includes('preferences') || missingFields.includes('location')) {
    return 6; // Preferences and Location
  }
  return null; // All complete
};

module.exports = router; 
const validator = require("validator");

const validateSignUpData = (req) => {
  const { firstName, lastName, emailId, password } = req.body;
  if (!firstName || !lastName) {
    throw new Error("Name is not valid!");
  } else if (!validator.isEmail(emailId)) {
    throw new Error("Email is not valid!");
  } else if (!validator.isStrongPassword(password)) {
    throw new Error("Please enter a strong Password!");
  }
};

const validateEditProfileData = (req) => {
  const allowedEditFields = [
    "firstName",
    "lastName",
    "emailId",
    "photoUrl",
    "gender",
    "age",
    "about",
    "skills",
  ];

  const isEditAllowed = Object.keys(req.body).every((field) =>
    allowedEditFields.includes(field)
  );

  return isEditAllowed;
};

const validateProfileData = (profileData) => {
  const errors = [];
  
  // Basic Information Validation
  if (!profileData.firstName || profileData.firstName.trim().length < 2) {
    errors.push("First name must be at least 2 characters long");
  }
  
  if (!profileData.lastName || profileData.lastName.trim().length < 2) {
    errors.push("Last name must be at least 2 characters long");
  }
  
  if (!profileData.dateOfBirth) {
    errors.push("Date of birth is required");
  } else {
    const age = Math.floor((Date.now() - new Date(profileData.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 18) {
      errors.push("You must be 18 or older to use MergeMates");
    }
    if (age > 100) {
      errors.push("Please enter a valid date of birth");
    }
  }
  
  if (!profileData.gender || !['Male', 'Female', 'Other'].includes(profileData.gender)) {
    errors.push("Valid gender selection is required");
  }
  
  // Bio Validation
  if (!profileData.bio || profileData.bio.trim().length < 20) {
    errors.push("Bio must be at least 20 characters long");
  }
  
  if (profileData.bio && profileData.bio.length > 500) {
    errors.push("Bio must be less than 500 characters");
  }
  
  // Professional Information Validation
  const validProfessions = [
    "Software Engineer", "Frontend Developer", "Backend Developer", 
    "Full Stack Developer", "Mobile Developer", "DevOps Engineer", 
    "Data Scientist", "ML Engineer", "Product Manager", "Designer", 
    "Student", "Freelancer", "Entrepreneur", "Other"
  ];
  
  if (!profileData.profession || !validProfessions.includes(profileData.profession)) {
    errors.push("Valid profession selection is required");
  }
  
  // Skills Validation
  if (!profileData.skills || profileData.skills.length < 3) {
    errors.push("At least 3 skills are required");
  }
  
  if (profileData.skills && profileData.skills.length > 20) {
    errors.push("Maximum 20 skills allowed");
  }
  
  // Photos Validation
  if (!profileData.photos || profileData.photos.length === 0) {
    errors.push("At least one photo is required");
  }
  
  if (profileData.photos && profileData.photos.length > 6) {
    errors.push("Maximum 6 photos allowed");
  }
  
  // Preferences Validation
  if (!profileData.preferences) {
    errors.push("Preferences are required");
  } else {
    if (!profileData.preferences.ageRange || 
        !profileData.preferences.ageRange.min || 
        !profileData.preferences.ageRange.max) {
      errors.push("Age range preferences are required");
    } else {
      if (profileData.preferences.ageRange.min < 18 || profileData.preferences.ageRange.max > 100) {
        errors.push("Age range must be between 18 and 100");
      }
      if (profileData.preferences.ageRange.min >= profileData.preferences.ageRange.max) {
        errors.push("Minimum age must be less than maximum age");
      }
    }
    
    if (!profileData.preferences.genders || profileData.preferences.genders.length === 0) {
      errors.push("Gender preferences are required");
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateOnboardingStep = (stepNumber, stepData) => {
  const errors = [];
  
  switch (parseInt(stepNumber)) {
    case 1: // Basic Information
      if (!stepData.firstName || stepData.firstName.trim().length < 2) {
        errors.push("First name is required and must be at least 2 characters");
      }
      if (!stepData.lastName || stepData.lastName.trim().length < 2) {
        errors.push("Last name is required and must be at least 2 characters");
      }
      if (!stepData.dateOfBirth) {
        errors.push("Date of birth is required");
      }
      if (!stepData.gender) {
        errors.push("Gender selection is required");
      }
      break;
      
    case 2: // Bio and About
      if (!stepData.bio || stepData.bio.length < 20) {
        errors.push("Bio must be at least 20 characters long");
      }
      break;
      
    case 3: // Professional Information
      if (!stepData.profession) {
        errors.push("Profession is required");
      }
      break;
      
    case 4: // Skills and Interests
      if (!stepData.skills || stepData.skills.length < 3) {
        errors.push("At least 3 skills are required");
      }
      break;
      
    case 5: // Photos
      if (!stepData.photos || stepData.photos.length === 0) {
        errors.push("At least one photo is required");
      }
      break;
      
    case 6: // Preferences and Location
      if (!stepData.preferences || !stepData.preferences.ageRange) {
        errors.push("Age preferences are required");
      }
      if (!stepData.preferences || !stepData.preferences.genders || stepData.preferences.genders.length === 0) {
        errors.push("Gender preferences are required");
      }
      break;
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateSignUpData,
  validateEditProfileData,
  validateProfileData,
  validateOnboardingStep,
};

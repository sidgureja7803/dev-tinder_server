const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { authenticateUser } = require("../middlewares/auth");

// In-memory OTP storage (in production, use Redis or a database)
const otpStorage = {};

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "your-email@gmail.com",
    pass: process.env.EMAIL_PASSWORD || "your-app-password"
  }
});

// Function to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Function to send OTP via email
const sendOTP = async (email, otp) => {
  const mailOptions = {
    from: `"Merge Mates" <${process.env.EMAIL_USER || "noreply@mergemates.app"}>`,
    to: email,
    subject: "🔐 Your Merge Mates Verification Code",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
      </head>
      <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px;">
          <div style="max-width: 600px; width: 100%; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border-radius: 20px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1); overflow: hidden;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #e91e63, #ad1457); padding: 40px 30px; text-align: center;">
              <div style="display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <svg width="50" height="50" viewBox="0 0 32 32" style="margin-right: 15px;">
                  <circle cx="16" cy="16" r="16" fill="white"/>
                  <path d="M16 24l-6.5-6.5c-1.5-1.5-1.5-4 0-5.5s4-1.5 5.5 0l1 1 1-1c1.5-1.5 4-1.5 5.5 0s1.5 4 0 5.5L16 24z" fill="#e91e63"/>
                  <path d="M8 10l-2 2 2 2M24 10l2 2-2 2" stroke="#e91e63" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Merge Mates</h1>
              </div>
              <h2 style="color: white; margin: 0; font-size: 24px; font-weight: 500;">Welcome to the Developer Community! 👨‍💻</h2>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h3 style="color: #333; margin: 0 0 15px 0; font-size: 22px;">Email Verification Required</h3>
                <p style="color: #666; margin: 0; font-size: 16px; line-height: 1.5;">
                  Please use the verification code below to complete your signup and join the community of developers, engineers, and tech professionals.
                </p>
              </div>

              <!-- OTP Code -->
              <div style="background: linear-gradient(135deg, #f8f9fa, #e9ecef); border: 2px dashed #e91e63; border-radius: 15px; padding: 30px; text-align: center; margin: 30px 0;">
                <p style="color: #666; margin: 0 0 15px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
                <div style="background: white; border-radius: 10px; padding: 20px; box-shadow: 0 4px 15px rgba(233, 30, 99, 0.1);">
                  <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #e91e63; font-family: 'Courier New', monospace;">${otp}</span>
                </div>
              </div>

              <!-- Instructions -->
              <div style="background: #f8f9fa; border-radius: 10px; padding: 20px; margin: 25px 0;">
                <h4 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">📱 How to use this code:</h4>
                <ol style="color: #666; margin: 0; padding-left: 20px; line-height: 1.6;">
                  <li>Return to the Merge Mates verification page</li>
                  <li>Enter the 6-digit code above</li>
                  <li>Click "Verify OTP" to complete your registration</li>
                </ol>
              </div>

              <!-- Timer Warning -->
              <div style="text-align: center; margin: 25px 0;">
                <p style="color: #ff6b6b; margin: 0; font-size: 14px; font-weight: 500;">
                  ⏰ This code expires in 10 minutes
                </p>
              </div>

              <!-- Call to Action -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="#" style="display: inline-block; background: linear-gradient(135deg, #e91e63, #ad1457); color: white; text-decoration: none; padding: 15px 30px; border-radius: 25px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(233, 30, 99, 0.3);">
                  Continue to Merge Mates →
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">
                Welcome to the community where developers connect! 💝
              </p>
              <p style="color: #999; margin: 0; font-size: 12px;">
                If you didn't request this verification, please ignore this email.<br>
                This email was sent from Merge Mates - The Developer Dating Platform
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return transporter.sendMail(mailOptions);
};

// Signup route
router.post("/signup", async (req, res) => {
  try {
    const { firstName, lastName, emailId, password } = req.body;

    if (!firstName || !lastName || !emailId || !password) {
      return res.status(400).send({
        message: "All fields are required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ emailId });
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).send({
          message: "User already registered with this email. Please login instead.",
        });
      } else {
        // User exists but not verified, resend OTP
        const otp = generateOTP();
        
        // Store OTP with expiry (10 minutes)
        otpStorage[emailId] = {
          otp,
          expiresAt: Date.now() + 10 * 60 * 1000,
        };

        // Send OTP to user's email
        await sendOTP(emailId, otp);

        return res.status(200).send({
          message: "Account exists but not verified. Verification code sent to email.",
          data: {
            userId: existingUser._id,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            emailId: existingUser.emailId,
            isVerified: existingUser.isVerified,
          },
        });
      }
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with expiry (10 minutes)
    otpStorage[emailId] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };

    // Send OTP to user's email
    await sendOTP(emailId, otp);

    // Hash password before saving
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user in unverified state
    const newUser = new User({
      firstName,
      lastName,
      emailId,
      password: hashedPassword,
      isVerified: false,
      onboardingCompleted: false,
    });

    await newUser.save();

    res.status(201).send({
      message: "User created successfully. Verification code sent to email.",
      data: {
        userId: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        emailId: newUser.emailId,
        isVerified: newUser.isVerified,
        onboardingCompleted: newUser.onboardingCompleted,
      },
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message,
    });
  }
});

// Verify OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { emailId, otp } = req.body;

    if (!emailId || !otp) {
      return res.status(400).send({
        message: "Email and OTP are required",
      });
    }

    // Check if OTP exists and is valid
    const otpData = otpStorage[emailId];
    if (!otpData || otpData.otp !== otp || Date.now() > otpData.expiresAt) {
      return res.status(400).send({
        message: "Invalid or expired OTP",
      });
    }

    // Mark user as verified
    const user = await User.findOneAndUpdate(
      { emailId },
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).send({
        message: "User not found",
      });
    }

    // Clear OTP
    delete otpStorage[emailId];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.emailId },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    // Set cookie
    res.cookie("jwt", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Calculate profile completion
    user.calculateProfileCompletion();

    res.status(200).send({
      message: "Email verified successfully",
      data: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        emailId: user.emailId,
        isVerified: user.isVerified,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep || 0,
        profileCompletion: user.profileCompletion,
        requiresOnboarding: !user.onboardingCompleted,
        redirectTo: user.isVerified && !user.onboardingCompleted ? '/onboarding' : '/app/feed'
      },
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message,
    });
  }
});

// Resend OTP
router.post("/resend-otp", async (req, res) => {
  try {
    const { emailId } = req.body;

    if (!emailId) {
      return res.status(400).send({
        message: "Email is required",
      });
    }

    // Check if user exists
    const user = await User.findOne({ emailId });
    if (!user) {
      return res.status(404).send({
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).send({
        message: "User is already verified",
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    
    // Store OTP with expiry (10 minutes)
    otpStorage[emailId] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };

    // Send OTP to user's email
    await sendOTP(emailId, otp);

    res.status(200).send({
      message: "Verification code sent to email",
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message,
    });
  }
});

// Google OAuth route
router.post("/oauth/google", async (req, res) => {
  try {
    const { emailId, firstName, lastName, photoUrl } = req.body;

    if (!emailId) {
      return res.status(400).send({
        message: "Email is required",
      });
    }

    // Check if user exists
    let user = await User.findOne({ emailId });
    
    if (!user) {
      // Create user if doesn't exist
      user = new User({
        firstName: firstName || "User",
        lastName: lastName || "",
        emailId,
        photoUrl,
        isVerified: true, // OAuth users are already verified
        onboardingCompleted: false,
        password: await bcrypt.hash(Math.random().toString(36).slice(-8), 10), // Random password
      });
      
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.emailId },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    // Set cookie
    res.cookie("jwt", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Calculate profile completion
    user.calculateProfileCompletion();

    res.status(200).send({
      message: "Login successful",
      data: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        emailId: user.emailId,
        photoUrl: user.photoUrl,
        isVerified: user.isVerified,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep || 0,
        profileCompletion: user.profileCompletion,
        requiresOnboarding: !user.onboardingCompleted,
        redirectTo: user.isVerified && !user.onboardingCompleted ? '/onboarding' : '/app/feed'
      },
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message,
    });
  }
});

// GitHub OAuth route
router.post("/oauth/github", async (req, res) => {
  try {
    const { emailId, firstName, lastName, photoUrl } = req.body;

    if (!emailId) {
      return res.status(400).send({
        message: "Email is required",
      });
    }

    // Check if user exists
    let user = await User.findOne({ emailId });
    
    if (!user) {
      // Create user if doesn't exist
      user = new User({
        firstName: firstName || "GitHub",
        lastName: lastName || "User",
        emailId,
        photoUrl,
        isVerified: true, // OAuth users are already verified
        onboardingCompleted: false,
        password: await bcrypt.hash(Math.random().toString(36).slice(-8), 10), // Random password
      });
      
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.emailId },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    // Set cookie
    res.cookie("jwt", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Calculate profile completion
    user.calculateProfileCompletion();

    res.status(200).send({
      message: "Login successful",
      data: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        emailId: user.emailId,
        photoUrl: user.photoUrl,
        isVerified: user.isVerified,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep || 0,
        profileCompletion: user.profileCompletion,
        requiresOnboarding: !user.onboardingCompleted,
        redirectTo: user.isVerified && !user.onboardingCompleted ? '/onboarding' : '/app/feed'
      },
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message,
    });
  }
});

// Login route
router.post("/login", async (req, res) => {
  try {
    const { emailId, password } = req.body;
    
    console.log("Received login request for email:", emailId);

    if (!emailId || !password) {
      return res.status(400).send({
        message: "Email and password are required",
      });
    }

    // Find user
    const user = await User.findOne({ emailId });
    if (!user) {
      return res.status(401).send({
        message: "Invalid credentials. Please check your email and password.",
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(400).send({
        message: "Please verify your email before logging in. Check your inbox for verification code.",
        requiresVerification: true,
        emailId: user.emailId
      });
    }

    // Verify password using bcrypt compare
    console.log("🔍 DEBUG - Password verification:");
    console.log("Input password:", password);
    console.log("Stored hash length:", user.password.length);
    console.log("Stored hash starts with:", user.password.substring(0, 10));
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Password validation result:", isPasswordValid);
    
    if (!isPasswordValid) {
      return res.status(401).send({
        message: "Invalid credentials. Please check your email and password.",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.emailId },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    // Set cookie
    res.cookie("jwt", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Calculate profile completion
    user.calculateProfileCompletion();

    // Send response with onboarding status
    res.status(200).send({
      message: "Login successful",
      data: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        emailId: user.emailId,
        photoUrl: user.photoUrl,
        isVerified: user.isVerified,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep || 0,
        profileCompletion: user.profileCompletion,
        requiresOnboarding: !user.onboardingCompleted,
        redirectTo: user.isVerified && !user.onboardingCompleted ? '/onboarding' : '/app/feed'
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send({
      message: "Something went wrong",
      error: err.message,
    });
  }
});

// Logout route
router.post("/logout", (req, res) => {
  res.clearCookie("jwt");
  res.status(200).send({
    message: "Logout successful",
  });
});

// Get current user
router.get("/me", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).send({
        message: "User not found",
      });
    }

    res.status(200).send({
      data: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        emailId: user.emailId,
        photoUrl: user.photoUrl,
        about: user.about,
        age: user.age,
        gender: user.gender,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message,
    });
  }
});

// Forgot Password route
router.post("/forgot-password", async (req, res) => {
  try {
    const { emailId } = req.body;

    if (!emailId) {
      return res.status(400).send({
        message: "Email is required",
      });
    }

    // Check if user exists
    const user = await User.findOne({ emailId });
    if (!user) {
      return res.status(404).send({
        message: "No account exists with this email address",
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(400).send({
        message: "Please verify your email address first",
      });
    }

    // Check if there's an existing OTP that hasn't expired
    const existingOTP = otpStorage[emailId];
    if (existingOTP && existingOTP.expiresAt > Date.now()) {
      const timeLeft = Math.ceil((existingOTP.expiresAt - Date.now()) / 1000);
      return res.status(429).send({
        message: `Please wait ${timeLeft} seconds before requesting a new OTP`,
      });
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with expiry (10 minutes)
    otpStorage[emailId] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      type: 'forgot-password',
      attempts: 0 // Track failed attempts
    };

    // Send OTP to user's email
    await sendOTP(emailId, otp);

    res.status(200).send({
      message: "Password reset code sent to your email",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).send({
      message: "Failed to process forgot password request",
      error: err.message,
    });
  }
});

// Verify Forgot Password OTP
router.post("/verify-forgot-password-otp", async (req, res) => {
  try {
    const { emailId, otp } = req.body;

    if (!emailId || !otp) {
      return res.status(400).send({
        message: "Email and OTP are required",
      });
    }

    // Check if user exists
    const user = await User.findOne({ emailId });
    if (!user) {
      return res.status(404).send({
        message: "No account exists with this email address",
      });
    }

    // Check if OTP exists and is valid
    const otpData = otpStorage[emailId];
    if (!otpData || otpData.type !== 'forgot-password') {
      return res.status(400).send({
        message: "No OTP request found. Please request a new OTP",
      });
    }

    if (Date.now() > otpData.expiresAt) {
      delete otpStorage[emailId];
      return res.status(400).send({
        message: "OTP has expired. Please request a new one",
      });
    }

    // Check max attempts
    if (otpData.attempts >= 3) {
      delete otpStorage[emailId];
      return res.status(400).send({
        message: "Too many failed attempts. Please request a new OTP",
      });
    }

    if (otpData.otp !== otp) {
      otpData.attempts += 1;
      return res.status(400).send({
        message: "Invalid OTP",
        attemptsLeft: 3 - otpData.attempts
      });
    }

    // Clear OTP after successful verification
    delete otpStorage[emailId];

    // Generate a temporary token for password reset
    const resetToken = jwt.sign(
      { userId: user._id, email: user.emailId, purpose: 'reset-password' },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: '15m' }
    );

    res.status(200).send({
      message: "OTP verified successfully",
      resetToken
    });
  } catch (err) {
    console.error("OTP verification error:", err);
    res.status(500).send({
      message: "Failed to verify OTP",
      error: err.message,
    });
  }
});

// Reset Password
router.post("/reset-password", async (req, res) => {
  try {
    const { emailId, newPassword, resetToken } = req.body;

    if (!emailId || !newPassword || !resetToken) {
      return res.status(400).send({
        message: "Email, new password and reset token are required",
      });
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET || "your-secret-key");
    } catch (err) {
      return res.status(401).send({
        message: "Invalid or expired reset token. Please start the reset process again",
      });
    }

    if (decoded.email !== emailId || decoded.purpose !== 'reset-password') {
      return res.status(401).send({
        message: "Invalid reset token",
      });
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).send({
        message: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number and one special character",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password
    const user = await User.findOneAndUpdate(
      { emailId },
      { 
        password: hashedPassword,
        passwordChangedAt: new Date() // Track when password was changed
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).send({
        message: "User not found",
      });
    }

    res.status(200).send({
      message: "Password reset successful. Please login with your new password",
    });
  } catch (err) {
    console.error("Password reset error:", err);
    res.status(500).send({
      message: "Failed to reset password",
      error: err.message,
    });
  }
});

// Resend Forgot Password OTP
router.post("/resend-forgot-password-otp", async (req, res) => {
  try {
    const { emailId } = req.body;

    if (!emailId) {
      return res.status(400).send({
        message: "Email is required",
      });
    }

    // Check if user exists
    const user = await User.findOne({ emailId });
    if (!user) {
      return res.status(404).send({
        message: "User not found",
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    
    // Store OTP with expiry (10 minutes)
    otpStorage[emailId] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      type: 'forgot-password'
    };

    // Send OTP to user's email
    await sendOTP(emailId, otp);

    res.status(200).send({
      message: "Password reset code sent to email",
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message,
    });
  }
});

// TEMPORARY: Fix password for existing users with double-hashing issue
router.post("/fix-password", async (req, res) => {
  try {
    const { emailId, newPassword } = req.body;

    if (!emailId || !newPassword) {
      return res.status(400).send({
        message: "Email and new password are required",
      });
    }

    // Find user
    const user = await User.findOne({ emailId });
    if (!user) {
      return res.status(404).send({
        message: "User not found",
      });
    }

    // Hash the new password properly
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password directly (bypassing pre-save hook)
    await User.updateOne(
      { emailId },
      { $set: { password: hashedPassword } }
    );

    res.status(200).send({
      message: "Password updated successfully. You can now login with your new password.",
    });
  } catch (err) {
    res.status(500).send({
      message: "Something went wrong",
      error: err.message,
    });
  }
});

// DEBUG: Test password hashing (remove in production)
router.post("/debug-password", async (req, res) => {
  try {
    const { password } = req.body;
    
    // Hash password same way as User model
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Test comparison
    const isMatch = await bcrypt.compare(password, hashedPassword);
    
    res.json({
      original: password,
      hashed: hashedPassword,
      matches: isMatch
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

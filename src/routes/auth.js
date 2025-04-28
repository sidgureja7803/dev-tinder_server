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
    from: process.env.EMAIL_USER || "your-email@gmail.com",
    to: email,
    subject: "Email Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">Email Verification</h2>
        <p style="color: #666;">Please use the following verification code to complete your signup:</p>
        <div style="background-color: #f5f5f5; padding: 12px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold; margin: 20px 0; border-radius: 5px;">${otp}</div>
        <p style="color: #666;">This code will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 12px; margin-top: 30px; text-align: center;">If you didn't request this, please ignore this email.</p>
      </div>
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
      return res.status(400).send({
        message: "User already exists with this email",
      });
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

    // Hash password with a consistent salt rounds
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in unverified state
    const newUser = new User({
      firstName,
      lastName,
      emailId,
      password: hashedPassword,
      isVerified: false,
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

    res.status(200).send({
      message: "Email verified successfully",
      data: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        emailId: user.emailId,
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
        isVerified: true, // Google users are already verified
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

    res.status(200).send({
      message: "Login successful",
      data: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        emailId: user.emailId,
        photoUrl: user.photoUrl,
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
        message: "Invalid credentials, user not found",
      });
    }

    // Verify password using bcrypt compare
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Password validation result:", isPasswordValid);
    
    if (!isPasswordValid) {
      return res.status(401).send({
        message: "Invalid credentials, password is incorrect",
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

    // Send response
    res.status(200).send({
      message: "Login successful",
      data: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        emailId: user.emailId,
        photoUrl: user.photoUrl,
        isVerified: user.isVerified
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
        isPremium: user.isPremium,
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

module.exports = router;

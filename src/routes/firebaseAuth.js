const express = require("express");
const router = express.Router();
const { auth } = require("../config/firebase");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Firebase token verification and user creation/login
router.post("/firebase-auth", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Firebase ID token is required"
      });
    }

    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Find or create user in our database
    let user = await User.findOne({ emailId: decodedToken.email });
    
    if (!user) {
      // Create new user
      const hashedPassword = await bcrypt.hash(Math.random().toString(36).slice(-8), 10);
      
      user = new User({
        firstName: decodedToken.name?.split(' ')[0] || 'User',
        lastName: decodedToken.name?.split(' ').slice(1).join(' ') || '',
        emailId: decodedToken.email,
        photoUrl: decodedToken.picture,
        isVerified: decodedToken.email_verified || true,
        firebaseUid: decodedToken.uid,
        password: hashedPassword
      });
      
      await user.save();
      console.log('New user created from Firebase:', user.emailId);
    } else {
      // Update Firebase UID if not present
      if (!user.firebaseUid) {
        user.firebaseUid = decodedToken.uid;
        await user.save();
      }
    }

    // Generate our own JWT token for session management
    const token = jwt.sign(
      { userId: user._id, email: user.emailId },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    // Set cookie
    res.cookie("jwt", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.json({
      success: true,
      message: "Authentication successful",
      data: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        emailId: user.emailId,
        photoUrl: user.photoUrl,
        isVerified: user.isVerified,
        isVerified: user.isVerified,
        membershipType: user.membershipType
      }
    });

  } catch (error) {
    console.error('Firebase authentication error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        success: false,
        message: 'Token revoked. Please login again.',
        code: 'TOKEN_REVOKED'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Invalid Firebase token',
      error: error.message
    });
  }
});

// Custom token creation for existing users
router.post("/create-custom-token", async (req, res) => {
  try {
    const { emailId } = req.body;

    if (!emailId) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Find user in database
    const user = await User.findOne({ emailId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Create custom token for existing user
    let customToken;
    if (user.firebaseUid) {
      customToken = await auth.createCustomToken(user.firebaseUid);
    } else {
      // Create Firebase user if doesn't exist
      try {
        const firebaseUser = await auth.createUser({
          email: user.emailId,
          displayName: `${user.firstName} ${user.lastName}`,
          photoURL: user.photoUrl
        });
        
        // Update our user record
        user.firebaseUid = firebaseUser.uid;
        await user.save();
        
        customToken = await auth.createCustomToken(firebaseUser.uid);
      } catch (firebaseError) {
        if (firebaseError.code === 'auth/email-already-exists') {
          // Get existing Firebase user
          const firebaseUser = await auth.getUserByEmail(user.emailId);
          user.firebaseUid = firebaseUser.uid;
          await user.save();
          customToken = await auth.createCustomToken(firebaseUser.uid);
        } else {
          throw firebaseError;
        }
      }
    }

    res.json({
      success: true,
      customToken
    });

  } catch (error) {
    console.error('Custom token creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create custom token',
      error: error.message
    });
  }
});

// Revoke refresh tokens for user
router.post("/revoke-refresh-tokens", async (req, res) => {
  try {
    const { firebaseUid } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({
        success: false,
        message: "Firebase UID is required"
      });
    }

    await auth.revokeRefreshTokens(firebaseUid);
    
    res.json({
      success: true,
      message: "Refresh tokens revoked successfully"
    });

  } catch (error) {
    console.error('Token revocation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke tokens',
      error: error.message
    });
  }
});

// Delete Firebase user
router.delete("/delete-firebase-user", async (req, res) => {
  try {
    const { firebaseUid } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({
        success: false,
        message: "Firebase UID is required"
      });
    }

    await auth.deleteUser(firebaseUid);
    
    res.json({
      success: true,
      message: "Firebase user deleted successfully"
    });

  } catch (error) {
    console.error('Firebase user deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete Firebase user',
      error: error.message
    });
  }
});

module.exports = router; 
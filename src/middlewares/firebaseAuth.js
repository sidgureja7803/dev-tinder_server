const { auth } = require('../config/firebase');
const User = require('../models/User');

// Middleware to verify Firebase ID tokens
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided or invalid format'
      });
    }

    const idToken = authHeader.split(' ')[1];

    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Find or create user in our database
    let user = await User.findOne({ emailId: decodedToken.email });
    
    if (!user) {
      // Create new user if doesn't exist
      user = new User({
        firstName: decodedToken.name?.split(' ')[0] || 'User',
        lastName: decodedToken.name?.split(' ').slice(1).join(' ') || '',
        emailId: decodedToken.email,
        photoUrl: decodedToken.picture,
        isVerified: decodedToken.email_verified || true,
        firebaseUid: decodedToken.uid,
        // Generate a random password for database compatibility
        password: require('bcrypt').hashSync(Math.random().toString(36).slice(-8), 10)
      });
      
      await user.save();
      console.log('New user created from Firebase token:', user.emailId);
    } else {
      // Update Firebase UID if not present
      if (!user.firebaseUid) {
        user.firebaseUid = decodedToken.uid;
        await user.save();
      }
    }

    // Attach user info to request
    req.user = user;
    req.userId = user._id;
    req.firebaseUser = decodedToken;
    
    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    
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
      message: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

// Middleware that supports both JWT and Firebase tokens
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.jwt;

  // Check if Firebase token is present
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return verifyFirebaseToken(req, res, next);
  }
  
  // Fallback to existing JWT cookie authentication
  if (cookieToken) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(cookieToken, process.env.JWT_SECRET || "your-secret-key");
      
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }
      
      req.user = user;
      req.userId = user._id;
      
      return next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid JWT token'
      });
    }
  }
  
  return res.status(401).json({
    success: false,
    message: 'No authentication token provided'
  });
};

module.exports = {
  verifyFirebaseToken,
  authenticateUser
}; 
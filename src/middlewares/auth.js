const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticateUser = async (req, res, next) => {
  try {
    // Get token from cookies or Authorization header
    const token = req.cookies.jwt || 
                 (req.headers.authorization && req.headers.authorization.startsWith('Bearer') 
                  ? req.headers.authorization.split(' ')[1] : null);
    
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Set userId in req for use in route handlers
    req.userId = decoded.userId;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = { authenticateUser };

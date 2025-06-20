# MergeMates Backend API 🚀

> **Completely Free Developer Dating Platform - Backend Server**

A modern, scalable Node.js backend for MergeMates - the free developer dating platform. Built with Express, MongoDB, Socket.IO, and Firebase Auth.

## 🌟 Features

### Core Features
- **User Authentication** - Firebase Auth + JWT tokens
- **Profile Management** - Complete developer profiles with skills, education, work
- **Smart Matching** - AI-powered compatibility scoring algorithm
- **Real-time Chat** - WebSocket-based messaging system
- **Feed System** - Intelligent user discovery with preferences
- **Match System** - Mutual likes, super likes, and match notifications
- **AI Integration** - Novita AI for enhanced insights and chatbot responses

### Security & Performance
- **Firebase Admin SDK** - Secure server-side authentication
- **CORS Protection** - Configurable cross-origin resource sharing
- **Rate Limiting** - Built-in request throttling
- **Input Validation** - Comprehensive data validation
- **MongoDB Indexes** - Optimized database queries
- **WebSocket Security** - Authenticated real-time connections

## 🛠 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.x
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Firebase Admin SDK + JWT
- **Real-time**: Socket.IO for WebSocket connections
- **Email**: Nodemailer with Gmail SMTP
- **AI**: Novita AI integration (optional)
- **Validation**: Custom validation middleware
- **Security**: CORS, bcrypt, cookie-parser

## 📋 Prerequisites

- **Node.js** 18.0.0 or higher
- **MongoDB Atlas** account (or local MongoDB)
- **Firebase Project** with Admin SDK
- **Gmail Account** with App Password (for emails)
- **Novita AI Account** (optional, for enhanced AI features)

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd server

# Install dependencies
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp env.sample .env

# Edit .env with your actual values
nano .env
```

### 3. Configure Environment Variables

See the **Environment Variables** section below for detailed configuration.

### 4. Start Development Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:7777`

## 🔧 Environment Variables

### Required Variables (15 total)

#### Application (4 variables)
```env
NODE_ENV=production
PORT=7777
APP_NAME=MergeMates
APP_URL=https://api.mergemates.com
```

#### Database (1 variable)
```env
DB_CONNECTION_SECRET=mongodb+srv://username:password@cluster.mongodb.net/mergemates
```

#### Security (3 variables)
```env
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters
COOKIE_SECRET=your_cookie_secret
COOKIE_SECURE=true
```

#### Firebase Admin SDK (6 variables)
```env
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your_project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id
FIREBASE_PRIVATE_KEY_ID=your_key_id
FIREBASE_CLIENT_X509_CERT_URL=your_cert_url
```

#### Email (3 variables)
```env
EMAIL_USER=your.email@gmail.com
EMAIL_PASSWORD=your_16_char_gmail_app_password
EMAIL_FROM=team@mergemates.com
```

#### CORS (2 variables)
```env
FRONTEND_URL=https://mergemates.com
ALLOWED_ORIGINS=https://mergemates.com,https://www.mergemates.com
```

### Optional Variables

#### Backend AI (1 variable)
```env
NOVITA_AI_API_KEY=your_novita_api_key  # Optional for enhanced AI features
```

## 📚 API Documentation

### Authentication Endpoints

#### POST `/auth/signup`
Create a new user account
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "emailId": "john@example.com",
  "password": "securePassword123"
}
```

#### POST `/auth/login`
Login with email and password
```json
{
  "emailId": "john@example.com",
  "password": "securePassword123"
}
```

#### POST `/auth/logout`
Logout current user (clears cookies)

### Profile Endpoints

#### GET `/profile/view`
Get current user's profile (authenticated)

#### PATCH `/profile/edit`
Update user profile (authenticated)
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "bio": "Full-stack developer passionate about React and Node.js",
  "profession": "Software Engineer",
  "skills": ["JavaScript", "React", "Node.js", "MongoDB"]
}
```

### Feed & Matching

#### GET `/feed`
Get personalized user feed (authenticated)
- Returns up to 50 compatible users
- Applies user preferences (age, location, profession)
- Includes compatibility scores

#### POST `/swipe/:action/:userId`
Record swipe action (authenticated)
- Actions: `like`, `pass`, `superlike`
- Returns match information if mutual like

#### POST `/undo`
Undo last swipe (authenticated)
- Free for all users

### Chat System

#### GET `/chat/matches`
Get all matches for current user (authenticated)

#### GET `/chat/:matchId/messages`
Get messages for a specific match (authenticated)

#### POST `/chat/:matchId/send`
Send message to a match (authenticated)
```json
{
  "message": "Hey! Nice to match with you!"
}
```

### AI Features

#### GET `/feed/ai-insights`
Get AI-powered profile insights (authenticated)
- Profile optimization tips
- Matching recommendations
- Conversation starters

## 🔌 WebSocket Events

### Connection
```javascript
const socket = io('ws://localhost:7777');

// Join user's room
socket.emit('join', { userId: 'user_id_here' });
```

### Chat Messages
```javascript
// Send message
socket.emit('sendMessage', {
  matchId: 'match_id',
  message: 'Hello!',
  senderId: 'sender_id'
});

// Receive message
socket.on('newMessage', (data) => {
  console.log('New message:', data);
});
```

### Match Notifications
```javascript
// Receive match notification
socket.on('newMatch', (matchData) => {
  console.log('New match!', matchData);
});
```

## 🗄 Database Schema

### User Model
```javascript
{
  firstName: String,
  lastName: String,
  emailId: String (unique),
  password: String (hashed),
  age: Number,
  gender: String,
  dateOfBirth: Date,
  bio: String,
  profession: String,
  skills: [String],
  photos: [{
    url: String,
    isPrimary: Boolean
  }],
  location: {
    type: "Point",
    coordinates: [Number], // [longitude, latitude]
    city: String,
    state: String
  },
  preferences: {
    ageRange: { min: Number, max: Number },
    genders: [String],
    maxDistance: Number,
    professions: [String]
  },
  isVerified: Boolean,
  lastActive: Date,
  profileComplete: Boolean
}
```

### Match Model
```javascript
{
  user1: ObjectId,
  user2: ObjectId,
  matchType: String, // 'regular' or 'superlike'
  compatibility: Number,
  mutualInterests: [String],
  isActive: Boolean,
  createdAt: Date
}
```

## 🚀 Deployment

### Railway Deployment

1. **Create Railway Account**
   - Sign up at [railway.app](https://railway.app)
   - Connect your GitHub repository

2. **Configure Environment**
   - Add all required environment variables in Railway dashboard
   - Set `NODE_ENV=production`

3. **Deploy**
   ```bash
   # Railway will automatically deploy from your main branch
   # Access your app at: https://your-app.railway.app
   ```

### Heroku Deployment

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   heroku login
   ```

2. **Create Heroku App**
   ```bash
   heroku create mergemates-api
   ```

3. **Configure Environment**
   ```bash
   # Set all environment variables
   heroku config:set NODE_ENV=production
   heroku config:set PORT=7777
   # ... add all other variables
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 7777
CMD ["npm", "start"]
```

## 🔧 Development

### Project Structure
```
server/
├── src/
│   ├── config/          # Database & Firebase config
│   ├── controllers/     # Route controllers
│   ├── middlewares/     # Auth & validation middleware
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── services/        # External services (AI, email)
│   └── utils/           # Utilities (socket, cron, validation)
├── .env.sample          # Environment template
├── .gitignore          # Git ignore patterns
├── package.json        # Dependencies & scripts
└── README.md           # This file
```

### Available Scripts

```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Run tests (if configured)
npm test

# Check code style
npm run lint

# Fix code style issues
npm run lint:fix
```

### Adding New Routes

1. **Create Route File**
   ```javascript
   // src/routes/newFeature.js
   const express = require('express');
   const router = express.Router();
   const { authenticateUser } = require('../middlewares/auth');
   
   router.get('/new-feature', authenticateUser, (req, res) => {
     res.json({ message: 'New feature endpoint' });
   });
   
   module.exports = router;
   ```

2. **Register Route**
   ```javascript
   // src/app.js
   const newFeatureRouter = require('./routes/newFeature');
   app.use('/', newFeatureRouter);
   ```

## 🔒 Security Best Practices

### Environment Variables
- **Never commit `.env` files** to version control
- Use strong, unique secrets for JWT and cookies
- Rotate API keys regularly
- Use environment-specific configurations

### Database Security
- Use MongoDB Atlas with IP whitelisting
- Enable authentication and authorization
- Use connection string with authentication
- Regular backups and monitoring

### API Security
- Implement rate limiting
- Validate all inputs
- Use HTTPS in production
- Implement proper CORS policies
- Sanitize user data

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check MongoDB connection string
# Ensure IP is whitelisted in MongoDB Atlas
# Verify username/password
```

#### Firebase Auth Errors
```bash
# Verify Firebase project configuration
# Check private key formatting (newlines)
# Ensure service account has proper permissions
```

#### CORS Issues
```bash
# Update ALLOWED_ORIGINS in .env
# Check frontend URL configuration
# Verify credentials: true in CORS config
```

#### WebSocket Connection Issues
```bash
# Check if Socket.IO is properly initialized
# Verify client-server version compatibility
# Check firewall/proxy settings
```

## 📊 Monitoring & Logging

### Health Check Endpoint
```bash
GET /health
# Returns server status and timestamp
```

### Logging
- All errors are logged to console
- API requests are logged in development
- Database operations are monitored
- WebSocket connections are tracked

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Create a GitHub issue for bugs or feature requests
- **Email**: Contact team@mergemates.com for support

---

**Made with ❤️ for the developer community**

*MergeMates - Where developers find their perfect match! 💕* 
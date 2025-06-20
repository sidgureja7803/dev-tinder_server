# Firebase Backend Integration Setup Guide

## Overview
This guide will help you set up Firebase Admin SDK in your backend to create a unified authentication system between frontend and backend.

## Prerequisites
1. Firebase project already created (devtinder-e1df5)
2. Frontend Firebase configuration working

## Step 1: Generate Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (devtinder-e1df5)
3. Go to Project Settings (gear icon)
4. Navigate to "Service accounts" tab
5. Click "Generate new private key"
6. Download the JSON file and keep it secure

## Step 2: Environment Variables

Add these environment variables to your `.env` file:

```env
# Firebase Admin SDK Configuration
FIREBASE_PROJECT_ID=devtinder-e1df5
FIREBASE_PRIVATE_KEY_ID=your_private_key_id_from_json
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@devtinder-e1df5.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id_from_json
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40devtinder-e1df5.iam.gserviceaccount.com
```

## Step 3: Alternative Setup (Using Service Account File)

Instead of environment variables, you can place the downloaded JSON file in your server directory:

1. Save the JSON file as `firebase-service-account.json` in the server root
2. Update `server/src/config/firebase.js`:

```javascript
// Alternative initialization using service account file
const serviceAccount = require('../../firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
});
```

## Step 4: Frontend Integration

Update your frontend to send Firebase ID tokens to the backend:

```javascript
// In your frontend authentication
import { getAuth, getIdToken } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;

if (user) {
  const idToken = await getIdToken(user);
  
  // Send to backend
  const response = await fetch('/firebase-auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken })
  });
}
```

## Step 5: Testing

1. Test Firebase authentication: `POST /firebase-auth`
2. Test protected routes with Firebase tokens: `Authorization: Bearer <firebase_id_token>`
3. Verify user creation/update in MongoDB

## Features Added

### Authentication Methods
- **Firebase ID Token Verification**: Verify tokens sent from frontend
- **Dual Authentication**: Support both Firebase tokens and JWT cookies
- **Auto User Creation**: Create MongoDB users from Firebase authentication
- **Token Management**: Create custom tokens, revoke tokens

### API Endpoints
- `POST /firebase-auth` - Authenticate with Firebase ID token
- `POST /create-custom-token` - Create custom token for existing users
- `POST /revoke-refresh-tokens` - Revoke user's refresh tokens
- `DELETE /delete-firebase-user` - Delete Firebase user

### Database Integration
- Added `firebaseUid` field to User model
- Automatic user sync between Firebase and MongoDB
- Preserve existing user data during Firebase migration

## Security Considerations

1. **Token Verification**: All Firebase tokens are verified server-side
2. **User Sync**: Firebase users are synced with MongoDB users
3. **Error Handling**: Proper error codes for expired/revoked tokens
4. **Environment Security**: Keep service account credentials secure

## Migration Strategy

For existing users:
1. When they login with email/password, create Firebase user
2. Link Firebase UID to existing MongoDB user
3. Future logins can use either method

## Testing Commands

```bash
# Test Firebase authentication
curl -X POST http://localhost:7777/firebase-auth \
  -H "Content-Type: application/json" \
  -d '{"idToken": "your_firebase_id_token"}'

# Test protected route with Firebase token
curl -X GET http://localhost:7777/feed \
  -H "Authorization: Bearer your_firebase_id_token"
```

## Troubleshooting

1. **Permission Denied**: Check service account permissions
2. **Invalid Token**: Verify Firebase project configuration
3. **User Not Found**: Check user creation logic in middleware
4. **CORS Issues**: Ensure proper CORS configuration for frontend

This integration provides a seamless authentication experience between your React frontend using Firebase Auth and your Node.js backend. 
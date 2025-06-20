const admin = require('firebase-admin');

// Firebase Admin SDK configuration
const firebaseConfig = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // If environment variables are not set, use default credentials
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
        databaseURL: `https://${firebaseConfig.project_id}-default-rtdb.firebaseio.com`
      });
      console.log('Firebase Admin initialized with service account credentials');
    } else {
      // For development, you can use the Firebase CLI credentials
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || "mergemates-project-id"
      });
      console.log('Firebase Admin initialized with default credentials');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

// Export auth instance
const auth = admin.auth();
const firestore = admin.firestore();

module.exports = {
  admin,
  auth,
  firestore
}; 
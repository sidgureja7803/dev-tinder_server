# Image Upload Setup Guide

## 📸 Overview
This feature allows users to upload up to 5 profile images during the onboarding process (Step 5). Images are stored in Cloudinary and optimized for web display.

## 🔧 Setup Instructions

### 1. Create Cloudinary Account
1. Go to [Cloudinary.com](https://cloudinary.com) and create a free account
2. Navigate to your dashboard to get your credentials
3. Note down:
   - Cloud Name
   - API Key
   - API Secret

### 2. Environment Variables
Add these variables to your `.env` file:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

### 3. Folder Configuration
Images will be automatically uploaded to the `mergemates-profiles` folder in your Cloudinary account with these settings:
- **Size**: 800x800px (square crop)
- **Quality**: Auto-optimized
- **Formats**: JPG, PNG, WEBP supported
- **Max Size**: 5MB per image

## 🏗️ Technical Implementation

### Backend Routes
- `POST /upload/image` - Upload single image
- `POST /upload/images` - Upload multiple images (max 5)
- `DELETE /upload/image/:publicId` - Delete image from Cloudinary
- `POST /upload/save-photos` - Save photo URLs to user profile

### Frontend Component
- **ImageUpload.jsx** - Drag & drop upload component
- **Features**:
  - Drag and drop files
  - Click to select files
  - Reorder images (first image = primary)
  - Delete images
  - Progress indicators
  - Error handling

### Database Schema
```javascript
photos: [{
  url: String,           // Cloudinary URL
  isPrimary: Boolean,    // First image is primary
  uploadedAt: Date       // Upload timestamp
}]
```

## 🎯 User Experience

### Onboarding Step 5 - Photos
1. **Upload Area**: Drag & drop or click to select images
2. **Preview Grid**: Shows uploaded images with thumbnails
3. **Reordering**: Drag images to reorder (first = primary)
4. **Deletion**: Click X button to remove images
5. **Validation**: At least 1 image required to proceed

### Features
- ✅ Upload up to 5 images
- ✅ First image automatically set as primary
- ✅ Drag and drop reordering
- ✅ Individual image deletion
- ✅ Real-time upload progress
- ✅ File type and size validation
- ✅ Responsive design
- ✅ Error handling and user feedback

## 🔒 Security & Validation

### File Validation
- **Types**: Only image files (PNG, JPG, JPEG, WEBP)
- **Size**: Maximum 5MB per file
- **Count**: Maximum 5 images per user
- **Authentication**: Only authenticated users can upload

### Cloudinary Security
- Images are publicly accessible but organized in folders
- Original filenames are replaced with Cloudinary public IDs
- Automatic image optimization and compression
- CDN delivery for fast loading

## 🚀 Testing

### Manual Testing
1. Navigate to onboarding step 5
2. Try uploading different image formats
3. Test drag and drop functionality
4. Test reordering images
5. Test deletion functionality
6. Verify primary image selection

### API Testing
```bash
# Upload single image
curl -X POST http://localhost:7777/upload/image \
  -H "Content-Type: multipart/form-data" \
  -F "image=@test-image.jpg" \
  --cookie "jwt=your_jwt_token"

# Delete image
curl -X DELETE http://localhost:7777/upload/image/public_id_here \
  --cookie "jwt=your_jwt_token"
```

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid credentials"**
   - Check Cloudinary environment variables
   - Verify credentials in Cloudinary dashboard

2. **"File too large"**
   - Images must be under 5MB
   - Consider compressing images before upload

3. **"Failed to upload"**
   - Check internet connection
   - Verify JWT authentication
   - Check browser console for detailed errors

4. **Images not displaying**
   - Verify Cloudinary URLs are accessible
   - Check CORS settings if serving from different domain

### Logs
Check server logs for detailed error messages:
```bash
npm run dev  # Development mode with detailed logging
```

## 📱 Mobile Compatibility
- Touch-friendly drag and drop
- Responsive grid layout
- Camera/gallery access on mobile devices
- Optimized for smaller screens

## 🔮 Future Enhancements
- [ ] Image cropping tool
- [ ] Filters and effects
- [ ] Background removal
- [ ] AI-powered photo suggestions
- [ ] Bulk upload from social media
- [ ] Photo verification system 
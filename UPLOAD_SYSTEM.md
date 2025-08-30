# File Upload System Documentation

## Overview
This system allows direct file uploads from the admin panel to the server's file system. Images are stored locally and served via static file serving.

## Features
- **Direct File Upload**: Upload images directly from admin panel
- **File Validation**: Image type and size validation (max 5MB)
- **Drag & Drop**: Support for drag and drop file uploads
- **Multiple Upload**: Support for single and multiple file uploads
- **File Management**: Upload, view, and delete files
- **Static Serving**: Files are served via HTTP for easy access

## API Endpoints

### Upload Single File
```
POST /api/v1/upload/single
Content-Type: multipart/form-data

Body:
- image: File (required)
```

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "filename": "image-1234567890-123456789.jpg",
    "originalName": "product-image.jpg",
    "size": 1024000,
    "mimetype": "image/jpeg",
    "url": "http://localhost:5000/uploads/images/image-1234567890-123456789.jpg"
  }
}
```

### Upload Multiple Files
```
POST /api/v1/upload/multiple
Content-Type: multipart/form-data

Body:
- images: File[] (required, max 10 files)
```

### Delete File
```
DELETE /api/v1/upload/:filename
```

## File Storage

### Directory Structure
```
ecommerce-backend/
├── uploads/
│   └── images/
│       ├── image-1234567890-123456789.jpg
│       ├── image-1234567890-987654321.png
│       └── ...
```

### File Naming Convention
- Format: `{fieldname}-{timestamp}-{random}.{extension}`
- Example: `image-1234567890-123456789.jpg`

### File Access
- Files are served at: `http://localhost:5000/uploads/images/{filename}`
- Direct URL access for images in frontend

## Frontend Integration

### ImageUpload Component
The `ImageUpload` component provides:
- Drag & drop functionality
- File type validation
- Size validation
- Upload progress indication
- Error handling
- Preview of uploaded images

### Usage Example
```jsx
import ImageUpload from '@/components/Common/ImageUpload'

<ImageUpload
    onImageUpload={(url) => setFormData(prev => ({ ...prev, image: url }))}
    onImageRemove={() => setFormData(prev => ({ ...prev, image: '' }))}
    currentImage={formData.image}
    label="Product Image"
    maxSize={5} // 5MB
/>
```

## Configuration

### Environment Variables
```env
BASE_URL=http://localhost:5000  # For generating file URLs
```

### File Limits
- **Max File Size**: 5MB
- **Max Files**: 10 (for multiple upload)
- **Allowed Types**: image/* (jpg, jpeg, png, gif, webp, etc.)

## Security Considerations

### File Validation
- Only image files are allowed
- File size limits enforced
- Unique filenames prevent conflicts
- File type validation on both frontend and backend

### Access Control
- Files are publicly accessible (for image serving)
- Consider implementing authentication for sensitive files
- File deletion requires proper authorization

## Deployment Notes

### VPS Deployment
1. Ensure uploads directory has proper permissions
2. Configure nginx/apache to serve static files
3. Set proper BASE_URL in environment variables
4. Consider using CDN for better performance

### Directory Permissions
```bash
# Create uploads directory with proper permissions
mkdir -p uploads/images
chmod 755 uploads
chmod 755 uploads/images
```

### Nginx Configuration (Optional)
```nginx
location /uploads {
    alias /path/to/your/app/uploads;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Error Handling

### Common Errors
- **File too large**: Returns 400 with size limit message
- **Invalid file type**: Returns 400 with type restriction message
- **No file uploaded**: Returns 400 with missing file message
- **Server error**: Returns 500 with generic error message

### Frontend Error Display
- Real-time validation feedback
- Upload progress indication
- Error message display
- Retry functionality

## Maintenance

### Cleanup
- Implement periodic cleanup of unused files
- Monitor disk usage
- Consider implementing file lifecycle management

### Backup
- Include uploads directory in backup strategy
- Consider cloud storage for redundancy
- Implement file versioning if needed

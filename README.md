# IPTV Backend API

A comprehensive IPTV (Internet Protocol Television) backend API built with Node.js, Express, and MongoDB. This API provides complete functionality for managing channels, users, subscriptions, payments, and watch history.

## Features

### 🎬 Channel Management
- CRUD operations for channels
- Category-based organization
- Premium/free channel support
- Streaming URL generation with security tokens
- Channel status management (active/inactive/maintenance)
- Search and filtering capabilities

### 👥 User Management
- User registration and authentication
- Multiple login methods (SID, Email, Google OAuth)
- Profile management
- Password change functionality
- Admin user management

### 💳 Subscription System
- Multiple subscription plans (Free, Basic, Premium, VIP)
- Subscription lifecycle management
- Plan comparison and features
- Subscription statistics

### 💰 Payment Processing
- Multiple payment methods (bKash, Nagad, Rocket, Card)
- Payment webhook support
- Transaction tracking
- Payment statistics and analytics

### 📊 Watch History & Analytics
- User watch history tracking
- Channel analytics
- Viewing statistics
- Device and session tracking

### 🔐 Security Features
- JWT-based authentication
- Role-based access control
- Admin middleware
- Secure streaming tokens
- Input validation and sanitization

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **Validation**: Built-in validation
- **Error Handling**: Custom error classes
- **Logging**: Morgan

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd iptv-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   NODE_ENV=development
   PORT=8000
   MONGODB_URI=mongodb://localhost:27017/iptv
   JWT_SECRET=your-super-secret-jwt-key-here
   STREAMING_BASE_URL=http://localhost:8000
   PAYMENT_GATEWAY_URL=https://payment.example.com
   ```

4. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Documentation

The complete API documentation is available in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

### Quick Start Examples

#### Register a new user
```bash
curl -X POST http://localhost:8000/api/v1/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "phone": "1234567890"
  }'
```

#### Login
```bash
curl -X POST http://localhost:8000/api/v1/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "john@example.com",
    "password": "password123"
  }'
```

#### Get channels
```bash
curl -X GET http://localhost:8000/api/v1/channel?page=1&limit=10
```

## Project Structure

```
src/
├── app.js                 # Main application file
├── config/
│   ├── db.js             # Database configuration
│   └── cloudinary.js     # Cloudinary configuration
├── controllers/
│   ├── authController.js  # Authentication logic
│   ├── channelController.js # Channel management
│   ├── categoryController.js # Category management
│   ├── subscriptionController.js # Subscription logic
│   ├── paymentController.js # Payment processing
│   ├── userController.js  # User management
│   └── watchHistoryController.js # Watch history
├── middlewares/
│   ├── verifyToken.js    # JWT verification
│   └── adminAuth.js      # Admin authentication
├── models/
│   ├── User.js           # User model
│   ├── Channel.js        # Channel model
│   ├── Category.js       # Category model
│   ├── Subscription.js   # Subscription model
│   ├── Payment.js        # Payment model
│   └── WatchHistory.js   # Watch history model
├── routes/
│   ├── index.js          # Main routes
│   ├── user.route.js     # User routes
│   ├── channel.route.js  # Channel routes
│   ├── category.route.js # Category routes
│   ├── subscription.route.js # Subscription routes
│   ├── payment.route.js  # Payment routes
│   └── watchHistory.route.js # Watch history routes
├── services/             # Business logic services
└── utils/
    ├── sendResponse.js   # Response utility
    └── errorHandler.js   # Error handling
```

## Database Models

### User
- Basic user information
- Authentication details
- Role-based access control
- SID (System ID) for easy identification

### Channel
- Channel metadata
- Streaming URLs (encrypted)
- Category association
- Premium/free classification
- Status management

### Category
- Channel categorization
- Hierarchical organization
- Status management

### Subscription
- User subscription details
- Plan information
- Expiry management
- Payment association

### Payment
- Transaction details
- Payment method tracking
- Status management
- Webhook processing

### WatchHistory
- User viewing behavior
- Channel analytics
- Session tracking
- Device information

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `8000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/iptv` |
| `JWT_SECRET` | JWT signing secret | Required |
| `STREAMING_BASE_URL` | Base URL for streaming | `http://localhost:8000` |
| `PAYMENT_GATEWAY_URL` | Payment gateway URL | `https://payment.example.com` |

## API Endpoints Overview

### Authentication
- `POST /api/v1/user/register` - Register new user
- `POST /api/v1/user/login` - Login with SID/Email
- `POST /api/v1/user/google-auth` - Google OAuth
- `GET /api/v1/user/profile` - Get user profile
- `PUT /api/v1/user/profile` - Update profile

### Channels
- `GET /api/v1/channel` - Get all channels
- `GET /api/v1/channel/:id` - Get channel details
- `GET /api/v1/channel/:id/stream` - Get streaming URL
- `POST /api/v1/channel` - Create channel (admin)
- `PUT /api/v1/channel/:id` - Update channel (admin)

### Categories
- `GET /api/v1/category` - Get all categories
- `GET /api/v1/category/:id` - Get category with channels
- `POST /api/v1/category` - Create category (admin)

### Subscriptions
- `GET /api/v1/subscription/my-subscription` - Get user subscription
- `GET /api/v1/subscription/plans` - Get available plans
- `POST /api/v1/subscription/subscribe` - Subscribe to plan

### Payments
- `POST /api/v1/payment/create` - Create payment
- `GET /api/v1/payment/history` - Get payment history
- `POST /api/v1/payment/webhook` - Payment webhook

### Watch History
- `GET /api/v1/watch-history/my-history` - Get user watch history
- `POST /api/v1/watch-history/add` - Add watch history
- `GET /api/v1/watch-history/stats/my-stats` - Get watch stats

## Development

### Running in Development Mode
```bash
npm run dev
```

### Running Tests
```bash
npm test
```

### Code Linting
```bash
npm run lint
```

## Deployment

### Production Build
```bash
npm run build
```

### Environment Setup for Production
1. Set `NODE_ENV=production`
2. Configure MongoDB connection string
3. Set secure JWT secret
4. Configure payment gateway URLs
5. Set up proper CORS origins

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8000
CMD ["npm", "start"]
```

## Security Considerations

1. **JWT Tokens**: Use strong secrets and implement token refresh
2. **Input Validation**: All inputs are validated and sanitized
3. **Rate Limiting**: Implement rate limiting for production
4. **CORS**: Configure CORS properly for your frontend domains
5. **HTTPS**: Use HTTPS in production
6. **Database Security**: Use MongoDB authentication and network security

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue in the repository
- Check the API documentation
- Review the code examples

## Changelog

### v1.0.0
- Initial release
- Complete CRUD operations for all entities
- Authentication and authorization
- Payment processing
- Watch history tracking
- Admin management system 
# Quick Setup Guide - Import Channel Data

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set up Environment
Create a `.env` file in the root directory:
```env
NODE_ENV=development
PORT=8000
MONGODB_URI=mongodb://localhost:27017/iptv
JWT_SECRET=your-super-secret-jwt-key-here
STREAMING_BASE_URL=http://localhost:8000
PAYMENT_GATEWAY_URL=https://payment.example.com
```

### 3. Start MongoDB
Make sure MongoDB is running on your system.

### 4. Import Channel Data
```bash
# Import channels from channels.json
npm run seed
```

### 5. Start the Server
```bash
# Development mode
npm run dev
```

### 6. Test the API
```bash
# Test API endpoints
npm run test:api
```

## 📊 What Gets Imported

From your `channels.json` file, the script will create:

### Categories (9 total)
- Bangladesh (22 channels)
- Indian Bangla (7 channels)  
- Sports (13 channels)
- Music (6 channels)
- Kids (6 channels)
- News (6 channels)
- Infotainment (3 channels)
- Movies (3 channels)
- Documentary (1 channel)

### Channels (120 total)
- All channels from your JSON file
- Automatically categorized
- Premium/free classification
- Quality detection (HD/SD)
- Language and country mapping

## 🧪 Test Your API

After seeding, you can test these endpoints:

```bash
# Health check
curl http://localhost:8000/api/v1/health

# Get all categories
curl http://localhost:8000/api/v1/category

# Get all channels
curl http://localhost:8000/api/v1/channel

# Search channels
curl "http://localhost:8000/api/v1/channel/search?q=sports"

# Get free channels
curl http://localhost:8000/api/v1/channel/free
```

## 🔄 Reset and Re-import

If you need to start fresh:

```bash
# Clear database and re-import
npm run seed:reset
```

## 📈 Expected Results

After running the seed script, you should see:

```
🎉 Seeding completed!
📊 Summary:
   - Total channels processed: 120
   - New channels created: 120
   - Categories: 9

📈 Database Statistics:
   - Total channels in DB: 120
   - Total categories in DB: 9
   - Premium channels: 25
   - Free channels: 95
```

## 🎯 Next Steps

1. **Test the API** - Use the test script to verify everything works
2. **Create a user** - Register a user to test authentication
3. **Test streaming** - Try the streaming endpoints
4. **Build frontend** - Connect your frontend to these endpoints

## 🆘 Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check your connection string in `.env`

### Seeding Errors
- Make sure `channels.json` is in the project root
- Check file permissions
- Verify JSON format is valid

### API Test Fails
- Ensure server is running (`npm run dev`)
- Check server port in `.env`
- Verify MongoDB connection

## 📝 API Endpoints Available

After seeding, you can use all these endpoints:

### Public Endpoints
- `GET /api/v1/health` - Health check
- `GET /api/v1/category` - All categories
- `GET /api/v1/channel` - All channels
- `GET /api/v1/channel/search` - Search channels
- `GET /api/v1/channel/free` - Free channels only

### Protected Endpoints (require authentication)
- `GET /api/v1/channel/:id` - Channel details
- `GET /api/v1/channel/:id/stream` - Streaming URL
- `GET /api/v1/category/:id` - Category with channels

### Admin Endpoints (require admin access)
- `POST /api/v1/channel` - Create channel
- `PUT /api/v1/channel/:id` - Update channel
- `DELETE /api/v1/channel/:id` - Delete channel

Your IPTV backend is now ready with all your channel data! 🎉 
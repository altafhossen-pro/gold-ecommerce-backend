const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');
const expressSyncHelper = require('express-sync-helper');
const { globalErrorHandler, notFound } = require('./utils/errorHandler');
const dotenv = require('dotenv');
const routes = require('./routes/index');

dotenv.config();
const app = express();

// Connect to MongoDB
connectDB();

// CORS Configuration - Single middleware to avoid conflicts
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://64.227.133.212',
    'http://forpink.com',
    'https://forpink.com',
    'http://www.forpink.com',
    'https://www.forpink.com',
    'http://api.forpink.com',
    'https://api.forpink.com',
    'http://64.227.133.212:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(expressSyncHelper());


// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/v1', routes);

app.get('/', (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'Welcome to Forpink Server',
        version: '1.0.0',
        author: 'Forpink',
        ip: req.ip,
        port: process.env.PORT,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        platform: process.platform,
    });
});


// 404 Route
app.use(notFound);

// Global Error Handler
app.use(globalErrorHandler);

module.exports = app;

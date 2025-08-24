const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { globalErrorHandler, notFound } = require('./utils/errorHandler');
const dotenv = require('dotenv');
const routes = require('./routes/index');

dotenv.config();
const app = express();

const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://iptv-bd.netlify.app'
];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});
// Connect to MongoDB
connectDB();

// Middlewares
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://iptv-bd.netlify.app',
        'https://monowartv.netlify.app',
    ],
    credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1', routes);

app.get('/', (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'Welcome to IPTV Server',
    });
});


// 404 Route
app.use(notFound);

// Global Error Handler
app.use(globalErrorHandler);

module.exports = app;

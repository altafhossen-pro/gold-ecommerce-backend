// middlewares/verifyToken.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendResponse = require('../utils/sendResponse');

const verifyToken = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Access token is required'
            });
        }

        // Check if token starts with "Bearer "
        if (!authHeader.startsWith('Bearer ')) {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Invalid token format. Use Bearer token'
            });
        }

        // Extract token
        const token = authHeader.substring(7); // Remove "Bearer " prefix

        if (!token) {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Access token is required'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');

        if (!decoded.userId) {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Invalid token payload'
            });
        }

        // Find user in database
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'User not found. Token may be invalid'
            });
        }

        // Check if user account is active
        if (user.status !== 'active') {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Account is suspended or deactivated'
            });
        }

        // Attach user to request object
        req.user = {
            userId: user._id,
            sid: user.sid,
            email: user.email,
            name: user.name,
            status: user.status,
            avatar: user.avatar,
            phone: user.phone,
            last_login: user.last_login,
            created_at: user.created_at
        };

        // Continue to next middleware/controller
        next();

    } catch (error) {
        console.error('Token verification error:', error);

        // Handle specific JWT errors
        if (error.name === 'JsonWebTokenError') {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Token has expired. Please login again'
            });
        }

        if (error.name === 'NotBeforeError') {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Token not active yet'
            });
        }

        // General server error
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error during authentication'
        });
    }
};

module.exports = verifyToken;
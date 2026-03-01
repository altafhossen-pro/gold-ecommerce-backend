// middlewares/verifyToken.js
const jwtService = require('../services/jwtService');
const { User } = require('../modules/user/user.model');
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
        
        // Verify token using service (this may throw JWT errors)
        let decoded;
        try {
            decoded = jwtService.verifyToken(token);
        } catch (jwtError) {
            // Re-throw JWT errors to be caught by outer catch block
            throw jwtError;
        }

        if (!decoded || !decoded.userId) {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Invalid token payload'
            });
        }

        // Find user in database (may throw database errors)
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
        req.user = user;
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

        // Handle Mongoose CastError (invalid ObjectId)
        if (error.name === 'CastError' || error.kind === 'ObjectId') {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Invalid token. User ID is invalid'
            });
        }

        // Handle database connection errors
        if (error.name === 'MongoError' || error.name === 'MongooseError') {
            return sendResponse({
                res,
                statusCode: 503,
                success: false,
                message: 'Database connection error. Please try again later'
            });
        }

        // Handle error messages from jwtService
        if (error.message && error.message.includes('Token')) {
            if (error.message.includes('expired')) {
                return sendResponse({
                    res,
                    statusCode: 401,
                    success: false,
                    message: 'Token has expired. Please login again'
                });
            }
            if (error.message.includes('Invalid')) {
                return sendResponse({
                    res,
                    statusCode: 401,
                    success: false,
                    message: 'Invalid token'
                });
            }
        }

        // General server error (only for unexpected errors)
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error during authentication'
        });
    }
};

module.exports = verifyToken;
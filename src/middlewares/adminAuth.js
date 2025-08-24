// middlewares/adminAuth.js
const User = require('../models/User');
const sendResponse = require('../utils/sendResponse');

const adminAuth = async (req, res, next) => {
    try {
        // First verify the token (this should be called before adminAuth)
        if (!req.user || !req.user.userId) {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Authentication required'
            });
        }

        // Check if user exists and is admin
        const user = await User.findById(req.user.userId);
        if (!user) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'User not found'
            });
        }

        // Check if user is admin (you can modify this logic based on your admin system)
        if (!user.is_admin && !user.role === 'admin') {
            return sendResponse({
                res,
                statusCode: 403,
                success: false,
                message: 'Admin access required'
            });
        }

        // Add admin info to request
        req.admin = {
            userId: user._id,
            name: user.name,
            email: user.email,
            role: user.role || 'admin'
        };

        next();
    } catch (error) {
        console.error('Admin auth error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error during admin authentication'
        });
    }
};

module.exports = adminAuth; 
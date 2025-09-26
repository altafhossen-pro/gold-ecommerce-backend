
const { User } = require('../modules/user/user.model');
const sendResponse = require('../utils/sendResponse');
const jwtService = require('../services/jwtService');

const verifyTokenAdmin = async (req, res, next) => {
    try {
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

        // Verify admin token using service
        const decoded = jwtService.verifyAdminToken(token);

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
        req.user = user;

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

module.exports = verifyTokenAdmin; 
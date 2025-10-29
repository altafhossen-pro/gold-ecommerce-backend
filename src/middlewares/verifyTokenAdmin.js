
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

        // Check if user is admin - Admin access is via roleId only
        let isAdmin = false;

        // NEW SYSTEM: Check roleId (role-based system)
        if (user.roleId) {
            const { Role } = require('../modules/role/role.model');
            const role = await Role.findById(user.roleId);
            
            if (role && role.isActive) {
                // Super admin or any role with admin permissions
                if (role.isSuperAdmin) {
                    isAdmin = true;
                } else {
                    // Check if role has any admin-level permissions
                    await role.populate('permissions');
                    // If role has permissions, consider them admin
                    if (role.permissions && role.permissions.length > 0) {
                        isAdmin = true;
                    }
                }
            }
        }

        // OLD SYSTEM: Backward compatibility - only check if no roleId (for existing admin users without roleId)
        // This is only for backward compatibility during migration
        if (!isAdmin && !user.roleId && (user.role === 'admin' || user.is_admin)) {
            isAdmin = true;
        }

        if (!isAdmin) {
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
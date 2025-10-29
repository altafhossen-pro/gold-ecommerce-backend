const { Role } = require('../modules/role/role.model');
const { User } = require('../modules/user/user.model');
const sendResponse = require('../utils/sendResponse');

/**
 * Middleware to check if user has permission to perform an action
 * Usage: checkPermission('product', 'delete')
 * 
 * Supports both old system (role string) and new system (roleId)
 */
const checkPermission = (module, action) => {
  return async (req, res, next) => {
    try {
      // User must be authenticated (should be set by verifyTokenAdmin)
      if (!req.user) {
        return sendResponse({
          res,
          statusCode: 401,
          success: false,
          message: 'Authentication required',
        });
      }

      const user = await User.findById(req.user._id || req.user.id);

      if (!user) {
        return sendResponse({
          res,
          statusCode: 401,
          success: false,
          message: 'User not found',
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        return sendResponse({
          res,
          statusCode: 403,
          success: false,
          message: 'Account is suspended or deactivated',
        });
      }

      // NEW SYSTEM: Check if user has roleId (new role-based system)
      if (user.roleId) {
        
        const hasPermission = await Role.checkPermission(user.roleId, module, action);
        
        if (hasPermission) {
          return next();
        }

        return sendResponse({
          res,
          statusCode: 403,
          success: false,
          message: `You don't have permission to ${action} ${module}`,
        });
      }

      // OLD SYSTEM: Backward compatibility - check role string
      // If role is 'admin', allow all actions (for backward compatibility)
      if (user.role === 'admin') {
        return next();
      }

      // For other roles (customer, seller), deny admin actions
      return sendResponse({
        res,
        statusCode: 403,
        success: false,
        message: `You don't have permission to ${action} ${module}`,
      });
    } catch (error) {
      console.error('Permission check error:', error);
      return sendResponse({
        res,
        statusCode: 500,
        success: false,
        message: 'Error checking permissions',
      });
    }
  };
};

/**
 * Helper function to check permission in controllers
 * Usage: const hasPermission = await checkUserPermission(user, 'product', 'delete')
 */
const checkUserPermission = async (user, module, action) => {
  try {
    // NEW SYSTEM: Check roleId
    if (user.roleId) {
      const hasPermission = await Role.checkPermission(user.roleId, module, action);
      return hasPermission;
    }

    // OLD SYSTEM: Backward compatibility
    if (user.role === 'admin') {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
};

module.exports = { checkPermission, checkUserPermission };


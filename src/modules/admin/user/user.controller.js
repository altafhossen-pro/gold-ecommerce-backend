const { User } = require('../../../modules/user/user.model');
const { Role } = require('../../role/role.model');
const sendResponse = require('../../../utils/sendResponse');
const jwtService = require('../../../services/jwtService');
const { checkUserPermission } = require('../../../middlewares/checkPermission');
const bcrypt = require('bcryptjs');
exports.listUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-createdAt';
    const search = req.query.search || '';
    const status = req.query.status || '';
    const role = req.query.role || '';
    const staffOnly = req.query.staffOnly === 'true'; // Filter for staff only (users with roleId)
    const customersOnly = req.query.customersOnly === 'true'; // Filter for customers only (role='customer' AND roleId is null)

    // Build query filter
    let queryFilter = {};
    const andConditions = [];
    
    // Search filter
    if (search) {
      andConditions.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      });
    }

    // Status filter
    if (status) {
      queryFilter.status = status;
    }
    
    // Customers only filter (role='customer' AND roleId is null/doesn't exist)
    if (customersOnly) {
      andConditions.push({
        $and: [
          { role: 'customer' },
          {
            $or: [
              { roleId: { $exists: false } },
              { roleId: null }
            ]
          }
        ]
      });
    } else if (staffOnly) {
      // Staff only filter: users with roleId (ObjectId exists and not null)
      // Staff = roleId exists AND roleId is not null AND roleId is ObjectId type (BSON type 7)
      // Customer = roleId doesn't exist OR roleId is null
      andConditions.push({
        $and: [
          { roleId: { $exists: true } },
          { roleId: { $ne: null } },
          { roleId: { $type: 7 } } // BSON type 7 = ObjectId
        ]
      });
    } else if (role) {
      // Role filter (only if not using staffOnly or customersOnly)
      queryFilter.role = role;
    }

    // Combine all conditions with $and if needed
    if (andConditions.length > 0) {
      const baseFilter = { ...queryFilter };
      // Clear queryFilter to rebuild
      Object.keys(queryFilter).forEach(key => delete queryFilter[key]);
      
      // Build $and array - only include baseFilter if it has properties
      if (Object.keys(baseFilter).length > 0) {
        queryFilter.$and = [baseFilter, ...andConditions];
      } else {
        // If baseFilter is empty, just use andConditions directly
        if (andConditions.length === 1) {
          // If only one condition, merge it directly
          Object.assign(queryFilter, andConditions[0]);
        } else {
          // Multiple conditions need $and
          queryFilter.$and = andConditions;
        }
      }
    }

    const total = await User.countDocuments(queryFilter);
    const users = await User.find(queryFilter)
      .select('-password')
      .populate('roleId', 'name isSuperAdmin')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    return sendResponse({ 
      res, 
      statusCode: 200, 
      success: true, 
      message: 'Users fetched successfully', 
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('roleId', 'name isSuperAdmin');
    if (!user) return sendResponse({ res, statusCode: 404, success: false, message: 'User not found' });
    
    // Check if target user is staff (has roleId)
    const targetIsStaff = user.roleId && user.roleId._id;
    
    // If target user is staff, only Super Admin can view/edit
    if (targetIsStaff) {
      // Resolve requester super admin status
      let requesterIsSuperAdmin = false;
      if (req.user?.roleId) {
        const requesterRole = await Role.findById(req.user.roleId);
        requesterIsSuperAdmin = !!requesterRole?.isSuperAdmin;
      }
      
      if (!requesterIsSuperAdmin) {
        return sendResponse({ 
          res, 
          statusCode: 403, 
          success: false, 
          message: "Only Super Admin can view or edit staff user data" 
        });
      }
    }
    
    return sendResponse({ res, statusCode: 200, success: true, message: 'User fetched', data: user });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // Fetch the target user first to check if they are staff
    const targetUser = await User.findById(req.params.id).populate('roleId', 'name isSuperAdmin');
    if (!targetUser) {
      return sendResponse({ res, statusCode: 404, success: false, message: 'User not found' });
    }
    
    // Check if target user is staff (has roleId)
    const targetIsStaff = targetUser.roleId && targetUser.roleId._id;
    
    // Check if user is trying to update their own account
    const isSelfUpdate = String(req.params.id) === String(req.user._id);
    
    // Resolve requester super admin status
    let requesterIsSuperAdmin = false;
    if (req.user?.roleId) {
      const requesterRole = await Role.findById(req.user.roleId);
      requesterIsSuperAdmin = !!requesterRole?.isSuperAdmin;
    }
    
    // If target user is staff, only Super Admin can update
    if (targetIsStaff && !requesterIsSuperAdmin) {
      return sendResponse({ 
        res, 
        statusCode: 403, 
        success: false, 
        message: "Only Super Admin can update staff user data" 
      });
    }
    
    // Check if email is being updated - only Super Admin can change emails
    if (Object.prototype.hasOwnProperty.call(updateData, 'email')) {
      // Use targetUser that was already fetched
      if (targetUser && targetUser.email !== updateData.email) {
        // Email is being changed
        if (!requesterIsSuperAdmin) {
          return sendResponse({ res, statusCode: 403, success: false, message: "Only Super Admin can change email addresses" });
        }
      }
    }
    
    // Check if roleId is being updated
    if (Object.prototype.hasOwnProperty.call(updateData, 'roleId')) {
      // Check if user has role.update permission (module: 'role', action: 'update')
      const hasRoleUpdatePermission = await checkUserPermission(req.user, 'role', 'update');
      
      // Require role.update permission (unless super admin)
      if (!requesterIsSuperAdmin && !hasRoleUpdatePermission) {
        return sendResponse({ res, statusCode: 403, success: false, message: "Permission Denied: You don't have permission to change user roles. Please contact your administrator to grant Role Management access." });
      }
      
      // Prevent non-Super Admin users from updating their own role
      if (isSelfUpdate && !requesterIsSuperAdmin) {
        return sendResponse({ res, statusCode: 403, success: false, message: "You cannot update your own role. Only Super Admin can update their own role." });
      }
      
      const roleIdValue = updateData.roleId;
      const hasAdminRole = roleIdValue && String(roleIdValue).trim().length > 0;
      
      // If assigning a role, check if it's a Super Admin role
      if (hasAdminRole) {
        const assignedRole = await Role.findById(roleIdValue);
        if (assignedRole?.isSuperAdmin) {
          // Check if requester is Super Admin
          if (!requesterIsSuperAdmin) {
            return sendResponse({ res, statusCode: 403, success: false, message: "Only Super Admin can assign Super Admin role" });
          }
        }
      }
    }
    
    // Determine legacy role string based on roleId presence
    // If roleId provided (non-empty), treat as admin access; otherwise default to customer
    let updateQuery = { $set: updateData };
    if (Object.prototype.hasOwnProperty.call(updateData, 'roleId')) {
      const roleIdValue = updateData.roleId;
      const hasAdminRole = roleIdValue && String(roleIdValue).trim().length > 0;
      updateQuery.$set.role = hasAdminRole ? 'admin' : 'customer';
      if (!hasAdminRole) {
        // Ensure roleId is removed from the document entirely
        if (!updateQuery.$unset) updateQuery.$unset = {};
        updateQuery.$unset.roleId = "";
        // Also prevent setting roleId with empty values in $set
        delete updateQuery.$set.roleId;
      }
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateQuery, { new: true });
    if (!user) return sendResponse({ res, statusCode: 404, success: false, message: 'User not found' });
    return sendResponse({ res, statusCode: 200, success: true, message: 'User updated', data: user });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};



exports.deleteUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return sendResponse({ res, statusCode: 404, success: false, message: 'User not found' });

    // Prevent self-delete
    if (String(targetUser._id) === String(req.user._id)) {
      return sendResponse({ res, statusCode: 403, success: false, message: "You cannot delete your own account" });
    }

    // Determine roles
    const targetIsAdmin = targetUser.role === 'admin' || !!targetUser.roleId;

    // Resolve requester super admin status
    let requesterIsSuperAdmin = false;
    if (req.user?.roleId) {
      const role = await Role.findById(req.user.roleId);
      requesterIsSuperAdmin = !!role?.isSuperAdmin;
    }

    if (targetIsAdmin) {
      // Only super admin can delete any admin; or roles with explicit admin.delete can delete admins (but not super admins)
      const hasAdminDelete = await checkUserPermission(req.user, 'admin', 'delete');

      // Prevent deleting super admin unless requester is super admin
      let targetIsSuperAdmin = false;
      if (targetUser.roleId) {
        const targetRole = await Role.findById(targetUser.roleId);
        targetIsSuperAdmin = !!targetRole?.isSuperAdmin;
      }

      if (targetIsSuperAdmin && !requesterIsSuperAdmin) {
        return sendResponse({ res, statusCode: 403, success: false, message: "Only Super Admin can delete a Super Admin" });
      }

      if (!requesterIsSuperAdmin && !hasAdminDelete) {
        return sendResponse({ res, statusCode: 403, success: false, message: "You don't have permission to delete admin users" });
      }
    } else {
      // Non-admin (customers) are covered by route 'user.delete', no extra checks
    }

    await User.findByIdAndDelete(targetUser._id);
    return sendResponse({ res, statusCode: 200, success: true, message: 'User deleted' });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    return sendResponse({ res, statusCode: 201, success: true, message: 'User created', data: user });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || query.trim().length < 1) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Search query is required',
      });
    }

    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } }
      ]
    })
    .select('name email phone')
    .limit(5);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Users found successfully',
      data: users,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Admin login function
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find admin user
    const admin = await User.findOne({ email, role: 'admin' });
    if (!admin) {
      return sendResponse({
        res,
        statusCode: 401,
        success: false,
        message: 'Invalid admin credentials',
      });
    }

    
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return sendResponse({
        res,
        statusCode: 401,
        success: false,
        message: 'Invalid admin credentials',
      });
    }

    // Generate admin token
    const token = jwtService.generateAdminToken(admin._id, admin.role, ['all']);

    // Remove password from response
    const adminObj = admin.toObject();
    delete adminObj.password;

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Admin login successful',
      data: { 
        admin: adminObj, 
        token 
      },
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Create staff member (Super Admin only)
exports.createStaff = async (req, res) => {
  try {
    // Only Super Admin can create staff
    let requesterIsSuperAdmin = false;
    if (req.user?.roleId) {
      const requesterRole = await Role.findById(req.user.roleId);
      requesterIsSuperAdmin = !!requesterRole?.isSuperAdmin;
    }
    
    if (!requesterIsSuperAdmin) {
      return sendResponse({ 
        res, 
        statusCode: 403, 
        success: false, 
        message: "Only Super Admin can create staff members" 
      });
    }

    const { name, email, phone, password, roleId, status } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        ...(phone ? [{ phone }] : [])
      ]
    });

    if (existingUser) {
      return sendResponse({
        res,
        statusCode: 409,
        success: false,
        message: 'User with this email or phone already exists',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Build user data
    const userData = {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'admin', // Staff members have admin role
      status: status || 'active',
    };

    // Add phone if provided
    if (phone && phone.trim()) {
      userData.phone = phone.trim();
    }

    // Add roleId if provided (for staff with custom roles)
    if (roleId && roleId.trim()) {
      // Check if the role exists
      const assignedRole = await Role.findById(roleId);
      if (!assignedRole) {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: 'Invalid role ID',
        });
      }
      
      // Only Super Admin can assign Super Admin role (already checked above)
      if (assignedRole.isSuperAdmin && !requesterIsSuperAdmin) {
        return sendResponse({
          res,
          statusCode: 403,
          success: false,
          message: 'Only Super Admin can assign Super Admin role',
        });
      }
      
      userData.roleId = roleId;
    }

    // Create user
    const user = new User(userData);
    await user.save();

    // Remove password from response
    const userObj = user.toObject();
    delete userObj.password;

    return sendResponse({ 
      res, 
      statusCode: 201, 
      success: true, 
      message: 'Staff member created successfully', 
      data: userObj 
    });
  } catch (error) {
    console.error('Error creating staff:', error);
    return sendResponse({ 
      res, 
      statusCode: 500, 
      success: false, 
      message: error.message || 'Error creating staff member' 
    });
  }
};
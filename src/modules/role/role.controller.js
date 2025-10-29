const { Role } = require('./role.model');
const { Permission } = require('../permission/permission.model');
const { User } = require('../user/user.model');
const sendResponse = require('../../utils/sendResponse');
const { checkUserPermission } = require('../../middlewares/checkPermission');

// Get all roles with pagination
exports.getRoles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const sort = req.query.sort || '-createdAt';

    // Build query filter
    let queryFilter = {};

    if (search) {
      queryFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Role.countDocuments(queryFilter);
    const roles = await Role.find(queryFilter)
      .populate('permissions', 'module action description category')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Roles fetched successfully',
      data: roles,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
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

// Get single role by ID
exports.getRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findById(id)
      .populate('permissions', 'module action description category permissionString')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!role) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Role not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Role fetched successfully',
      data: role,
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

// Create new role
exports.createRole = async (req, res) => {
  try {
    // Check if user has permission to create roles
    const canCreate = await checkUserPermission(req.user, 'role', 'create');
    if (!canCreate && !req.user.roleId) {
      // Fallback: Only super admin or users with role.create permission can create roles
      if (req.user.role !== 'admin') {
        return sendResponse({
          res,
          statusCode: 403,
          success: false,
          message: 'You don\'t have permission to create roles',
        });
      }
    }

    const { name, description, permissions: permissionIds, isDefault, isActive } = req.body;

    if (!name) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Role name is required',
      });
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Check if role with same name or slug exists
    const existingRole = await Role.findOne({
      $or: [{ name }, { slug }],
    });

    if (existingRole) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Role with this name or slug already exists',
      });
    }

    // Validate permissions if provided
    if (permissionIds && permissionIds.length > 0) {
      const validPermissions = await Permission.find({
        _id: { $in: permissionIds },
        isActive: true,
      });

      if (validPermissions.length !== permissionIds.length) {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: 'Some permissions are invalid or inactive',
        });
      }
    }

    const role = new Role({
      name,
      slug,
      description,
      permissions: permissionIds || [],
      isDefault: isDefault || false,
      isSuperAdmin: false, // Cannot create super admin role
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id || req.user.id,
    });

    await role.save();

    const populatedRole = await Role.findById(role._id)
      .populate('permissions', 'module action description category');

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Role created successfully',
      data: populatedRole,
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Role with this name or slug already exists',
      });
    }

    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Update role
exports.updateRole = async (req, res) => {
  try {
    // Check permission
    const canUpdate = await checkUserPermission(req.user, 'role', 'update');
    if (!canUpdate && !req.user.roleId) {
      if (req.user.role !== 'admin') {
        return sendResponse({
          res,
          statusCode: 403,
          success: false,
          message: 'You don\'t have permission to update roles',
        });
      }
    }

    const { id } = req.params;
    const { name, description, permissions: permissionIds, isDefault, isActive } = req.body;

    const role = await Role.findById(id);

    if (!role) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Role not found',
      });
    }

    // Prevent modifying super admin role
    if (role.isSuperAdmin) {
      return sendResponse({
        res,
        statusCode: 403,
        success: false,
        message: 'Cannot modify super admin role',
      });
    }

    // Update fields
    if (name) {
      role.name = name;
      role.slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }

    if (description !== undefined) role.description = description;
    if (isDefault !== undefined) role.isDefault = isDefault;
    if (isActive !== undefined) role.isActive = isActive;
    if (permissionIds !== undefined) {
      // Validate permissions
      if (permissionIds.length > 0) {
        const validPermissions = await Permission.find({
          _id: { $in: permissionIds },
          isActive: true,
        });

        if (validPermissions.length !== permissionIds.length) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Some permissions are invalid or inactive',
          });
        }
      }
      role.permissions = permissionIds;
    }

    role.updatedBy = req.user._id || req.user.id;

    await role.save();

    const updatedRole = await Role.findById(role._id)
      .populate('permissions', 'module action description category');

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Role updated successfully',
      data: updatedRole,
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Role with this name or slug already exists',
      });
    }

    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Delete role
exports.deleteRole = async (req, res) => {
  try {
    // Check permission
    const canDelete = await checkUserPermission(req.user, 'role', 'delete');
    if (!canDelete && !req.user.roleId) {
      if (req.user.role !== 'admin') {
        return sendResponse({
          res,
          statusCode: 403,
          success: false,
          message: 'You don\'t have permission to delete roles',
        });
      }
    }

    const { id } = req.params;

    const role = await Role.findById(id);

    if (!role) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Role not found',
      });
    }

    // Prevent deleting super admin role
    if (role.isSuperAdmin) {
      return sendResponse({
        res,
        statusCode: 403,
        success: false,
        message: 'Cannot delete super admin role',
      });
    }

    // Check if role is assigned to any users
    const usersWithRole = await User.countDocuments({ roleId: id });
    if (usersWithRole > 0) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: `Cannot delete role. It is assigned to ${usersWithRole} user(s). Please reassign users first.`,
      });
    }

    await Role.findByIdAndDelete(id);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Role deleted successfully',
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

// Get all available permissions
exports.getPermissions = async (req, res) => {
  try {
    const { category } = req.query;

    let queryFilter = { isActive: true };

    if (category) {
      queryFilter.category = category;
    }

    const permissions = await Permission.find(queryFilter).sort({ category: 1, module: 1, action: 1 });

    // Group by category for easier frontend display
    const groupedPermissions = permissions.reduce((acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    }, {});

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Permissions fetched successfully',
      data: {
        all: permissions,
        grouped: groupedPermissions,
      },
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


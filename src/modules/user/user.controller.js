const { User } = require('./user.model');
const bcrypt = require('bcryptjs');
const sendResponse = require('../../utils/sendResponse');
const jwtService = require('../../services/jwtService');
const { uploadSingle, handleUploadError, generateFileUrl, deleteFile } = require('../../utils/fileUpload');
const { Loyalty } = require('../loyalty/loyalty.model');
const Settings = require('../settings/settings.model');
const { sendWelcomeEmail } = require('../../utils/email');

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'All fields are required',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendResponse({
        res,
        statusCode: 409,
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      registerType: 'email', // Track that user registered via email
    });
    await user.save();

    // Get signup bonus coins amount for welcome email
    let signupBonusCoins = 0;

    // Give signup bonus coins if enabled
    try {
      const settings = await Settings.findOne();
      if (settings && settings.loyaltySettings?.isLoyaltyEnabled && settings.loyaltySettings?.signupBonusCoins > 0) {
        signupBonusCoins = settings.loyaltySettings.signupBonusCoins;

        // Get or create loyalty record
        let loyalty = await Loyalty.findOne({ user: user._id });
        if (!loyalty) {
          loyalty = new Loyalty({ user: user._id, points: 0, coins: 0, history: [] });
        }

        // Add signup bonus coins
        loyalty.coins += signupBonusCoins;
        loyalty.history.unshift({
          type: 'earn',
          points: 0,
          coins: signupBonusCoins,
          description: `Welcome bonus: ${signupBonusCoins} coins for signing up`
        });

        await loyalty.save();
      }
    } catch (error) {
      // Don't fail signup if loyalty bonus fails
      console.error('Error giving signup bonus:', error);
    }

    // Remove password from response
    const userObj = user.toObject();
    delete userObj.password;

    // Send response first (don't wait for email)
    sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'User registered successfully',
      data: userObj,
    });

    // Send welcome email asynchronously (don't wait for it)
    if (user.email) {
      sendWelcomeEmail(user, signupBonusCoins).catch(emailError => {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail signup if email fails
      });
    }
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    if (!emailOrPhone || !password) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Email/Phone and password are required',
      });
    }
    // Find user by email or phone
    const user = await User.findOne({
      $or: [
        { email: emailOrPhone },
        { phone: emailOrPhone },
      ],
    });
    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'User not found',
      });
    }
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendResponse({
        res,
        statusCode: 401,
        success: false,
        message: 'Invalid credentials',
      });
    }
    // Generate JWT token using service
    const token = jwtService.generateAccessToken(user._id);

    // Fetch full user with roles and permissions correctly
    const { Role } = require('../role/role.model');
    const fullUser = await User.findById(user._id)
      .populate({
        path: 'roleId',
        populate: { path: 'permissions' }
      })
      .select('-password');

    let permissions = [];
    let role = null;

    if (fullUser && fullUser.roleId) {
      role = fullUser.roleId;

      if (role.permissions && role.permissions.length > 0) {
        permissions = role.permissions.map(p => ({
          _id: p._id,
          module: p.module,
          action: p.action,
          description: p.description,
          category: p.category,
        }));
      }
    }

    // Format user data with role and permissions
    const userData = {
      ...(fullUser ? fullUser.toObject() : user.toObject()),
      roleDetails: role ? {
        _id: role._id,
        name: role.name,
        slug: role.slug,
        description: role.description,
        isSuperAdmin: role.isSuperAdmin,
        isDefault: role.isDefault,
        isActive: role.isActive,
        permissions: permissions,
      } : null,
      permissions: permissions, // Direct access to permissions array
    };

    // Remove password from response
    delete userData.password;

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Login successful',
      data: { user: userData, token },
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

exports.getProfile = async (req, res) => {
  try {
    // Assume req.userId is set by auth middleware
    const { User } = require('./user.model');
    const { Role } = require('../role/role.model');

    const user = await User.findById(req.user._id || req.user.id)
      .populate({
        path: 'roleId',
        populate: { path: 'permissions' }
      })
      .select('-password');

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'User not found',
      });
    }

    // Get permissions if user has a role
    let permissions = [];
    let role = null;

    if (user.roleId) {
      role = user.roleId;
      if (role.permissions && role.permissions.length > 0) {
        permissions = role.permissions.map(p => ({
          _id: p._id,
          module: p.module,
          action: p.action,
          description: p.description,
          category: p.category,
        }));
      }
    }

    // Format user data with role and permissions
    const userData = {
      ...user.toObject(),
      roleDetails: role ? {
        _id: role._id,
        name: role.name,
        slug: role.slug,
        description: role.description,
        isSuperAdmin: role.isSuperAdmin,
        isDefault: role.isDefault,
        isActive: role.isActive,
        permissions: permissions,
      } : null,
      permissions: permissions, // Direct access to permissions array
    };

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Profile fetched successfully',
      data: userData,
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

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, phone, address } = req.body;

    // Prepare updates object
    const updates = {};

    if (name) {
      updates.name = name;
    }

    if (phone) {
      updates.phone = phone;
    }

    if (address) {
      updates.address = address;
    }

    // Check if phone is being updated and if it already exists for another user
    if (phone) {
      const currentUser = await User.findById(userId);
      if (currentUser && currentUser.phone !== phone) {
        // Phone is being changed, check if it exists for another user
        const existingUser = await User.findOne({
          phone: phone,
          _id: { $ne: userId }
        });

        if (existingUser) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Phone number already exists for another user',
          });
        }
      }
    }

    // Update user normally
    await User.updateOne({ _id: userId }, updates);

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'User not found',
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Profile updated successfully',
      data: user,
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

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    // Get user ID from req.user (set by verifyToken middleware)
    const userId = req.user._id;

    // Find user with password field
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedNewPassword;
    await user.save();

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Password changed successfully',
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

exports.deleteUser = async (req, res) => {
  try {
    // Get user ID from req.user (set by verifyToken middleware)
    const userId = req.user._id;
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'User not found',
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'User deleted successfully',
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

// Get all users with pagination and filtering (Admin only)
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const role = req.query.role || '';
    const excludeRole = req.query.excludeRole || ''; // Filter to exclude a role
    const staffOnly = req.query.staffOnly === 'true'; // Filter for staff only (non-customers)
    const customersOnly = req.query.customersOnly === 'true'; // Filter for customers only (role='customer' AND roleId is null)

    // Build filter object
    const filter = {};
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
      filter.status = status;
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
    } else if (excludeRole) {
      // Exclude specific role
      filter.role = { $ne: excludeRole };
    } else if (role) {
      // Role filter
      filter.role = role;
    }

    // Combine all conditions with $and if needed
    if (andConditions.length > 0) {
      const baseFilter = { ...filter };
      // Clear filter to rebuild
      Object.keys(filter).forEach(key => delete filter[key]);

      // Build $and array - only include baseFilter if it has properties
      if (Object.keys(baseFilter).length > 0) {
        filter.$and = [baseFilter, ...andConditions];
      } else {
        // If baseFilter is empty, just use andConditions directly
        if (andConditions.length === 1) {
          // If only one condition, merge it directly
          Object.assign(filter, andConditions[0]);
        } else {
          // Multiple conditions need $and
          filter.$and = andConditions;
        }
      }
    }

    // Calculate skip value
    const skip = (page - 1) * limit;

    // Get users with pagination
    const users = await User.find(filter)
      .select('-password') // Exclude password
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await User.countDocuments(filter);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Users fetched successfully',
      data: users,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage
      }
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

// Get single user by ID (Admin only)
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'User not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'User fetched successfully',
      data: user,
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

// Update user by ID (Admin only)
exports.updateUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, status, role } = req.body;


    const updates = {};

    if (name) {
      updates.name = name;
    }

    if (phone) {
      updates.phone = phone;
    }

    if (address !== undefined) {
      updates.address = address;
    }

    if (status) {
      updates.status = status;
    }

    if (role) {
      updates.role = role;
    }

    const existingUser = await User.findOne({ phone: phone, _id: { $ne: id } });

    if (existingUser) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Phone number already exists for another user',
      });
    }

    const updatedUser = await User.updateOne({ _id: id }, updates);


    if (!updatedUser) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'User not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
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

// Soft delete user (Admin only)
exports.softDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      {
        status: 'deleted',
        deletedAt: new Date()
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'User not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'User deleted successfully',
      data: user,
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

exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

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
      .select('name email phone address addresses')
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

// Upload profile picture
exports.uploadProfilePicture = async (req, res) => {
  try {
    uploadSingle(req, res, async (err) => {
      if (err) {
        return handleUploadError(err, req, res, () => { });
      }

      if (!req.file) {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: 'No image file uploaded'
        });
      }

      const userId = req.user._id;
      const user = await User.findById(userId);

      if (!user) {
        return sendResponse({
          res,
          statusCode: 404,
          success: false,
          message: 'User not found'
        });
      }

      // Delete old profile picture if exists
      if (user.avatar) {
        const oldFilename = user.avatar.split('/').pop();
        deleteFile(oldFilename);
      }

      // Generate new file URL
      const fileUrl = generateFileUrl(req.file.filename);

      // Update user's avatar
      user.avatar = fileUrl;
      await user.save();

      return sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'Profile picture uploaded successfully',
        data: {
          avatar: fileUrl,
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Delete profile picture
exports.deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'User not found'
      });
    }

    if (!user.avatar) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'No profile picture to delete'
      });
    }

    // Delete file from filesystem
    const filename = user.avatar.split('/').pop();
    const deleted = deleteFile(filename);

    // Remove avatar from user record
    user.avatar = undefined;
    await user.save();

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Profile picture deleted successfully'
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error'
    });
  }
};
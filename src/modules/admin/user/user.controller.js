const { User } = require('../../../modules/user/user.model');
const sendResponse = require('../../../utils/sendResponse');
const jwtService = require('../../../services/jwtService');

exports.listUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-createdAt';
    const search = req.query.search || '';
    const status = req.query.status || '';
    const role = req.query.role || '';

    // Build query filter
    let queryFilter = {};
    
    // Search filter
    if (search) {
      queryFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status) {
      queryFilter.status = status;
    }
    
    // Role filter
    if (role) {
      queryFilter.role = role;
    }

    const total = await User.countDocuments(queryFilter);
    const users = await User.find(queryFilter)
      .select('-password')
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
    const user = await User.findById(req.params.id);
    if (!user) return sendResponse({ res, statusCode: 404, success: false, message: 'User not found' });
    return sendResponse({ res, statusCode: 200, success: true, message: 'User fetched', data: user });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!user) return sendResponse({ res, statusCode: 404, success: false, message: 'User not found' });
    return sendResponse({ res, statusCode: 200, success: true, message: 'User updated', data: user });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return sendResponse({ res, statusCode: 404, success: false, message: 'User not found' });
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

    // Verify password
    const bcrypt = require('bcryptjs');
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

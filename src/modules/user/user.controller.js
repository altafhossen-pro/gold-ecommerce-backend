const { User } = require('./user.model');
const bcrypt = require('bcryptjs');
const sendResponse = require('../../utils/sendResponse');
const jwt = require('jsonwebtoken'); // Assume JWT is used for login

exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'All fields are required',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
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

    // Create user
    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
    });
    await user.save();

    // Remove password from response
    const userObj = user.toObject();
    delete userObj.password;

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'User registered successfully',
      data: userObj,
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
    // Generate JWT (dummy secret for now)
    const token = jwt.sign({ userId: user._id }, 'your_jwt_secret', { expiresIn: '7d' });
    const userObj = user.toObject();
    delete userObj.password;
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Login successful',
      data: { user: userObj, token },
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
    const user = await User.findById(req.userId).select('-password');
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
      message: 'Profile fetched successfully',
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

exports.updateProfile = async (req, res) => {
  try {
    // Assume req.userId is set by auth middleware
    const updates = req.body;
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }
    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true }).select('-password');
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

exports.deleteUser = async (req, res) => {
  try {
    // Assume req.userId is set by auth middleware
    const user = await User.findByIdAndDelete(req.userId);
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

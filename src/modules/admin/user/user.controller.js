const { User } = require('../../../modules/user/user.model');
const sendResponse = require('../../../utils/sendResponse');

exports.listUsers = async (req, res) => {
  try {
    const users = await User.find();
    return sendResponse({ res, statusCode: 200, success: true, message: 'Users fetched', data: users });
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

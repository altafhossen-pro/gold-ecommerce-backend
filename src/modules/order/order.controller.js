const { Order } = require('./order.model');
const sendResponse = require('../../utils/sendResponse');

exports.createOrder = async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();
    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Order created successfully',
      data: order,
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

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 }); // Sort by newest first
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Orders fetched successfully',
      data: orders,
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

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).populate('user', 'name email phone');
    if (!order) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Order not found',
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Order fetched successfully',
      data: order,
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

exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const order = await Order.findByIdAndUpdate(id, updates, { new: true });
    if (!order) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Order not found',
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Order updated successfully',
      data: order,
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

exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findByIdAndDelete(id);
    if (!order) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Order not found',
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Order deleted successfully',
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

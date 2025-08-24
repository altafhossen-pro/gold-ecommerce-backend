const { User } = require('../../user/user.model');
const { Order } = require('../../order/order.model');
const { Product } = require('../../product/product.model');
const sendResponse = require('../../../utils/sendResponse');

exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalSalesAgg = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const totalSales = totalSalesAgg[0]?.total || 0;
    const topProducts = await Product.find().sort({ totalSold: -1 }).limit(5).select('title totalSold');
    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5).populate('user', 'name');
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Dashboard stats fetched',
      data: {
        totalUsers,
        totalOrders,
        totalSales,
        topProducts,
        recentOrders
      }
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

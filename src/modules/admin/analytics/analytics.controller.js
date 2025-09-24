const { User } = require('../../user/user.model');
const { Order } = require('../../order/order.model');
const { Product } = require('../../product/product.model');
const { Category } = require('../../category/category.model');
const Coupon = require('../../coupon/coupon.model');
const sendResponse = require('../../../utils/sendResponse');

// Get comprehensive dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Set start date to beginning of day for more accurate filtering
    startDate.setHours(0, 0, 0, 0);
    
    // Debug logging
    console.log('Analytics Period:', period);
    console.log('Start Date:', startDate.toISOString());
    console.log('Days difference:', Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)));

    // Basic counts (all time)
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments({ isActive: true });
    const totalCategories = await Category.countDocuments({ isActive: true });
    const totalCoupons = await Coupon.countDocuments({ isActive: true });

    // Order statistics (all time)
    const totalOrders = await Order.countDocuments();
    const paidOrders = await Order.countDocuments({ paymentStatus: 'paid' });
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const confirmedOrders = await Order.countDocuments({ status: 'confirmed' });
    const shippedOrders = await Order.countDocuments({ status: 'shipped' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });
    const returnedOrders = await Order.countDocuments({ status: 'returned' });

    // Debug: Log order status counts
    console.log('Order Status Counts:', {
      pending: pendingOrders,
      confirmed: confirmedOrders,
      shipped: shippedOrders,
      delivered: deliveredOrders,
      cancelled: cancelledOrders,
      returned: returnedOrders
    });

    // Period-based order statistics
    const periodOrders = await Order.countDocuments({ 
      createdAt: { $gte: startDate } 
    });
    const periodPaidOrders = await Order.countDocuments({ 
      paymentStatus: 'paid',
      createdAt: { $gte: startDate } 
    });
    const periodDeliveredOrders = await Order.countDocuments({ 
      status: 'delivered',
      createdAt: { $gte: startDate } 
    });

    // Revenue calculations - include delivered orders even if payment is pending (for COD)
    const totalSalesAgg = await Order.aggregate([
      { 
        $match: { 
          $or: [
            { paymentStatus: 'paid' },
            { status: 'delivered' } // Include delivered orders (COD orders)
          ]
        } 
      },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const totalSales = totalSalesAgg[0]?.total || 0;

    // Period-based sales - include delivered orders even if payment is pending (for COD)
    const periodSalesAgg = await Order.aggregate([
      { 
        $match: { 
          $or: [
            { paymentStatus: 'paid' },
            { status: 'delivered' } // Include delivered orders (COD orders)
          ],
          createdAt: { $gte: startDate }
        } 
      },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const periodSales = periodSalesAgg[0]?.total || 0;

    // Previous period for comparison - include delivered orders even if payment is pending (for COD)
    const previousStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
    const previousSalesAgg = await Order.aggregate([
      { 
        $match: { 
          $or: [
            { paymentStatus: 'paid' },
            { status: 'delivered' } // Include delivered orders (COD orders)
          ],
          createdAt: { $gte: previousStartDate, $lt: startDate }
        } 
      },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const previousSales = previousSalesAgg[0]?.total || 0;

    // Calculate growth percentage
    const salesGrowth = previousSales > 0 ? 
      ((periodSales - previousSales) / previousSales * 100).toFixed(1) : 0;

    // Average order value
    const avgOrderValue = paidOrders > 0 ? (totalSales / paidOrders).toFixed(2) : 0;

    // Top selling products
    const topProducts = await Product.find({ isActive: true })
      .sort({ totalSold: -1 })
      .limit(5)
      .select('title totalSold featuredImage priceRange')
      .populate('category', 'name');

    // Low stock products
    const lowStockProducts = await Product.find({
      isActive: true,
      $or: [
        { totalStock: { $lte: 5 } },
        { 'variants.stockQuantity': { $lte: 5 } }
      ]
    })
    .limit(5)
    .select('title totalStock variants.stockQuantity featuredImage')
    .populate('category', 'name');

    // Add calculatedTotalStock to each product
    lowStockProducts.forEach(product => {
      product.calculatedTotalStock = product.variants.reduce((total, variant) => total + (variant.stockQuantity || 0), 0);
    });

    // Debug: Log low stock products
    console.log('Low stock products found:', lowStockProducts.length);
    lowStockProducts.forEach(product => {
      console.log(`Product: ${product.title}, totalStock: ${product.totalStock}, calculatedTotalStock: ${product.calculatedTotalStock}, variants:`, 
        product.variants.map(v => ({ sku: v.sku, stock: v.stockQuantity }))
      );
    });

    // Debug: Check specific product
    const testProduct = await Product.findOne({ title: 'Test Product 1' });
    if (testProduct) {
      console.log('Test Product 1 details:', {
        title: testProduct.title,
        totalStock: testProduct.totalStock,
        variants: testProduct.variants.map(v => ({ sku: v.sku, stock: v.stockQuantity })),
        isActive: testProduct.isActive
      });
    }

    // Recent orders (period-based)
    const recentOrders = await Order.find({
      createdAt: { $gte: startDate }
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name email phone')
      .select('orderId user total status paymentStatus createdAt items');

    // Order status distribution
    const orderStatusDistribution = {
      pending: pendingOrders,
      confirmed: confirmedOrders,
      shipped: shippedOrders,
      delivered: deliveredOrders,
      cancelled: cancelledOrders,
      returned: returnedOrders
    };

    // Payment method distribution - include delivered orders even if payment is pending (for COD)
    const paymentMethodAgg = await Order.aggregate([
      { 
        $match: { 
          $or: [
            { paymentStatus: 'paid' },
            { status: 'delivered' } // Include delivered orders (COD orders)
          ]
        } 
      },
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$total' } } }
    ]);

    // Monthly sales data for chart - include delivered orders even if payment is pending (for COD)
    const monthlySales = await Order.aggregate([
      {
        $match: {
          $or: [
            { paymentStatus: 'paid' },
            { status: 'delivered' } // Include delivered orders (COD orders)
          ],
          createdAt: { $gte: new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Customer growth
    const customerGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Dashboard stats fetched successfully',
      data: {
        overview: {
        totalUsers,
          totalProducts,
          totalCategories,
          totalCoupons,
        totalOrders,
          totalSales: parseFloat(totalSales.toFixed(2)),
          avgOrderValue: parseFloat(avgOrderValue),
          salesGrowth: parseFloat(salesGrowth)
        },
        orders: {
          total: totalOrders,
          paid: paidOrders,
          pending: pendingOrders,
          confirmed: confirmedOrders,
          shipped: shippedOrders,
          delivered: deliveredOrders,
          cancelled: cancelledOrders,
          returned: returnedOrders,
          statusDistribution: orderStatusDistribution,
          // Period-based order counts
          periodTotal: periodOrders,
          periodPaid: periodPaidOrders,
          periodDelivered: periodDeliveredOrders
        },
        sales: {
          total: parseFloat(totalSales.toFixed(2)),
          period: parseFloat(periodSales.toFixed(2)),
          previous: parseFloat(previousSales.toFixed(2)),
          growth: parseFloat(salesGrowth),
          monthlyData: monthlySales,
          paymentMethods: paymentMethodAgg
        },
        products: {
          topSelling: topProducts,
          lowStock: lowStockProducts
        },
        customers: {
          total: totalUsers,
          growth: customerGrowth
        },
        recentOrders
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return sendResponse({ 
      res, 
      statusCode: 500, 
      success: false, 
      message: error.message || 'Failed to fetch dashboard stats' 
    });
  }
};

// Get sales analytics with date range
exports.getSalesAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    let matchStage = { 
      $or: [
        { paymentStatus: 'paid' },
        { status: 'delivered' } // Include delivered orders (COD orders)
      ]
    };
    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    let groupFormat;
    switch (groupBy) {
      case 'hour':
        groupFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' }
        };
        break;
      case 'day':
        groupFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        break;
      case 'week':
        groupFormat = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        break;
      case 'month':
        groupFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default:
        groupFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }

    const salesData = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupFormat,
          totalSales: { $sum: '$total' },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: '$total' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Sales analytics fetched successfully',
      data: salesData
    });
  } catch (error) {
    console.error('Sales analytics error:', error);
    return sendResponse({ 
      res, 
      statusCode: 500, 
      success: false, 
      message: error.message || 'Failed to fetch sales analytics' 
    });
  }
};

// Get product analytics
exports.getProductAnalytics = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Top selling products
    const topSelling = await Product.find({ isActive: true })
      .sort({ totalSold: -1 })
      .limit(parseInt(limit))
      .select('title totalSold averageRating totalReviews priceRange featuredImage')
      .populate('category', 'name');

    // Low stock products
    const lowStock = await Product.find({
      isActive: true,
      $or: [
        { totalStock: { $lte: 5 } },
        { 'variants.stockQuantity': { $lte: 5 } }
      ]
    })
    .sort({ totalStock: 1 })
    .limit(parseInt(limit))
    .select('title totalStock variants.stockQuantity featuredImage')
    .populate('category', 'name');

    // Category performance
    const categoryPerformance = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          totalProducts: { $sum: 1 },
          totalSold: { $sum: '$totalSold' },
          avgRating: { $avg: '$averageRating' }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: '$categoryInfo' },
      { $sort: { totalSold: -1 } }
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Product analytics fetched successfully',
      data: {
        topSelling,
        lowStock,
        categoryPerformance
      }
    });
  } catch (error) {
    console.error('Product analytics error:', error);
    return sendResponse({ 
      res, 
      statusCode: 500, 
      success: false, 
      message: error.message || 'Failed to fetch product analytics' 
    });
  }
};

// Get customer analytics
exports.getCustomerAnalytics = async (req, res) => {
  try {
    // Customer growth over time
    const customerGrowth = await User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          newCustomers: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Customer order statistics
    const customerOrderStats = await Order.aggregate([
      {
        $group: {
          _id: '$user',
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$total' },
          avgOrderValue: { $avg: '$total' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ]);

    // Customer lifetime value - include delivered orders even if payment is pending (for COD)
    const totalCustomers = await User.countDocuments();
    const totalRevenue = await Order.aggregate([
      { 
        $match: { 
          $or: [
            { paymentStatus: 'paid' },
            { status: 'delivered' } // Include delivered orders (COD orders)
          ]
        } 
      },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const avgCustomerValue = totalCustomers > 0 ? 
      (totalRevenue[0]?.total || 0) / totalCustomers : 0;

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Customer analytics fetched successfully',
      data: {
        customerGrowth,
        topCustomers: customerOrderStats,
        avgCustomerValue: parseFloat(avgCustomerValue.toFixed(2)),
        totalCustomers
      }
    });
  } catch (error) {
    console.error('Customer analytics error:', error);
    return sendResponse({ 
      res, 
      statusCode: 500, 
      success: false, 
      message: error.message || 'Failed to fetch customer analytics' 
    });
  }
};

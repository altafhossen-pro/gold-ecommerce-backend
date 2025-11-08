const { User } = require('../../user/user.model');
const { Order } = require('../../order/order.model');
const { Product } = require('../../product/product.model');
const { Category } = require('../../category/category.model');
const Coupon = require('../../coupon/coupon.model');
const sendResponse = require('../../../utils/sendResponse');

// Get comprehensive dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    let endDate;
    switch (period) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        endDate = null;
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        endDate = null;
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        endDate = null;
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        endDate = null;
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        endDate = null;
    }
    

    // Basic counts (all time)
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments({ isActive: true });
    const totalCategories = await Category.countDocuments({ isActive: true });
    const totalCoupons = await Coupon.countDocuments({ isActive: true });

    // Order statistics (all time, excluding deleted)
    const totalOrders = await Order.countDocuments({ isDeleted: false });
    const paidOrders = await Order.countDocuments({ paymentStatus: 'paid', isDeleted: false });
    const pendingOrders = await Order.countDocuments({ status: 'pending', isDeleted: false });
    const confirmedOrders = await Order.countDocuments({ status: 'confirmed', isDeleted: false });
    const shippedOrders = await Order.countDocuments({ status: 'shipped', isDeleted: false });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered', isDeleted: false });
    const cancelledOrders = await Order.countDocuments({ status: 'cancelled', isDeleted: false });
    const returnedOrders = await Order.countDocuments({ status: 'returned', isDeleted: false });

    // Period-based order statistics (excluding deleted)
    const periodOrdersQuery = { 
      createdAt: endDate ? { $gte: startDate, $lte: endDate } : { $gte: startDate },
      isDeleted: false
    };
    const periodOrders = await Order.countDocuments(periodOrdersQuery);
    const periodPaidOrders = await Order.countDocuments({ 
      paymentStatus: 'paid',
      ...periodOrdersQuery
    });
    const periodDeliveredOrders = await Order.countDocuments({ 
      status: 'delivered',
      ...periodOrdersQuery
    });

    // Revenue calculations - only items subtotal (excluding shipping and discounts)
    // Partial returns: exclude returned items' value from revenue
    // COD orders: count when status is 'delivered' OR 'returned' (delivered orders that were returned)
    // Non-COD orders: count when paymentStatus is 'paid' AND status is 'confirmed' OR 'returned'
    // Excluding deleted orders
    const totalSalesAgg = await Order.aggregate([
      { 
        $match: { 
          $or: [
            // COD orders: delivered or returned status (returned means it was delivered first)
            { paymentMethod: 'cod', status: { $in: ['delivered', 'returned'] } },
            // Non-COD orders: paid AND (confirmed or returned)
            { 
              paymentMethod: { $ne: 'cod' },
              paymentStatus: 'paid',
              status: { $in: ['confirmed', 'returned'] }
            }
          ],
          isDeleted: false
        } 
      },
      {
        $project: {
          items: 1,
          returnQuantities: 1,
          subtotal: {
            $let: {
              vars: {
                // Calculate total items value
                totalValue: {
                  $reduce: {
                    input: "$items",
                    initialValue: 0,
                    in: { $add: ["$$value", { $multiply: ["$$this.price", "$$this.quantity"] }] }
                  }
                },
                // Calculate returned items value (if partial return exists)
                returnedValue: {
                  $cond: {
                    if: { $and: [{ $ne: ["$returnQuantities", null] }, { $gt: [{ $size: { $ifNull: ["$returnQuantities", []] } }, 0] }] },
                    then: {
                      $reduce: {
                        input: "$returnQuantities",
                        initialValue: 0,
                        in: {
                          $add: [
                            "$$value",
                            {
                              $multiply: [
                                { $arrayElemAt: ["$items.price", "$$this.itemIndex"] },
                                "$$this.quantity"
                              ]
                            }
                          ]
                        }
                      }
                    },
                    else: 0
                  }
                }
              },
              in: {
                // Subtract returned value from total value
                $subtract: ["$$totalValue", "$$returnedValue"]
              }
            }
          }
        }
      },
      { $group: { _id: null, total: { $sum: '$subtotal' } } }
    ]);
    const totalSales = totalSalesAgg[0]?.total || 0;

    // Period-based sales - only items subtotal (excluding shipping and discounts)
    // Partial returns: exclude returned items' value from revenue
    // COD orders: count when status is 'delivered' OR 'returned' (delivery date matters, not order date)
    // Non-COD orders: count when paymentStatus is 'paid' AND status is 'confirmed' OR 'returned' (order date)
    // Excluding deleted orders
    const periodSalesMatch = {
      $or: [
        // COD orders: delivered or returned status (returned means it was delivered first)
        { paymentMethod: 'cod', status: { $in: ['delivered', 'returned'] } },
        // Non-COD orders: paid AND (confirmed or returned)
        { 
          paymentMethod: { $ne: 'cod' },
          paymentStatus: 'paid',
          status: { $in: ['confirmed', 'returned'] }
        }
      ],
      isDeleted: false
    };
    
    // For COD: filter by delivery date (statusTimestamps.delivered, fallback to createdAt if missing)
    // For Non-COD: filter by order creation date (createdAt)
    const periodSalesAgg = await Order.aggregate([
      { 
        $match: periodSalesMatch
      },
      {
        $addFields: {
          // Determine which date to use based on payment method
          relevantDate: {
            $cond: {
              if: { $eq: ["$paymentMethod", "cod"] },
              then: {
                // COD: use delivery date, fallback to createdAt if delivered timestamp is missing
                $ifNull: ["$statusTimestamps.delivered", "$createdAt"]
              },
              else: "$createdAt" // Non-COD: use order date
            }
          }
        }
      },
      {
        $match: endDate 
          ? {
              relevantDate: { 
                $ne: null, // Exclude null dates
                $gte: startDate, 
                $lte: endDate 
              }
            }
          : {
              relevantDate: { 
                $ne: null, // Exclude null dates
                $gte: startDate 
              }
            }
      },
      {
        $project: {
          items: 1,
          returnQuantities: 1,
          subtotal: {
            $let: {
              vars: {
                // Calculate total items value
                totalValue: {
                  $reduce: {
                    input: "$items",
                    initialValue: 0,
                    in: { $add: ["$$value", { $multiply: ["$$this.price", "$$this.quantity"] }] }
                  }
                },
                // Calculate returned items value (if partial return exists)
                returnedValue: {
                  $cond: {
                    if: { $and: [{ $ne: ["$returnQuantities", null] }, { $gt: [{ $size: { $ifNull: ["$returnQuantities", []] } }, 0] }] },
                    then: {
                      $reduce: {
                        input: "$returnQuantities",
                        initialValue: 0,
                        in: {
                          $add: [
                            "$$value",
                            {
                              $multiply: [
                                { $arrayElemAt: ["$items.price", "$$this.itemIndex"] },
                                "$$this.quantity"
                              ]
                            }
                          ]
                        }
                      }
                    },
                    else: 0
                  }
                }
              },
              in: {
                // Subtract returned value from total value
                $subtract: ["$$totalValue", "$$returnedValue"]
              }
            }
          }
        }
      },
      { $group: { _id: null, total: { $sum: '$subtotal' } } }
    ]);
    const periodSales = periodSalesAgg[0]?.total || 0;

    // Previous period for comparison - only items subtotal (excluding shipping and discounts)
    // Partial returns: exclude returned items' value from revenue
    // COD orders: count when status is 'delivered' OR 'returned' (delivery date matters)
    // Non-COD orders: count when paymentStatus is 'paid' AND status is 'confirmed' OR 'returned' (order date)
    // Excluding deleted orders
    const periodDuration = endDate 
      ? (endDate.getTime() - startDate.getTime()) 
      : (now.getTime() - startDate.getTime());
    const previousStartDate = new Date(startDate.getTime() - periodDuration);
    const previousEndDate = startDate;
    
    const previousSalesAgg = await Order.aggregate([
      { 
        $match: { 
          $or: [
            // COD orders: delivered or returned status (returned means it was delivered first)
            { paymentMethod: 'cod', status: { $in: ['delivered', 'returned'] } },
            // Non-COD orders: paid AND (confirmed or returned)
            { 
              paymentMethod: { $ne: 'cod' },
              paymentStatus: 'paid',
              status: { $in: ['confirmed', 'returned'] }
            }
          ],
          isDeleted: false
        } 
      },
      {
        $addFields: {
          // Determine which date to use based on payment method
          relevantDate: {
            $cond: {
              if: { $eq: ["$paymentMethod", "cod"] },
              then: {
                // COD: use delivery date, fallback to createdAt if delivered timestamp is missing
                $ifNull: ["$statusTimestamps.delivered", "$createdAt"]
              },
              else: "$createdAt" // Non-COD: use order date
            }
          }
        }
      },
      {
        $match: {
          relevantDate: { 
            $ne: null, // Exclude null dates
            $gte: previousStartDate, 
            $lt: previousEndDate 
          }
        }
      },
      {
        $project: {
          items: 1,
          returnQuantities: 1,
          subtotal: {
            $let: {
              vars: {
                // Calculate total items value
                totalValue: {
                  $reduce: {
                    input: "$items",
                    initialValue: 0,
                    in: { $add: ["$$value", { $multiply: ["$$this.price", "$$this.quantity"] }] }
                  }
                },
                // Calculate returned items value (if partial return exists)
                returnedValue: {
                  $cond: {
                    if: { $and: [{ $ne: ["$returnQuantities", null] }, { $gt: [{ $size: { $ifNull: ["$returnQuantities", []] } }, 0] }] },
                    then: {
                      $reduce: {
                        input: "$returnQuantities",
                        initialValue: 0,
                        in: {
                          $add: [
                            "$$value",
                            {
                              $multiply: [
                                { $arrayElemAt: ["$items.price", "$$this.itemIndex"] },
                                "$$this.quantity"
                              ]
                            }
                          ]
                        }
                      }
                    },
                    else: 0
                  }
                }
              },
              in: {
                // Subtract returned value from total value
                $subtract: ["$$totalValue", "$$returnedValue"]
              }
            }
          }
        }
      },
      { $group: { _id: null, total: { $sum: '$subtotal' } } }
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

    // Recent orders (period-based, excluding deleted)
    const recentOrders = await Order.find({
      createdAt: endDate ? { $gte: startDate, $lte: endDate } : { $gte: startDate },
      isDeleted: false
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name email phone')
      .select('orderId user total status paymentStatus paymentMethod createdAt items discount couponDiscount loyaltyDiscount upsellDiscount coupon orderSource orderType manualOrderInfo');

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
    // Excluding deleted orders
    const paymentMethodAgg = await Order.aggregate([
      { 
        $match: { 
          $or: [
            { paymentStatus: 'paid' },
            { status: 'delivered' } // Include delivered orders (COD orders)
          ],
          isDeleted: false
        } 
      },
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$total' } } }
    ]);

    // Monthly sales data for chart - only items subtotal (excluding shipping and discounts)
    // Partial returns: exclude returned items' value from revenue
    // COD orders: count when status is 'delivered' OR 'returned' (delivery date matters)
    // Non-COD orders: count when paymentStatus is 'paid' AND status is 'confirmed' OR 'returned' (order date)
    // Excluding deleted orders
    const monthlySales = await Order.aggregate([
      {
        $match: {
          $or: [
            // COD orders: delivered or returned status (returned means it was delivered first)
            { paymentMethod: 'cod', status: { $in: ['delivered', 'returned'] } },
            // Non-COD orders: paid AND (confirmed or returned)
            { 
              paymentMethod: { $ne: 'cod' },
              paymentStatus: 'paid',
              status: { $in: ['confirmed', 'returned'] }
            }
          ],
          isDeleted: false
        }
      },
      {
        $addFields: {
          // Determine which date to use based on payment method
          relevantDate: {
            $cond: {
              if: { $eq: ["$paymentMethod", "cod"] },
              then: {
                // COD: use delivery date, fallback to createdAt if delivered timestamp is missing
                $ifNull: ["$statusTimestamps.delivered", "$createdAt"]
              },
              else: "$createdAt" // Non-COD: use order date
            }
          }
        }
      },
      {
        $match: {
          relevantDate: { 
            $ne: null, // Exclude null dates
            $gte: new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000) 
          }
        }
      },
      {
        $project: {
          year: { $year: "$relevantDate" },
          month: { $month: "$relevantDate" },
          items: 1,
          returnQuantities: 1,
          subtotal: {
            $let: {
              vars: {
                // Calculate total items value
                totalValue: {
                  $reduce: {
                    input: "$items",
                    initialValue: 0,
                    in: { $add: ["$$value", { $multiply: ["$$this.price", "$$this.quantity"] }] }
                  }
                },
                // Calculate returned items value (if partial return exists)
                returnedValue: {
                  $cond: {
                    if: { $and: [{ $ne: ["$returnQuantities", null] }, { $gt: [{ $size: { $ifNull: ["$returnQuantities", []] } }, 0] }] },
                    then: {
                      $reduce: {
                        input: "$returnQuantities",
                        initialValue: 0,
                        in: {
                          $add: [
                            "$$value",
                            {
                              $multiply: [
                                { $arrayElemAt: ["$items.price", "$$this.itemIndex"] },
                                "$$this.quantity"
                              ]
                            }
                          ]
                        }
                      }
                    },
                    else: 0
                  }
                }
              },
              in: {
                // Subtract returned value from total value
                $subtract: ["$$totalValue", "$$returnedValue"]
              }
            }
          }
        }
      },
      {
        $group: {
          _id: {
            year: "$year",
            month: "$month"
          },
          total: { $sum: '$subtotal' },
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
      ],
      isDeleted: false
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

    // Customer order statistics (excluding deleted orders)
    const customerOrderStats = await Order.aggregate([
      {
        $match: { isDeleted: false }
      },
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
    // Excluding deleted orders
    const totalCustomers = await User.countDocuments();
    const totalRevenue = await Order.aggregate([
      { 
        $match: { 
          $or: [
            { paymentStatus: 'paid' },
            { status: 'delivered' } // Include delivered orders (COD orders)
          ],
          isDeleted: false
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

const { Product } = require('../product/product.model');
const { StockTracking } = require('./stockTracking.model');
const sendResponse = require('../../utils/sendResponse');

// Get inventory overview with all products and their stock status
exports.getInventory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-createdAt';
    const search = req.query.search || '';
    const stockFilter = req.query.stockFilter || 'all'; // all, low, out, in

    // Build query filter
    let queryFilter = {};
    
    // Search filter
    if (search) {
      queryFilter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { 'variants.sku': { $regex: search, $options: 'i' } }
      ];
    }

    // Stock status filter
    if (stockFilter === 'low') {
      queryFilter.$or = [
        { totalStock: { $lte: 5, $gt: 0 } },
        { 'variants.stockQuantity': { $lte: 5, $gt: 0 } }
      ];
    } else if (stockFilter === 'out') {
      queryFilter.$or = [
        { totalStock: { $lte: 0 } },
        { 'variants.stockQuantity': { $lte: 0 } }
      ];
    } else if (stockFilter === 'in') {
      queryFilter.$or = [
        { totalStock: { $gt: 5 } },
        { 'variants.stockQuantity': { $gt: 5 } }
      ];
    }

    const total = await Product.countDocuments(queryFilter);
    const products = await Product.find(queryFilter)
      .populate('category', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Enhance products with stock information
    const inventoryData = products.map(product => {
      const variants = product.variants || [];
      const totalVariantStock = variants.reduce((sum, variant) => sum + (variant.stockQuantity || 0), 0);
      const totalStock = product.totalStock || 0;
      const calculatedStock = variants.length > 0 ? totalVariantStock : totalStock;
      
      // Find low stock variants
      const lowStockVariants = variants.filter(variant => 
        variant.stockQuantity <= (variant.lowStockThreshold || 5)
      );
      
      // Determine overall stock status
      let stockStatus = 'in_stock';
      if (calculatedStock === 0) {
        stockStatus = 'out_of_stock';
      } else if (lowStockVariants.length > 0 || calculatedStock <= 5) {
        stockStatus = 'low_stock';
      }

      return {
        _id: product._id,
        title: product.title,
        brand: product.brand,
        category: product.category,
        featuredImage: product.featuredImage,
        totalStock: calculatedStock,
        stockStatus,
        variants: variants.map(variant => ({
          sku: variant.sku,
          attributes: variant.attributes,
          currentPrice: variant.currentPrice,
          originalPrice: variant.originalPrice,
          costPrice: variant.costPrice,
          stockQuantity: variant.stockQuantity,
          lowStockThreshold: variant.lowStockThreshold,
          stockStatus: variant.stockQuantity <= 0 ? 'out_of_stock' : 
                     variant.stockQuantity <= (variant.lowStockThreshold || 5) ? 'low_stock' : 'in_stock'
        })),
        lowStockVariants: lowStockVariants.length,
        totalSold: product.totalSold || 0,
        isActive: product.isActive,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      };
    });

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Inventory fetched successfully',
      data: inventoryData,
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

// Get low stock products
exports.getLowStockProducts = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5;
    
    const products = await Product.find({
      $or: [
        { totalStock: { $lte: threshold, $gt: 0 } },
        { 'variants.stockQuantity': { $lte: threshold, $gt: 0 } }
      ]
    })
    .populate('category', 'name')
    .sort({ totalStock: 1 });

    const lowStockData = products.map(product => {
      const variants = product.variants || [];
      const lowStockVariants = variants.filter(variant => 
        variant.stockQuantity <= (variant.lowStockThreshold || threshold)
      );
      
      return {
        _id: product._id,
        title: product.title,
        brand: product.brand,
        category: product.category,
        featuredImage: product.featuredImage,
        totalStock: product.totalStock || 0,
        lowStockVariants: lowStockVariants.map(variant => ({
          sku: variant.sku,
          attributes: variant.attributes,
          stockQuantity: variant.stockQuantity,
          lowStockThreshold: variant.lowStockThreshold
        })),
        isActive: product.isActive
      };
    });

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Low stock products fetched successfully',
      data: lowStockData,
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

// Update product stock
exports.updateStock = async (req, res) => {
  try {
    const { productId, variantSku, type, quantity, reason, reference, cost, notes } = req.body;
    const performedBy = req.user.id;

    // Validate required fields
    if (!productId || !type || quantity === undefined) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Product ID, type, and quantity are required',
      });
    }

    // Keep the same type as frontend sends
    let mappedType = type;

    // Get the product
    const product = await Product.findById(productId);
    if (!product) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Product not found',
      });
    }

    let previousStock = 0;
    let newStock = 0;
    let variant = null;

    if (variantSku) {
      // Update variant stock
      variant = product.variants.find(v => v.sku === variantSku);
      if (!variant) {
        return sendResponse({
          res,
          statusCode: 404,
          success: false,
          message: 'Variant not found',
        });
      }

      previousStock = variant.stockQuantity || 0;
      newStock = type === 'remove' ? previousStock - quantity : previousStock + quantity;

      // Validate stock for remove operations
      if (type === 'remove' && quantity > previousStock) {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: `Cannot remove ${quantity} items. Current stock is only ${previousStock}.`,
        });
      }

      // Update variant stock
      variant.stockQuantity = Math.max(0, newStock);
      
      // Update total stock
      const totalVariantStock = product.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
      product.totalStock = totalVariantStock;
    } else {
      // Update main product stock
      previousStock = product.totalStock || 0;
      newStock = type === 'remove' ? previousStock - quantity : previousStock + quantity;

      // Validate stock for remove operations
      if (type === 'remove' && quantity > previousStock) {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: `Cannot remove ${quantity} items. Current stock is only ${previousStock}.`,
        });
      }

      product.totalStock = Math.max(0, newStock);
    }

    // Save product
    await product.save();

    // Create stock tracking record
    const stockTracking = new StockTracking({
      product: productId,
      variant: variant ? {
        sku: variant.sku,
        attributes: variant.attributes
      } : null,
      type: mappedType,
      quantity,
      previousStock,
      newStock,
      reason,
      reference,
      performedBy,
      cost,
      notes
    });

    await stockTracking.save();

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Stock updated successfully',
      data: {
        product: {
          _id: product._id,
          title: product.title,
          totalStock: product.totalStock,
          variant: variant ? {
            sku: variant.sku,
            stockQuantity: variant.stockQuantity
          } : null
        },
        tracking: stockTracking
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

// Get stock history for a product
exports.getStockHistory = async (req, res) => {
  try {
    const { productId } = req.params;
    const { variantSku, limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const query = { product: productId };
    if (variantSku) {
      query['variant.sku'] = variantSku;
    }

    const total = await StockTracking.countDocuments(query);
    const history = await StockTracking.find(query)
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Stock history fetched successfully',
      data: history,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
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

// Get stock summary/analytics
exports.getStockSummary = async (req, res) => {
  try {
    const { productId } = req.params;
    const { variantSku, days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const query = { 
      product: productId,
      createdAt: { $gte: startDate }
    };
    if (variantSku) {
      query['variant.sku'] = variantSku;
    }

    // Get summary by type
    const summaryByType = await StockTracking.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          totalQuantity: { $sum: '$quantity' },
          count: { $sum: 1 },
          totalCost: { $sum: { $multiply: ['$quantity', { $ifNull: ['$cost', 0] }] } }
        }
      }
    ]);

    // Get monthly breakdown
    const monthlyBreakdown = await StockTracking.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalQuantity: { $sum: '$quantity' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } }
    ]);

    // Get recent activity
    const recentActivity = await StockTracking.find(query)
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Stock summary fetched successfully',
      data: {
        summaryByType,
        monthlyBreakdown,
        recentActivity,
        period: {
          days: parseInt(days),
          startDate,
          endDate: new Date()
        }
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

// Get overall stock analytics
exports.getStockAnalytics = async (req, res) => {
  try {
    const { period = '7days', startDate, endDate } = req.query;
    
    let dateQuery = {};
    const now = new Date();
    
    // Calculate date range based on period
    switch (period) {
      case 'today':
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        dateQuery = { createdAt: { $gte: todayStart, $lte: todayEnd } };
        break;
      case 'yesterday':
        const yesterdayStart = new Date(now);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        yesterdayStart.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(now);
        yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
        yesterdayEnd.setHours(23, 59, 59, 999);
        dateQuery = { createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd } };
        break;
      case '7days':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateQuery = { createdAt: { $gte: weekAgo } };
        break;
      case '30days':
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        dateQuery = { createdAt: { $gte: monthAgo } };
        break;
      case '6months':
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        dateQuery = { createdAt: { $gte: sixMonthsAgo } };
        break;
      case '1year':
        const yearAgo = new Date(now);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        dateQuery = { createdAt: { $gte: yearAgo } };
        break;
      case 'custom':
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateQuery = { createdAt: { $gte: start, $lte: end } };
        }
        break;
      default:
        const defaultWeekAgo = new Date(now);
        defaultWeekAgo.setDate(defaultWeekAgo.getDate() - 7);
        dateQuery = { createdAt: { $gte: defaultWeekAgo } };
    }

    // Get analytics data
    const analytics = await StockTracking.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$type',
          totalQuantity: { $sum: '$quantity' },
          count: { $sum: 1 },
          totalCost: { $sum: { $multiply: ['$quantity', { $ifNull: ['$cost', 0] }] } }
        }
      }
    ]);

    // Get total products count
    const totalProducts = await Product.countDocuments({ isActive: true });
    
    // Get low stock products count
    const lowStockProducts = await Product.countDocuments({
      $or: [
        { totalStock: { $lte: 5, $gt: 0 } },
        { 'variants.stockQuantity': { $lte: 5, $gt: 0 } }
      ]
    });

    // Process analytics data
    let stockAdded = 0;
    let stockRemoved = 0;
    
    analytics.forEach(item => {
      if (item._id === 'add' || item._id === 'restock') {
        stockAdded += item.totalQuantity;
      } else if (item._id === 'remove' || item._id === 'adjustment') {
        stockRemoved += item.totalQuantity;
      }
    });



    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Stock analytics fetched successfully',
      data: {
        stockAdded,
        stockRemoved,
        totalProducts,
        lowStockCount: lowStockProducts,
        analytics,
        period,
        dateRange: {
          start: dateQuery.createdAt?.$gte || new Date(),
          end: dateQuery.createdAt?.$lte || new Date()
        }
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

// Bulk stock update
exports.bulkUpdateStock = async (req, res) => {
  try {
    const { updates } = req.body;
    const performedBy = req.user.id;

    if (!Array.isArray(updates) || updates.length === 0) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Updates array is required',
      });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const { productId, variantSku, type, quantity, reason, reference, cost, notes } = update;

        // Get the product
        const product = await Product.findById(productId);
        if (!product) {
          errors.push({ productId, error: 'Product not found' });
          continue;
        }

        let previousStock = 0;
        let newStock = 0;
        let variant = null;

        if (variantSku) {
          variant = product.variants.find(v => v.sku === variantSku);
          if (!variant) {
            errors.push({ productId, variantSku, error: 'Variant not found' });
            continue;
          }

          previousStock = variant.stockQuantity || 0;
          newStock = previousStock + quantity;
          variant.stockQuantity = Math.max(0, newStock);
          
          const totalVariantStock = product.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
          product.totalStock = totalVariantStock;
        } else {
          previousStock = product.totalStock || 0;
          newStock = previousStock + quantity;
          product.totalStock = Math.max(0, newStock);
        }

        await product.save();

        // Create stock tracking record
        const stockTracking = new StockTracking({
          product: productId,
          variant: variant ? {
            sku: variant.sku,
            attributes: variant.attributes
          } : null,
          type,
          quantity,
          previousStock,
          newStock,
          reason,
          reference,
          performedBy,
          cost,
          notes
        });

        await stockTracking.save();

        results.push({
          productId,
          variantSku,
          success: true,
          newStock,
          trackingId: stockTracking._id
        });

      } catch (error) {
        errors.push({
          productId: update.productId,
          variantSku: update.variantSku,
          error: error.message
        });
      }
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: `Bulk update completed. ${results.length} successful, ${errors.length} errors`,
      data: {
        results,
        errors,
        totalProcessed: updates.length,
        successCount: results.length,
        errorCount: errors.length
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

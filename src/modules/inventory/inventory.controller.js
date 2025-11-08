const { Product } = require('../product/product.model');
const { StockTracking } = require('./stockTracking.model');
const { Purchase } = require('./purchase.model');
const { StockAdjustment } = require('./stockAdjustment.model');
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

// Create a new purchase
exports.createPurchase = async (req, res) => {
  try {
    const { items, notes } = req.body;
    const performedBy = req.user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'At least one item is required for purchase',
      });
    }

    const purchaseItems = [];
    const errors = [];

    // Process each item
    for (const item of items) {
      const { productId, variantSku, quantity, unitCost } = item;

      if (!productId || !quantity || quantity <= 0 || !unitCost || unitCost < 0) {
        errors.push({ item, error: 'Invalid item data' });
        continue;
      }

      // Get the product
      const product = await Product.findById(productId);
      if (!product) {
        errors.push({ item, error: 'Product not found' });
        continue;
      }

      let variant = null;
      let previousStock = 0;
      let previousUnitCost = null;

      if (variantSku) {
        // Handle variant
        variant = product.variants.find(v => v.sku === variantSku);
        if (!variant) {
          errors.push({ item, error: 'Variant not found' });
          continue;
        }

        previousStock = variant.stockQuantity || 0;
        previousUnitCost = variant.costPrice || null;
        
        // Update variant stock only (no cost price update)
        variant.stockQuantity = (variant.stockQuantity || 0) + quantity;
        
        // Update variant cost price with new purchase unit cost (for next purchase reference)
        variant.costPrice = unitCost;
        
        // Update total stock
        const totalVariantStock = product.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
        product.totalStock = totalVariantStock;
      } else {
        // Handle main product
        previousStock = product.totalStock || 0;
        previousUnitCost = product.costPrice || null;
        
        // Update product stock only (no cost price update)
        product.totalStock = (product.totalStock || 0) + quantity;
        
        // Update product cost price with new purchase unit cost (for next purchase reference)
        product.costPrice = unitCost;
      }

      // Save product
      await product.save();

      // Add to purchase items with tracking data (will be saved after purchase number is generated)
      purchaseItems.push({
        product: productId,
        variant: variant ? {
          sku: variant.sku,
          attributes: variant.attributes
        } : null,
        quantity,
        unitCost,
        previousUnitCost,
        totalCost: quantity * unitCost,
        previousStock,
        newStock: variant ? variant.stockQuantity : product.totalStock,
        // Store tracking data for later (will be removed before saving Purchase)
        _trackingData: {
          product: productId,
          variant: variant ? {
            sku: variant.sku,
            attributes: variant.attributes
          } : null,
          type: 'add',
          quantity,
          previousStock,
          newStock: variant ? variant.stockQuantity : product.totalStock,
          reason: 'Purchase',
          performedBy,
          cost: unitCost,
          notes: notes || 'Purchase stock addition'
        }
      });
    }

    if (purchaseItems.length === 0) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'No valid items to process',
        data: { errors }
      });
    }

    // Generate purchase number
    const purchaseCount = await Purchase.countDocuments();
    const purchaseNumber = `PUR-${String(purchaseCount + 1).padStart(6, '0')}`;

    // Create stock tracking records with purchase number reference
    for (const item of purchaseItems) {
      if (item._trackingData) {
        const stockTracking = new StockTracking({
          ...item._trackingData,
          reference: purchaseNumber
        });
        await stockTracking.save();
        // Remove tracking data from item
        delete item._trackingData;
      }
    }

    // Create purchase record
    const purchase = new Purchase({
      purchaseNumber,
      items: purchaseItems,
      performedBy,
      notes
    });

    await purchase.save();

    // Populate purchase for response
    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate('items.product', 'title featuredImage brand')
      .populate('performedBy', 'name email');

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Purchase created successfully',
      data: populatedPurchase
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

// Get all purchases with pagination
exports.getPurchases = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-createdAt';

    const total = await Purchase.countDocuments();
    const purchases = await Purchase.find()
      .populate('items.product', 'title featuredImage brand')
      .populate('performedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Purchases fetched successfully',
      data: purchases,
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

// Get single purchase by ID
exports.getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await Purchase.findById(id)
      .populate('items.product', 'title featuredImage brand')
      .populate('performedBy', 'name email');

    if (!purchase) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Purchase not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Purchase fetched successfully',
      data: purchase,
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

// Create stock adjustment (subtract stock)
exports.createStockAdjustment = async (req, res) => {
  try {
    const { items, notes } = req.body;
    const performedBy = req.user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'At least one item is required for stock adjustment',
      });
    }

    const adjustmentItems = [];
    const errors = [];

    // Process each item
    for (const item of items) {
      const { productId, variantSku, quantity, reason, notes: itemNotes } = item;

      if (!productId || !quantity || quantity <= 0 || !reason) {
        errors.push({ item, error: 'Invalid item data' });
        continue;
      }

      // Get the product
      const product = await Product.findById(productId);
      if (!product) {
        errors.push({ item, error: 'Product not found' });
        continue;
      }

      let variant = null;
      let previousStock = 0;
      let newStock = 0;

      if (variantSku) {
        // Handle variant
        variant = product.variants.find(v => v.sku === variantSku);
        if (!variant) {
          errors.push({ item, error: 'Variant not found' });
          continue;
        }

        previousStock = variant.stockQuantity || 0;
        
        // Check if adjustment quantity exceeds current stock
        if (quantity > previousStock) {
          errors.push({ item, error: `Adjustment quantity (${quantity}) exceeds current stock (${previousStock})` });
          continue;
        }

        // Subtract stock
        newStock = previousStock - quantity;
        variant.stockQuantity = newStock;
        
        // Update total stock
        const totalVariantStock = product.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
        product.totalStock = totalVariantStock;
      } else {
        // Handle main product
        previousStock = product.totalStock || 0;
        
        // Check if adjustment quantity exceeds current stock
        if (quantity > previousStock) {
          errors.push({ item, error: `Adjustment quantity (${quantity}) exceeds current stock (${previousStock})` });
          continue;
        }

        // Subtract stock
        newStock = previousStock - quantity;
        product.totalStock = newStock;
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
        type: 'adjustment',
        quantity: -quantity, // Negative for subtraction
        previousStock,
        newStock,
        reason: `Stock adjustment: ${reason}`,
        performedBy,
        notes: itemNotes || notes || ''
      });

      await stockTracking.save();

      // Add to adjustment items
      adjustmentItems.push({
        product: productId,
        variant: variant ? {
          sku: variant.sku,
          attributes: variant.attributes
        } : null,
        quantity,
        previousStock,
        newStock,
        reason,
        notes: itemNotes || ''
      });
    }

    if (errors.length > 0) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Some items failed to process',
        data: { errors },
      });
    }

    // Generate adjustment number
    const adjustmentCount = await StockAdjustment.countDocuments();
    const adjustmentNumber = `ADJ-${String(adjustmentCount + 1).padStart(6, '0')}`;

    // Create stock adjustment record
    const stockAdjustment = new StockAdjustment({
      adjustmentNumber,
      items: adjustmentItems,
      performedBy,
      notes
    });

    await stockAdjustment.save();

    // Populate and return
    const populatedAdjustment = await StockAdjustment.findById(stockAdjustment._id)
      .populate('items.product', 'title featuredImage brand')
      .populate('performedBy', 'name email');

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Stock adjustment created successfully',
      data: populatedAdjustment,
    });
  } catch (error) {
    console.error('Error creating stock adjustment:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Get all stock adjustments with pagination
exports.getStockAdjustments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-createdAt';

    const total = await StockAdjustment.countDocuments();
    const adjustments = await StockAdjustment.find()
      .populate('items.product', 'title featuredImage brand')
      .populate('performedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Stock adjustments fetched successfully',
      data: adjustments,
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

// Get single stock adjustment by ID
exports.getStockAdjustmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const adjustment = await StockAdjustment.findById(id)
      .populate('items.product', 'title featuredImage brand')
      .populate('performedBy', 'name email');

    if (!adjustment) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Stock adjustment not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Stock adjustment fetched successfully',
      data: adjustment,
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

// Get product stock history with variants
exports.getProductStockHistory = async (req, res) => {
  try {
    const { productId } = req.params;

    // Get product with variants
    const product = await Product.findById(productId).select('title brand featuredImage variants totalStock');
    if (!product) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Product not found',
      });
    }

    // Get all stock tracking records for this product
    const allStockHistory = await StockTracking.find({ product: productId })
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 });

    // Get purchase records for this product
    const purchases = await Purchase.find({
      'items.product': productId
    })
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 });

    // Get stock adjustments for this product
    const adjustments = await StockAdjustment.find({
      'items.product': productId
    })
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 });

    // Process variants with stock history
    const variantsData = (product.variants || []).map(variant => {
      // Filter history for this variant
      const variantHistory = allStockHistory.filter(record => 
        record.variant && record.variant.sku === variant.sku
      );

      // Calculate totals
      let totalPurchase = 0;
      let totalSold = 0;
      let totalAdjustment = 0;

      variantHistory.forEach(record => {
        if (record.type === 'add') {
          totalPurchase += Math.abs(record.quantity);
        } else if (record.type === 'remove') {
          totalSold += Math.abs(record.quantity);
        } else if (record.type === 'adjustment') {
          totalAdjustment += Math.abs(record.quantity);
        }
      });

      // Get purchase records for this variant
      const variantPurchases = purchases.filter(purchase =>
        purchase.items.some(item => item.variant?.sku === variant.sku)
      );

      // Get adjustment records for this variant
      const variantAdjustments = adjustments.filter(adjustment =>
        adjustment.items.some(item => item.variant?.sku === variant.sku)
      );

      // Format history timeline (only from StockTracking - no duplicates from Purchase/Adjustment)
      const timeline = variantHistory.map(record => ({
        date: record.createdAt,
        type: record.type === 'add' && record.reference && record.reference.startsWith('PUR-') ? 'purchase' : record.type,
        quantityChange: record.quantity,
        previousStock: record.previousStock,
        newStock: record.newStock,
        reason: record.reason || (record.type === 'add' && record.reference ? `Purchase: ${record.reference}` : 'Stock change'),
        performedBy: record.performedBy,
        reference: record.reference
      }));

      // Sort timeline by date (newest first)
      timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Pagination for variant timeline (each variant has its own pagination)
      // Query param format: variant_<sku>_page=1, variant_<sku>_limit=50
      const variantPageKey = `variant_${variant.sku}_page`;
      const variantLimitKey = `variant_${variant.sku}_limit`;
      const variantPage = parseInt(req.query[variantPageKey]) || 1;
      const variantLimit = parseInt(req.query[variantLimitKey]) || 50;
      const variantSkip = (variantPage - 1) * variantLimit;
      const variantTotalRecords = timeline.length;
      const variantTotalPages = Math.ceil(variantTotalRecords / variantLimit);
      const paginatedTimeline = timeline.slice(variantSkip, variantSkip + variantLimit);

      return {
        sku: variant.sku,
        attributes: variant.attributes,
        currentStock: variant.stockQuantity || 0,
        totalPurchase,
        totalSold,
        totalAdjustment,
        timeline: paginatedTimeline,
        pagination: {
          currentPage: variantPage,
          totalPages: variantTotalPages,
          totalRecords: variantTotalRecords,
          limit: variantLimit,
          hasNextPage: variantPage < variantTotalPages,
          hasPrevPage: variantPage > 1
        }
      };
    });

    // Handle main product (if no variants)
    let mainProductData = null;
    if (!product.variants || product.variants.length === 0) {
      const mainHistory = allStockHistory.filter(record => !record.variant);
      
      let totalPurchase = 0;
      let totalSold = 0;
      let totalAdjustment = 0;

      mainHistory.forEach(record => {
        if (record.type === 'add') {
          totalPurchase += Math.abs(record.quantity);
        } else if (record.type === 'remove') {
          totalSold += Math.abs(record.quantity);
        } else if (record.type === 'adjustment') {
          totalAdjustment += Math.abs(record.quantity);
        }
      });

      const mainPurchases = purchases.filter(purchase =>
        purchase.items.some(item => !item.variant)
      );

      const mainAdjustments = adjustments.filter(adjustment =>
        adjustment.items.some(item => !item.variant)
      );

      // Format history timeline (only from StockTracking - no duplicates)
      const timeline = mainHistory.map(record => ({
        date: record.createdAt,
        type: record.type === 'add' && record.reference && record.reference.startsWith('PUR-') ? 'purchase' : record.type,
        quantityChange: record.quantity,
        previousStock: record.previousStock,
        newStock: record.newStock,
        reason: record.reason || (record.type === 'add' && record.reference ? `Purchase: ${record.reference}` : 'Stock change'),
        performedBy: record.performedBy,
        reference: record.reference
      }));

      timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Pagination for main product timeline
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;
      const totalRecords = timeline.length;
      const totalPages = Math.ceil(totalRecords / limit);
      const paginatedTimeline = timeline.slice(skip, skip + limit);

      mainProductData = {
        currentStock: product.totalStock || 0,
        totalPurchase,
        totalSold,
        totalAdjustment,
        timeline: paginatedTimeline,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Product stock history fetched successfully',
      data: {
        product: {
          _id: product._id,
          title: product.title,
          brand: product.brand,
          featuredImage: product.featuredImage
        },
        variants: variantsData,
        mainProduct: mainProductData
      },
    });
  } catch (error) {
    console.error('Error fetching product stock history:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

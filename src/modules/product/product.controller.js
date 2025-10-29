const { Product } = require('./product.model');
const { StockTracking } = require('../inventory/stockTracking.model');
const sendResponse = require('../../utils/sendResponse');

// Helper for pagination and filtering
const getPaginatedProducts = async (filter, req, res, message) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-createdAt';

    // Additional filters from query
    const queryFilter = { ...filter };
    if (req.query.category) queryFilter.category = req.query.category;
    if (req.query.brand) queryFilter.brand = req.query.brand;
    if (req.query.minPrice) queryFilter['priceRange.min'] = { $gte: Number(req.query.minPrice) };
    if (req.query.maxPrice) queryFilter['priceRange.max'] = { $lte: Number(req.query.maxPrice) };
    if (req.query.isActive) queryFilter.isActive = req.query.isActive === 'true';
    
    // Add search functionality
    if (req.query.search) {
      const searchQuery = req.query.search;
      queryFilter.$or = [
        { title: { $regex: searchQuery, $options: 'i' } },
        { shortDescription: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
        { tags: { $in: [new RegExp(searchQuery, 'i')] } },
        { brand: { $regex: searchQuery, $options: 'i' } },
        { 'variants.sku': { $regex: searchQuery, $options: 'i' } }
      ];
    }

    const total = await Product.countDocuments(queryFilter);
    const products = await Product.find(queryFilter)
      .populate('category')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message,
      data: products,
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

exports.createProduct = async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();

    // Create stock tracking records
    if (product.variants && product.variants.length > 0) {
      // If product has variants, track each variant separately
      for (const variant of product.variants) {
        if (variant.stockQuantity && variant.stockQuantity > 0) {
          const variantStockTracking = new StockTracking({
            product: product._id,
            variant: {
              sku: variant.sku,
              attributes: variant.attributes
            },
            type: 'add',
            quantity: variant.stockQuantity,
            previousStock: 0,
            newStock: variant.stockQuantity,
            reason: 'Initial variant stock on product creation',
            performedBy: req.user?.id || req.user?._id,
            notes: `Stock added for variant ${variant.sku} during product creation`
          });
          await variantStockTracking.save();
        }
      }
    } else if (product.totalStock && product.totalStock > 0) {
      // If product has no variants, track main product stock
      const stockTracking = new StockTracking({
        product: product._id,
        type: 'add',
        quantity: product.totalStock,
        previousStock: 0,
        newStock: product.totalStock,
        reason: 'Initial stock on product creation',
        performedBy: req.user?.id || req.user?._id,
        notes: 'Stock added during product creation'
      });
      await stockTracking.save();
    }

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (error) {
    let statusCode = 500;
    let message = 'Server error';

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      statusCode = 400;
      
      // Check if it's a duplicate SKU error
      if (error.keyPattern && error.keyPattern['variants.sku']) {
        const duplicateSku = error.keyValue['variants.sku'];
        message = `Product variant with SKU "${duplicateSku}" already exists. Please use a different SKU.`;
      }
      // Check if it's a duplicate slug error
      else if (error.keyPattern && error.keyPattern.slug) {
        const duplicateSlug = error.keyValue.slug;
        message = `Product with slug "${duplicateSlug}" already exists. Please use a different slug.`;
      }
      // Check if it's a duplicate title error
      else if (error.keyPattern && error.keyPattern.title) {
        const duplicateTitle = error.keyValue.title;
        message = `Product with title "${duplicateTitle}" already exists. Please use a different title.`;
      }
      // Generic duplicate key error
      else {
        message = 'A product with this information already exists. Please check for duplicates.';
      }
    }
    // Handle validation errors
    else if (error.name === 'ValidationError') {
      statusCode = 400;
      const validationErrors = Object.values(error.errors).map(err => err.message);
      message = `Validation failed: ${validationErrors.join(', ')}`;
    }
    // Handle other specific errors
    else if (error.name === 'CastError') {
      statusCode = 400;
      message = 'Invalid data format provided.';
    }
    // Default error handling
    else {
      message = error.message || 'Failed to create product. Please try again.';
    }

    return sendResponse({
      res,
      statusCode,
      success: false,
      message,
    });
  }
};

exports.getProducts = async (req, res) => {
  return getPaginatedProducts({}, req, res, 'Products fetched successfully');
};

// Admin: Get all products with search, filter, and pagination
exports.getAdminProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-createdAt';
    const searchQuery = req.query.search || '';
    const statusFilter = req.query.status || req.query.filterStatus; // Support both 'status' and 'filterStatus'

    // Build base filter (admin sees all products, including inactive)
    const queryFilter = {};

    // Status filter (if not 'all')
    if (statusFilter && statusFilter !== 'all') {
      queryFilter.status = statusFilter;
    }

    // Search functionality - includes SKU, title, slug, brand
    if (searchQuery) {
      queryFilter.$or = [
        { title: { $regex: searchQuery, $options: 'i' } },
        { slug: { $regex: searchQuery, $options: 'i' } },
        { shortDescription: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
        { tags: { $in: [new RegExp(searchQuery, 'i')] } },
        { brand: { $regex: searchQuery, $options: 'i' } },
        { 'variants.sku': { $regex: searchQuery, $options: 'i' } }
      ];
    }

    const total = await Product.countDocuments(queryFilter);
    const products = await Product.find(queryFilter)
      .populate('category')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Admin products fetched successfully',
      data: products,
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

exports.getFeaturedProducts = async (req, res) => {
  return getPaginatedProducts({ isFeatured: true }, req, res, 'Featured products fetched successfully');
};

exports.getDiscountedProducts = async (req, res) => {
  return getPaginatedProducts({ 'variants.salePrice': { $gt: 0 } }, req, res, 'Discounted products fetched successfully');
};

exports.getNewArrivals = async (req, res) => {
  return getPaginatedProducts({ isNewArrival: true }, req, res, 'New arrivals fetched successfully');
};

exports.getBestsellingProducts = async (req, res) => {
  return getPaginatedProducts({ isBestselling: true }, req, res, 'Bestselling products fetched successfully');
};

// Get available filters based on categories
exports.getAvailableFilters = async (req, res) => {
  try {
    const categoryIds = req.query.category ? req.query.category.split(',').map(id => id.trim()) : [];

    let queryFilter = { isActive: true };

    // If categories are selected, filter by those categories including child categories
    if (categoryIds.length > 0) {
      // Get all child categories for the selected parent categories
      const { Category } = require('../category/category.model');
      const childCategories = await Category.find({
        parent: { $in: categoryIds }
      }).select('_id');
      
      // Combine parent and child category IDs
      const allCategoryIds = [
        ...categoryIds,
        ...childCategories.map(child => child._id.toString())
      ];
      
      queryFilter.category = { $in: allCategoryIds };
    }


    // Get all products matching the filter
    const products = await Product.find(queryFilter).select('isBracelet isRing braceletSizes ringSizes');


    // Count products with bracelet and ring types
    let hasBracelets = 0;
    let hasRings = 0;
    const braceletSizes = new Set();
    const ringSizes = new Set();

    products.forEach(product => {
      // Check if product is bracelet type
      if (product.isBracelet === true) {
        hasBracelets++;
        // Add bracelet sizes if they exist
        if (product.braceletSizes && Array.isArray(product.braceletSizes)) {
          product.braceletSizes.forEach(size => {
            if (size && size.trim()) {
              braceletSizes.add(size.trim());
            }
          });
        }
      }

      // Check if product is ring type
      if (product.isRing === true) {
        hasRings++;
        // Add ring sizes if they exist
        if (product.ringSizes && Array.isArray(product.ringSizes)) {
          product.ringSizes.forEach(size => {
            if (size && size.trim()) {
              ringSizes.add(size.trim());
            }
          });
        }
      }
    });

    // Convert to arrays and sort
    const uniqueBraceletSizes = Array.from(braceletSizes).sort();
    const uniqueRingSizes = Array.from(ringSizes).sort();

    // Calculate filter visibility
    const showBraceletFilter = hasBracelets > 0;
    const showRingFilter = hasRings > 0;


    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Available filters fetched successfully',
      data: {
        braceletSizes: uniqueBraceletSizes,
        ringSizes: uniqueRingSizes,
        showBraceletFilter: showBraceletFilter,
        showRingFilter: showRingFilter
      }
    });

  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Error fetching available filters',
    });
  }
};

exports.searchProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-createdAt';
    const searchQuery = req.query.search || req.query.query || '';

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Invalid pagination parameters',
      });
    }

    // Build search filter
    let queryFilter = { isActive: true };

    // Text search across multiple fields
    if (searchQuery) {
      queryFilter.$or = [
        { title: { $regex: searchQuery, $options: 'i' } },
        { shortDescription: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
        { tags: { $in: [new RegExp(searchQuery, 'i')] } },
        { brand: { $regex: searchQuery, $options: 'i' } },
        { 'variants.sku': { $regex: searchQuery, $options: 'i' } }
      ];
    }

    // Additional filters
    if (req.query.category) {
      const categoryIds = req.query.category.split(',').map(id => id.trim());
      
      // Get all child categories for the selected parent categories
      const { Category } = require('../category/category.model');
      const childCategories = await Category.find({
        parent: { $in: categoryIds }
      }).select('_id');
      
      // Combine parent and child category IDs
      const allCategoryIds = [
        ...categoryIds,
        ...childCategories.map(child => child._id.toString())
      ];
      
      queryFilter.category = { $in: allCategoryIds };
    }

    if (req.query.brand) queryFilter.brand = req.query.brand;

    // Size filters for jewelry
    if (req.query.braceletSize) {
      const sizes = req.query.braceletSize.split(',').map(size => size.trim());
      queryFilter.braceletSizes = { $in: sizes };
    }

    if (req.query.ringSize) {
      const sizes = req.query.ringSize.split(',').map(size => size.trim());
      queryFilter.ringSizes = { $in: sizes };
    }

    // Price filtering based on variants
    if (req.query.minPrice || req.query.maxPrice) {
      const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
      const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;

      // Validate price values
      if (minPrice !== null && (isNaN(minPrice) || minPrice < 0)) {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: 'Invalid minimum price value',
        });
      }

      if (maxPrice !== null && (isNaN(maxPrice) || maxPrice < 0)) {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: 'Invalid maximum price value',
        });
      }

      if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
        return sendResponse({
          res,
          statusCode: 200,
          success: true,
          message: 'Minimum price cannot be greater than maximum price',
        });
      }

      // Price filtering will be handled in the aggregation pipeline
    }

    let products, total;

    // Use aggregation pipeline only when price filtering is needed
    if (req.query.minPrice || req.query.maxPrice) {
      try {
        let pipeline = [];

        // Match stage for basic filters
        pipeline.push({ $match: queryFilter });

        // Filter by variant prices
        const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
        const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;

        if (minPrice !== null || maxPrice !== null) {
          pipeline.push({
            $match: {
              $or: [
                // Products with variants in price range
                {
                  variants: {
                    $elemMatch: {
                      currentPrice: {
                        ...(minPrice !== null && { $gte: minPrice }),
                        ...(maxPrice !== null && { $lte: maxPrice })
                      }
                    }
                  }
                },
                // Products without variants (fallback)
                { variants: { $size: 0 } }
              ]
            }
          });
        }

        // Add category population
        pipeline.push({
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'category'
          }
        });

        // Unwind category array
        pipeline.push({
          $unwind: {
            path: '$category',
            preserveNullAndEmptyArrays: true
          }
        });

        // Sort
        pipeline.push({ $sort: { [sort.replace('-', '')]: sort.startsWith('-') ? -1 : 1 } });

        // Count total before pagination
        const countPipeline = [...pipeline, { $count: 'total' }];
        const totalResult = await Product.aggregate(countPipeline);
        total = totalResult.length > 0 ? totalResult[0].total : 0;

        // Add pagination
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit });

        products = await Product.aggregate(pipeline);
      } catch (aggregationError) {
        // Fallback to simple search if aggregation fails
        total = await Product.countDocuments(queryFilter);
        products = await Product.find(queryFilter)
          .populate('category')
          .sort(sort)
          .skip(skip)
          .limit(limit);
      }
    } else {
      // Use simple find for non-price filtered searches
      total = await Product.countDocuments(queryFilter);
      products = await Product.find(queryFilter)
        .populate('category')
        .sort(sort)
        .skip(skip)
        .limit(limit);
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Search results fetched successfully',
      data: products,
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

exports.getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ slug })
      .populate('category')
      .populate('subCategories');

    

    if (!product) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Product not found',
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Product fetched successfully',
      data: product,
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

exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .populate('category')
      .populate('subCategories');
    
    if (!product) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Product not found',
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Product fetched successfully',
      data: product,
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

// Admin: Get single product by ID (with all details, no filtering by active status)
exports.getAdminProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .populate('category')
      .populate('subCategories');
    
    if (!product) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Product not found',
      });
    }
    
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Admin product fetched successfully',
      data: product,
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

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Get the original product to compare stock changes
    const originalProduct = await Product.findById(id);
    if (!originalProduct) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Product not found',
      });
    }

    // Update the product
    const product = await Product.findByIdAndUpdate(id, updates, { new: true });
    
    // Check for stock changes and create tracking records
    const stockTrackingRecords = [];
    
    // Check main product stock changes
    if (updates.totalStock !== undefined && updates.totalStock !== originalProduct.totalStock) {
      const previousStock = originalProduct.totalStock || 0;
      const newStock = updates.totalStock;
      const quantity = Math.abs(newStock - previousStock);
      const type = newStock > previousStock ? 'add' : 'remove';
      
      const stockTracking = new StockTracking({
        product: id,
        variant: null,
        type: type,
        quantity: quantity,
        previousStock: previousStock,
        newStock: newStock,
        reason: 'Product Information Updated',
        reference: 'Product Edit',
        performedBy: req.user?._id || null,
        cost: null,
        notes: `Main product stock changed from ${previousStock} to ${newStock} units`
      });
      
      stockTrackingRecords.push(stockTracking);
    }
    
    // Check variant stock changes
    if (updates.variants && Array.isArray(updates.variants)) {
      for (const updatedVariant of updates.variants) {
        if (updatedVariant.sku) {
          const originalVariant = originalProduct.variants.find(v => v.sku === updatedVariant.sku);
          
          if (originalVariant && updatedVariant.stockQuantity !== undefined) {
            const previousStock = originalVariant.stockQuantity || 0;
            const newStock = updatedVariant.stockQuantity;
            
            if (previousStock !== newStock) {
              const quantity = Math.abs(newStock - previousStock);
              const type = newStock > previousStock ? 'add' : 'remove';
              
              const stockTracking = new StockTracking({
                product: id,
                variant: {
                  sku: updatedVariant.sku,
                  attributes: updatedVariant.attributes || originalVariant.attributes
                },
                type: type,
                quantity: quantity,
                previousStock: previousStock,
                newStock: newStock,
                reason: 'Product Variant Updated',
                reference: 'Product Edit',
                performedBy: req.user?.id || null,
                cost: null,
                notes: `Variant stock changed from ${previousStock} to ${newStock} units`
              });
              
              stockTrackingRecords.push(stockTracking);
            }
          }
        }
      }
    }
    
    // Save all stock tracking records
    if (stockTrackingRecords.length > 0) {
      await StockTracking.insertMany(stockTrackingRecords);
    }
    
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Product updated successfully',
      data: {
        product,
        stockTrackingRecords: stockTrackingRecords.length
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

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Product not found',
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Product deleted successfully',
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

// Check stock availability for cart items
exports.checkStockAvailability = async (req, res) => {
  try {
    const { cartItems } = req.body;

    if (!cartItems || !Array.isArray(cartItems)) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Cart items array is required',
      });
    }

    const stockCheckResults = [];

    for (const cartItem of cartItems) {
      try {
        const product = await Product.findById(cartItem.productId);
        
        if (!product) {
          stockCheckResults.push({
            cartItemId: cartItem.id,
            productId: cartItem.productId,
            isAvailable: false,
            availableStock: 0,
            requestedQuantity: cartItem.quantity,
            reason: 'Product not found'
          });
          continue;
        }

        // Check if product has variants
        if (product.variants && product.variants.length > 0) {
          // Find the specific variant
          const variant = product.variants.find(v => v.sku === cartItem.sku);
          
          if (!variant) {
            stockCheckResults.push({
              cartItemId: cartItem.id,
              productId: cartItem.productId,
              sku: cartItem.sku,
              isAvailable: false,
              availableStock: 0,
              requestedQuantity: cartItem.quantity,
              reason: 'Variant not found'
            });
            continue;
          }

          const availableStock = variant.stockQuantity || 0;
          const isAvailable = availableStock >= cartItem.quantity;

          stockCheckResults.push({
            cartItemId: cartItem.id,
            productId: cartItem.productId,
            sku: cartItem.sku,
            isAvailable,
            availableStock,
            requestedQuantity: cartItem.quantity,
            reason: isAvailable ? 'In stock' : 'Insufficient stock'
          });
        } else {
          // Product without variants - check totalStock
          const availableStock = product.totalStock || 0;
          const isAvailable = availableStock >= cartItem.quantity;

          stockCheckResults.push({
            cartItemId: cartItem.id,
            productId: cartItem.productId,
            isAvailable,
            availableStock,
            requestedQuantity: cartItem.quantity,
            reason: isAvailable ? 'In stock' : 'Insufficient stock'
          });
        }
      } catch (itemError) {
        stockCheckResults.push({
          cartItemId: cartItem.id,
          productId: cartItem.productId,
          isAvailable: false,
          availableStock: 0,
          requestedQuantity: cartItem.quantity,
          reason: 'Error checking stock'
        });
      }
    }

    // Check if any items are out of stock
    const outOfStockItems = stockCheckResults.filter(item => !item.isAvailable);
    const allItemsInStock = outOfStockItems.length === 0;

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: allItemsInStock ? 'All items are in stock' : 'Some items are out of stock',
      data: {
        stockCheckResults,
        allItemsInStock,
        outOfStockItems,
        totalItems: cartItems.length,
        outOfStockCount: outOfStockItems.length
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

// Get similar products with smart fallback logic
exports.getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const limit = parseInt(req.query.limit) || 8;
    const minRequired = parseInt(req.query.minRequired) || 4;

    // First, get the current product to find its category
    const currentProduct = await Product.findById(productId).populate('category');
    
    if (!currentProduct) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Product not found',
      });
    }

    let similarProducts = [];
    let source = 'category'; // Track where products came from

    // Step 1: Try to get products from the same category first
    if (currentProduct.category) {
      const categoryProducts = await Product.find({
        _id: { $ne: productId }, // Exclude current product
        category: currentProduct.category._id,
        isActive: true
      })
      .populate('category')
      .sort({ createdAt: -1 })
      .limit(limit);

      similarProducts = categoryProducts;
      
    }

    // Step 2: If we don't have enough products from same category, fill with products from all categories
    if (similarProducts.length < minRequired) {
      const remainingNeeded = limit - similarProducts.length;
      
      // Get additional products from all categories, excluding current product and already selected ones
      const excludeIds = [productId, ...similarProducts.map(p => p._id)];
      
      const additionalProducts = await Product.find({
        _id: { $nin: excludeIds },
        isActive: true
      })
      .populate('category')
      .sort({ createdAt: -1 })
      .limit(remainingNeeded);

      similarProducts = [...similarProducts, ...additionalProducts];
      source = similarProducts.length > minRequired ? 'mixed' : 'all';
      
      
    }

    // Ensure we don't exceed the limit
    similarProducts = similarProducts.slice(0, limit);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: `Similar products fetched successfully (${source} source)`,
      data: similarProducts,
      meta: {
        source,
        totalFound: similarProducts.length,
        categoryName: currentProduct.category?.name || 'Unknown',
        requestedLimit: limit,
        minRequired
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
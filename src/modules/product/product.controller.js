const { Product } = require('./product.model');
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
    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Product created successfully',
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

exports.getProducts = async (req, res) => {
  return getPaginatedProducts({}, req, res, 'Products fetched successfully');
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

    // If categories are selected, filter by those categories
    if (categoryIds.length > 0) {
      queryFilter.category = { $in: categoryIds };
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
    console.error('Error getting available filters:', error);
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
        { brand: { $regex: searchQuery, $options: 'i' } }
      ];
    }

    // Additional filters
    if (req.query.category) {
      const categoryIds = req.query.category.split(',').map(id => id.trim());
      queryFilter.category = { $in: categoryIds };
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
        console.error('Aggregation pipeline error:', aggregationError);
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
    console.error('Error in getProductBySlug:', error);
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
    const product = await Product.findById(id);
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

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const product = await Product.findByIdAndUpdate(id, updates, { new: true });
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
      message: 'Product updated successfully',
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
        console.error('Error checking stock for item:', cartItem, itemError);
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
    console.error('Error checking stock availability:', error);
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
    console.error('Error fetching similar products:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};
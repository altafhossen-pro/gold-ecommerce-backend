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

exports.getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    console.log('Searching for product with slug:', slug);
    
    const product = await Product.findOne({ slug })
      .populate('category')
      .populate('subCategories');
      
    console.log('Found product:', product ? product.title : 'Not found');
    
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

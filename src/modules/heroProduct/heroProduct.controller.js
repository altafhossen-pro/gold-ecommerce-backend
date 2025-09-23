const { HeroProduct } = require('./heroProduct.model');
const sendResponse = require('../../utils/sendResponse');

// Get all active hero products
exports.getHeroProducts = async (req, res) => {
  try {
    const products = await HeroProduct.find({ isActive: true })
      .populate('productId', 'title name slug images category price priceRange featuredImage shortDescription')
      .populate('productId.category', 'name')
      .sort({ order: 1 })
      .select('-__v');

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Hero products retrieved successfully',
      data: products
    });
  } catch (error) {
    console.error('Error fetching hero products:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Admin: Get all hero products (including inactive)
exports.getAllHeroProducts = async (req, res) => {
  try {
    const products = await HeroProduct.find()
      .populate('productId', 'title name slug images category price priceRange featuredImage shortDescription')
      .populate('productId.category', 'name')
      .sort({ order: 1 })
      .select('-__v');

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'All hero products retrieved successfully',
      data: products
    });
  } catch (error) {
    console.error('Error fetching all hero products:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Admin: Create hero product
exports.createHeroProduct = async (req, res) => {
  try {
    const { productId, customImage, size, badge, isActive, order } = req.body;

    // Check if product already exists in hero section
    const existingProduct = await HeroProduct.findOne({ productId });
    if (existingProduct) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Product already exists in hero section',
      });
    }

    const productData = {
      productId,
      customImage: customImage || null,
      size: size || 'large',
      badge: {
        text: badge?.text || '',
        color: badge?.color || 'bg-pink-500'
      },
      isActive: isActive !== false,
      order: order || 0
    };

    const heroProduct = new HeroProduct(productData);
    await heroProduct.save();

    // Populate the product data for response
    await heroProduct.populate('productId', 'title name slug images category price priceRange featuredImage shortDescription');
    await heroProduct.populate('productId.category', 'name');

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Hero product created successfully',
      data: heroProduct
    });
  } catch (error) {
    console.error('Error creating hero product:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Admin: Update hero product
exports.updateHeroProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, customImage, size, badge, isActive, order } = req.body;

    const updateData = {
      customImage: customImage || null,
      size: size || 'large',
      badge: {
        text: badge?.text || '',
        color: badge?.color || 'bg-pink-500'
      },
      isActive: isActive !== false,
      order: order || 0
    };

    // If productId is being changed, check for duplicates
    if (productId) {
      const existingProduct = await HeroProduct.findOne({ 
        productId, 
        _id: { $ne: id } 
      });
      if (existingProduct) {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: 'Product already exists in hero section',
        });
      }
      updateData.productId = productId;
    }

    const heroProduct = await HeroProduct.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('productId', 'title name slug images category price priceRange featuredImage shortDescription')
     .populate('productId.category', 'name');

    if (!heroProduct) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Hero product not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Hero product updated successfully',
      data: heroProduct
    });
  } catch (error) {
    console.error('Error updating hero product:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Admin: Delete hero product
exports.deleteHeroProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const heroProduct = await HeroProduct.findByIdAndDelete(id);

    if (!heroProduct) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Hero product not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Hero product deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting hero product:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Admin: Update product order
exports.updateProductOrder = async (req, res) => {
  try {
    const { products } = req.body; // Array of { id, order }

    const updatePromises = products.map(product => 
      HeroProduct.findByIdAndUpdate(product.id, { order: product.order }, { new: true })
    );

    await Promise.all(updatePromises);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Product order updated successfully',
    });
  } catch (error) {
    console.error('Error updating product order:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

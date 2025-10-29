const { Upsell } = require('./upsell.model');
const { Product } = require('../product/product.model');
const sendResponse = require('../../utils/sendResponse');

// Get all upsells with pagination
const getAllUpsells = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const total = await Upsell.countDocuments(filter);
    const upsells = await Upsell.find(filter)
      .populate('mainProduct', 'title slug featuredImage priceRange status isActive')
      .populate('linkedProducts.product', 'title slug featuredImage priceRange status isActive')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Upsells retrieved successfully',
      data: upsells,
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

// Get single upsell by ID
const getUpsellById = async (req, res) => {
  try {
    const { id } = req.params;

    const upsell = await Upsell.findById(id)
      .populate('mainProduct', 'title slug featuredImage priceRange status isActive')
      .populate('linkedProducts.product', 'title slug featuredImage priceRange status isActive')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!upsell) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Upsell not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Upsell retrieved successfully',
      data: upsell,
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

// Create new upsell
const createUpsell = async (req, res) => {
  try {
    const { mainProduct, linkedProducts } = req.body;
    const userId = req.user.id;

    // Validate main product exists
    const mainProductExists = await Product.findById(mainProduct);
    if (!mainProductExists) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Main product not found',
      });
    }

    // Check if upsell already exists for this main product
    const existingUpsell = await Upsell.findOne({ mainProduct });
    if (existingUpsell) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Upsell already exists for this product',
      });
    }

    // Validate linked products exist
    if (linkedProducts && linkedProducts.length > 0) {
      const linkedProductIds = linkedProducts.map(lp => lp.product || lp);
      const linkedProductsExist = await Product.find({ 
        _id: { $in: linkedProductIds },
        isActive: true,
        status: 'published'
      });

      if (linkedProductsExist.length !== linkedProductIds.length) {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: 'Some linked products not found or inactive',
        });
      }

      // Check if any linked product is the same as main product
      if (linkedProductIds.includes(mainProduct)) {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: 'Main product cannot be linked to itself',
        });
      }
    }

    // Create upsell
    const upsellData = {
      mainProduct,
      createdBy: userId,
      linkedProducts: linkedProducts || []
    };

    const upsell = new Upsell(upsellData);
    await upsell.save();

    // Populate the created upsell
    await upsell.populate([
      { path: 'mainProduct', select: 'title slug featuredImage priceRange status isActive' },
      { path: 'linkedProducts.product', select: 'title slug featuredImage priceRange status isActive' },
      { path: 'createdBy', select: 'name email' }
    ]);

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Upsell created successfully',
      data: upsell,
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

// Update upsell
const updateUpsell = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const userId = req.user.id;

    const upsell = await Upsell.findById(id);
    if (!upsell) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Upsell not found',
      });
    }

    // Update fields
    if (isActive !== undefined) {
      upsell.isActive = isActive;
    }

    upsell.updatedBy = userId;
    await upsell.save();

    // Populate the updated upsell
    await upsell.populate([
      { path: 'mainProduct', select: 'title slug featuredImage priceRange status isActive' },
      { path: 'linkedProducts.product', select: 'title slug featuredImage priceRange status isActive' },
      { path: 'createdBy', select: 'name email' },
      { path: 'updatedBy', select: 'name email' }
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Upsell updated successfully',
      data: upsell,
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

// Add linked product to upsell
const addLinkedProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, order = 0 } = req.body;

    const upsell = await Upsell.findById(id);
    if (!upsell) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Upsell not found',
      });
    }

    // Validate product exists and is active
    const product = await Product.findById(productId);
    if (!product || !product.isActive || product.status !== 'published') {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Product not found or inactive',
      });
    }

    // Check if product is the same as main product
    if (productId === upsell.mainProduct.toString()) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Cannot link main product to itself',
      });
    }

    // Check if product is already linked
    const existingLink = upsell.linkedProducts.find(link => 
      link.product.toString() === productId
    );
    if (existingLink) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Product is already linked',
      });
    }

    // Add linked product
    await upsell.addLinkedProduct(productId, order);

    // Populate the updated upsell
    await upsell.populate([
      { path: 'mainProduct', select: 'title slug featuredImage priceRange status isActive' },
      { path: 'linkedProducts.product', select: 'title slug featuredImage priceRange status isActive' },
      { path: 'createdBy', select: 'name email' }
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Linked product added successfully',
      data: upsell,
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

// Remove linked product from upsell
const removeLinkedProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId } = req.body;

    const upsell = await Upsell.findById(id);
    if (!upsell) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Upsell not found',
      });
    }

    // Remove linked product
    await upsell.removeLinkedProduct(productId);

    // Populate the updated upsell
    await upsell.populate([
      { path: 'mainProduct', select: 'title slug featuredImage priceRange status isActive' },
      { path: 'linkedProducts.product', select: 'title slug featuredImage priceRange status isActive' },
      { path: 'createdBy', select: 'name email' }
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Linked product removed successfully',
      data: upsell,
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

// Update linked product order
const updateLinkedProductOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, order } = req.body;

    const upsell = await Upsell.findById(id);
    if (!upsell) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Upsell not found',
      });
    }

    // Update order
    await upsell.updateLinkedProductOrder(productId, order);

    // Populate the updated upsell
    await upsell.populate([
      { path: 'mainProduct', select: 'title slug featuredImage priceRange status isActive' },
      { path: 'linkedProducts.product', select: 'title slug featuredImage priceRange status isActive' },
      { path: 'createdBy', select: 'name email' }
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Linked product order updated successfully',
      data: upsell,
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

// Toggle linked product status
const toggleLinkedProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId } = req.body;

    const upsell = await Upsell.findById(id);
    if (!upsell) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Upsell not found',
      });
    }

    // Toggle status
    await upsell.toggleLinkedProductStatus(productId);

    // Populate the updated upsell
    await upsell.populate([
      { path: 'mainProduct', select: 'title slug featuredImage priceRange status isActive' },
      { path: 'linkedProducts.product', select: 'title slug featuredImage priceRange status isActive' },
      { path: 'createdBy', select: 'name email' }
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Linked product status updated successfully',
      data: upsell,
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

// Delete upsell
const deleteUpsell = async (req, res) => {
  try {
    const { id } = req.params;

    const upsell = await Upsell.findById(id);
    if (!upsell) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Upsell not found',
      });
    }

    await Upsell.findByIdAndDelete(id);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Upsell deleted successfully',
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

// Get upsells by main product
const getUpsellsByMainProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const upsell = await Upsell.findByMainProduct(productId);
    if (!upsell) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'No upsells found for this product',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Upsells retrieved successfully',
      data: upsell,
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

// Get upsells by main product (Public - no auth required)
const getUpsellsByMainProductPublic = async (req, res) => {
  try {
    const { productId } = req.params;

    const upsell = await Upsell.findOne({ 
      mainProduct: productId, 
      isActive: true 
    })
    .populate('mainProduct', 'title slug featuredImage priceRange status isActive')
    .populate({
      path: 'linkedProducts.product',
      select: 'title slug featuredImage priceRange status isActive totalStock variants',
      populate: {
        path: 'variants',
        select: 'sku attributes currentPrice originalPrice stockQuantity stockStatus'
      }
    })
    .select('mainProduct linkedProducts isActive');

    if (!upsell) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'No upsells found for this product',
      });
    }

    // Filter out inactive linked products
    upsell.linkedProducts = upsell.linkedProducts.filter(link => 
      link.isActive && 
      link.product && 
      link.product.isActive && 
      link.product.status === 'published'
    );

    

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Upsells retrieved successfully',
      data: upsell,
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

// Get upsells by linked product
const getUpsellsByLinkedProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const upsells = await Upsell.findByLinkedProduct(productId);
    if (!upsells || upsells.length === 0) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'No upsells found for this linked product',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Upsells retrieved successfully',
      data: upsells,
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

// Search products for linking
const searchProductsForLinking = async (req, res) => {
  try {
    const { query, excludeId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build search filter
    const filter = {
      isActive: true,
      status: 'published'
    };

    if (excludeId) {
      filter._id = { $ne: excludeId };
    }

    if (query) {
      filter.$or = [
        { title: { $regex: query, $options: 'i' } },
        { shortDescription: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ];
    }

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .select('title slug featuredImage priceRange status isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Products retrieved successfully',
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

module.exports = {
  getAllUpsells,
  getUpsellById,
  createUpsell,
  updateUpsell,
  addLinkedProduct,
  removeLinkedProduct,
  updateLinkedProductOrder,
  toggleLinkedProductStatus,
  deleteUpsell,
  getUpsellsByMainProduct,
  getUpsellsByMainProductPublic,
  getUpsellsByLinkedProduct,
  searchProductsForLinking
};

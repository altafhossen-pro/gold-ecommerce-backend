const { Category } = require('./category.model');
const sendResponse = require('../../utils/sendResponse');
const mongoose = require('mongoose');

exports.createCategory = async (req, res) => {
  try {
    const { name, slug, image, parent, isFeatured } = req.body;
    if (!name || !slug) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Name and slug are required',
      });
    }
    
    // Handle empty parent field - convert empty string to null
    const parentValue = (parent === '' || !parent) ? null : parent;
    
    const category = new Category({ 
      name, 
      slug, 
      image, 
      parent: parentValue,
      isFeatured: isFeatured || false
    });
    await category.save();
    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Category created successfully',
      data: category,
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

// Helper for pagination and filtering
const getPaginatedCategories = async (filter, req, res, message) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || 'name';

    // Additional filters from query
    const queryFilter = { ...filter };
    if (req.query.isActive) queryFilter.isActive = req.query.isActive === 'true';
    if (req.query.parent) queryFilter.parent = req.query.parent;

    const total = await Category.countDocuments(queryFilter);
    
    // Get categories with product counts
    const categories = await Category.aggregate([
      {
        $match: queryFilter
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'category',
          as: 'products'
        }
      },
      {
        $addFields: {
          productCount: { $size: '$products' }
        }
      },
      {
        $project: {
          name: 1,
          slug: 1,
          image: 1,
          parent: 1,
          isActive: 1,
          isFeatured: 1,
          sortOrder: 1,
          productCount: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      {
        $sort: { [sort]: 1 }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      }
    ]);

    // Populate parent and children references
    const populatedCategories = await Category.populate(categories, [
      { path: 'parent' },
      { path: 'children' }
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message,
      data: populatedCategories,
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

exports.getCategories = async (req, res) => {
  return getPaginatedCategories({}, req, res, 'Categories fetched successfully');
};

// Get only main/parent categories (no children)
exports.getMainCategories = async (req, res) => {
  try {
    const categories = await Category.aggregate([
      {
        $match: { 
          parent: null, // Only categories without parent
          isActive: true // Only active categories
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'category',
          as: 'products'
        }
      },
      {
        $addFields: {
          productCount: { $size: '$products' }
        }
      },
      {
        $project: {
          name: 1,
          slug: 1,
          image: 1,
          parent: 1,
          isActive: 1,
          isFeatured: 1,
          sortOrder: 1,
          productCount: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      {
        $sort: { sortOrder: 1, name: 1 }
      }
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Main categories fetched successfully',
      data: categories,
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

// Get paginated main categories with pagination
exports.getPaginatedMainCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12; // Default 12 categories per page
    const skip = (page - 1) * limit;

    // Get total count first
    const total = await Category.countDocuments({ 
      parent: null, 
      isActive: true 
    });

    // Get categories with pagination
    const categories = await Category.aggregate([
      {
        $match: { 
          parent: null, // Only categories without parent
          isActive: true // Only active categories
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'category',
          as: 'products'
        }
      },
      {
        $addFields: {
          productCount: { $size: '$products' }
        }
      },
      {
        $project: {
          name: 1,
          slug: 1,
          image: 1,
          parent: 1,
          isActive: 1,
          isFeatured: 1,
          sortOrder: 1,
          productCount: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      {
        $sort: { sortOrder: 1, name: 1 }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      }
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Paginated main categories fetched successfully',
      data: categories,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
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

// Get categories for homepage (limited, active categories)
exports.getHomepageCategories = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Get categories with product counts
    const categories = await Category.aggregate([
      {
        $lookup: {
          from: 'products', // Assuming your product collection name is 'products'
          localField: '_id',
          foreignField: 'category',
          as: 'products'
        }
      },
      {
        $addFields: {
          productCount: { $size: '$products' }
        }
      },
      {
        $project: {
          name: 1,
          slug: 1,
          image: 1,
          parent: 1,
          isActive: 1,
          isFeatured: 1,
          sortOrder: 1,
          productCount: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      {
        $sort: { sortOrder: 1, name: 1 }
      },
      {
        $limit: limit
      }
    ]);

    // Populate parent and children references
    const populatedCategories = await Category.populate(categories, [
      { path: 'parent' },
      { path: 'children' }
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Homepage categories fetched successfully',
      data: populatedCategories,
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

// Get featured categories for homepage
exports.getFeaturedCategories = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    
    // Get featured categories with product counts
    const categories = await Category.aggregate([
      {
        $match: { isActive: true, isFeatured: true }
      },
      {
        $lookup: {
          from: 'products', // Assuming your product collection name is 'products'
          localField: '_id',
          foreignField: 'category',
          as: 'products'
        }
      },
      {
        $addFields: {
          productCount: { $size: '$products' }
        }
      },
      {
        $project: {
          name: 1,
          slug: 1,
          image: 1,
          parent: 1,
          isActive: 1,
          isFeatured: 1,
          sortOrder: 1,
          productCount: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      {
        $sort: { sortOrder: 1, name: 1 }
      },
      {
        $limit: limit
      }
    ]);

    // Populate parent and children references
    const populatedCategories = await Category.populate(categories, [
      { path: 'parent' },
      { path: 'children' }
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Featured categories fetched successfully',
      data: populatedCategories,
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

exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get category with product count
    const categories = await Category.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(id) }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'category',
          as: 'products'
        }
      },
      {
        $addFields: {
          productCount: { $size: '$products' }
        }
      },
      {
        $project: {
          name: 1,
          slug: 1,
          image: 1,
          parent: 1,
          isActive: 1,
          isFeatured: 1,
          sortOrder: 1,
          productCount: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ]);

    if (!categories || categories.length === 0) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Category not found',
      });
    }

    const category = categories[0];
    
    // Populate parent and children references
    const populatedCategory = await Category.populate(category, [
      { path: 'parent' },
      { path: 'children' }
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Category fetched successfully',
      data: populatedCategory,
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

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Handle empty parent field - convert empty string to null
    if (updates.parent === '') {
      updates.parent = null;
    }
    
    // Handle isFeatured field - ensure it's boolean
    if (updates.isFeatured !== undefined) {
      updates.isFeatured = Boolean(updates.isFeatured);
    }
    
    const category = await Category.findByIdAndUpdate(id, updates, { new: true }).populate('parent').populate('children');
    if (!category) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Category not found',
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Category updated successfully',
      data: category,
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

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Category not found',
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Category deleted successfully',
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

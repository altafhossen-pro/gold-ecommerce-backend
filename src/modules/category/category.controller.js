const { Category } = require('./category.model');
const sendResponse = require('../../utils/sendResponse');

exports.createCategory = async (req, res) => {
  try {
    const { name, slug, image, parent } = req.body;
    if (!name || !slug) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Name and slug are required',
      });
    }
    const category = new Category({ name, slug, image, parent: parent || null });
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

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find().populate('parent').populate('children');
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Categories fetched successfully',
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

exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id).populate('parent').populate('children');
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
      message: 'Category fetched successfully',
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

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
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

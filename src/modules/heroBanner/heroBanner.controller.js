const { HeroBanner } = require('./heroBanner.model');
const sendResponse = require('../../utils/sendResponse');

// Get all active hero banners
exports.getHeroBanners = async (req, res) => {
  try {
    const banners = await HeroBanner.find({ isActive: true })
      .sort({ order: 1 })
      .select('-__v');

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Hero banners retrieved successfully',
      data: banners
    });
  } catch (error) {
    console.error('Error fetching hero banners:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Admin: Get all hero banners (including inactive)
exports.getAllHeroBanners = async (req, res) => {
  try {
    const banners = await HeroBanner.find()
      .sort({ order: 1 })
      .select('-__v');

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'All hero banners retrieved successfully',
      data: banners
    });
  } catch (error) {
    console.error('Error fetching all hero banners:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Admin: Create hero banner
exports.createHeroBanner = async (req, res) => {
  try {
    const { image, link, isActive, order } = req.body;

    if (!image) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Image is required',
      });
    }

    const bannerData = {
      image,
      link: link || '',
      isActive: isActive !== false,
      order: order || 0,
      createdBy: req.user?._id
    };

    const banner = new HeroBanner(bannerData);
    await banner.save();

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Hero banner created successfully',
      data: banner
    });
  } catch (error) {
    console.error('Error creating hero banner:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Admin: Update hero banner
exports.updateHeroBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { image, link, isActive, order } = req.body;

    if (!image) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Image is required',
      });
    }

    const updateData = {
      image,
      link: link || '',
      isActive: isActive !== false,
      order: order || 0,
      updatedBy: req.user?._id
    };

    const banner = await HeroBanner.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!banner) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Hero banner not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Hero banner updated successfully',
      data: banner
    });
  } catch (error) {
    console.error('Error updating hero banner:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Admin: Delete hero banner
exports.deleteHeroBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await HeroBanner.findByIdAndDelete(id);

    if (!banner) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Hero banner not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Hero banner deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting hero banner:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Admin: Update banner order
exports.updateBannerOrder = async (req, res) => {
  try {
    const { banners } = req.body; // Array of { id, order }

    const updatePromises = banners.map(banner => 
      HeroBanner.findByIdAndUpdate(banner.id, { order: banner.order }, { new: true })
    );

    await Promise.all(updatePromises);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Banner order updated successfully',
    });
  } catch (error) {
    console.error('Error updating banner order:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

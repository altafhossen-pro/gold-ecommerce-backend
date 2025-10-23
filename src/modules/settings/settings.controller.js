
const sendResponse = require('../../utils/sendResponse');
const Settings = require('./settings.model');

// Get current settings
exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Settings retrieved successfully',
      data: settings
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Update settings (Admin only)
exports.updateSettings = async (req, res) => {
  try {
    const updateData = req.body;
    updateData.updatedBy = req.user._id; // Set who updated it
    
    let settings = await Settings.findOne();
    
    if (!settings) {
      // Create new settings if none exist
      settings = new Settings(updateData);
    } else {
      // Update existing settings
      Object.assign(settings, updateData);
    }
    
    await settings.save();
    
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Reset settings to default
exports.resetSettings = async (req, res) => {
  try {
    await Settings.deleteMany({});
    
    const defaultSettings = new Settings();
    await defaultSettings.save();
    
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Settings reset to default successfully',
      data: defaultSettings
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get loyalty settings only
exports.getLoyaltySettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Loyalty settings retrieved successfully',
      data: settings.loyaltySettings
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Update loyalty settings only
exports.updateLoyaltySettings = async (req, res) => {
  try {
    const loyaltyData = req.body;
    const updateData = {
      'loyaltySettings': loyaltyData,
      updatedBy: req.user._id
    };
    
    let settings = await Settings.findOne();
    
    if (!settings) {
      // Create new settings if none exist
      settings = new Settings();
    }
    
    // Update only loyalty settings
    Object.assign(settings.loyaltySettings, loyaltyData);
    settings.updatedBy = req.user._id;
    
    await settings.save();
    
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Loyalty settings updated successfully',
      data: settings.loyaltySettings
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get delivery charge settings
exports.getDeliveryChargeSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Delivery charge settings retrieved successfully',
      data: settings.deliveryChargeSettings
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Update delivery charge settings
exports.updateDeliveryChargeSettings = async (req, res) => {
  try {
    const deliveryChargeData = req.body;
    
    let settings = await Settings.findOne();
    
    if (!settings) {
      // Create new settings if none exist
      settings = new Settings();
    }
    
    // Update only delivery charge settings
    Object.assign(settings.deliveryChargeSettings, deliveryChargeData);
    settings.updatedBy = req.user._id;
    
    await settings.save();
    
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Delivery charge settings updated successfully',
      data: settings.deliveryChargeSettings
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error'
    });
  }
};

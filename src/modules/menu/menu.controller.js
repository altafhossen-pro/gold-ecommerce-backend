const { Menu } = require('./menu.model');
const sendResponse = require('../../utils/sendResponse');


// Header Menu Controllers
exports.getHeaderMenus = async (req, res) => {
  try {
    const menus = await Menu.find({ type: 'header', isVisible: true })
      .sort({ order: 1 })
      .select('-__v');

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Header menus retrieved successfully',
      data: menus
    });
  } catch (error) {
    console.error('Error fetching header menus:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.createHeaderMenu = async (req, res) => {
  try {
    const { name, href, isActive, order, isVisible, target, icon, description } = req.body;

    // Prepare menu data, only include fields that have values
    const menuData = {
      type: 'header',
      name,
      href,
      isActive: isActive || false,
      order: order || 0,
      isVisible: isVisible !== false,
      target: target || '_self'
    };

    // Only add optional fields if they have values
    if (icon && icon.trim() !== '') {
      menuData.icon = icon;
    }
    if (description && description.trim() !== '') {
      menuData.description = description;
    }

    const menu = new Menu(menuData);

    await menu.save();

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Header menu created successfully',
      data: menu
    });
  } catch (error) {
    console.error('Error creating header menu:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.updateHeaderMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, href, isActive, order, isVisible, target, icon, description } = req.body;

    // Prepare update data, only include fields that have values
    const updateData = {
      name,
      href,
      isActive: isActive || false,
      order: order || 0,
      isVisible: isVisible !== false,
      target: target || '_self'
    };

    // Only add optional fields if they have values, or set to null if empty
    updateData.icon = (icon && icon.trim() !== '') ? icon : null;
    updateData.description = (description && description.trim() !== '') ? description : null;

    const menu = await Menu.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!menu) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Header menu not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Header menu updated successfully',
      data: menu
    });
  } catch (error) {
    console.error('Error updating header menu:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.deleteHeaderMenu = async (req, res) => {
  try {
    const { id } = req.params;

    const menu = await Menu.findByIdAndDelete(id);

    if (!menu) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Header menu not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Header menu deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting header menu:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Footer Menu Controllers
exports.getFooterMenus = async (req, res) => {
  try {
    const { section } = req.query;
    
    let query = { type: 'footer', isVisible: true };
    if (section) {
      query.section = section;
    }

    const menus = await Menu.find(query)
      .sort({ section: 1, order: 1 })
      .select('-__v');

    // Group by section
    const groupedMenus = menus.reduce((acc, menu) => {
      if (!acc[menu.section]) {
        acc[menu.section] = [];
      }
      acc[menu.section].push(menu);
      return acc;
    }, {});

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Footer menus retrieved successfully',
      data: groupedMenus
    });
  } catch (error) {
    console.error('Error fetching footer menus:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.createFooterMenu = async (req, res) => {
  try {
    const { section, name, href, isActive, order, isVisible, target, icon, description, contactType, socialPlatform } = req.body;

    // Prepare menu data, only include fields that have values
    const menuData = {
      type: 'footer',
      section,
      name,
      href,
      isActive: isActive || false,
      order: order || 0,
      isVisible: isVisible !== false,
      target: target || '_self'
    };

    // Only add optional fields if they have values
    if (icon && icon.trim() !== '') {
      menuData.icon = icon;
    }
    if (description && description.trim() !== '') {
      menuData.description = description;
    }
    if (contactType && contactType.trim() !== '') {
      menuData.contactType = contactType;
    }
    if (socialPlatform && socialPlatform.trim() !== '') {
      menuData.socialPlatform = socialPlatform;
    }

    const menu = new Menu(menuData);

    await menu.save();

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Footer menu created successfully',
      data: menu
    });
  } catch (error) {
    console.error('Error creating footer menu:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.updateFooterMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { section, name, href, isActive, order, isVisible, target, icon, description, contactType, socialPlatform } = req.body;

    // Prepare update data, only include fields that have values
    const updateData = {
      section,
      name,
      href,
      isActive: isActive || false,
      order: order || 0,
      isVisible: isVisible !== false,
      target: target || '_self'
    };

    // Only add optional fields if they have values, or set to null if empty
    updateData.icon = (icon && icon.trim() !== '') ? icon : null;
    updateData.description = (description && description.trim() !== '') ? description : null;
    updateData.contactType = (contactType && contactType.trim() !== '') ? contactType : null;
    updateData.socialPlatform = (socialPlatform && socialPlatform.trim() !== '') ? socialPlatform : null;

    const menu = await Menu.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!menu) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Footer menu not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Footer menu updated successfully',
      data: menu
    });
  } catch (error) {
    console.error('Error updating footer menu:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.deleteFooterMenu = async (req, res) => {
  try {
    const { id } = req.params;

    const menu = await Menu.findByIdAndDelete(id);

    if (!menu) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Footer menu not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Footer menu deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting footer menu:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Bulk operations
exports.updateMenuOrder = async (req, res) => {
  try {
    const { menus } = req.body; // Array of { id, order }

    const updatePromises = menus.map(menu => 
      Menu.findByIdAndUpdate(menu.id, { order: menu.order })
    );

    await Promise.all(updatePromises);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Menu order updated successfully',
    });
  } catch (error) {
    console.error('Error updating menu order:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

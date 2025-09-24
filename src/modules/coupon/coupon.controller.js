const Coupon = require('./coupon.model');
const sendResponse = require('../../utils/sendResponse');

// Get all coupons (Admin only)
exports.getAllCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (status === 'active') {
      filter.isActive = true;
      filter.endDate = { $gt: new Date() };
    } else if (status === 'expired') {
      filter.endDate = { $lte: new Date() };
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const coupons = await Coupon.find(filter)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Coupon.countDocuments(filter);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Coupons fetched successfully',
      data: {
        coupons,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalCoupons: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message
    });
  }
};

// Get single coupon by ID (Admin only)
exports.getCouponById = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!coupon) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Coupon not found'
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Coupon fetched successfully',
      data: coupon
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message
    });
  }
};

// Validate coupon code (Public)
exports.validateCoupon = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;

    if (!code) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Coupon code is required'
      });
    }

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true,
      endDate: { $gt: new Date() }
    });

    if (!coupon) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Invalid or expired coupon code'
      });
    }

    // Check if coupon has reached max usage
    if (coupon.maxUsage && coupon.usedCount >= coupon.maxUsage) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Coupon usage limit exceeded'
      });
    }

    // Check minimum order amount
    if (orderAmount && coupon.minOrderAmount > orderAmount) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: `Minimum order amount of ৳${coupon.minOrderAmount} required`
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (orderAmount * coupon.discountValue) / 100;
    } else {
      discountAmount = coupon.discountValue;
    }

    // Round discount amount to nearest integer (0.5 and above rounds up, below 0.5 rounds down)
    discountAmount = Math.round(discountAmount);

    // Don't allow discount to exceed order amount
    discountAmount = Math.min(discountAmount, orderAmount);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Coupon is valid',
      data: {
        coupon: {
          id: coupon._id,
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          description: coupon.description
        },
        discountAmount,
        finalAmount: orderAmount - discountAmount
      }
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message
    });
  }
};

// Create new coupon (Admin only)
exports.createCoupon = async (req, res) => {
  try {
    const couponData = {
      ...req.body,
      code: req.body.code.toUpperCase(),
      createdBy: req.user._id
    };

    // Validate end date
    if (couponData.endDate && new Date(couponData.endDate) <= new Date()) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'End date must be in the future'
      });
    }

    // Validate discount value
    if (couponData.discountType === 'percentage' && couponData.discountValue > 100) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Percentage discount cannot exceed 100%'
      });
    }

    const coupon = new Coupon(couponData);
    await coupon.save();

    await coupon.populate('createdBy', 'name email');

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Coupon created successfully',
      data: coupon
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Coupon code already exists'
      });
    }
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message
    });
  }
};

// Update coupon (Admin only)
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updatedBy: req.user._id
    };

    // Convert code to uppercase if provided
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase();
    }

    // Validate end date
    if (updateData.endDate && new Date(updateData.endDate) <= new Date()) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'End date must be in the future'
      });
    }

    // Validate discount value
    if (updateData.discountType === 'percentage' && updateData.discountValue > 100) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Percentage discount cannot exceed 100%'
      });
    }

    const coupon = await Coupon.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
     .populate('updatedBy', 'name email');

    if (!coupon) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Coupon not found'
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Coupon updated successfully',
      data: coupon
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Coupon code already exists'
      });
    }
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message
    });
  }
};

// Delete coupon (Admin only)
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);

    if (!coupon) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Coupon not found'
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message
    });
  }
};

// Toggle coupon status (Admin only)
exports.toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Coupon not found'
      });
    }

    coupon.isActive = !coupon.isActive;
    coupon.updatedBy = req.user._id;
    await coupon.save();

    await coupon.populate('createdBy', 'name email');
    await coupon.populate('updatedBy', 'name email');

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      data: coupon
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message
    });
  }
};

// Increment coupon usage (Internal use)
exports.incrementCouponUsage = async (couponId) => {
  try {
    const coupon = await Coupon.findById(couponId);
    if (coupon) {
      coupon.usedCount += 1;
      await coupon.save();
      return { success: true };
    }
    return { success: false, message: 'Coupon not found' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};
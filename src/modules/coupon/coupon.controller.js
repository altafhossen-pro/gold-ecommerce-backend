const { Coupon } = require('./coupon.model');
const sendResponse = require('../../utils/sendResponse');

exports.createCoupon = async (req, res) => {
  try {
    const coupon = new Coupon(req.body);
    await coupon.save();
    return sendResponse({ res, statusCode: 201, success: true, message: 'Coupon created', data: coupon });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find();
    return sendResponse({ res, statusCode: 200, success: true, message: 'Coupons fetched', data: coupons });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return sendResponse({ res, statusCode: 404, success: false, message: 'Coupon not found' });
    return sendResponse({ res, statusCode: 200, success: true, message: 'Coupon fetched', data: coupon });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!coupon) return sendResponse({ res, statusCode: 404, success: false, message: 'Coupon not found' });
    return sendResponse({ res, statusCode: 200, success: true, message: 'Coupon updated', data: coupon });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return sendResponse({ res, statusCode: 404, success: false, message: 'Coupon not found' });
    return sendResponse({ res, statusCode: 200, success: true, message: 'Coupon deleted' });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.validateAndApplyCoupon = async (req, res) => {
  try {
    const { code, userId, orderAmount } = req.body;
    const coupon = await Coupon.findOne({ code, isActive: true });
    if (!coupon) return sendResponse({ res, statusCode: 404, success: false, message: 'Invalid or expired coupon' });
    const now = new Date();
    if ((coupon.validFrom && now < coupon.validFrom) || (coupon.validUntil && now > coupon.validUntil)) {
      return sendResponse({ res, statusCode: 400, success: false, message: 'Coupon not valid at this time' });
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return sendResponse({ res, statusCode: 400, success: false, message: 'Coupon usage limit reached' });
    }
    if (orderAmount < coupon.minOrderAmount) {
      return sendResponse({ res, statusCode: 400, success: false, message: `Minimum order amount is ${coupon.minOrderAmount}` });
    }
    // TODO: Check per-user usage if needed
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (orderAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount) discount = Math.min(discount, coupon.maxDiscountAmount);
    } else {
      discount = coupon.discountValue;
    }
    return sendResponse({ res, statusCode: 200, success: true, message: 'Coupon applied', data: { discount, coupon } });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

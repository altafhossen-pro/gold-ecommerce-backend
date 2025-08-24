const express = require('express');
const router = express.Router();
const couponController = require('./coupon.controller');

router.post('/', couponController.createCoupon);
router.get('/', couponController.getCoupons);
router.get('/:id', couponController.getCouponById);
router.put('/:id', couponController.updateCoupon);
router.delete('/:id', couponController.deleteCoupon);
router.post('/validate', couponController.validateAndApplyCoupon);

module.exports = router;

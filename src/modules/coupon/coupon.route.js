const express = require('express');
const router = express.Router();
const couponController = require('./coupon.controller');
const verifyToken = require('../../middlewares/verifyToken');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');

// Public routes
router.post('/validate', couponController.validateCoupon);
router.get('/public', couponController.getPublicCoupons);

// Admin routes (protected)
router.get('/', verifyToken, verifyTokenAdmin, couponController.getAllCoupons);
router.get('/:id', verifyToken, verifyTokenAdmin, couponController.getCouponById);
router.post('/', verifyToken, verifyTokenAdmin, couponController.createCoupon);
router.put('/:id', verifyToken, verifyTokenAdmin, couponController.updateCoupon);
router.delete('/:id', verifyToken, verifyTokenAdmin, couponController.deleteCoupon);
router.patch('/:id/toggle-status', verifyToken, verifyTokenAdmin, couponController.toggleCouponStatus);

module.exports = router;
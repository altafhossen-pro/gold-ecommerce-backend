const express = require('express');
const router = express.Router();

const userRoutes = require('../modules/user/user.route');
const categoryRoutes = require('../modules/category/category.route');
const productRoutes = require('../modules/product/product.route');
const couponRoutes = require('../modules/coupon/coupon.route');
const orderRoutes = require('../modules/order/order.route');
const reviewRoutes = require('../modules/review/review.route');
const loyaltyRoutes = require('../modules/loyalty/loyalty.route');
const offerBannerRoutes = require('../modules/offerBanner/offerBanner.route');
const adminAnalyticsRoutes = require('../modules/admin/analytics/analytics.route');
const adminUserRoutes = require('../modules/admin/user/user.route');
const uploadRoutes = require('../modules/upload/upload.route');

router.use('/user', userRoutes);
router.use('/category', categoryRoutes);
router.use('/product', productRoutes);
router.use('/coupon', couponRoutes);
router.use('/order', orderRoutes);
router.use('/review', reviewRoutes);
router.use('/loyalty', loyaltyRoutes);
router.use('/offer-banner', offerBannerRoutes);
router.use('/admin/analytics', adminAnalyticsRoutes);
router.use('/admin/user', adminUserRoutes);
router.use('/upload', uploadRoutes);

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Ecommerce Backend API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

module.exports = router;

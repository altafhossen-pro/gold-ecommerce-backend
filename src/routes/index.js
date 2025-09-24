const express = require('express');
const router = express.Router();

const userRoutes = require('../modules/user/user.route');
const otpRoutes = require('../modules/otp/otp.route');
const categoryRoutes = require('../modules/category/category.route');
const productRoutes = require('../modules/product/product.route');
const couponRoutes = require('../modules/coupon/coupon.route');
const orderRoutes = require('../modules/order/order.route');
const reviewRoutes = require('../modules/review/review.route');
const loyaltyRoutes = require('../modules/loyalty/loyalty.route');
const settingsRoutes = require('../modules/settings/settings.route');
const offerBannerRoutes = require('../modules/offerBanner/offerBanner.route');
const testimonialRoutes = require('../modules/testimonial/testimonial.route');
const adminAnalyticsRoutes = require('../modules/admin/analytics/analytics.route');
const adminUserRoutes = require('../modules/admin/user/user.route');
const uploadRoutes = require('../modules/upload/upload.route');
const menuRoutes = require('../modules/menu/menu.route');
const heroBannerRoutes = require('../modules/heroBanner/heroBanner.route');
const heroProductRoutes = require('../modules/heroProduct/heroProduct.route');

router.use('/user', userRoutes);
router.use('/otp', otpRoutes);
router.use('/category', categoryRoutes);
router.use('/product', productRoutes);
router.use('/coupon', couponRoutes);
router.use('/order', orderRoutes);
router.use('/review', reviewRoutes);
router.use('/loyalty', loyaltyRoutes);
router.use('/settings', settingsRoutes);
router.use('/offer-banner', offerBannerRoutes);
router.use('/testimonial', testimonialRoutes);
router.use('/admin/analytics', adminAnalyticsRoutes);
router.use('/admin/user', adminUserRoutes);
router.use('/upload', uploadRoutes);
router.use('/menu', menuRoutes);
router.use('/hero-banner', heroBannerRoutes);
router.use('/hero-product', heroProductRoutes);

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

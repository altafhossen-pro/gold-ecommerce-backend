const express = require('express');
const router = express.Router();
const offerBannerController = require('./offerBanner.controller');

// Public routes
router.get('/active', offerBannerController.getActiveBanners);
router.post('/:id/click', offerBannerController.trackBannerClick);

// Admin routes (without middleware for now - same as other routes)
router.get('/', offerBannerController.getAllBanners);
router.get('/:id', offerBannerController.getBannerById);
router.post('/', offerBannerController.createBanner);
router.put('/:id', offerBannerController.updateBanner);
router.delete('/:id', offerBannerController.deleteBanner);
router.patch('/:id/toggle-status', offerBannerController.toggleBannerStatus);

module.exports = router;

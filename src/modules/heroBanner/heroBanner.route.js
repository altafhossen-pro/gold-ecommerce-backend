const express = require('express');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');
const heroBannerController = require('./heroBanner.controller');
const router = express.Router();

// Public routes (no authentication required)
router.get('/', heroBannerController.getHeroBanners);

// Admin routes (authentication required)
router.get('/admin', verifyTokenAdmin, heroBannerController.getAllHeroBanners);
router.post('/', verifyTokenAdmin, heroBannerController.createHeroBanner);
router.put('/:id', verifyTokenAdmin, heroBannerController.updateHeroBanner);
router.delete('/:id', verifyTokenAdmin, heroBannerController.deleteHeroBanner);
router.put('/order/update', verifyTokenAdmin, heroBannerController.updateBannerOrder);

module.exports = router;

const express = require('express');
const router = express.Router();
const adsController = require('./ads.controller');
const verifyToken = require('../../middlewares/verifyToken');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');

// Public routes (no authentication required)
router.get('/active', adsController.getActiveAds);
router.post('/track-click/:id', adsController.trackAdClick);
router.post('/track-view/:id', adsController.trackAdView);

// Admin routes (authentication required)
router.post('/', verifyToken, verifyTokenAdmin, adsController.createAd);
router.get('/', verifyToken, verifyTokenAdmin, adsController.getAllAds);
router.get('/stats', verifyToken, verifyTokenAdmin, adsController.getAdsStats);
router.get('/:id', verifyToken, verifyTokenAdmin, adsController.getAdById);
router.put('/:id', verifyToken, verifyTokenAdmin, adsController.updateAd);
router.delete('/:id', verifyToken, verifyTokenAdmin, adsController.deleteAd);
router.patch('/:id/toggle-status', verifyToken, verifyTokenAdmin, adsController.toggleAdStatus);

module.exports = router;

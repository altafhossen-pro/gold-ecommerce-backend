const express = require('express');
const router = express.Router();
const affiliateController = require('./affiliate.controller');
const verifyToken = require('../../middlewares/verifyToken');

// Create or get affiliate (requires authentication)
router.get('/', verifyToken, affiliateController.createOrGetAffiliate);

// Get affiliate stats (requires authentication)
router.get('/stats', verifyToken, affiliateController.getAffiliateStats);

// Track affiliate click (public - no auth required)
router.post('/track/:affiliateCode', affiliateController.trackAffiliateClick);

module.exports = router;


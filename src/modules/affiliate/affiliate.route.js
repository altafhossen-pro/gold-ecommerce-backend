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

// Check if user has already used an affiliate code (requires authentication)
router.get('/check/:affiliateCode', affiliateController.checkAffiliateCodeUsage);

// Check if guest user has already used an affiliate code (by phone number - no auth required)
router.post('/check-guest', affiliateController.checkGuestAffiliateCodeUsage);

module.exports = router;


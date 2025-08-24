const express = require('express');
const router = express.Router();
const loyaltyController = require('./loyalty.controller');

router.get('/', loyaltyController.getLoyalty);
router.post('/earn', loyaltyController.earnPoints);
router.post('/redeem', loyaltyController.redeemPoints);
router.get('/history', loyaltyController.getHistory);
router.post('/adjust', loyaltyController.adjustPoints);

module.exports = router;

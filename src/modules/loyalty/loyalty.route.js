const express = require('express');
const router = express.Router();
const loyaltyController = require('./loyalty.controller');
const verifyToken = require('../../middlewares/verifyToken');

router.get('/', verifyToken, loyaltyController.getLoyalty);
router.post('/earn', verifyToken, loyaltyController.earnPoints);
router.post('/redeem', verifyToken, loyaltyController.redeemPoints);
router.get('/history', verifyToken, loyaltyController.getHistory);
router.post('/adjust', verifyToken, loyaltyController.adjustPoints);

// New route for coin redemption during checkout
router.post('/redeem-coins', verifyToken, loyaltyController.redeemCoinsForCheckout);

module.exports = router;

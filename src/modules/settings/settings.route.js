const express = require('express');
const router = express.Router();
const settingsController = require('./settings.controller');
const verifyToken = require('../../middlewares/verifyToken');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');

// Get settings (public)
router.get('/', settingsController.getSettings);

// Update settings (Admin only)
router.put('/', verifyToken, verifyTokenAdmin, settingsController.updateSettings);

// Reset settings (Admin only)
router.post('/reset', verifyToken, verifyTokenAdmin, settingsController.resetSettings);

// Loyalty settings endpoints
router.get('/loyalty', settingsController.getLoyaltySettings);
router.put('/loyalty', verifyToken, verifyTokenAdmin, settingsController.updateLoyaltySettings);

// Delivery charge settings endpoints
router.get('/delivery-charge', settingsController.getDeliveryChargeSettings);
router.put('/delivery-charge', verifyToken, verifyTokenAdmin, settingsController.updateDeliveryChargeSettings);

module.exports = router;

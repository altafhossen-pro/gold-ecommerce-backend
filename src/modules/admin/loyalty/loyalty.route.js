const express = require('express');
const router = express.Router();
const loyaltyController = require('./loyalty.controller');
const verifyTokenAdmin = require('../../../middlewares/verifyTokenAdmin');

// Apply admin authentication to all routes
router.use(verifyTokenAdmin);

// Get user loyalty data
router.get('/user/:userId', loyaltyController.getUserLoyalty);

// Get all users with loyalty data
router.get('/users', loyaltyController.getAllUsersLoyalty);

// Get user loyalty history
router.get('/user/:userId/history', loyaltyController.getUserLoyaltyHistory);

// Admin add coins to user
router.post('/add-coins', loyaltyController.addCoinsToUser);

module.exports = router;
